// tests/unit/pr-env-validator.test.ts
// Unit tests for Issue #75: CI / PR checks for required Vercel env vars, feature flags, and secret handoff notes.

import { describe, it, expect } from 'vitest';
import {
  detectEnvAndFlagRequirements,
  validatePRDescriptionNotes,
  formatEnvValidationComment,
} from '@/lib/ci/pr-env-validator';

describe('PR Environment Variables, Feature Flags & Secret Handoff Validator (Issue #75)', () => {
  describe('detectEnvAndFlagRequirements()', () => {
    it('detects env variable requirement when .env.example or .env.local.example is modified', () => {
      const result = detectEnvAndFlagRequirements(['.env.example', 'README.md']);
      expect(result.requiresEnvNotes).toBe(true);
      expect(result.reasons).toContain('Modified .env.example');
    });

    it('detects feature flag requirement when src/lib/flags/feature-flags.ts is modified', () => {
      const result = detectEnvAndFlagRequirements(['src/lib/flags/feature-flags.ts']);
      expect(result.requiresFlagNotes).toBe(true);
      expect(result.reasons).toContain('Modified feature flags configuration');
    });

    it('detects secret handoff requirement when infra secrets or tokens are modified', () => {
      const result = detectEnvAndFlagRequirements(['infra/ansible/group_vars/all.yml']);
      expect(result.requiresSecretHandoff).toBe(true);
    });

    it('returns false for normal UI or documentation changes', () => {
      const result = detectEnvAndFlagRequirements(['src/components/AudioPlayer.tsx', 'docs/README.md']);
      expect(result.requiresEnvNotes).toBe(false);
      expect(result.requiresFlagNotes).toBe(false);
      expect(result.requiresSecretHandoff).toBe(false);
    });
  });

  describe('validatePRDescriptionNotes()', () => {
    it('passes when no env or flag changes are required, even with empty body', () => {
      const validation = validatePRDescriptionNotes('', {
        requiresEnvNotes: false,
        requiresFlagNotes: false,
        requiresSecretHandoff: false,
      });
      expect(validation.valid).toBe(true);
      expect(validation.missingNotes).toHaveLength(0);
    });

    it('passes when env changes are required and PR body specifies Password Pusher or OneTimeSecret', () => {
      const prBody = `## Environment Variables & Secrets Required
- Added NEW_API_KEY
- Secret shared via Password Pusher to dev@promptfm.live`;

      const validation = validatePRDescriptionNotes(prBody, {
        requiresEnvNotes: true,
        requiresFlagNotes: false,
        requiresSecretHandoff: true,
      });
      expect(validation.valid).toBe(true);
      expect(validation.missingNotes).toHaveLength(0);
    });

    it('passes when PR explicitly states None or N/A for secrets', () => {
      const prBody = `## Environment Variables & Secrets Required
None (no new secrets required).`;

      const validation = validatePRDescriptionNotes(prBody, {
        requiresEnvNotes: true,
        requiresFlagNotes: false,
        requiresSecretHandoff: false,
      });
      expect(validation.valid).toBe(true);
    });

    it('fails when env/secrets are modified but PR body omits handoff method or notes', () => {
      const prBody = `Just a quick fix to the backend.`;

      const validation = validatePRDescriptionNotes(prBody, {
        requiresEnvNotes: true,
        requiresFlagNotes: false,
        requiresSecretHandoff: true,
      });
      expect(validation.valid).toBe(false);
      expect(validation.missingNotes).toContain(
        'Missing secret handoff method (must specify Password Pusher or OneTimeSecret to dev@promptfm.live)'
      );
      expect(validation.missingNotes).toContain(
        'Missing environment variable notes in PR description (specify new Vercel env vars or "None")'
      );
    });

    it('passes when env variables are documented in PR body', () => {
      const prBody = `### Environment Variables & Secrets Required\nNew env: VERCEL_ANALYTICS_ID added to .env.example`;

      const validation = validatePRDescriptionNotes(prBody, {
        requiresEnvNotes: true,
        requiresFlagNotes: false,
        requiresSecretHandoff: false,
      });
      expect(validation.valid).toBe(true);
      expect(validation.missingNotes).toHaveLength(0);
    });

    it('fails when feature flags are modified but not mentioned in PR body', () => {
      const prBody = `Added some new components.`;

      const validation = validatePRDescriptionNotes(prBody, {
        requiresEnvNotes: false,
        requiresFlagNotes: true,
        requiresSecretHandoff: false,
      });
      expect(validation.valid).toBe(false);
      expect(validation.missingNotes).toContain(
        'Missing feature flag activation/deactivation notes in PR description'
      );
    });
  });

  describe('formatEnvValidationComment()', () => {
    it('formats actionable feedback comment when validation fails', () => {
      const comment = formatEnvValidationComment({
        valid: false,
        missingNotes: [
          'Missing secret handoff method (must specify Password Pusher or OneTimeSecret to dev@promptfm.live)',
        ],
        warnings: [],
      });
      expect(comment).toContain('### ⚠️ PR Review Check: Environment & Secret Handoff Required');
      expect(comment).toContain('Password Pusher');
      expect(comment).toContain('dev@promptfm.live');
    });
  });
});
