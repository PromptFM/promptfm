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

  it('audits DNS zone zero-egress compliance and alerts on direct VM IP', () => {
    const leakZone: hostingerDns.HostingerDNSRecord[] = [
      {
        name: 'stream',
        type: 'A',
        ttl: 300,
        records: [{ content: '34.123.80.137' }],
      },
    ];

    const leakCheck = hostingerDns.validateZeroEgressCompliance(leakZone);
    expect(leakCheck.compliant).toBe(false);
    expect(leakCheck.risk).toBe('direct_vm_egress');
    expect(leakCheck.message).toContain('points to an A record instead of an edge CNAME');

    const validCheck = hostingerDns.validateZeroEgressCompliance(sampleZone);
    expect(validCheck.compliant).toBe(true);
    expect(validCheck.risk).toBe('none');
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
