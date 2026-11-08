#!/usr/bin/env node
// scripts/prepare-infra.ts
// Automated Infrastructure Preparation & Credential Orchestrator for Terraform & Ansible.

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  resolveGcpServiceAccountKey,
  resolveHostingerTokenForInfra,
  generateTerraformTfvars,
  generateAnsibleSecrets,
} from '../src/lib/infra/prepare-infra';

async function main() {
  console.log(`\n======================================================================`);
  console.log(`🎙️  PromptFM Infrastructure Preparation & Credential Orchestrator`);
  console.log(`    Strictly adhering to GCP Always Free Tier ($0.00 / month)`);
  console.log(`======================================================================\n`);

  const projectId = 'promptfm-radio-1793623670';
  const domainName = 'promptfm.live';

  // 1. Configure and Verify GCP Project
  console.log(`1️⃣  Google Cloud Platform Setup (${projectId})...`);
  try {
    const currentAccount = execSync('gcloud auth list --filter=status:ACTIVE --format="value(account)"', {
      encoding: 'utf8',
    }).trim();
    if (!currentAccount) {
      console.log(`⚠️  No active gcloud account found. Initiating gcloud auth login...`);
      execSync('gcloud auth login', { stdio: 'inherit' });
    } else {
      console.log(`   ✓ Active GCP account: ${currentAccount}`);
    }

    execSync(`gcloud config set project ${projectId}`, { stdio: 'pipe' });
    console.log(`   ✓ Active project set to: ${projectId}`);
  } catch (err: any) {
    console.warn(`   ⚠️  Could not run gcloud CLI: ${err.message}`);
  }

  // 2. Resolve Programmatic GCP Key
  console.log(`\n2️⃣  Resolving GCP Service Account Key...`);
  const gcpKeyPath = resolveGcpServiceAccountKey();
  if (gcpKeyPath && existsSync(gcpKeyPath)) {
    console.log(`   ✓ Programmatic GCP Key ready at: ${gcpKeyPath}`);
  } else {
    console.log(`   ⚠️  GCP service account key not found locally. It can be pulled from Vercel secrets (GCP_SA_KEY).`);
  }

  // 3. Resolve Hostinger API Token
  console.log(`\n3️⃣  Resolving Hostinger API Token...`);
  let hostingerToken = resolveHostingerTokenForInfra();

  if (!hostingerToken) {
    console.log(`   ℹ️  No HOSTINGER_API_TOKEN found in environment or local credentials.`);
    console.log(`   🚀 Launching Hostinger OAuth verification...`);
    try {
      execSync('npx @hostinger/mcp hostinger-dns-mcp', { stdio: 'inherit', timeout: 60000 });
      hostingerToken = resolveHostingerTokenForInfra();
    } catch {
      console.warn(`   ⚠️  OAuth flow skipped or timed out.`);
    }
  }

  if (hostingerToken) {
    console.log(`   ✓ Hostinger API Token resolved successfully (${hostingerToken.slice(0, 6)}...${hostingerToken.slice(-4)})`);
  } else {
    console.log(`   ⚠️  Hostinger API Token missing. Remote DNS sync will require HOSTINGER_API_TOKEN.`);
  }

  // 4. Generate Terraform Variables (terraform.tfvars)
  console.log(`\n4️⃣  Generating Terraform Variables (infra/terraform/terraform.tfvars)...`);
  const tfvarsPath = join(process.cwd(), 'infra/terraform/terraform.tfvars');
  generateTerraformTfvars({
    projectId,
    domainName,
    hostingerApiToken: hostingerToken,
    outputPath: tfvarsPath,
  });
  console.log(`   ✓ Generated: ${tfvarsPath}`);

  // 5. Generate Ansible Secrets (infra/ansible/group_vars/all.yml)
  console.log(`\n5️⃣  Generating Ansible Secrets (infra/ansible/group_vars/all.yml)...`);
  const ansibleVarsPath = join(process.cwd(), 'infra/ansible/group_vars/all.yml');
  const icecastSource = process.env.ICECAST_SOURCE_PASSWORD || 'promptfm_source_2026';
  const icecastAdmin = process.env.ICECAST_ADMIN_PASSWORD || 'promptfm_admin_2026';
  generateAnsibleSecrets({
    icecastSourcePassword: icecastSource,
    icecastAdminPassword: icecastAdmin,
    hostingerApiToken: hostingerToken,
    outputPath: ansibleVarsPath,
  });
  console.log(`   ✓ Generated: ${ansibleVarsPath}`);

  console.log(`\n======================================================================`);
  console.log(`🎉 Infrastructure & Credentials Successfully Prepared!`);
  console.log(`======================================================================`);
  console.log(`\nCommands to run:`);
  console.log(`  1. Terraform:`);
  console.log(`     cd infra/terraform && terraform init && terraform plan`);
  console.log(`  2. Hostinger DNS status & migration:`);
  console.log(`     npm run promptfm -- dns status ${domainName}`);
  console.log(`  3. Ansible configuration:`);
  console.log(`     ansible-playbook -i infra/ansible/inventory.ini infra/ansible/hostinger-playbook.yml\n`);
}

main().catch((err) => {
  console.error('Fatal error preparing infrastructure:', err);
  process.exit(1);
});

