// src/lib/infra/budget-gate.ts
// $0 Infra Budget Gate & Vercel Preview Protection Policy Engine
// Enforces zero-cost operational guardrails across Vercel serverless compute and GitHub Actions CI.

export interface VercelBuildParams {
  vercelEnv: 'production' | 'preview' | 'development' | string;
  gitBranch?: string;
  commitMessage?: string;
  pullRequestId?: string;
  isFork?: boolean;
  isForkApproved?: boolean;
  changedFiles?: string[];
  enableAutoPreviews?: boolean;
  forcePreview?: boolean;
}

export interface BudgetGateDecision {
  shouldBuild: boolean;
  reason: string;
  exitCode: 0 | 1; // 1 = proceed with build, 0 = skip/cancel in Vercel ignoreCommand
}

export interface InfraBudgetPolicy {
  monthlyCostTargetUsd: number;
  vercelActiveCpuWarningThresholdPercent: number;
  vercelMaxActiveCpuHoursHobby: number;
  forkPreviewsRequireApproval: boolean;
  autoPreviewsEnabledByDefault: boolean;
  protectedPreviewAccess: boolean;
}

export interface CIJobEvaluationParams {
  changedFiles: string[];
  actor: string;
}

export interface CIJobDecisions {
  lintAndTypecheck: boolean;
  unitAndIntegrationTests: boolean;
  playwrightE2E: boolean;
  mutationTesting: boolean;
  terraformValidate: boolean;
  codeqlSecurityScan: boolean;
  packageVulnerabilityScan: boolean;
}

const NON_APP_FILE_PATTERNS = [
  /\.md$/i,
  /^docs\//i,
  /^infra\//i,
  /^\.github\//i,
  /^\.gitleaksignore$/i,
  /^LICENSE$/i,
  /^\.env\.local\.example$/i,
];

const SKIP_PREVIEW_REGEX = /\[(skip preview|skip vercel|no-preview|skip ci)\]/i;
const FORCE_PREVIEW_REGEX = /\[(preview|deploy-preview|run-preview)\]/i;

/**
 * Returns true if the file does not impact the production web runtime.
 */
export function isNonApplicationFile(filePath: string): boolean {
  return NON_APP_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Evaluates whether a Vercel deployment build should proceed or be cancelled/skipped.
 */
export function shouldBuildVercelDeployment(params: VercelBuildParams): BudgetGateDecision {
  // 1. Production deployments always proceed
  if (params.vercelEnv === 'production') {
    return {
      shouldBuild: true,
      exitCode: 1,
      reason: 'Production deployments always proceed',
    };
  }

  // 2. Explicit skip overrides in commit message
  if (params.commitMessage && SKIP_PREVIEW_REGEX.test(params.commitMessage)) {
    return {
      shouldBuild: false,
      exitCode: 0,
      reason: 'Skipped via commit message tag',
    };
  }

  // 3. Automated dependency bot branches (Dependabot, Renovate)
  if (
    params.gitBranch &&
    (params.gitBranch.startsWith('dependabot/') || params.gitBranch.startsWith('renovate/'))
  ) {
    return {
      shouldBuild: false,
      exitCode: 0,
      reason: 'Automated dependency bot previews disabled to protect free tier',
    };
  }

  // 4. Explicit force preview requested via commit tag or parameter
  const hasForceTag = params.commitMessage ? FORCE_PREVIEW_REGEX.test(params.commitMessage) : false;
  const isForced = params.forcePreview === true || hasForceTag;

  // 5. Forked PR security & budget protection
  if (params.isFork === true && params.isForkApproved !== true) {
    return {
      shouldBuild: false,
      exitCode: 0,
      reason: 'Forked PR preview requires maintainer authorization to prevent unauthorized CPU burn',
    };
  }

  // 6. Non-application changes check (pure docs, pure infra, etc.)
  if (params.changedFiles && params.changedFiles.length > 0) {
    const allNonApp = params.changedFiles.every(isNonApplicationFile);
    if (allNonApp) {
      return {
        shouldBuild: false,
        exitCode: 0,
        reason: 'Only non-application documentation or infra files changed',
      };
    }
  }

  // If explicitly forced after passing security checks, allow
  if (isForced) {
    return {
      shouldBuild: true,
      exitCode: 1,
      reason: 'Preview explicitly requested via tag or flag',
    };
  }

  // 7. Automatic previews budget policy
  if (params.enableAutoPreviews === true) {
    return {
      shouldBuild: true,
      exitCode: 1,
      reason: 'Preview build permitted by policy',
    };
  }

  // Default: Gated under $0 budget
  return {
    shouldBuild: false,
    exitCode: 0,
    reason: 'Automatic preview generation disabled under $0 budget policy (use [preview] tag to opt-in)',
  };
}

/**
 * Returns the active PromptFM $0 infrastructure policy constraints.
 */
export function getInfraBudgetPolicy(): InfraBudgetPolicy {
  return {
    monthlyCostTargetUsd: 0,
    vercelActiveCpuWarningThresholdPercent: 75,
    vercelMaxActiveCpuHoursHobby: 4,
    forkPreviewsRequireApproval: true,
    autoPreviewsEnabledByDefault: false,
    protectedPreviewAccess: true,
  };
}

/**
 * Determines which GitHub Actions CI jobs should run for a given PR or ref.
 */
export function evaluateCIJobsForPR(params: CIJobEvaluationParams): CIJobDecisions {
  const isDependabot = params.actor === 'dependabot[bot]';
  const hasChangedFiles = params.changedFiles && params.changedFiles.length > 0;

  const isDocOnly = hasChangedFiles && params.changedFiles.every(isNonApplicationFile);

  const hasInfraChanges = hasChangedFiles && params.changedFiles.some((f) =>
    /^infra\//i.test(f) || /^\.github\/workflows\/ci\.yml$/i.test(f)
  );

  const hasUIOrRouteChanges = hasChangedFiles && params.changedFiles.some((f) =>
    /^src\/(app|components)\//i.test(f) ||
    /^playwright\.config\.ts$/i.test(f) ||
    /^tests\/e2e\//i.test(f)
  );

  const hasCoreDomainChanges = hasChangedFiles && params.changedFiles.some((f) =>
    /^src\/lib\/(dj|community|radio|guardrails|legal|safety|infra)\//i.test(f) ||
    /^tests\/unit\//i.test(f) ||
    /^tests\/integration\//i.test(f)
  );

  return {
    lintAndTypecheck: true,
    unitAndIntegrationTests: !isDocOnly,
    playwrightE2E: !isDependabot && !isDocOnly && hasUIOrRouteChanges,
    mutationTesting: !isDependabot && !isDocOnly && hasCoreDomainChanges,
    terraformValidate: hasInfraChanges,
    codeqlSecurityScan: !isDependabot && !isDocOnly,
    packageVulnerabilityScan: true,
  };
}

