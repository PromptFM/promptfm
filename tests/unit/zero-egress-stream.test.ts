// tests/unit/zero-egress-stream.test.ts
// Verifies Issue #127: Keep stream.promptfm.live off direct GCP VM egress.
// Ensures DNS resolves stream to edge CNAME, and GCP firewall blocks direct 0.0.0.0/0 port 80/443 ingress.

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
    it('flags non-compliance when stream is an A record pointing directly to VM IP', () => {
      const zoneWithDirectIP = [
        {
          name: 'stream',
          type: 'A' as const,
          ttl: 300,
          records: [{ content: '34.123.80.137', is_disabled: false }],
        },
      ];

      const check = validateZeroEgressCompliance(zoneWithDirectIP);
      expect(check.compliant).toBe(false);
      expect(check.risk).toBe('direct_vm_egress');
      expect(check.message).toContain('points to an A record instead of an edge CNAME');
    });

    it('passes compliance when stream is a CNAME pointing to Cloudflare Tunnel edge', () => {
      const zoneWithEdgeCNAME = [
        {
          name: 'stream',
          type: 'CNAME' as const,
          ttl: 300,
          records: [{ content: 'promptfm-stream.cfargotunnel.com.', is_disabled: false }],
        },
      ];

      const check = validateZeroEgressCompliance(zoneWithEdgeCNAME);
      expect(check.compliant).toBe(true);
      expect(check.risk).toBe('none');
      expect(check.message).toContain('routes through edge CNAME proxy');
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
    it('configures stream as CNAME pointing to edge tunnel and NOT direct VM IP', () => {
      expect(fs.existsSync(dnsStateFile)).toBe(true);
      const stateContent = JSON.parse(fs.readFileSync(dnsStateFile, 'utf8'));
      const streamRecord = stateContent.zone.find((r: { name: string }) => r.name === 'stream');

      expect(streamRecord).toBeDefined();
      expect(streamRecord.type).toBe('CNAME');
      expect(streamRecord.records[0].content).toContain('.cfargotunnel.com');
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
      expect(tfContent).not.toMatch(
        /resource "google_compute_firewall" "allow_web" \{\s*name\s*=\s*"allow-http-https"\s*network\s*=\s*"default"\s*description\s*=\s*"[^"]*"\s*allow\s*\{[\s\S]*\}\s*source_ranges\s*=\s*\["0\.0\.0\.0\/0"\]/
      );
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
