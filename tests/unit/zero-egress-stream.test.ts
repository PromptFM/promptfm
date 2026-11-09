// tests/unit/zero-egress-stream.test.ts
// Verifies Issue #127 / #150: listeners must not be served from the GCP VM (1 GB/month of outbound traffic is free).
// The stream is served from the Oracle host (docs/oracle-always-free-streamer.md); GCP has no public 80/443.

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validateZeroEgressCompliance } from '@/lib/infra/hostinger-dns';

describe('Zero-Egress Stream Architecture & Edge Protection (Issue #127)', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const dnsStateFile = path.join(rootDir, 'infra/dns/promptfm.live.state.json');
  const terraformMainFile = path.join(rootDir, 'infra/terraform/main.tf');
  const ansibleComposeFile = path.join(
    rootDir,
    'infra/ansible/roles/streamer/templates/docker-compose.yml.j2'
  );

  describe('validateZeroEgressCompliance()', () => {
    it('flags non-compliance when stream is an A record pointing at the GCP VM', () => {
      const zoneWithGcpIP = [
        {
          name: 'stream',
          type: 'A' as const,
          ttl: 300,
          records: [{ content: '34.123.80.137', is_disabled: false }],
        },
      ];

      const check = validateZeroEgressCompliance(zoneWithGcpIP);
      expect(check.compliant).toBe(false);
      expect(check.risk).toBe('direct_vm_egress');
      expect(check.message).toContain('points at the GCP VM');
    });

    it('passes compliance when stream is an A record to the Oracle host', () => {
      const zoneWithOracleIP = [
        {
          name: 'stream',
          type: 'A' as const,
          ttl: 300,
          records: [{ content: '129.80.56.27', is_disabled: false }],
        },
      ];

      const check = validateZeroEgressCompliance(zoneWithOracleIP);
      expect(check.compliant).toBe(true);
      expect(check.risk).toBe('none');
    });

    it('flags non-compliance when stream record is missing from zone', () => {
      const emptyZone = [
        {
          name: 'www',
          type: 'CNAME' as const,
          ttl: 300,
          records: [{ content: '17b314bad0a79a1d.vercel-dns-017.com.', is_disabled: false }],
        },
      ];

      const check = validateZeroEgressCompliance(emptyZone);
      expect(check.compliant).toBe(false);
      expect(check.risk).toBe('missing_stream_record');
    });
  });

  describe('Declarative DNS State (infra/dns/promptfm.live.state.json)', () => {
    it('points stream at the Oracle host and NOT at the GCP VM', () => {
      expect(fs.existsSync(dnsStateFile)).toBe(true);
      const stateContent = JSON.parse(fs.readFileSync(dnsStateFile, 'utf8'));
      const streamRecord = stateContent.zone.find((r: { name: string }) => r.name === 'stream');

      expect(streamRecord).toBeDefined();
      expect(streamRecord.type).toBe('A');
      expect(streamRecord.records[0].content).toBe('129.80.56.27');
      expect(streamRecord.records[0].content).not.toBe('34.123.80.137');
    });

    it('passes validateZeroEgressCompliance on active promptfm.live state file', () => {
      const stateContent = JSON.parse(fs.readFileSync(dnsStateFile, 'utf8'));
      const result = validateZeroEgressCompliance(stateContent.zone);
      expect(result.compliant).toBe(true);
      expect(result.risk).toBe('none');
    });
  });

  describe('Terraform Firewall Rules (infra/terraform/main.tf)', () => {
    it('disables allow-http-https from 0.0.0.0/0 when cloudflare_tunnel_enabled is true', () => {
      expect(fs.existsSync(terraformMainFile)).toBe(true);
      const tfContent = fs.readFileSync(terraformMainFile, 'utf8');

      // The firewall rule must be gated by cloudflare_tunnel_enabled
      expect(tfContent).toMatch(/count\s*=\s*var\.cloudflare_tunnel_enabled\s*\?\s*0\s*:\s*1/);
      const allowWebBlock =
        tfContent.split('resource "google_compute_firewall" "allow_web"')[1]?.split('}')[0] || '';
      expect(allowWebBlock).toContain('count');
      expect(allowWebBlock).toContain('var.cloudflare_tunnel_enabled');
    });
  });

  describe('Ansible Streamer Stack (docker-compose.yml.j2)', () => {
    it('includes cloudflared tunnel container and binds caddy to loopback/internal proxy', () => {
      expect(fs.existsSync(ansibleComposeFile)).toBe(true);
      const composeContent = fs.readFileSync(ansibleComposeFile, 'utf8');

      expect(composeContent).toContain('cloudflared:');
      expect(composeContent).toContain('cloudflare/cloudflared');
      expect(composeContent).toContain('TUNNEL_TOKEN');
      // Caddy must not bind public ports 80:80 and 443:443 directly to 0.0.0.0
      expect(composeContent).not.toContain('- "80:80"');
      expect(composeContent).not.toContain('- "443:443"');
    });
  });
});
