// tests/unit/dns-cli.test.ts
// Unit tests for PromptFM Hostinger DNS & Domain Migration CLI command handling.

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
