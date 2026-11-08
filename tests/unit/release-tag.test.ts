import { describe, it, expect } from 'vitest';
import {
  formatReleaseTag,
  formatRollbackTag,
  extractGhTokenFromRemote,
  resolveGitHubToken,
} from '@/lib/infra/release-tag';

describe('Release and Rollback Tag Formatter', () => {
  describe('formatReleaseTag', () => {
    it('formats a tag with promptfm/<version>-<short_hash>', () => {
      const tag = formatReleaseTag('0.1.0', 'be7386564e16dcaaab5f423293c060a1aedded24');
      expect(tag).toBe('promptfm/0.1.0-be73865');
    });

    it('strips leading "v" from version if present', () => {
      const tag = formatReleaseTag('v1.2.3', '1234567890abcdef');
      expect(tag).toBe('promptfm/1.2.3-1234567');
    });

    it('handles short sha of 7 characters directly', () => {
      const tag = formatReleaseTag('2.0.0', 'abcdef1');
      expect(tag).toBe('promptfm/2.0.0-abcdef1');
    });

    it('throws error if version is empty or invalid', () => {
      expect(() => formatReleaseTag('', 'be73865')).toThrow('Version cannot be empty');
      expect(() => formatReleaseTag('   ', 'be73865')).toThrow('Version cannot be empty');
    });

    it('throws error if commit sha is empty or invalid', () => {
      expect(() => formatReleaseTag('1.0.0', '')).toThrow('Commit SHA cannot be empty');
      expect(() => formatReleaseTag('1.0.0', '123')).toThrow('Commit SHA must be at least 7 characters');
    });
  });

  describe('formatRollbackTag', () => {
    it('creates promptfm/rollback-<sha> when target is a commit sha', () => {
      const tag = formatRollbackTag('be7386564e16dcaaab5f423293c060a1aedded24');
      expect(tag).toBe('promptfm/rollback-be73865');
    });

    it('creates promptfm/rollback-<sha> when target is a 7-character sha', () => {
      const tag = formatRollbackTag('be73865');
      expect(tag).toBe('promptfm/rollback-be73865');
    });

    it('creates promptfm/rollback-<version> when target is a release tag promptfm/<version>-<sha>', () => {
      const tag = formatRollbackTag('promptfm/0.1.0-be73865');
      expect(tag).toBe('promptfm/rollback-0.1.0-be73865');
    });

    it('creates promptfm/rollback-<version> when target is a semantic tag v1.0.0', () => {
      const tag = formatRollbackTag('v1.0.0');
      expect(tag).toBe('promptfm/rollback-1.0.0');
    });

    it('throws error if target ref is empty', () => {
      expect(() => formatRollbackTag('')).toThrow('Rollback reference cannot be empty');
      expect(() => formatRollbackTag('   ')).toThrow('Rollback reference cannot be empty');
    });
  });

  describe('extractGhTokenFromRemote', () => {
    it('extracts token from https://user:ghp_xxx@github.com/org/repo.git', () => {
      const url = 'https://atrifan:ghp_mockTokenString1234567890abcdef@github.com/PromptFM/promptfm.git';
      const token = extractGhTokenFromRemote(url);
      expect(token).toBe('ghp_mockTokenString1234567890abcdef');
    });

    it('extracts token from https://ghp_xxx@github.com/org/repo.git', () => {
      const url = 'https://ghp_testToken12345@github.com/PromptFM/promptfm.git';
      const token = extractGhTokenFromRemote(url);
      expect(token).toBe('ghp_testToken12345');
    });

    it('extracts fine-grained personal access token github_pat_xxx', () => {
      const url = 'https://x-access-token:github_pat_11AAAAAAA_test@github.com/PromptFM/promptfm.git';
      const token = extractGhTokenFromRemote(url);
      expect(token).toBe('github_pat_11AAAAAAA_test');
    });

    it('returns null if remote url has no token', () => {
      expect(extractGhTokenFromRemote('https://github.com/PromptFM/promptfm.git')).toBeNull();
      expect(extractGhTokenFromRemote('git@github.com:PromptFM/promptfm.git')).toBeNull();
      expect(extractGhTokenFromRemote('')).toBeNull();
    });
  });

  describe('resolveGitHubToken', () => {
    it('prioritizes explicit env token when provided and trims whitespace', () => {
      const token = resolveGitHubToken({
        envToken: '  explicit_token  ',
        remoteUrl: 'https://atrifan:ghp_remote@github.com/PromptFM/promptfm.git',
      });
      expect(token).toBe('explicit_token');
    });

    it('ignores empty explicit env token and falls back to remote URL', () => {
      const token = resolveGitHubToken({
        envToken: '   ',
        remoteUrl: 'https://atrifan:ghp_remote@github.com/PromptFM/promptfm.git',
        env: {},
      });
      expect(token).toBe('ghp_remote');
    });

    it('falls back to remote url token if env token is missing', () => {
      const token = resolveGitHubToken({
        remoteUrl: 'https://atrifan:ghp_remote@github.com/PromptFM/promptfm.git',
        env: {},
      });
      expect(token).toBe('ghp_remote');
    });

    it('falls back to GH_TOKEN in env if remote url has no token', () => {
      const token = resolveGitHubToken({
        remoteUrl: 'https://github.com/PromptFM/promptfm.git',
        env: { GH_TOKEN: 'gh_token_value' },
      });
      expect(token).toBe('gh_token_value');
    });

    it('falls back to GITHUB_TOKEN in env if GH_TOKEN is absent', () => {
      const token = resolveGitHubToken({
        remoteUrl: 'https://github.com/PromptFM/promptfm.git',
        env: { GITHUB_TOKEN: 'github_token_value' },
      });
      expect(token).toBe('github_token_value');
    });

    it('returns null if options is undefined or empty and env has no tokens', () => {
      expect(resolveGitHubToken({ env: {} })).toBeNull();
      expect(resolveGitHubToken({ env: { GH_TOKEN: '   ', GITHUB_TOKEN: '' } })).toBeNull();
    });

    it('returns null if neither env token nor remote url token exists', () => {
      const token = resolveGitHubToken({
        remoteUrl: 'https://github.com/PromptFM/promptfm.git',
        env: {},
      });
      expect(token).toBeNull();
    });
  });
});
