// src/lib/ci/pr-env-validator.ts
// PR validator for required Vercel environment variables, feature flags, and secret handoff notes (Issue #75).

export interface RequirementsResult {
  requiresEnvNotes: boolean;
  requiresFlagNotes: boolean;
  requiresSecretHandoff: boolean;
  reasons: string[];
}

export interface PRValidationResult {
  valid: boolean;
  missingNotes: string[];
  warnings: string[];
}

/**
 * Analyzes changed files to determine if the PR introduces or modifies:
 * 1. Environment variables (.env.example, .env.local.example)
 * 2. Feature flags (src/lib/flags/feature-flags.ts)
 * 3. Secrets / tokens in infrastructure or configurations
 */
export function detectEnvAndFlagRequirements(changedFiles: string[]): RequirementsResult {
  let requiresEnvNotes = false;
  let requiresFlagNotes = false;
  let requiresSecretHandoff = false;
  const reasons: string[] = [];

  for (const file of changedFiles) {
    const cleanPath = file.trim();

    if (/\.env\.example$/i.test(cleanPath) || /\.env\.local\.example$/i.test(cleanPath)) {
      requiresEnvNotes = true;
      reasons.push(`Modified ${cleanPath}`);
    }

    if (/src\/lib\/flags\/feature-flags\.ts$/i.test(cleanPath)) {
      requiresFlagNotes = true;
      reasons.push('Modified feature flags configuration');
    }

    if (
      /infra\/ansible\/group_vars/i.test(cleanPath) ||
      /infra\/terraform\/.*\.tfvars/i.test(cleanPath) ||
      /secrets-sync\.ts/i.test(cleanPath)
    ) {
      requiresSecretHandoff = true;
      reasons.push(`Modified sensitive configuration: ${cleanPath}`);
    }
  }

  return {
    requiresEnvNotes,
    requiresFlagNotes,
    requiresSecretHandoff,
    reasons,
  };
}

/**
 * Validates whether the PR description contains the necessary callouts and secure handoff notes.
 */
export function validatePRDescriptionNotes(
  prBody: string,
  requirements: {
    requiresEnvNotes: boolean;
    requiresFlagNotes: boolean;
    requiresSecretHandoff: boolean;
  }
): PRValidationResult {
  const missingNotes: string[] = [];
  const warnings: string[] = [];
  const body = (prBody || '').toLowerCase();

  const mentionsNone =
    body.includes('none') ||
    body.includes('n/a') ||
    body.includes('no new secrets') ||
    body.includes('no new env');

  // 1. Secret handoff check
  if (requirements.requiresSecretHandoff && !mentionsNone) {
    const mentionsSecureHandoff =
      body.includes('password pusher') ||
      body.includes('pwpush') ||
      body.includes('onetimesecret') ||
      body.includes('one-time secret') ||
      body.includes('secretshare');

    if (!mentionsSecureHandoff) {
      missingNotes.push(
        'Missing secret handoff method (must specify Password Pusher or OneTimeSecret to dev@promptfm.live)'
      );
    }
  }

  // 2. Feature flags check
  if (requirements.requiresFlagNotes && !mentionsNone) {
    const mentionsFeatureFlags =
      body.includes('feature flag') ||
      body.includes('feature_flag') ||
      body.includes('flags') ||
      body.includes('flag:');

    if (!mentionsFeatureFlags) {
      missingNotes.push('Missing feature flag activation/deactivation notes in PR description');
    }
  }

  // 3. Env vars check
  if (requirements.requiresEnvNotes && !mentionsNone) {
    const mentionsEnv =
      body.includes('env') ||
      body.includes('environment variable') ||
      body.includes('vercel env');

    if (!mentionsEnv) {
      missingNotes.push(
        'Missing environment variable notes in PR description (specify new Vercel env vars or "None")'
      );
    }
  }

  return {
    valid: missingNotes.length === 0,
    missingNotes,
    warnings,
  };
}

/**
 * Formats an actionable guidance comment when PR environment or feature flag notes are missing.
 */
export function formatEnvValidationComment(result: PRValidationResult): string {
  const bulletPoints = result.missingNotes.map((note) => `- ❌ ${note}`).join('\n');

  return `### ⚠️ PR Review Check: Environment & Secret Handoff Required

Our automated CI checks detected that this Pull Request modifies environment variables, feature flags, or infrastructure credentials, but is missing required handoff notes in the description:

${bulletPoints}

---

### How to resolve:
1. Edit the PR description to explicitly list new environment variables or feature flags.
2. If new secrets or API keys are required for Vercel or cloud infrastructure:
   - **Never post raw secrets in GitHub issues or comments.**
   - Create an encrypted, self-destructing secret link via **[Password Pusher](https://pwpush.com)** or **[OneTimeSecret](https://onetimesecret.com)**.
   - Send the link to **dev@promptfm.live** or notify **@atrifan**.
3. If no secrets are required, note \`None\` under the **Environment Variables & Secrets** section of your PR description.`;
}
