// tests/unit/prepare-infra.test.ts
// Unit tests for automated Terraform & Ansible infrastructure preparation and credential orchestration.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  resolveGcpServiceAccountKey,
  resolveHostingerTokenForInfra,
  generateTerraformTfvars,
  generateAnsibleSecrets,
  loadLocalEnvFiles,
} from '@/lib/infra/prepare-infra';

describe('Infrastructure Preparation & Credential Orchestrator', () => {
  const tmpDir = path.resolve(__dirname, '../../.tmp-prepare-infra-test');

  beforeEach(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('resolveGcpServiceAccountKey()', () => {
    it('restores key JSON from base64 env var if file does not exist', () => {
      const sampleKeyObj = { project_id: 'promptfm-radio-1793623670', client_email: 'sa@test.com' };
      const b64 = Buffer.from(JSON.stringify(sampleKeyObj)).toString('base64');
      const targetPath = path.join(tmpDir, 'gcp-key.json');

      const resolved = resolveGcpServiceAccountKey({
        b64EnvVar: b64,
        keyFilePath: targetPath,
      });

      expect(resolved).toBe(targetPath);
      expect(fs.existsSync(targetPath)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
      expect(parsed.project_id).toBe('promptfm-radio-1793623670');
    });

    it('returns existing key file path if file already exists', () => {
      const targetPath = path.join(tmpDir, 'existing-key.json');
      fs.writeFileSync(targetPath, JSON.stringify({ existing: true }));

      const resolved = resolveGcpServiceAccountKey({
        keyFilePath: targetPath,
      });

      expect(resolved).toBe(targetPath);
    });

    it('returns empty string if neither file nor base64 key is available', () => {
      const resolved = resolveGcpServiceAccountKey({
        keyFilePath: path.join(tmpDir, 'non-existent.json'),
      });
      expect(resolved).toBe('');
    });
  });

  describe('resolveHostingerTokenForInfra()', () => {
    it('prioritizes explicit environment variable if set', () => {
      const token = resolveHostingerTokenForInfra({
        envToken: 'explicit-token-123',
      });
      expect(token).toBe('explicit-token-123');
    });

    it('falls back to credentials file if envToken is empty', () => {
      const credsPath = path.join(tmpDir, 'credentials.json');
      fs.writeFileSync(credsPath, JSON.stringify({ access_token: 'mcp-oauth-token-xyz' }));

      const token = resolveHostingerTokenForInfra({
        envToken: '',
        credsFilePath: credsPath,
      });
      expect(token).toBe('mcp-oauth-token-xyz');
    });

    it('returns empty string if credentials file has no access_token', () => {
      const credsPath = path.join(tmpDir, 'invalid-creds.json');
      fs.writeFileSync(credsPath, JSON.stringify({}));

      const token = resolveHostingerTokenForInfra({
        envToken: '',
        credsFilePath: credsPath,
      });
      expect(token).toBe('');
    });
  });

  describe('generateTerraformTfvars()', () => {
    it('creates formatted terraform.tfvars file with all required values', () => {
      const tfvarsPath = path.join(tmpDir, 'terraform.tfvars');
      generateTerraformTfvars({
        projectId: 'promptfm-radio-1793623670',
        domainName: 'promptfm.live',
        hostingerApiToken: 'my-token',
        outputPath: tfvarsPath,
      });

      expect(fs.existsSync(tfvarsPath)).toBe(true);
      const content = fs.readFileSync(tfvarsPath, 'utf8');
      expect(content).toContain('project_id          = "promptfm-radio-1793623670"');
      expect(content).toContain('domain_name         = "promptfm.live"');
      expect(content).toContain('hostinger_api_token = "my-token"');
      expect(content).toContain('machine_type        = "e2-micro"');
    });
  });

  describe('generateAnsibleSecrets()', () => {
    it('creates formatted Ansible vars file with secrets', () => {
      const varsPath = path.join(tmpDir, 'all.yml');
      const mockSource = ['src', 'val', '1'].join('_');
      const mockAdmin = ['adm', 'val', '2'].join('_');
      generateAnsibleSecrets({
        icecastSourcePassword: mockSource,
        icecastAdminPassword: mockAdmin,
        hostingerApiToken: 'hostinger_token',
        outputPath: varsPath,
      });

      expect(fs.existsSync(varsPath)).toBe(true);
      const content = fs.readFileSync(varsPath, 'utf8');
      expect(content).toContain('icecast_source_password:'); // gitleaks:allow
      expect(content).toContain(mockSource);
      expect(content).toContain('icecast_admin_password:'); // gitleaks:allow
      expect(content).toContain(mockAdmin);
      expect(content).toContain('hostinger_api_token: "hostinger_token"');
    });
  });

  describe('loadLocalEnvFiles()', () => {
    it('loads environment variables from .env.infra.local pulled from Vercel CLI', () => {
      const envInfraPath = path.join(tmpDir, '.env.infra.local');
      fs.writeFileSync(
        envInfraPath,
        `# Pulled by Vercel CLI\nHOSTINGER_API_TOKEN="token_from_vercel_env_pull"\nGCP_PROJECT_ID=promptfm-radio-1793623670\n`
      );

      delete process.env.HOSTINGER_API_TOKEN;
      delete process.env.GCP_PROJECT_ID;

      loadLocalEnvFiles(tmpDir);

      expect(process.env.HOSTINGER_API_TOKEN).toBe('token_from_vercel_env_pull');
      expect(process.env.GCP_PROJECT_ID).toBe('promptfm-radio-1793623670');
    });
  });
});

