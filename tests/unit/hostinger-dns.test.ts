// tests/unit/hostinger-dns.test.ts
// Unit tests for Hostinger DNS state management, domain migration, diff planning, and validation.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  validateRecord,
  diffZone,
  replaceCaseInsensitive,
  migrateZoneConfig,
  createZoneState,
  formatMigrationSummary,
  saveZoneState,
  loadZoneState,
  fetchRemoteZone,
  validateRemoteZone,
  applyRemoteZone,
  ALLOWED_RECORD_TYPES,
  type HostingerDNSRecord,
  type HostingerRecordType,
  type DNSZoneState,
} from '@/lib/infra/hostinger-dns';

describe('Hostinger DNS State Management & Domain Migration Engine', () => {
  const sampleLiveZone: HostingerDNSRecord[] = [
    {
      name: 'stream',
      type: 'A',
      ttl: 300,
      records: [{ content: '34.123.80.137', is_disabled: false }],
    },
    {
      name: 'www',
      type: 'CNAME',
      ttl: 300,
      records: [{ content: '17b314bad0a79a1d.vercel-dns-017.com.', is_disabled: false }],
    },
    {
      name: '_dmarc',
      type: 'TXT',
      ttl: 300,
      records: [{ content: '"v=DMARC1; p=none; sp=none; rua=mailto:contact@promptfm.live"', is_disabled: false }],
    },
    {
      name: '@',
      type: 'TXT',
      ttl: 300,
      records: [
        { content: '"google-site-verification=JyC0MUsTb-PI8ssnpZsCcwmWCw-BxPvn7S07-2FDHRA"', is_disabled: false },
        { content: '"v=spf1 include:amazonses.com ~all"', is_disabled: false },
      ],
    },
    {
      name: '@',
      type: 'MX',
      ttl: 300,
      records: [
        { content: '9 receive-euw1.forge.rmta.net.', is_disabled: false },
        { content: '10 feedback.resend.com.', is_disabled: false },
      ],
    },
    {
      name: '@',
      type: 'A',
      ttl: 300,
      records: [
        { content: '216.198.79.1', is_disabled: false },
        { content: '64.29.17.1', is_disabled: false },
      ],
    },
  ];

  describe('validateRecord()', () => {
    it('approves all allowed record types', () => {
      const types: HostingerRecordType[] = [
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

      expect(ALLOWED_RECORD_TYPES).toEqual(types);

      for (const t of types) {
        const record: HostingerDNSRecord = {
          name: 'test',
          type: t,
          ttl: 300,
          records: [{ content: 'val' }],
        };
        const res = validateRecord(record);
        expect(res.valid).toBe(true);
      }
    });

    it('rejects unsupported DNS record types', () => {
      const invalid = {
        name: 'bad',
        type: 'INVALID_TYPE' as any,
        ttl: 300,
        records: [{ content: '1.2.3.4' }],
      };
      const res = validateRecord(invalid);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/unsupported record type/i);
    });

    it('validates exact TTL boundary conditions (60 to 86400)', () => {
      const testTtl = (ttl: number) =>
        validateRecord({
          name: 'stream',
          type: 'A',
          ttl,
          records: [{ content: '1.1.1.1' }],
        });

      // Valid boundary values
      expect(testTtl(60).valid).toBe(true);
      expect(testTtl(86400).valid).toBe(true);
      expect(testTtl(300).valid).toBe(true);

      // Invalid boundary values
      expect(testTtl(59).valid).toBe(false);
      expect(testTtl(59).error).toMatch(/TTL must be between 60 and 86400/i);
      expect(testTtl(86401).valid).toBe(false);
      expect(testTtl(86401).error).toMatch(/TTL must be between 60 and 86400/i);
      expect(testTtl('300' as any).valid).toBe(false);
    });

    it('rejects empty name or whitespace-only name', () => {
      expect(
        validateRecord({
          name: '',
          type: 'A',
          ttl: 300,
          records: [{ content: '1.1.1.1' }],
        }).valid
      ).toBe(false);

      expect(
        validateRecord({
          name: '   ',
          type: 'A',
          ttl: 300,
          records: [{ content: '1.1.1.1' }],
        }).error
      ).toMatch(/Record name cannot be empty/i);

      expect(
        validateRecord({
          name: null as any,
          type: 'A',
          ttl: 300,
          records: [{ content: '1.1.1.1' }],
        }).valid
      ).toBe(false);
    });

    it('rejects empty record item content or non-array records', () => {
      expect(
        validateRecord({
          name: 'test',
          type: 'A',
          ttl: 300,
          records: [{ content: '' }],
        }).error
      ).toMatch(/Record item content in "test" cannot be empty/i);

      expect(
        validateRecord({
          name: 'test',
          type: 'A',
          ttl: 300,
          records: [{ content: '   ' }],
        }).error
      ).toMatch(/Record item content in "test" cannot be empty/i);

      expect(
        validateRecord({
          name: 'test',
          type: 'A',
          ttl: 300,
          records: [{ content: 123 as any }],
        }).error
      ).toMatch(/Record item content in "test" cannot be empty/i);

      expect(
        validateRecord({
          name: 'test',
          type: 'A',
          ttl: 300,
          records: [],
        }).error
      ).toMatch(/must contain at least one content item/i);

      expect(
        validateRecord({
          name: 'test',
          type: 'A',
          ttl: 300,
          records: 'invalid' as any,
        }).error
      ).toMatch(/must contain at least one content item/i);
    });
  });

  describe('diffZone()', () => {
    it('detects unchanged records when zones are identical', () => {
      const diffs = diffZone(sampleLiveZone, sampleLiveZone);
      expect(diffs.length).toBe(sampleLiveZone.length);
      expect(diffs.every((d) => d.action === 'unchanged')).toBe(true);
      expect(diffs[0]!.currentTtl).toBe(300);
      expect(diffs[0]!.desiredTtl).toBe(300);
    });

    it('identifies new records to create', () => {
      const current = sampleLiveZone.filter((r) => r.name !== 'stream');
      const diffs = diffZone(current, sampleLiveZone);
      const streamDiff = diffs.find((d) => d.name === 'stream' && d.type === 'A');
      expect(streamDiff?.action).toBe('create');
      expect(streamDiff?.desiredTtl).toBe(300);
      expect(streamDiff?.desiredRecords?.[0]?.content).toBe('34.123.80.137');
    });

    it('identifies records to delete when absent from desired', () => {
      const desired = sampleLiveZone.filter((r) => r.name !== 'www');
      const diffs = diffZone(sampleLiveZone, desired);
      const wwwDiff = diffs.find((d) => d.name === 'www');
      expect(wwwDiff?.action).toBe('delete');
      expect(wwwDiff?.currentRecords?.[0]?.content).toBe('17b314bad0a79a1d.vercel-dns-017.com.');
      expect(wwwDiff?.currentTtl).toBe(300);
    });

    it('detects updates when TTL changes but content is identical', () => {
      const modified: HostingerDNSRecord[] = sampleLiveZone.map((r) => {
        if (r.name === 'www') {
          return { ...r, ttl: 600 };
        }
        return r;
      });

      const diffs = diffZone(sampleLiveZone, modified);
      const wwwDiff = diffs.find((d) => d.name === 'www');
      expect(wwwDiff?.action).toBe('update');
      expect(wwwDiff?.currentTtl).toBe(300);
      expect(wwwDiff?.desiredTtl).toBe(600);
    });

    it('detects updates when content order or items change', () => {
      const modified: HostingerDNSRecord[] = sampleLiveZone.map((r) => {
        if (r.name === '_dmarc') {
          return {
            ...r,
            records: [{ content: '"v=DMARC1; p=reject; rua=mailto:security@promptfm.live"', is_disabled: false }],
          };
        }
        return r;
      });

      const diffs = diffZone(sampleLiveZone, modified);
      const dmarcDiff = diffs.find((d) => d.name === '_dmarc');
      expect(dmarcDiff?.action).toBe('update');
      expect(dmarcDiff?.desiredRecords?.[0]?.content).toContain('security@promptfm.live');
    });

    it('matches record names case-insensitively', () => {
      const upper: HostingerDNSRecord[] = [
        {
          name: 'STREAM',
          type: 'A',
          ttl: 300,
          records: [{ content: '34.123.80.137' }],
        },
      ];
      const lower: HostingerDNSRecord[] = [
        {
          name: 'stream',
          type: 'A',
          ttl: 300,
          records: [{ content: '34.123.80.137' }],
        },
      ];

      const diffs = diffZone(upper, lower);
      expect(diffs).toHaveLength(1);
      expect(diffs[0]!.action).toBe('unchanged');
    });

    it('handles multiple record items in different order as unchanged', () => {
      const zoneA: HostingerDNSRecord[] = [
        {
          name: '@',
          type: 'A',
          ttl: 300,
          records: [{ content: '216.198.79.1' }, { content: '64.29.17.1' }],
        },
      ];
      const zoneB: HostingerDNSRecord[] = [
        {
          name: '@',
          type: 'A',
          ttl: 300,
          records: [{ content: '64.29.17.1' }, { content: '216.198.79.1' }],
        },
      ];

      const diffs = diffZone(zoneA, zoneB);
      expect(diffs[0]!.action).toBe('unchanged');
    });
  });

  describe('replaceCaseInsensitive()', () => {
    it('returns empty or original string if input or search is empty', () => {
      expect(replaceCaseInsensitive('', 'foo', 'bar')).toBe('');
      expect(replaceCaseInsensitive('hello', '', 'bar')).toBe('hello');
    });

    it('replaces all occurrences regardless of casing', () => {
      const input = 'PREFIX promptfm.live MID PromptFM.LIVE END';
      const result = replaceCaseInsensitive(input, 'promptfm.live', 'target.com');
      expect(result).toBe('PREFIX target.com MID target.com END');
    });

    it('safely handles strings with regex metacharacters without regex injection', () => {
      const input = 'contact@promptfm.live (alias.*+?[test])';
      const result = replaceCaseInsensitive(input, '(alias.*+?[test])', '[safe]');
      expect(result).toBe('contact@promptfm.live [safe]');
    });

    it('returns original string if search term is not found', () => {
      expect(replaceCaseInsensitive('hello world', 'missing', 'target')).toBe('hello world');
    });
  });

  describe('migrateZoneConfig()', () => {
    it('returns sourceZone unmodified if sourceDomain or targetDomain is empty', () => {
      expect(migrateZoneConfig(sampleLiveZone, '', 'promptfm.com')).toEqual(sampleLiveZone);
      expect(migrateZoneConfig(sampleLiveZone, 'promptfm.live', '   ')).toEqual(sampleLiveZone);
    });

    it('transforms source domain occurrences into target domain', () => {
      const migrated = migrateZoneConfig(sampleLiveZone, 'promptfm.live', 'promptfm.com');

      const dmarc = migrated.find((r) => r.name === '_dmarc');
      expect(dmarc?.records[0]?.content).toBe(
        '"v=DMARC1; p=none; sp=none; rua=mailto:contact@promptfm.com"'
      );

      // Third party hostnames like vercel-dns and resend should NOT be touched
      const www = migrated.find((r) => r.name === 'www');
      expect(www?.records[0]?.content).toBe('17b314bad0a79a1d.vercel-dns-017.com.');

      const mx = migrated.find((r) => r.name === '@' && r.type === 'MX');
      expect(mx?.records.some((rec) => rec.content.includes('feedback.resend.com.'))).toBe(true);
    });

    it('replaces multiple occurrences within the same record content', () => {
      const customZone: HostingerDNSRecord[] = [
        {
          name: 'test',
          type: 'TXT',
          ttl: 300,
          records: [{ content: 'host1=promptfm.live host2=promptfm.live' }],
        },
      ];

      const migrated = migrateZoneConfig(customZone, 'promptfm.live', 'example.org');
      expect(migrated[0]!.records[0]!.content).toBe('host1=example.org host2=example.org');
    });

    it('preserves disabled flags and records that do not contain source domain', () => {
      const customZone: HostingerDNSRecord[] = [
        {
          name: 'stream',
          type: 'A',
          ttl: 300,
          records: [{ content: '34.123.80.137', is_disabled: true }],
        },
      ];

      const migrated = migrateZoneConfig(customZone, 'promptfm.live', 'target.fm');
      expect(migrated[0]!.records[0]!.content).toBe('34.123.80.137');
      expect(migrated[0]!.records[0]!.is_disabled).toBe(true);
    });

    it('trims whitespace on source and target domains and matches case-insensitively', () => {
      const customZone: HostingerDNSRecord[] = [
        {
          name: '_dmarc',
          type: 'TXT',
          ttl: 300,
          records: [{ content: 'mailto:admin@PROMPTFM.LIVE' }],
        },
      ];

      const migrated = migrateZoneConfig(customZone, '  PROMPTFM.LIVE  ', '  NewDomain.live  ');
      expect(migrated[0]!.records[0]!.content).toBe('mailto:admin@newdomain.live');
    });
  });

  describe('createZoneState() & State Persistence', () => {
    const tmpDir = path.resolve(__dirname, '../../.tmp-dns-test');

    beforeEach(() => {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    });

    afterEach(() => {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('creates structured zone state with ISO timestamp, trimmed domain, and version', () => {
      const state = createZoneState('  PromptFM.Live  ', sampleLiveZone, 2);
      expect(state.domain).toBe('promptfm.live');
      expect(state.version).toBe(2);
      expect(state.zone).toHaveLength(sampleLiveZone.length);
      expect(new Date(state.updatedAt).getTime()).not.toBeNaN();
    });

    it('defaults version to 1 if omitted in createZoneState', () => {
      const state = createZoneState('promptfm.live', sampleLiveZone);
      expect(state.version).toBe(1);
    });

    it('saves and loads zone state accurately to disk', () => {
      const filePath = path.join(tmpDir, 'test-zone.state.json');
      const originalState = createZoneState('promptfm.live', sampleLiveZone);

      saveZoneState(filePath, originalState);
      expect(fs.existsSync(filePath)).toBe(true);

      const loadedState = loadZoneState(filePath);
      expect(loadedState.domain).toBe('promptfm.live');
      expect(loadedState.zone).toEqual(sampleLiveZone);
      expect(loadedState.version).toBe(1);
    });

    it('throws descriptive error if loading non-existent state file', () => {
      expect(() => loadZoneState(path.join(tmpDir, 'missing.json'))).toThrow(
        /file not found/i
      );
    });
  });

  describe('formatMigrationSummary()', () => {
    it('produces formatted summary including source, target, diff counts, and symbols', () => {
      const current: HostingerDNSRecord[] = [
        { name: 'stream', type: 'A', ttl: 300, records: [{ content: '1.1.1.1' }] },
        { name: 'del', type: 'TXT', ttl: 300, records: [{ content: 'old' }] },
        { name: 'unchanged', type: 'CNAME', ttl: 300, records: [{ content: 'same.com' }] },
      ];
      const desired: HostingerDNSRecord[] = [
        { name: 'stream', type: 'A', ttl: 300, records: [{ content: '2.2.2.2' }] }, // update
        { name: 'new', type: 'A', ttl: 300, records: [{ content: '3.3.3.3' }] }, // create
        { name: 'unchanged', type: 'CNAME', ttl: 300, records: [{ content: 'same.com' }] }, // unchanged
      ];

      const diffs = diffZone(current, desired);
      const summary = formatMigrationSummary({
        sourceDomain: 'source.com',
        targetDomain: 'target.com',
        plannedRecords: desired,
        diffs,
      });

      expect(summary).toContain('DNS Migration Plan: [source.com] ➔ [target.com]');
      expect(summary).toContain('• Records Planned:   3');
      expect(summary).toContain('• To Create (+):     1');
      expect(summary).toContain('• To Update (~):     1');
      expect(summary).toContain('• To Delete (-):     1');
      expect(summary).toContain('• Unchanged (=):     1');
      expect(summary).toContain('[+] CREATE');
      expect(summary).toContain('[~] UPDATE');
      expect(summary).toContain('[-] DELETE');
      expect(summary).toContain('[=] UNCHANGED');
      expect(summary).toContain('➔ 2.2.2.2');
    });
  });

  describe('Hostinger REST API Integration', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('fetchRemoteZone fetches zone from Hostinger API with Bearer token and trims domain', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleLiveZone,
      });
      global.fetch = mockFetch;

      const records = await fetchRemoteZone('  promptfm.live  ', 'test-token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hostinger.com/v1/dns/records/promptfm.live',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer test-token',
            Accept: 'application/json',
          },
        }
      );
      expect(records).toEqual(sampleLiveZone);
    });

    it('fetchRemoteZone throws if apiToken is missing', async () => {
      await expect(fetchRemoteZone('promptfm.live', '')).rejects.toThrow(
        /Hostinger API token is required/i
      );
    });

    it('fetchRemoteZone throws error with status and text on API failure', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid token',
      });

      await expect(fetchRemoteZone('promptfm.live', 'bad-token')).rejects.toThrow(
        /Hostinger API error \(401 Unauthorized\): Invalid token/i
      );
    });

    it('fetchRemoteZone falls back to generic message when error response text fails', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: async () => {
          throw new Error('cannot read body');
        },
      });

      await expect(fetchRemoteZone('promptfm.live', 'token')).rejects.toThrow(
        /Hostinger API error \(500 Server Error\): Failed to fetch DNS records/i
      );
    });

    it('validateRemoteZone sends validation payload to Hostinger endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'success' }),
      });
      global.fetch = mockFetch;

      const res = await validateRemoteZone('  promptfm.live  ', sampleLiveZone, 'test-token');
      expect(res.valid).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hostinger.com/v1/dns/records/promptfm.live/validate',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ overwrite: true, zone: sampleLiveZone }),
        }
      );
    });

    it('validateRemoteZone throws when apiToken is missing', async () => {
      await expect(validateRemoteZone('promptfm.live', sampleLiveZone, '')).rejects.toThrow(
        /Hostinger API token is required/i
      );
    });

    it('validateRemoteZone returns valid:false and error on validation failure', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () => 'Invalid CNAME syntax',
      });

      const res = await validateRemoteZone('promptfm.live', sampleLiveZone, 'test-token');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Validation failed (422): Invalid CNAME syntax');
    });

    it('applyRemoteZone sends update payload and returns success', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'success', updated: sampleLiveZone.length }),
      });
      global.fetch = mockFetch;

      const res = await applyRemoteZone('  promptfm.live  ', sampleLiveZone, 'test-token', false);
      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hostinger.com/v1/dns/records/promptfm.live',
        {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ overwrite: false, zone: sampleLiveZone }),
        }
      );
    });

    it('applyRemoteZone defaults overwrite to true', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'success' }),
      });
      global.fetch = mockFetch;

      await applyRemoteZone('promptfm.live', sampleLiveZone, 'test-token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hostinger.com/v1/dns/records/promptfm.live',
        expect.objectContaining({
          body: JSON.stringify({ overwrite: true, zone: sampleLiveZone }),
        })
      );
    });

    it('applyRemoteZone throws when apiToken is missing', async () => {
      await expect(applyRemoteZone('promptfm.live', sampleLiveZone, '')).rejects.toThrow(
        /Hostinger API token is required/i
      );
    });

    it('applyRemoteZone throws on HTTP error response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => 'Hostinger maintenance',
      });

      await expect(applyRemoteZone('promptfm.live', sampleLiveZone, 'token')).rejects.toThrow(
        /Hostinger API error \(503 Service Unavailable\): Hostinger maintenance/i
      );
    });
  });
});
