import { describe, it, expect } from 'vitest';
import {
  formatReleaseTag,
  formatRollbackTag,
  formatSqlTag,
  formatInfraTag,
  formatInfraRollbackTag,
  formatSqlRollbackTag,
  createGitReleaseTag,
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

  describe('formatInfraRollbackTag', () => {
    it('creates promptfm-infra/rollback-<sha> when target is a commit sha', () => {
      const tag = formatInfraRollbackTag('be7386564e16dcaaab5f423293c060a1aedded24');
      expect(tag).toBe('promptfm-infra/rollback-be73865');
    });

    it('creates promptfm-infra/rollback-<version> when target is a release tag or version', () => {
      const tag = formatInfraRollbackTag('promptfm-infra/0.2.0-be73865');
      expect(tag).toBe('promptfm-infra/rollback-0.2.0-be73865');
      expect(formatInfraRollbackTag('v0.2.0')).toBe('promptfm-infra/rollback-0.2.0');
    });

    it('throws error if target ref is empty', () => {
      expect(() => formatInfraRollbackTag('')).toThrow('Rollback reference cannot be empty');
      expect(() => formatInfraRollbackTag('   ')).toThrow('Rollback reference cannot be empty');
    });
  });

  describe('formatSqlRollbackTag', () => {
    it('creates promptfm-sql/rollback-<sha> when target is a commit sha', () => {
      const tag = formatSqlRollbackTag('be7386564e16dcaaab5f423293c060a1aedded24');
      expect(tag).toBe('promptfm-sql/rollback-be73865');
    });

    it('creates promptfm-sql/rollback-<version> when target is a release tag or version', () => {
      const tag = formatSqlRollbackTag('promptfm-sql/0.2.0-be73865');
      expect(tag).toBe('promptfm-sql/rollback-0.2.0-be73865');
      expect(formatSqlRollbackTag('20261108_table')).toBe('promptfm-sql/rollback-20261108_table');
    });

    it('throws error if target ref is empty', () => {
      expect(() => formatSqlRollbackTag('')).toThrow('Rollback reference cannot be empty');
      expect(() => formatSqlRollbackTag('   ')).toThrow('Rollback reference cannot be empty');
    });
  });

  describe('formatSqlTag', () => {
    it('formats a tag with promptfm-sql/<version>-<short_hash>', () => {
      const tag = formatSqlTag('0.2.0', 'be7386564e16dcaaab5f423293c060a1aedded24');
      expect(tag).toBe('promptfm-sql/0.2.0-be73865');
    });

    it('strips leading "v" from version if present', () => {
      const tag = formatSqlTag('v1.0.0', '1234567890abcdef');
      expect(tag).toBe('promptfm-sql/1.0.0-1234567');
    });

    it('throws error if version or commit sha is empty', () => {
      expect(() => formatSqlTag('', '1234567')).toThrow('Version cannot be empty');
      expect(() => formatSqlTag('1.0.0', '')).toThrow('Commit SHA cannot be empty');
    });
  });

  describe('formatInfraTag', () => {
    it('formats a tag with promptfm-infra/<version>-<short_hash>', () => {
      const tag = formatInfraTag('0.2.0', 'be7386564e16dcaaab5f423293c060a1aedded24');
      expect(tag).toBe('promptfm-infra/0.2.0-be73865');
    });

    it('strips leading "v" from version if present', () => {
      const tag = formatInfraTag('v2.1.0', 'abcdef123456');
      expect(tag).toBe('promptfm-infra/2.1.0-abcdef1');
    });

    it('throws error if version or commit sha is empty', () => {
      expect(() => formatInfraTag('', '1234567')).toThrow('Version cannot be empty');
      expect(() => formatInfraTag('1.0.0', '')).toThrow('Commit SHA cannot be empty');
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

  describe('createGitReleaseTag', () => {
    it('generates sql release tag and calls git commands', () => {
      const executedCmds: string[] = [];
      const mockExec = (cmd: string) => {
        executedCmds.push(cmd);
        if (cmd.includes('git rev-parse HEAD')) return 'be7386564e16dcaaab5f423293c060a1aedded24';
        return '';
      };

      const res = createGitReleaseTag('sql', {
        version: '0.2.0',
        execFn: mockExec,
      });

      expect(res.tag).toBe('promptfm-sql/0.2.0-be73865');
      expect(res.executed).toBe(true);
      expect(executedCmds.some((c) => c.includes('git tag -a "promptfm-sql/0.2.0-be73865"'))).toBe(true);
      expect(executedCmds.some((c) => c.includes('git push origin "promptfm-sql/0.2.0-be73865"'))).toBe(true);
    });

    it('generates infra release tag and respects dryRun', () => {
      const executedCmds: string[] = [];
      const mockExec = (cmd: string) => {
        executedCmds.push(cmd);
        return '';
      };

      const res = createGitReleaseTag('infra', {
        version: '0.2.0',
        sha: '1234567890abcdef',
        dryRun: true,
        execFn: mockExec,
      });

      expect(res.tag).toBe('promptfm-infra/0.2.0-1234567');
      expect(res.executed).toBe(false);
      expect(executedCmds.length).toBe(0);
    });

    it('generates infra-rollback and sql-rollback tags', () => {
      const executedCmds: string[] = [];
      const mockExec = (cmd: string) => {
        executedCmds.push(cmd);
        return '';
      };

      const infraRes = createGitReleaseTag('infra-rollback', {
        targetRef: 'be7386564e16dcaaab5f423293c060a1aedded24',
        dryRun: true,
        execFn: mockExec,
      });
      expect(infraRes.tag).toBe('promptfm-infra/rollback-be73865');

      const sqlRes = createGitReleaseTag('sql-rollback', {
        targetRef: '20261108_initial',
        dryRun: true,
        execFn: mockExec,
      });
      expect(sqlRes.tag).toBe('promptfm-sql/rollback-20261108_initial');
    });

    it('handles git push errors non-fatally and returns executed=false', () => {
      const mockExec = (cmd: string) => {
        if (cmd.includes('git rev-parse HEAD')) return '1234567890abcdef';
        if (cmd.includes('git push')) throw new Error('Permission denied');
        return '';
      };

      const res = createGitReleaseTag('release', {
        version: '0.2.0',
        execFn: mockExec,
      });

      expect(res.tag).toBe('promptfm/0.2.0-1234567');
      expect(res.executed).toBe(false);
    });
  });
});
