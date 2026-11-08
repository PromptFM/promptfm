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
}

/**
 * Detects whether changed files contain Terraform, Ansible, or SQL schema modifications.
 */
export function detectInfraChanges(changedFiles: string[]): InfraChangesResult {
  let hasTerraform = false;
  let hasAnsible = false;
  let hasSql = false;

  for (const file of changedFiles) {
    if (
      /^infra\/terraform\//i.test(file) ||
      /\.tf$/i.test(file) ||
      /^scripts\/prepare-infra\.ts$/i.test(file)
    ) {
      hasTerraform = true;
    }
    if (
      /^infra\/ansible\//i.test(file) ||
      /^infra\/roles\//i.test(file) ||
      /playbook\.ya?ml$/i.test(file)
    ) {
      hasAnsible = true;
    }
    if (
      /^supabase\//i.test(file) ||
      /\.sql$/i.test(file) ||
      /scripts\/apply-sql-migrations\.ts/i.test(file) ||
      /src\/lib\/sql\//i.test(file)
    ) {
      hasSql = true;
    }
  }

  return { hasTerraform, hasAnsible, hasSql };
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
} {
  const { hasTerraform, hasAnsible, hasSql } = detectInfraChanges(params.changedFiles);
  const commentMarkdown = generatePRGuidanceComment(params);

  return {
    commentMarkdown,
    hasInfraChanges: hasTerraform || hasAnsible || hasSql,
    hasTerraform,
    hasAnsible,
    hasSql,
  };
}
export function generatePRGuidanceComment(params: PRCommentParams): string {
  if (!params.checksPassed) {
    return `### ⚠️ Quality & Security Gate
Quality and security checks must pass before preview links or infrastructure deployments can be requested.
Please review the failing checks in GitHub Actions.`;
  }

  const { hasTerraform, hasAnsible, hasSql } = detectInfraChanges(params.changedFiles);
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

  if (hasTerraform || hasAnsible || hasSql) {
    lines.push(``);
    lines.push(`---`);
    lines.push(`### 🏗️ Infrastructure & Database Changes Detected`);
    lines.push(``);

    if (hasTerraform) {
      lines.push(`> [!IMPORTANT]`);
      lines.push(`> **Terraform Update Required:** After merge have an admin run the Update terraform workflow`);
    }

    if (hasAnsible) {
      lines.push(`> [!IMPORTANT]`);
      lines.push(`> **Ansible Update Required:** After merge have an admin run the Update ansible workflow`);
    }

    if (hasSql) {
      lines.push(`> [!IMPORTANT]`);
      lines.push(
        `> **SQL Schema Update Required:** After merge have an admin run the Update SQL Schema workflow: https://github.com/PromptFM/promptfm/actions/workflows/apply-sql-schema.yml`
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
