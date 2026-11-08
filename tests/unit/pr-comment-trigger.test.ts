// tests/unit/pr-comment-trigger.test.ts
// Unit tests for /pr-link PR comment trigger and core team authorization.

import { describe, it, expect } from 'vitest';
import {
  isPrLinkCommand,
  isAuthorizedCoreMember,
  formatPrLinkComment,
  formatUnauthorizedComment,
} from '@/lib/ci/pr-comment-trigger';

describe('PR Link Comment Trigger & Core Team Auth', () => {
  describe('isPrLinkCommand()', () => {
    it('detects /pr-link command at the start of a comment', () => {
      expect(isPrLinkCommand('/pr-link')).toBe(true);
      expect(isPrLinkCommand('/pr-link please deploy')).toBe(true);
      expect(isPrLinkCommand('  /pr-link  ')).toBe(true);
    });

    it('detects /pr-link case-insensitively', () => {
      expect(isPrLinkCommand('/PR-LINK')).toBe(true);
      expect(isPrLinkCommand('/Pr-Link')).toBe(true);
    });

    it('detects /preview as an alias for convenience', () => {
      expect(isPrLinkCommand('/preview')).toBe(true);
    });

    it('returns false for general comments not invoking the command', () => {
      expect(isPrLinkCommand('Looks good to me!')).toBe(false);
      expect(isPrLinkCommand('Can you check /pr-link in the docs?')).toBe(false);
      expect(isPrLinkCommand('')).toBe(false);
    });
  });

  describe('isAuthorizedCoreMember()', () => {
    it('authorizes OWNER, MEMBER, and COLLABORATOR associations', () => {
      expect(isAuthorizedCoreMember('OWNER')).toBe(true);
      expect(isAuthorizedCoreMember('MEMBER')).toBe(true);
      expect(isAuthorizedCoreMember('COLLABORATOR')).toBe(true);
    });

    it('rejects CONTRIBUTOR, FIRST_TIME_CONTRIBUTOR, and NONE', () => {
      expect(isAuthorizedCoreMember('CONTRIBUTOR')).toBe(false);
      expect(isAuthorizedCoreMember('FIRST_TIME_CONTRIBUTOR')).toBe(false);
      expect(isAuthorizedCoreMember('NONE')).toBe(false);
      expect(isAuthorizedCoreMember('')).toBe(false);
    });

    it('authorizes explicit core team handles like atrifan regardless of association', () => {
      expect(isAuthorizedCoreMember('NONE', 'atrifan', ['atrifan'])).toBe(true);
      expect(isAuthorizedCoreMember('CONTRIBUTOR', 'atrifan')).toBe(true);
    });

    it('rejects arbitrary users who are not in core team', () => {
      expect(isAuthorizedCoreMember('CONTRIBUTOR', 'random_user', ['atrifan'])).toBe(false);
    });
  });

  describe('formatPrLinkComment()', () => {
    it('generates rich markdown comment with preview url and sha', () => {
      const comment = formatPrLinkComment('abcdef123456', 'https://promptfm-git-preview.vercel.app', 'atrifan');
      expect(comment).toContain('### 🔍 Vercel Preview Link Ready!');
      expect(comment).toContain('`abcdef123456`');
      expect(comment).toContain('https://promptfm-git-preview.vercel.app');
      expect(comment).toContain('@atrifan');
      expect(comment).toContain('$0 budget policy');
    });
  });

  describe('formatUnauthorizedComment()', () => {
    it('generates friendly rejection comment for non-core users', () => {
      const comment = formatUnauthorizedComment('contributor_dan');
      expect(comment).toContain('@contributor_dan');
      expect(comment).toContain('only PromptFM core maintainers and administrators');
      expect(comment).toContain('/pr-link');
    });
  });
});
