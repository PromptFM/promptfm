// src/lib/infra/hostinger-dns.ts
// Declarative Hostinger DNS State Management, Zone Diffing, Validation, and Domain Migration Engine.

import * as fs from 'fs';
import * as path from 'path';

export type HostingerRecordType =
  | 'A'
  | 'AAAA'
  | 'CNAME'
  | 'ALIAS'
  | 'MX'
  | 'TXT'
  | 'NS'
  | 'SOA'
  | 'SRV'
  | 'CAA';

export const ALLOWED_RECORD_TYPES: HostingerRecordType[] = [
  'A',
  'AAAA',
  'CNAME',
  'ALIAS',
  'MX',
  'TXT',
  'NS',
  'SOA',
  'SRV',
  'CAA',
];

export interface HostingerDNSRecordItem {
  content: string;
  is_disabled?: boolean;
}

export interface HostingerDNSRecord {
  name: string;
  type: HostingerRecordType;
  ttl: number;
  records: HostingerDNSRecordItem[];
}

export interface DNSZoneState {
  domain: string;
  updatedAt: string;
  version: number;
  zone: HostingerDNSRecord[];
}

export interface DNSDiffItem {
  name: string;
  type: HostingerRecordType;
  action: 'create' | 'update' | 'delete' | 'unchanged';
  currentRecords?: HostingerDNSRecordItem[];
  desiredRecords?: HostingerDNSRecordItem[];
  currentTtl?: number;
  desiredTtl?: number;
}

export interface DNSMigrationPlan {
  sourceDomain: string;
  targetDomain: string;
  plannedRecords: HostingerDNSRecord[];
  diffs: DNSDiffItem[];
}

export interface ZeroEgressComplianceResult {
  compliant: boolean;
  risk: 'none' | 'direct_vm_egress' | 'missing_stream_record';
  message: string;
  recordType?: HostingerRecordType;
  target?: string;
}

/**
 * The GCP VM that used to serve the stream. GCP only includes 1 GB/month of outbound traffic and one
 * 128 kbps listener is about 41 GB/month, so listeners must not be served from here.
 */
export const LEGACY_GCP_STREAM_VM_IPS: readonly string[] = ['34.123.80.137'];

/**
 * Validates that the stream subdomain does not send listeners to the GCP VM (Issues #127, #150).
 * An A record to any other host (the Oracle Always Free VM) or a CNAME is fine.
 */
export function validateZeroEgressCompliance(
  zone: HostingerDNSRecord[],
  streamSubdomain: string = 'stream',
  gcpVmIps: readonly string[] = LEGACY_GCP_STREAM_VM_IPS
): ZeroEgressComplianceResult {
  const streamRecord = zone.find(
    (r) => r.name.toLowerCase() === streamSubdomain.toLowerCase()
  );

  if (!streamRecord) {
    return {
      compliant: false,
      risk: 'missing_stream_record',
      message: `Stream subdomain "${streamSubdomain}" is missing from DNS zone.`,
    };
  }

  const contents = (streamRecord.records ?? []).map((r) => r.content.trim());
  const primaryContent = contents[0] || '';

  if (streamRecord.type === 'A') {
    const gcpIp = contents.find((c) => gcpVmIps.includes(c));
    if (gcpIp) {
      return {
        compliant: false,
        risk: 'direct_vm_egress',
        recordType: 'A',
        target: gcpIp,
        message: `Stream subdomain "${streamSubdomain}" points at the GCP VM (${gcpIp}). GCP only includes 1 GB/month of outbound traffic, so listener traffic would be billed.`,
      };
    }

    return {
      compliant: true,
      risk: 'none',
      recordType: 'A',
      target: primaryContent,
      message: `Stream subdomain "${streamSubdomain}" points at ${primaryContent}, not the GCP VM.`,
    };
  }

  if (streamRecord.type === 'CNAME') {
    return {
      compliant: true,
      risk: 'none',
      recordType: 'CNAME',
      target: primaryContent,
      message: `Stream subdomain "${streamSubdomain}" routes through ${primaryContent}, not the GCP VM.`,
    };
  }

  return {
    compliant: false,
    risk: 'direct_vm_egress',
    recordType: streamRecord.type,
    target: primaryContent,
    message: `Stream subdomain "${streamSubdomain}" uses unexpected record type ${streamRecord.type}. Expected an A record to the stream host or a CNAME.`,
  };
}

/**
 * Validates a single DNS record against Hostinger standards and limits.
 */
export function validateRecord(record: HostingerDNSRecord): { valid: boolean; error?: string } {
  if (!record.name || typeof record.name !== 'string' || record.name.trim() === '') {
    return { valid: false, error: 'Record name cannot be empty' };
  }

  if (!ALLOWED_RECORD_TYPES.includes(record.type)) {
    return {
      valid: false,
      error: `Unsupported record type "${record.type}". Supported types: ${ALLOWED_RECORD_TYPES.join(', ')}`,
    };
  }

  if (typeof record.ttl !== 'number' || record.ttl < 60 || record.ttl > 86400) {
    return {
      valid: false,
      error: `Invalid TTL ${record.ttl}. TTL must be between 60 and 86400 seconds.`,
    };
  }

  if (!Array.isArray(record.records) || record.records.length === 0) {
    return {
      valid: false,
      error: `Record "${record.name}" must contain at least one content item.`,
    };
  }

  for (const item of record.records) {
    if (!item.content || typeof item.content !== 'string' || item.content.trim() === '') {
      return {
        valid: false,
        error: `Record item content in "${record.name}" cannot be empty.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Normalizes records list for comparison: sorted contents and trimmed whitespace.
 */
function normalizeRecordItems(items: HostingerDNSRecordItem[]): string {
  return items
    .map((item) => item.content.trim())
    .sort()
    .join('||');
}

/**
 * Computes difference between current remote DNS zone and desired DNS zone.
 */
export function diffZone(
  currentZone: HostingerDNSRecord[],
  desiredZone: HostingerDNSRecord[]
): DNSDiffItem[] {
  const diffs: DNSDiffItem[] = [];

  const currentMap = new Map<string, HostingerDNSRecord>();
  for (const rec of currentZone) {
    const key = `${rec.name.toLowerCase()}::${rec.type}`;
    currentMap.set(key, rec);
  }

  const desiredMap = new Map<string, HostingerDNSRecord>();
  for (const rec of desiredZone) {
    const key = `${rec.name.toLowerCase()}::${rec.type}`;
    desiredMap.set(key, rec);
  }

  // 1. Process desired records (create, update, or unchanged)
  for (const [key, desired] of desiredMap.entries()) {
    const current = currentMap.get(key);
    if (!current) {
      diffs.push({
        name: desired.name,
        type: desired.type,
        action: 'create',
        desiredRecords: desired.records,
        desiredTtl: desired.ttl,
      });
    } else {
      const currentNorm = normalizeRecordItems(current.records);
      const desiredNorm = normalizeRecordItems(desired.records);
      const isContentSame = currentNorm === desiredNorm;
      const isTtlSame = current.ttl === desired.ttl;

      if (isContentSame && isTtlSame) {
        diffs.push({
          name: desired.name,
          type: desired.type,
          action: 'unchanged',
          currentRecords: current.records,
          desiredRecords: desired.records,
          currentTtl: current.ttl,
          desiredTtl: desired.ttl,
        });
      } else {
        diffs.push({
          name: desired.name,
          type: desired.type,
          action: 'update',
          currentRecords: current.records,
          desiredRecords: desired.records,
          currentTtl: current.ttl,
          desiredTtl: desired.ttl,
        });
      }
    }
  }

  // 2. Identify records present in current but absent in desired (delete)
  for (const [key, current] of currentMap.entries()) {
    if (!desiredMap.has(key)) {
      diffs.push({
        name: current.name,
        type: current.type,
        action: 'delete',
        currentRecords: current.records,
        currentTtl: current.ttl,
      });
    }
  }

  return diffs;
}

/**
 * Safely replaces all occurrences of a search string case-insensitively without regex.
 * Prevents ReDoS, regex injection, and incomplete character escaping (CWE-020, CWE-400).
 */
export function replaceCaseInsensitive(str: string, search: string, replacement: string): string {
  if (!str || !search) {
    return str;
  }
  let result = '';
  let startIndex = 0;
  const lowerStr = str.toLowerCase();
  const lowerSearch = search.toLowerCase();

  while (startIndex < str.length) {
    const index = lowerStr.indexOf(lowerSearch, startIndex);
    if (index === -1) {
      result += str.slice(startIndex);
      break;
    }
    result += str.slice(startIndex, index) + replacement;
    startIndex = index + search.length;
  }
  return result;
}

/**
 * Migrates a DNS zone configuration from one domain to another by substituting domain names.
 */
export function migrateZoneConfig(
  sourceZone: HostingerDNSRecord[],
  sourceDomain: string,
  targetDomain: string
): HostingerDNSRecord[] {
  const cleanSource = sourceDomain.trim().toLowerCase();
  const cleanTarget = targetDomain.trim().toLowerCase();

  if (!cleanSource || !cleanTarget) {
    return sourceZone;
  }

  return sourceZone.map((record) => {
    const updatedRecords = record.records.map((item) => ({
      ...item,
      content: replaceCaseInsensitive(item.content, cleanSource, cleanTarget),
    }));

    return {
      ...record,
      records: updatedRecords,
    };
  });
}

/**
 * Creates a versioned snapshot of the DNS zone state.
 */
export function createZoneState(
  domain: string,
  zone: HostingerDNSRecord[],
  version = 1
): DNSZoneState {
  return {
    domain: domain.trim().toLowerCase(),
    updatedAt: new Date().toISOString(),
    version,
    zone: JSON.parse(JSON.stringify(zone)),
  };
}

/**
 * Saves a zone state snapshot to disk as JSON.
 */
export function saveZoneState(filePath: string, state: DNSZoneState): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Loads a zone state snapshot from disk.
 */
export function loadZoneState(filePath: string): DNSZoneState {
  if (!fs.existsSync(filePath)) {
    throw new Error(`DNS state file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as DNSZoneState;
}

/**
 * Formats a terminal-friendly summary of a migration plan.
 */
export function formatMigrationSummary(plan: DNSMigrationPlan): string {
  const creates = plan.diffs.filter((d) => d.action === 'create').length;
  const updates = plan.diffs.filter((d) => d.action === 'update').length;
  const deletes = plan.diffs.filter((d) => d.action === 'delete').length;
  const unchanged = plan.diffs.filter((d) => d.action === 'unchanged').length;

  const lines = [
    '======================================================================',
    `🌐 DNS Migration Plan: [${plan.sourceDomain}] ➔ [${plan.targetDomain}]`,
    '======================================================================',
    `• Records Planned:   ${plan.plannedRecords.length}`,
    `• To Create (+):     ${creates}`,
    `• To Update (~):     ${updates}`,
    `• To Delete (-):     ${deletes}`,
    `• Unchanged (=):     ${unchanged}`,
    '----------------------------------------------------------------------',
    'Planned Changes by Record:',
  ];

  for (const diff of plan.diffs) {
    const symbol =
      diff.action === 'create'
        ? '+'
        : diff.action === 'update'
        ? '~'
        : diff.action === 'delete'
        ? '-'
        : '=';
    lines.push(`  [${symbol}] ${diff.action.toUpperCase().padEnd(9)} ${diff.type.padEnd(6)} ${diff.name}`);
    if (diff.desiredRecords) {
      for (const rec of diff.desiredRecords) {
        lines.push(`      ➔ ${rec.content}`);
      }
    }
  }

  lines.push('======================================================================');
  return lines.join('\n');
}

export const HOSTINGER_API_BASE =
  process.env.HOSTINGER_API_BASE || 'https://developers.hostinger.com/api/dns/v1';

/**
 * Resolves the Hostinger API token from:
 * 1. Explicit argument
 * 2. HOSTINGER_API_TOKEN or HOSTINGER_TOKEN environment variables
 * 3. Fallback to local IDE OAuth credentials in ~/.config/hostinger-mcp/credentials.json
 */
export function resolveHostingerToken(explicitToken?: string): string {
  if (explicitToken !== undefined) {
    return explicitToken.trim();
  }
  if (process.env.HOSTINGER_API_TOKEN && process.env.HOSTINGER_API_TOKEN.trim() !== '') {
    return process.env.HOSTINGER_API_TOKEN.trim();
  }
  if (process.env.HOSTINGER_TOKEN && process.env.HOSTINGER_TOKEN.trim() !== '') {
    return process.env.HOSTINGER_TOKEN.trim();
  }

  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (homeDir) {
      const credsPath = path.join(homeDir, '.config/hostinger-mcp/credentials.json');
      if (fs.existsSync(credsPath)) {
        const raw = fs.readFileSync(credsPath, 'utf8');
        const data = JSON.parse(raw);
        if (data && typeof data.access_token === 'string' && data.access_token.trim() !== '') {
          return data.access_token.trim();
        }
      }
    }
  } catch {
    // Ignore credentials read errors and fall through
  }

  // Fallback to Google Cloud Secret Manager (promptfm-hostinger-api-token)
  try {
    const { execSync } = require('child_process');
    const secret = execSync(
      'gcloud secrets versions access latest --secret=promptfm-hostinger-api-token --project=promptfm-radio-1793623670',
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }
    ).trim();
    if (secret) {
      return secret;
    }
  } catch {
    // Ignore gcloud resolution errors
  }

  return '';
}

/**
 * Fetches the current DNS zone records for a domain from Hostinger REST API.
 */
export async function fetchRemoteZone(
  domain: string,
  apiToken = resolveHostingerToken()
): Promise<HostingerDNSRecord[]> {
  const token = resolveHostingerToken(apiToken);
  if (!token) {
    throw new Error('Hostinger API token is required (HOSTINGER_API_TOKEN).');
  }

  const url = `${HOSTINGER_API_BASE}/zones/${encodeURIComponent(domain.trim())}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(
      `Hostinger API error (${res.status} ${res.statusText}): ${errorText || 'Failed to fetch DNS records'}`
    );
  }

  const data = (await res.json()) as HostingerDNSRecord[];
  return data;
}

/**
 * Validates a DNS zone against Hostinger API before applying.
 */
export async function validateRemoteZone(
  domain: string,
  zone: HostingerDNSRecord[],
  apiToken = resolveHostingerToken()
): Promise<{ valid: boolean; error?: string }> {
  const token = resolveHostingerToken(apiToken);
  if (!token) {
    throw new Error('Hostinger API token is required (HOSTINGER_API_TOKEN).');
  }

  const url = `${HOSTINGER_API_BASE}/zones/${encodeURIComponent(domain.trim())}/validate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      overwrite: true,
      zone,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    return {
      valid: false,
      error: `Validation failed (${res.status}): ${errorText}`,
    };
  }

  return { valid: true };
}

/**
 * Applies a desired DNS zone configuration to a Hostinger domain.
 */
export async function applyRemoteZone(
  domain: string,
  zone: HostingerDNSRecord[],
  apiToken = resolveHostingerToken(),
  overwrite = true
): Promise<{ success: boolean; data?: unknown }> {
  const token = resolveHostingerToken(apiToken);
  if (!token) {
    throw new Error('Hostinger API token is required (HOSTINGER_API_TOKEN).');
  }

  const url = `${HOSTINGER_API_BASE}/zones/${encodeURIComponent(domain.trim())}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      overwrite,
      zone,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(
      `Hostinger API error (${res.status} ${res.statusText}): ${errorText || 'Failed to update DNS records'}`
    );
  }

  const data = await res.json().catch(() => ({}));
  return { success: true, data };
}
