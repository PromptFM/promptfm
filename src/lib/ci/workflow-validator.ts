/**
 * CI Workflow and GitHub Branch Protection Alignment Validator
 *
 * Ensures that workflow job declarations in GitHub Actions report check names
 * that match the exact contexts configured in repository branch protection.
 *
 * Prevents PR status checks from staying stuck at "Expected — Waiting for status to be reported".
 * See issue #63.
 */

export const REQUIRED_BRANCH_PROTECTION_CHECKS = [
  'lint-and-typecheck',
  'unit-and-integration-tests',
  'mutation-testing',
  'terraform-lint-validate',
  'secret-leak-detection',
  'codeql-security-scan',
] as const;

export type RequiredCheckContext = (typeof REQUIRED_BRANCH_PROTECTION_CHECKS)[number];

export interface WorkflowJob {
  id: string;
  customName?: string;
  reportedCheckName: string;
  hasCustomName: boolean;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  jobs: WorkflowJob[];
  missingRequiredChecks: string[];
  mismatchedChecks: Array<{
    jobId: string;
    expected: string;
    actual: string;
  }>;
}

/**
 * Strips matching surrounding single or double quotes from a string.
 */
function cleanQuotedString(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parses GitHub Actions workflow YAML and extracts declared jobs and their reported check names.
 */
export function parseWorkflowJobs(yamlContent: string): Map<string, WorkflowJob> {
  const jobs = new Map<string, WorkflowJob>();
  if (!yamlContent || typeof yamlContent !== 'string') {
    return jobs;
  }

  const lines = yamlContent.split('\n');
  let inJobsSection = false;
  let currentJobId: string | null = null;
  let currentCustomName: string | undefined = undefined;
  let inStepsSection = false;

  const saveCurrentJob = () => {
    if (currentJobId) {
      jobs.set(currentJobId, {
        id: currentJobId,
        customName: currentCustomName,
        reportedCheckName: currentCustomName ?? currentJobId,
        hasCustomName: currentCustomName !== undefined,
      });
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Ignore comment lines and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Top-level block keys (no indentation)
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      if (line.startsWith('jobs:')) {
        inJobsSection = true;
      } else if (inJobsSection) {
        // Exited jobs section
        saveCurrentJob();
        inJobsSection = false;
        currentJobId = null;
        currentCustomName = undefined;
        inStepsSection = false;
      }
      continue;
    }

    if (!inJobsSection) {
      continue;
    }

    // Job ID starts at exactly 2 spaces indentation: e.g. "  lint-and-typecheck:"
    const jobMatch = line.match(/^ {2}([a-zA-Z0-9_-]+):\s*$/);
    if (jobMatch?.[1]) {
      saveCurrentJob();
      currentJobId = jobMatch[1];
      currentCustomName = undefined;
      inStepsSection = false;
      continue;
    }

    if (!currentJobId) {
      continue;
    }

    // Entering steps section under current job (indented by 4 spaces)
    if (line.match(/^ {4}steps:\s*$/)) {
      inStepsSection = true;
      continue;
    }

    // Job properties at 4 spaces before steps section
    if (!inStepsSection) {
      const nameMatch = line.match(/^ {4}name:\s*(.+)$/);
      if (nameMatch?.[1]) {
        currentCustomName = cleanQuotedString(nameMatch[1]);
      }
    }
  }

  saveCurrentJob();
  return jobs;
}

/**
 * Validates workflow content against required branch protection status checks.
 */
export function validateCIWorkflow(
  yamlContent: string,
  requiredChecks: readonly string[] = REQUIRED_BRANCH_PROTECTION_CHECKS
): WorkflowValidationResult {
  const jobsMap = parseWorkflowJobs(yamlContent);
  const jobsList = Array.from(jobsMap.values());
  const missingRequiredChecks: string[] = [];
  const mismatchedChecks: Array<{ jobId: string; expected: string; actual: string }> = [];
  const errors: string[] = [];

  for (const requiredCheck of requiredChecks) {
    const job = jobsMap.get(requiredCheck);
    if (!job) {
      missingRequiredChecks.push(requiredCheck);
      errors.push(`Missing required branch protection job: '${requiredCheck}'`);
      continue;
    }

    if (job.reportedCheckName !== requiredCheck) {
      mismatchedChecks.push({
        jobId: requiredCheck,
        expected: requiredCheck,
        actual: job.reportedCheckName,
      });
      errors.push(
        `Job '${requiredCheck}' reports check name '${job.reportedCheckName}', but branch protection requires '${requiredCheck}'`
      );
    }
  }

  return {
    valid: missingRequiredChecks.length === 0 && mismatchedChecks.length === 0,
    errors,
    jobs: jobsList,
    missingRequiredChecks,
    mismatchedChecks,
  };
}
