import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GitHub Branch Protection, CODEOWNERS & Production Gate Rulesets', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const codeownersPath = path.join(rootDir, '.github/CODEOWNERS');
  const githubTfPath = path.join(rootDir, 'infra/terraform/github.tf');

  it('validates .github/CODEOWNERS assigns @PromptFM/core and @atrifan for root, infra, and workflows', () => {
    expect(fs.existsSync(codeownersPath)).toBe(true);
    const content = fs.readFileSync(codeownersPath, 'utf8');

    expect(content).toContain('* @PromptFM/core @atrifan');
    expect(content).toContain('infra/ @PromptFM/core @atrifan');
    expect(content).toContain('.github/ @PromptFM/core @atrifan');
  });

  it('validates infra/terraform/github.tf declares Main Branch Production Gate ruleset', () => {
    expect(fs.existsSync(githubTfPath)).toBe(true);
    const content = fs.readFileSync(githubTfPath, 'utf8');

    // Ruleset resource
    expect(content).toContain('resource "github_repository_ruleset" "main_branch_gate"');
    expect(content).toContain('enforcement = "active"');
    expect(content).toContain('~DEFAULT_BRANCH');

    // Restrict direct & force pushes
    expect(content).toContain('non_fast_forward = true');
    expect(content).toContain('deletion         = true');

    // PR Requirements & CODEOWNERS approval
    expect(content).toContain('pull_request {');
    expect(content).toContain('required_approving_review_count   = 1');
    expect(content).toContain('require_code_owner_review         = true');
    expect(content).toContain('dismiss_stale_reviews_on_push     = true');

    // Core team & admin bypass for PR merging only
    expect(content).toContain('actor_id    = 20507550 # @PromptFM/core team');
    expect(content).toContain('bypass_mode = "pull_request"');
    expect(content).toContain('actor_id    = 5 # Repository Admin Role');

    // 6 Required Status Checks
    expect(content).toContain('context = "lint-and-typecheck"');
    expect(content).toContain('context = "unit-and-integration-tests"');
    expect(content).toContain('context = "mutation-testing"');
    expect(content).toContain('context = "terraform-lint-validate"');
    expect(content).toContain('context = "secret-leak-detection"');
    expect(content).toContain('context = "codeql-security-scan"');
  });

  it('keeps the CI apply from editing the ruleset bypass actors, which the workflow token cannot read or write', () => {
    const tf = fs.readFileSync(path.join(rootDir, 'infra/terraform/github.tf'), 'utf8');
    const block = tf.split('resource "github_repository_ruleset" "main_branch_gate"')[1]?.split('\n}\n')[0] ?? '';
    expect(block).toMatch(/lifecycle\s*\{\s*ignore_changes\s*=\s*\[bypass_actors\]/);
  });

  it('validates .github/RULESET.md documents ruleset ID, direct push prohibition, bypass modes, and CODEOWNERS integration', () => {
    const rulesetMdPath = path.join(rootDir, '.github/RULESET.md');
    expect(fs.existsSync(rulesetMdPath)).toBe(true);
    const content = fs.readFileSync(rulesetMdPath, 'utf8');

    expect(content).toContain('Main Branch Production Gate');
    expect(content).toContain('26815412');
    expect(content).toContain('pull_request');
    expect(content).toContain('@PromptFM/core');
    expect(content).toContain('non_fast_forward');
  });
});

