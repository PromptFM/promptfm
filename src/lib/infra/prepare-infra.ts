// src/lib/infra/prepare-infra.ts
// Automated Infrastructure Credential Orchestrator for Terraform & Ansible (0-Cost Always-Free Tier).

import * as fs from 'fs';
import * as path from 'path';

export interface GcpServiceAccountOptions {
  b64EnvVar?: string;
  keyFilePath?: string;
}

/**
 * Resolves the GCP Service Account Key path.
 * If the key file doesn't exist locally but a base64 string is provided in env,
 * it restores the key file automatically.
 */
export function resolveGcpServiceAccountKey(options?: GcpServiceAccountOptions): string {
  const defaultPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.config/gcloud/promptfm-terraform-key.json'
  );
  const keyPath = options?.keyFilePath || defaultPath;

  if (fs.existsSync(keyPath)) {
    return keyPath;
  }

  const b64 = options?.b64EnvVar || process.env.GCP_SA_KEY || '';
  if (b64) {
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      const dir = path.dirname(keyPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(keyPath, decoded, { mode: 0o600 });
      return keyPath;
    } catch {
      return '';
    }
  }

  return '';
}

export interface HostingerTokenOptions {
  envToken?: string;
  credsFilePath?: string;
}

/**
 * Resolves the Hostinger API token prioritizing environment variables,
 * then falling back to local MCP OAuth credentials.
 */
export function resolveHostingerTokenForInfra(options?: HostingerTokenOptions): string {
  if (options?.envToken !== undefined && options.envToken !== '') {
    return options.envToken.trim();
  }

  if (options?.envToken === undefined) {
    if (process.env.HOSTINGER_API_TOKEN && process.env.HOSTINGER_API_TOKEN.trim() !== '') {
      return process.env.HOSTINGER_API_TOKEN.trim();
    }
    if (process.env.HOSTINGER_TOKEN && process.env.HOSTINGER_TOKEN.trim() !== '') {
      return process.env.HOSTINGER_TOKEN.trim();
    }
  }

  const defaultCredsPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.config/hostinger-mcp/credentials.json'
  );
  const credsPath = options?.credsFilePath || defaultCredsPath;

  if (fs.existsSync(credsPath)) {
    try {
      const raw = fs.readFileSync(credsPath, 'utf8');
      const data = JSON.parse(raw);
      if (data && typeof data.access_token === 'string' && data.access_token.trim() !== '') {
        return data.access_token.trim();
      }
    } catch {
      return '';
    }
  }

  return '';
}

export interface TerraformVarsOptions {
  projectId?: string;
  domainName?: string;
  hostingerApiToken?: string;
  outputPath?: string;
}

/**
 * Generates the local terraform.tfvars configuration for Always-Free execution.
 */
export function generateTerraformTfvars(options: TerraformVarsOptions): string {
  const projectId = options.projectId || 'promptfm-radio-1793623670';
  const domainName = options.domainName || 'promptfm.live';
  const hostingerApiToken = options.hostingerApiToken || '';
  const outputPath =
    options.outputPath || path.join(process.cwd(), 'infra/terraform/terraform.tfvars');

  const content = `# PromptFM Terraform Variables Configuration
# Generated automatically by npm run prepare-infra (prepare-terraform)

project_id          = "${projectId}"
region              = "us-central1"
zone                = "us-central1-a"
instance_name       = "promptfm-streamer"
machine_type        = "e2-micro"      # Strictly e2-micro for Always Free
disk_type           = "pd-standard"   # Strictly pd-standard for Always Free (NOT pd-balanced/ssd)
disk_size_gb        = 30              # Max 30 GB standard disk for Always Free
ssh_user            = "ubuntu"
ssh_pub_key_path    = "~/.ssh/google_compute_engine.pub"

# Domain & Hostinger DNS Automation
domain_name         = "${domainName}"
hostinger_api_token = "${hostingerApiToken}"
`;

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content, { mode: 0o600 });
  return outputPath;
}

export interface AnsibleSecretsOptions {
  icecastSourcePassword?: string;
  icecastAdminPassword?: string;
  hostingerApiToken?: string;
  outputPath?: string;
}

/**
 * Generates the Ansible vars configuration with passwords and tokens.
 */
export function generateAnsibleSecrets(options: AnsibleSecretsOptions): string {
  const sourcePass = options.icecastSourcePassword || 'promptfm_source_2026';
  const adminPass = options.icecastAdminPassword || 'promptfm_admin_2026';
  const hostingerToken = options.hostingerApiToken || '';
  const outputPath =
    options.outputPath || path.join(process.cwd(), 'infra/ansible/group_vars/all.yml');

  const content = `---
# infra/ansible/group_vars/all.yml
# Synchronized secrets for PromptFM infrastructure deployment

icecast_source_password: "${sourcePass}"
icecast_admin_password: "${adminPass}"
hostinger_api_token: "${hostingerToken}"
`;

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content, { mode: 0o600 });
  return outputPath;
}

/**
 * Loads environment variables from local environment files (.env.infra.local, .env.local, .env).
 * This enables seamless credential resolution when secrets are pulled from Vercel via CLI.
 */
export function loadLocalEnvFiles(baseDir: string = process.cwd()): void {
  const envFiles = ['.env.infra.local', '.env.local', '.env'];
  for (const filename of envFiles) {
    const fullPath = path.join(baseDir, filename);
    if (fs.existsSync(fullPath)) {
      try {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        for (const line of fileContent.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIndex = trimmed.indexOf('=');
          if (eqIndex > 0) {
            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();
            if (
              (value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))
            ) {
              value = value.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      } catch {
        // Continue to next file if unreadable
      }
    }
  }
}

