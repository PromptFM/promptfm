// src/lib/ci/pr-comment-generator.ts
// Generates automated PR guidance comments for previews and infrastructure deployment gates.

import {
  detectEnvAndFlagRequirements,
  validatePRDescriptionNotes,
  formatEnvValidationComment,
} from './pr-env-validator';

export interface PRCommentParams {
  commitSha: string;
  changedFiles: string[];
  checksPassed: boolean;
  prBody?: string;
}

export interface InfraChangesResult {
  hasTerraform: boolean;
  hasAnsible: boolean;
  hasSql: boolean;
  hasSecrets: boolean;
  hasUi: boolean;
}

/**
 * Detects whether changed files contain Terraform, Ansible, SQL schema, secret, or UI modifications.
 */
export function detectInfraChanges(changedFiles: string[]): InfraChangesResult {
  let hasTerraform = false;
  let hasAnsible = false;
  let hasSql = false;
  let hasSecrets = false;
  let hasUi = false;

  for (const file of changedFiles) {
    if (file.endsWith('.md') || file === '.gitignore' || file.startsWith('docs/')) {
      continue;
    }

    if (
      /\.tf$/i.test(file) ||
      (/^infra\/terraform\//i.test(file) && !file.endsWith('.ts') && !file.endsWith('.json'))
    ) {
      hasTerraform = true;
    }
    if (
      (/^infra\/ansible\//i.test(file) || /^infra\/roles\//i.test(file) || /playbook\.ya?ml$/i.test(file)) &&
      !file.includes('group_vars')
    ) {
      hasAnsible = true;
    }
    // Only actual SQL schema migration files in supabase/migrations/*.sql or root migrations
    if (
      /^supabase\/migrations\/.*\.sql$/i.test(file) ||
      (/\.sql$/i.test(file) && !file.startsWith('src/lib/sql/') && !file.startsWith('scripts/'))
    ) {
      hasSql = true;
    }
    // Actual production secrets or credential definitions
    if (
      /infra\/ansible\/group_vars/i.test(file) ||
      /secrets\.auto\.tfvars$/i.test(file) ||
      /secrets-sync\.ts$/i.test(file)
    ) {
      hasSecrets = true;
    }
    if (
      /^src\/app\//i.test(file) ||
      /^src\/components\//i.test(file) ||
      /^public\//i.test(file) ||
      /\.(css|scss|svg|png|jpg|webp)$/i.test(file)
    ) {
      hasUi = true;
    }
  }

  return { hasTerraform, hasAnsible, hasSql, hasSecrets, hasUi };
}

/**
 * Generates structured output for PR guidance comment including flags and comment markdown.
 */
export function generatePRCommentOutput(params: PRCommentParams): {
  commentMarkdown: string;
  hasInfraChanges: boolean;
  hasTerraform: boolean;
  hasAnsible: boolean;
  hasSql: boolean;
  hasSecrets: boolean;
  hasUi: boolean;
} {
  const { hasTerraform, hasAnsible, hasSql, hasSecrets, hasUi } = detectInfraChanges(
    params.changedFiles
  );
  const commentMarkdown = generatePRGuidanceComment(params);

  return {
    commentMarkdown,
    hasInfraChanges: hasTerraform || hasAnsible || hasSql || hasSecrets,
    hasTerraform,
    hasAnsible,
    hasSql,
    hasSecrets,
    hasUi,
  };
}
export function generatePRGuidanceComment(params: PRCommentParams): string {
  if (!params.checksPassed) {
    return `### ⚠️ Quality & Security Gate
Quality and security checks must pass before preview links or infrastructure deployments can be requested.
Please review the failing checks in GitHub Actions.`;
  }

  const { hasTerraform, hasAnsible, hasSql, hasSecrets, hasUi } = detectInfraChanges(
    params.changedFiles
  );
  const cleanSha = params.commitSha.trim();

  const lines: string[] = [
    `### 🚀 Quality Gate Passed: All Checks Green!`,
    ``,
    `> [!NOTE]`,
    `> In accordance with the PromptFM $0 Infra Budget Policy, automatic Vercel preview deployments are disabled on PRs to prevent unnecessary Active CPU burn.`,
    ``,
    `**Preview Deployment Instruction:**`,
    `make an admin run the Make preview link workflow on the following sha: \`${cleanSha}\``,
    ``,
    `*💡 Core team members can also trigger a preview deployment directly by commenting \`/pr-link\` on this PR.*`,
  ];

  if (hasUi) {
    lines.push(``);
    lines.push(`---`);
    lines.push(`### 🎨 UI / Frontend Changes Detected`);
    lines.push(``);
    lines.push(`> [!TIP]`);
    lines.push(
      `> **UI Preview Required:** Visual or component changes detected. To spin up a live preview URL on Vercel, have a core team member comment \`/pr-link\` on this PR or ask an admin to run the [Create Preview Link workflow](https://github.com/PromptFM/promptfm/actions/workflows/create-preview-link.yml) for sha \`${cleanSha}\`.`
    );
  }

  if (hasTerraform || hasAnsible || hasSql || hasSecrets) {
    lines.push(``);
    lines.push(`---`);
    lines.push(`### 🏗️ Infrastructure & Database Changes Detected`);
    lines.push(``);
    lines.push(`> [!IMPORTANT]`);
    lines.push(`> **Post-Merge Operational Tasks:**`);

    if (hasTerraform) {
      lines.push(
        `> - **Terraform Infrastructure Update:** Changes detected in \`infra/terraform/\`. After merge have an admin run the Update terraform workflow (or push \`promptfm-infra/<version>\` tag): https://github.com/PromptFM/promptfm/actions/workflows/apply-terraform.yml`
      );
    }

    if (hasAnsible) {
      lines.push(
        `> - **Ansible Update Required:** After merge have an admin run the Update ansible workflow: https://github.com/PromptFM/promptfm/actions/workflows/apply-terraform.yml`
      );
    }

    if (hasSql) {
      lines.push(
        `> - **SQL Schema Migrations:** New migration detected in \`supabase/migrations/\`. Will **automatically apply** upon merge to \`main\` (recording \`promptfm-sql/<version>\` tag). Manual / dry-run trigger: https://github.com/PromptFM/promptfm/actions/workflows/apply-sql-schema.yml`
      );
    }

    if (hasSecrets) {
      lines.push(
        `> - **Secrets Update Required:** If new production secrets or credentials are required, have an admin run the Update Secrets workflow: https://github.com/PromptFM/promptfm/actions/workflows/update-secrets.yml`
      );
    }
  }

  const envRequirements = detectEnvAndFlagRequirements(params.changedFiles);
  if (
    envRequirements.requiresEnvNotes ||
    envRequirements.requiresFlagNotes ||
    envRequirements.requiresSecretHandoff
  ) {
    const envValidation = validatePRDescriptionNotes(params.prBody || '', envRequirements);
    if (!envValidation.valid) {
      lines.push(``);
      lines.push(`---`);
      lines.push(formatEnvValidationComment(envValidation));
    }
  }

  return lines.join('\n');
}
