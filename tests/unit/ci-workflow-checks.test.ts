import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseWorkflowJobs,
  validateCIWorkflow,
  REQUIRED_BRANCH_PROTECTION_CHECKS,
  WorkflowJob,
} from '@/lib/ci/workflow-validator';

describe('CI Workflow & Branch Protection Check Alignment', () => {
  const ciWorkflowPath = path.resolve(__dirname, '../../.github/workflows/ci.yml');

  describe('REQUIRED_BRANCH_PROTECTION_CHECKS', () => {
    it('contains the 6 required contexts registered in GitHub branch protection', () => {
      expect(REQUIRED_BRANCH_PROTECTION_CHECKS).toEqual([
        'lint-and-typecheck',
        'unit-and-integration-tests',
        'mutation-testing',
        'terraform-lint-validate',
        'secret-leak-detection',
        'codeql-security-scan',
      ]);
    });
  });

  describe('parseWorkflowJobs', () => {
    it('defaults reported check name to job ID when name is omitted', () => {
      const yaml = `
name: CI
jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - name: Step 1
        run: npm run lint
`;
      const jobs = parseWorkflowJobs(yaml);
      expect(jobs.size).toBe(1);
      const job = jobs.get('lint-and-typecheck') as WorkflowJob;
      expect(job).toBeDefined();
      expect(job.id).toBe('lint-and-typecheck');
      expect(job.reportedCheckName).toBe('lint-and-typecheck');
      expect(job.hasCustomName).toBe(false);
      expect(job.customName).toBeUndefined();
    });

    it('extracts custom name when explicitly declared with quotes or unquoted', () => {
      const yaml = `
jobs:
  job-a:
    name: "🔍 Custom Double Quoted"
    runs-on: ubuntu-latest
  job-b:
    name: '🧪 Custom Single Quoted'
    runs-on: ubuntu-latest
  job-c:
    name: Plain Unquoted Name
    runs-on: ubuntu-latest
`;
      const jobs = parseWorkflowJobs(yaml);
      expect(jobs.get('job-a')?.reportedCheckName).toBe('🔍 Custom Double Quoted');
      expect(jobs.get('job-a')?.hasCustomName).toBe(true);

      expect(jobs.get('job-b')?.reportedCheckName).toBe('🧪 Custom Single Quoted');
      expect(jobs.get('job-b')?.hasCustomName).toBe(true);

      expect(jobs.get('job-c')?.reportedCheckName).toBe('Plain Unquoted Name');
      expect(jobs.get('job-c')?.hasCustomName).toBe(true);
    });

    it('does not confuse step names or nested step properties with job names', () => {
      const yaml = `
jobs:
  unit-and-integration-tests:
    name: unit-and-integration-tests
    runs-on: ubuntu-latest
    steps:
      - name: 🧪 Vitest Step One
        run: npm test
      - run: echo upload
    name: ignored-after-steps
`;
      const jobs = parseWorkflowJobs(yaml);
      expect(jobs.size).toBe(1);
      const job = jobs.get('unit-and-integration-tests');
      expect(job?.reportedCheckName).toBe('unit-and-integration-tests');
      expect(job?.hasCustomName).toBe(true);
      expect(job?.customName).toBe('unit-and-integration-tests');
    });

    it('correctly parses jobs when top-level sections precede and follow jobs block', () => {
      const yaml = `
name: CI Pipeline
on:
  push:
    branches: [main]

jobs:
  job-before:
    runs-on: ubuntu-latest
  job-with-steps:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi

concurrency:
  group: test-group
  cancel-in-progress: true
`;
      const jobs = parseWorkflowJobs(yaml);
      expect(jobs.size).toBe(2);
      expect(jobs.has('job-before')).toBe(true);
      expect(jobs.has('job-with-steps')).toBe(true);
      expect(jobs.has('group')).toBe(false);
      expect(jobs.has('cancel-in-progress')).toBe(false);
      expect(jobs.get('job-before')?.reportedCheckName).toBe('job-before');
      expect(jobs.get('job-with-steps')?.reportedCheckName).toBe('job-with-steps');
    });

    it('handles mismatched quotes and preserves raw unquoted string with whitespace trimmed', () => {
      const yaml = `
jobs:
  mismatched-double:
    name: "starts-with-quote-only
    runs-on: ubuntu-latest
  mismatched-single:
    name: starts-without-quote'
    runs-on: ubuntu-latest
  mismatched-cross-1:
    name: "start-double-end-single'
    runs-on: ubuntu-latest
  mismatched-cross-2:
    name: 'start-single-end-double"
    runs-on: ubuntu-latest
  padded-name:
    name:    unquoted-trimmed-name   
    runs-on: ubuntu-latest
  outer-spaced-quotes:
    name:    "quoted-with-outer-spaces"   
    runs-on: ubuntu-latest
`;
      const jobs = parseWorkflowJobs(yaml);
      expect(jobs.get('mismatched-double')?.reportedCheckName).toBe('"starts-with-quote-only');
      expect(jobs.get('mismatched-single')?.reportedCheckName).toBe("starts-without-quote'");
      expect(jobs.get('mismatched-cross-1')?.reportedCheckName).toBe('"start-double-end-single\'');
      expect(jobs.get('mismatched-cross-2')?.reportedCheckName).toBe('\'start-single-end-double"');
      expect(jobs.get('padded-name')?.reportedCheckName).toBe('unquoted-trimmed-name');
      expect(jobs.get('outer-spaced-quotes')?.reportedCheckName).toBe('quoted-with-outer-spaces');
    });

    it('handles empty or comments-only content safely', () => {
      expect(parseWorkflowJobs('').size).toBe(0);
      expect(parseWorkflowJobs(null as unknown as string).size).toBe(0);
      expect(parseWorkflowJobs(undefined as unknown as string).size).toBe(0);
      expect(parseWorkflowJobs('# Just comments\n# Another comment').size).toBe(0);
      expect(parseWorkflowJobs('invalid: yaml: structure').size).toBe(0);
      // Malformed lines before job ID
      const withOrphan = parseWorkflowJobs(`
jobs:
    malformed-orphan-property: true
    name: orphan-name
    steps:
      - run: echo bad
  real-job:
    runs-on: ubuntu-latest
`);
      expect(withOrphan.size).toBe(1);
      expect(withOrphan.has('real-job')).toBe(true);
      expect(withOrphan.get('real-job')?.reportedCheckName).toBe('real-job');
    });
  });

  describe('validateCIWorkflow', () => {
    it('passes when all required checks are present and report matching names', () => {
      const validYaml = `
jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
  unit-and-integration-tests:
    runs-on: ubuntu-latest
  mutation-testing:
    runs-on: ubuntu-latest
  terraform-lint-validate:
    runs-on: ubuntu-latest
  secret-leak-detection:
    runs-on: ubuntu-latest
  codeql-security-scan:
    runs-on: ubuntu-latest
`;
      const result = validateCIWorkflow(validYaml);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.missingRequiredChecks).toHaveLength(0);
      expect(result.mismatchedChecks).toHaveLength(0);
    });

    it('passes when jobs explicitly declare name equal to their job id', () => {
      const validYamlWithMatchingName = `
jobs:
  lint-and-typecheck:
    name: lint-and-typecheck
    runs-on: ubuntu-latest
  unit-and-integration-tests:
    name: unit-and-integration-tests
    runs-on: ubuntu-latest
  mutation-testing:
    name: mutation-testing
    runs-on: ubuntu-latest
  terraform-lint-validate:
    name: terraform-lint-validate
    runs-on: ubuntu-latest
  secret-leak-detection:
    name: secret-leak-detection
    runs-on: ubuntu-latest
  codeql-security-scan:
    name: codeql-security-scan
    runs-on: ubuntu-latest
`;
      const result = validateCIWorkflow(validYamlWithMatchingName);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails when a required branch protection check is missing', () => {
      const missingJobYaml = `
jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
`;
      const result = validateCIWorkflow(missingJobYaml);
      expect(result.valid).toBe(false);
      expect(result.missingRequiredChecks).toContain('unit-and-integration-tests');
      expect(result.missingRequiredChecks).toContain('mutation-testing');
      expect(result.errors.some((e) => e.includes('Missing required branch protection job'))).toBe(true);
    });

    it('fails when a required check reports a mismatched check name (e.g. emoji decoration)', () => {
      const mismatchedYaml = `
jobs:
  lint-and-typecheck:
    name: 🔍 Lint & Static Types
    runs-on: ubuntu-latest
  unit-and-integration-tests:
    runs-on: ubuntu-latest
  mutation-testing:
    runs-on: ubuntu-latest
  terraform-lint-validate:
    runs-on: ubuntu-latest
  secret-leak-detection:
    runs-on: ubuntu-latest
  codeql-security-scan:
    runs-on: ubuntu-latest
`;
      const result = validateCIWorkflow(mismatchedYaml);
      expect(result.valid).toBe(false);
      expect(result.mismatchedChecks).toEqual([
        {
          jobId: 'lint-and-typecheck',
          expected: 'lint-and-typecheck',
          actual: '🔍 Lint & Static Types',
        },
      ]);
      expect(result.errors.some((e) => e.includes("reports check name '🔍 Lint & Static Types'"))).toBe(true);
    });

    it('reports both missing and mismatched checks simultaneously when both are present', () => {
      const complexFailureYaml = `
jobs:
  lint-and-typecheck:
    name: mismatched-lint-name
    runs-on: ubuntu-latest
`;
      const result = validateCIWorkflow(complexFailureYaml);
      expect(result.valid).toBe(false);
      expect(result.mismatchedChecks).toHaveLength(1);
      expect(result.missingRequiredChecks).toHaveLength(5);
      expect(result.errors).toHaveLength(6);
    });

    it('validates custom required check arrays', () => {
      const customYaml = `
jobs:
  custom-job-1:
    runs-on: ubuntu-latest
  custom-job-2:
    name: custom-job-2
    runs-on: ubuntu-latest
`;
      const result = validateCIWorkflow(customYaml, ['custom-job-1', 'custom-job-2']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('handles empty string or non-string input safely', () => {
      const result = validateCIWorkflow('');
      expect(result.valid).toBe(false);
      expect(result.missingRequiredChecks).toHaveLength(REQUIRED_BRANCH_PROTECTION_CHECKS.length);
    });
  });

  describe('Real Repository CI Workflow File (.github/workflows/ci.yml)', () => {
    it('exists in repository', () => {
      expect(fs.existsSync(ciWorkflowPath)).toBe(true);
    });

    it('satisfies branch protection required checks without getting stuck at Expected', () => {
      const ciYaml = fs.readFileSync(ciWorkflowPath, 'utf-8');
      const result = validateCIWorkflow(ciYaml);

      if (!result.valid) {
        // Output clear diagnostic info if validation fails
        console.error('CI Workflow Validation Errors:', result.errors);
      }

      expect(result.missingRequiredChecks).toHaveLength(0);
      expect(result.mismatchedChecks).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toBe(true);
    });

    it('verifies all jobs in ci.yml have consistent reported check names matching their job ids', () => {
      const ciYaml = fs.readFileSync(ciWorkflowPath, 'utf-8');
      const jobs = parseWorkflowJobs(ciYaml);

      expect(jobs.size).toBeGreaterThanOrEqual(6);
      for (const [jobId, job] of jobs.entries()) {
        expect(job.reportedCheckName).toBe(jobId);
      }
    });
  });
});
