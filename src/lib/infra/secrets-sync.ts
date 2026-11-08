// src/lib/infra/secrets-sync.ts
// Secure secret synchronization helpers for Vercel and documented SecretShare workflows.

export interface VercelSecretPayload {
  key: string;
  value: string;
  environments: string[];
}

export interface SecretShareProcessInfo {
  secretShareUrl: string;
  documentationPath: string;
  instructions: string;
}

const VALID_ENV_KEY_REGEX = /^[A-Z][A-Z0-9_]*$/;

/**
 * Validates and formats a secret payload for Vercel deployment environments.
 */
export function formatVercelSecretPayload(
  key: string,
  value: string,
  environments: string[] = ['production', 'preview', 'development']
): VercelSecretPayload {
  const trimmedKey = key.trim();
  if (!trimmedKey || !VALID_ENV_KEY_REGEX.test(trimmedKey)) {
    throw new Error(`Invalid environment variable key: "${key}". Must start with uppercase letter and contain only [A-Z0-9_].`);
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error('Secret value cannot be empty');
  }

  const validEnvs = environments.map((e) => e.trim()).filter(Boolean);
  if (validEnvs.length === 0) {
    throw new Error('At least one target environment must be specified');
  }

  return {
    key: trimmedKey,
    value: trimmedValue,
    environments: validEnvs,
  };
}

/**
 * Constructs CLI arguments for the `vercel env add` command.
 */
export function buildVercelCliEnvArgs(key: string, environment: string): string[] {
  return ['env', 'add', key, environment];
}

/**
 * Returns metadata and documentation links for secure credential sharing.
 */
export function getSecretShareProcessInfo(): SecretShareProcessInfo {
  return {
    secretShareUrl: 'https://secretshare.internal/promptfm-secrets',
    documentationPath: 'docs/admin-guide.md',
    instructions:
      'Secrets must be transferred via encrypted one-time SecretShare links before injecting into Vercel or GitHub Secrets.',
  };
}
