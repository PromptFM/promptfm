#!/usr/bin/env node
// scripts/vercel-budget-gate.js
// Standalone zero-dependency runtime gate for Vercel's Ignored Build Step (ignoreCommand).
// Determines whether Vercel builds the preview or cancels to protect the $0 infra budget.
//
// Exit code 1 = PROCEED with build
// Exit code 0 = CANCEL/SKIP build

const { execSync } = require('child_process');

function getChangedFiles() {
  try {
    const prevSha = process.env.VERCEL_GIT_PREVIOUS_SHA;
    const currentSha = process.env.VERCEL_GIT_COMMIT_SHA || 'HEAD';

    if (prevSha && prevSha !== currentSha) {
      const output = execSync(`git diff --name-only ${prevSha} ${currentSha}`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return output.trim().split('\n').filter(Boolean);
    }

    // Fallback: compare with HEAD^
    const output = execSync('git diff --name-only HEAD^ HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // If git diff fails (e.g. shallow clone or initial commit), return empty
    return [];
  }
}

function runGate() {
  const vercelEnv = process.env.VERCEL_ENV || 'preview';
  const gitBranch = process.env.VERCEL_GIT_COMMIT_REF || '';
  const commitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE || '';
  const isFork = process.env.VERCEL_GIT_IS_PULL_REQUEST_FROM_FORK === '1' || process.env.VERCEL_GIT_IS_PULL_REQUEST_FROM_FORK === 'true';
  const isForkApproved = process.env.APPROVE_FORK_PREVIEWS === 'true' || process.env.APPROVE_FORK_PREVIEWS === '1';
  const enableAutoPreviews = process.env.ENABLE_AUTO_PREVIEWS === 'true' || process.env.ENABLE_AUTO_PREVIEWS === '1';

  console.log(`[PromptFM Budget Gate] Evaluating deployment: env=${vercelEnv}, branch=${gitBranch}, isFork=${isFork}`);

  // 1. Production deployments always proceed
  if (vercelEnv === 'production') {
    console.log('[PromptFM Budget Gate] ✅ Proceeding: Production deployment.');
    process.exit(1);
  }

  // 2. Explicit skip overrides
  if (/\[(skip preview|skip vercel|no-preview|skip ci)\]/i.test(commitMessage)) {
    console.log('[PromptFM Budget Gate] 🛑 Skipped: Commit message contains skip preview tag.');
    process.exit(0);
  }

  // 3. Automated dependency bot branches
  if (gitBranch.startsWith('dependabot/') || gitBranch.startsWith('renovate/')) {
    console.log('[PromptFM Budget Gate] 🛑 Skipped: Automated dependency bot previews disabled to protect $0 budget.');
    process.exit(0);
  }

  // 4. Explicit force preview requested via commit tag
  const isForced = /\[(preview|deploy-preview|run-preview)\]/i.test(commitMessage);

  // 5. Forked PR security & budget protection
  if (isFork && !isForkApproved) {
    console.log('[PromptFM Budget Gate] 🛑 Skipped: Forked PR preview requires maintainer authorization to prevent unauthorized CPU burn.');
    process.exit(0);
  }

  // 6. Non-application changes check
  const changedFiles = getChangedFiles();
  if (changedFiles.length > 0) {
    const nonAppRegex = /(\.md$|^docs\/|^infra\/|^\.github\/|^\.gitleaksignore$|^LICENSE$|^\.env\.local\.example$)/i;
    const allNonApp = changedFiles.every((f) => nonAppRegex.test(f));
    if (allNonApp) {
      console.log('[PromptFM Budget Gate] 🛑 Skipped: Only non-application documentation or infra files changed.');
      process.exit(0);
    }
  }

  // 7. If explicitly forced after passing security checks, allow
  if (isForced) {
    console.log('[PromptFM Budget Gate] ✅ Proceeding: Preview explicitly requested via commit tag.');
    process.exit(1);
  }

  // 8. Automatic previews budget policy
  if (enableAutoPreviews) {
    console.log('[PromptFM Budget Gate] ✅ Proceeding: Automatic previews enabled.');
    process.exit(1);
  }

  // Default: Gated under $0 budget
  console.log('[PromptFM Budget Gate] 🛑 Skipped: Automatic preview generation disabled under $0 budget policy. (Tag commit with [preview] to trigger preview deployment).');
  process.exit(0);
}

runGate();

