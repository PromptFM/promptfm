// src/lib/infra/budget-gate.ts
// $0 Infra Budget Gate & Vercel Preview Protection Policy Engine
// Enforces zero-cost operational guardrails across Vercel serverless compute and GitHub Actions CI.

export interface VercelBuildParams {
  vercelEnv: 'production' | 'preview' | 'development' | string;
  gitBranch?: string;
  gitTag?: string;
  gitCommitRef?: string;
  commitMessage?: string;
  pullRequestId?: string;
  isFork?: boolean;
  isForkApproved?: boolean;
  changedFiles?: string[];
  enableAutoPreviews?: boolean;
  forcePreview?: boolean;
  enableMainProductionDeploys?: boolean;
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
const DEPLOY_PROD_REGEX = /\[(deploy-prod|force-deploy|release)\]/i;

const PROMPTFM_TAG_REGEX = /^promptfm\/[a-zA-Z0-9._-]+$/;
const SEMVER_TAG_REGEX = /^v\d+(\.\d+)*(-[a-zA-Z0-9._-]+)?$/;
const DOCS_TAG_REGEX = /^gh-pages\/[a-zA-Z0-9._-]+$/;

/**
 * Returns true if the git ref is a production application release tag (e.g. promptfm/v1.0.0, promptfm/0.1.0, v1.0.0).
 */
export function isReleaseTag(ref?: string): boolean {
  if (!ref) return false;
  return PROMPTFM_TAG_REGEX.test(ref) || SEMVER_TAG_REGEX.test(ref);
}

/**
 * Returns true if the git ref is a documentation GitHub Pages tag (e.g. gh-pages/v1.0.0).
 */
export function isDocReleaseTag(ref?: string): boolean {
  if (!ref) return false;
  return DOCS_TAG_REGEX.test(ref);
}

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
  // 1. Tag-Based Production Deployment Gating (Issue #123)
  if (params.vercelEnv === 'production') {
    const ref = params.gitTag || params.gitCommitRef || params.gitBranch || '';
    const commitMsg = params.commitMessage || '';
    const hasDeployProdTag = DEPLOY_PROD_REGEX.test(commitMsg);

    if (isDocReleaseTag(ref)) {
      return {
        shouldBuild: false,
        exitCode: 0,
        reason: 'GitHub Pages doc release tags do not deploy to Vercel (docs deploy to GitHub Pages only)',
      };
    }

    if (params.enableMainProductionDeploys === true) {
      return {
        shouldBuild: true,
        exitCode: 1,
        reason: 'Production deployment permitted: Manual override (enableMainProductionDeploys=true)',
      };
    }

    if (hasDeployProdTag) {
      return {
        shouldBuild: true,
        exitCode: 1,
        reason: 'Production deployment permitted: Explicit [deploy-prod] commit tag override',
      };
    }

    if (isReleaseTag(ref)) {
      return {
        shouldBuild: true,
        exitCode: 1,
        reason: `Production deployment permitted: Tagged production release permitted (${ref})`,
      };
    }

    // Default for production on main or untagged commits: STOP AUTO-DEPLOY TO SAVE ACTIVE CPU
    return {
      shouldBuild: false,
      exitCode: 0,
      reason: 'Production auto-deploy from main disabled under $0 budget policy. Production deploys require a release tag (promptfm/<version> or v<version>).',
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

