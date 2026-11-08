// src/lib/ci/pr-comment-generator.ts
// Generates automated PR guidance comments for previews and infrastructure deployment gates.

export interface PRCommentParams {
  commitSha: string;
  changedFiles: string[];
  checksPassed: boolean;
}

export interface InfraChangesResult {
  hasTerraform: boolean;
  hasAnsible: boolean;
}

/**
 * Detects whether changed files contain Terraform and/or Ansible modifications.
 */
export function detectInfraChanges(changedFiles: string[]): InfraChangesResult {
  let hasTerraform = false;
  let hasAnsible = false;

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
  }

  return { hasTerraform, hasAnsible };
}

/**
 * Generates structured output for PR guidance comment including flags and comment markdown.
 */
export function generatePRCommentOutput(params: PRCommentParams): {
  commentMarkdown: string;
  hasInfraChanges: boolean;
  hasTerraform: boolean;
  hasAnsible: boolean;
} {
  const { hasTerraform, hasAnsible } = detectInfraChanges(params.changedFiles);
  const commentMarkdown = generatePRGuidanceComment(params);

  return {
    commentMarkdown,
    hasInfraChanges: hasTerraform || hasAnsible,
    hasTerraform,
    hasAnsible,
  };
}
export function generatePRGuidanceComment(params: PRCommentParams): string {
  if (!params.checksPassed) {
    return `### ⚠️ Quality & Security Gate
Quality and security checks must pass before preview links or infrastructure deployments can be requested.
Please review the failing checks in GitHub Actions.`;
  }

  const { hasTerraform, hasAnsible } = detectInfraChanges(params.changedFiles);
  const cleanSha = params.commitSha.trim();

  const lines: string[] = [
    `### 🚀 Quality Gate Passed: All Checks Green!`,
    ``,
    `> [!NOTE]`,
    `> In accordance with the PromptFM $0 Infra Budget Policy, automatic Vercel preview deployments are disabled on PRs to prevent unnecessary Active CPU burn.`,
    ``,
    `**Preview Deployment Instruction:**`,
    `make an admin run the Make preview link workflow on the following sha: \`${cleanSha}\``,
  ];

  if (hasTerraform || hasAnsible) {
    lines.push(``);
    lines.push(`---`);
    lines.push(`### 🏗️ Infrastructure Changes Detected`);
    lines.push(``);

    if (hasTerraform) {
      lines.push(`> [!IMPORTANT]`);
      lines.push(`> **Terraform Update Required:** After merge have an admin run the Update terraform workflow`);
    }

    if (hasAnsible) {
      lines.push(`> [!IMPORTANT]`);
      lines.push(`> **Ansible Update Required:** After merge have an admin run the Update ansible workflow`);
    }
  }

  return lines.join('\n');
}
