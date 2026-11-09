// tests/unit/dns-cli.test.ts
// Unit tests for PromptFM Hostinger DNS & Domain Migration CLI command handling.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as hostingerDns from '@/lib/infra/hostinger-dns';

describe('PromptFM Hostinger DNS & Domain Migration CLI', () => {
  const sampleZone: hostingerDns.HostingerDNSRecord[] = [
    {
      name: 'stream',
      type: 'CNAME',
      ttl: 300,
      records: [{ content: 'promptfm-tunnel.cfargotunnel.com.' }],
    },
    {
      name: '_dmarc',
      type: 'TXT',
      ttl: 300,
      records: [{ content: '"v=DMARC1; rua=mailto:contact@promptfm.live"' }],
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates migration plan correctly for target domain', () => {
    const migrated = hostingerDns.migrateZoneConfig(sampleZone, 'promptfm.live', 'promptfm.com');
    const diffs = hostingerDns.diffZone(sampleZone, migrated);
    const summary = hostingerDns.formatMigrationSummary({
      sourceDomain: 'promptfm.live',
      targetDomain: 'promptfm.com',
      plannedRecords: migrated,
      diffs,
    });

    expect(summary).toContain('promptfm.live');
    expect(summary).toContain('promptfm.com');
    expect(migrated[1]?.records[0]?.content).toContain('contact@promptfm.com');
  });

  it('validates all planned records before migration apply', () => {
    const invalidZone: hostingerDns.HostingerDNSRecord[] = [
      {
        name: 'bad',
        type: 'INVALID' as any,
        ttl: 300,
        records: [{ content: 'test' }],
      },
    ];

    const results = invalidZone.map((r) => hostingerDns.validateRecord(r));
    expect(results.some((r) => !r.valid)).toBe(true);

    const validResults = sampleZone.map((r) => hostingerDns.validateRecord(r));
    expect(validResults.every((r) => r.valid)).toBe(true);
  });

  it('calculates diff accurately between state and target domain', () => {
    const targetZone: hostingerDns.HostingerDNSRecord[] = [
      {
        name: 'stream',
        type: 'A',
        ttl: 300,
        records: [{ content: '34.123.80.137' }],
      },
    ];

    const diffs = hostingerDns.diffZone(targetZone, sampleZone);
    const streamDiff = diffs.find((d) => d.name === 'stream' && d.type === 'CNAME');
    const oldStreamDiff = diffs.find((d) => d.name === 'stream' && d.type === 'A');

    expect(streamDiff?.action).toBe('create');
    expect(oldStreamDiff?.action).toBe('delete');
  });

  it('audits the stream record: it must not point at the legacy GCP VM', () => {
    const gcpZone: hostingerDns.HostingerDNSRecord[] = [
      { name: 'stream', type: 'A', ttl: 300, records: [{ content: '34.123.80.137' }] },
    ];
    const gcpCheck = hostingerDns.validateZeroEgressCompliance(gcpZone);
    expect(gcpCheck.compliant).toBe(false);
    expect(gcpCheck.risk).toBe('direct_vm_egress');
    expect(gcpCheck.recordType).toBe('A');
    expect(gcpCheck.target).toBe('34.123.80.137');
    expect(gcpCheck.message).toContain('points at the GCP VM (34.123.80.137)');

    const oracleZone: hostingerDns.HostingerDNSRecord[] = [
      { name: 'stream', type: 'A', ttl: 300, records: [{ content: '129.80.56.27' }] },
    ];
    const oracleCheck = hostingerDns.validateZeroEgressCompliance(oracleZone);
    expect(oracleCheck.compliant).toBe(true);
    expect(oracleCheck.risk).toBe('none');
    expect(oracleCheck.recordType).toBe('A');
    expect(oracleCheck.target).toBe('129.80.56.27');
    expect(oracleCheck.message).toContain('not the GCP VM');

    const validCheck = hostingerDns.validateZeroEgressCompliance(sampleZone);
    expect(validCheck.compliant).toBe(true);
    expect(validCheck.risk).toBe('none');
    expect(validCheck.recordType).toBe('CNAME');
  });

  it('treats any record that matches a GCP VM address as a leak, ignoring whitespace and the order', () => {
    const mixed: hostingerDns.HostingerDNSRecord[] = [
      {
        name: 'stream',
        type: 'A',
        ttl: 300,
        records: [{ content: '129.80.56.27' }, { content: ' 34.123.80.137 ' }],
      },
    ];
    expect(hostingerDns.validateZeroEgressCompliance(mixed).compliant).toBe(false);

    const padded: hostingerDns.HostingerDNSRecord[] = [
      { name: 'stream', type: 'A', ttl: 300, records: [{ content: '  34.123.80.137  ' }] },
    ];
    const check = hostingerDns.validateZeroEgressCompliance(padded);
    expect(check.compliant).toBe(false);
    expect(check.target).toBe('34.123.80.137');
  });

  it('accepts a custom list of GCP VM addresses and a custom stream subdomain, case-insensitively', () => {
    const zone: hostingerDns.HostingerDNSRecord[] = [
      { name: 'Radio', type: 'A', ttl: 300, records: [{ content: '10.0.0.9' }] },
    ];
    expect(hostingerDns.validateZeroEgressCompliance(zone, 'radio', ['10.0.0.9']).compliant).toBe(false);
    expect(hostingerDns.validateZeroEgressCompliance(zone, 'RADIO', ['10.0.0.1']).compliant).toBe(true);
    expect(hostingerDns.LEGACY_GCP_STREAM_VM_IPS).toContain('34.123.80.137');
  });

  it('reports a missing stream record and unexpected record types', () => {
    const missing = hostingerDns.validateZeroEgressCompliance([
      { name: 'www', type: 'CNAME', ttl: 300, records: [{ content: 'x.vercel-dns-017.com.' }] },
    ]);
    expect(missing.compliant).toBe(false);
    expect(missing.risk).toBe('missing_stream_record');
    expect(missing.message).toContain('missing from DNS zone');

    const odd = hostingerDns.validateZeroEgressCompliance([
      { name: 'stream', type: 'TXT', ttl: 300, records: [{ content: '"hi"' }] },
    ]);
    expect(odd.compliant).toBe(false);
    expect(odd.recordType).toBe('TXT');
    expect(odd.message).toContain('unexpected record type TXT');
  });

  it('exposes lint:dns script in package.json targeting strict DNS status check', () => {
    const pkg = JSON.parse(
      require('fs').readFileSync(require('path').resolve(__dirname, '../../package.json'), 'utf8')
    );
    expect(pkg.scripts['lint:dns']).toBeDefined();
    expect(pkg.scripts['lint:dns']).toContain('dns status promptfm.live --strict');
  });

  describe('resolveHostingerToken()', () => {
    const origEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...origEnv };
      delete process.env.HOSTINGER_API_TOKEN;
      delete process.env.HOSTINGER_TOKEN;
    });

    afterEach(() => {
      process.env = { ...origEnv };
    });

    it('returns explicit token when provided', () => {
      expect(hostingerDns.resolveHostingerToken('explicit-token')).toBe('explicit-token');
    });

    it('returns HOSTINGER_API_TOKEN from environment when set', () => {
      process.env.HOSTINGER_API_TOKEN = 'env-token-123';
      expect(hostingerDns.resolveHostingerToken()).toBe('env-token-123');
    });

    it('falls back to Google Cloud Secret Manager when environment and local creds are empty', () => {
      process.env.HOME = '/tmp/non-existent-home-dir';
      process.env.USERPROFILE = '/tmp/non-existent-home-dir';

      const childProcess = require('child_process');
      const spy = vi.spyOn(childProcess, 'execSync').mockReturnValue('gcp-token-xyz\n');

      const token = hostingerDns.resolveHostingerToken();
      expect(token).toBe('gcp-token-xyz');
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('gcloud secrets versions access latest --secret=promptfm-hostinger-api-token'),
        expect.anything()
      );
    });
  });
});
