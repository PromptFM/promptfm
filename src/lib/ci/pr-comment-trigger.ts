// src/lib/ci/pr-comment-trigger.ts
// Command parser and authorization verifier for /pr-link PR comment triggers.

export const DEFAULT_CORE_MEMBERS = ['atrifan', 'PromptFM/core'];

/**
 * Checks whether a comment body contains an explicit /pr-link or /preview trigger command.
 * Commands must appear as a leading token or standalone line to prevent false positives.
 */
export function isPrLinkCommand(commentBody: string): boolean {
  if (!commentBody) return false;

  const normalized = commentBody.trim();
  const lines = normalized.split('\n').map((l) => l.trim().toLowerCase());

  return lines.some((line) => {
    return (
      line === '/pr-link' ||
      line.startsWith('/pr-link ') ||
      line === '/preview' ||
      line.startsWith('/preview ')
    );
  });
}

/**
 * Verifies whether the commenter has core team authority to trigger Vercel preview builds.
 * Authorized associations: OWNER, MEMBER, COLLABORATOR.
 * Also checks explicit core team list (e.g. atrifan).
 */
export function isAuthorizedCoreMember(
  authorAssociation: string,
  username?: string,
  coreMembers: string[] = DEFAULT_CORE_MEMBERS
): boolean {
  const cleanAssoc = (authorAssociation || '').trim().toUpperCase();

  if (['OWNER', 'MEMBER', 'COLLABORATOR'].includes(cleanAssoc)) {
    return true;
  }

  if (username) {
    const cleanUser = username.trim().toLowerCase();
    const isExplicitCore = coreMembers.some(
      (member) => member.toLowerCase() === cleanUser
    );
    if (isExplicitCore) {
      return true;
    }
  }

  return false;
}

/**
 * Formats the markdown success message posted on the PR once the preview link is ready.
 */
export function formatPrLinkComment(
  sha: string,
  previewUrl: string,
  requestedBy?: string
): string {
  const requesterNotice = requestedBy ? ` (requested by @${requestedBy})` : '';
  return `### 🔍 Vercel Preview Link Ready!

- **Target SHA:** \`${sha}\`
- **Preview URL:** [${previewUrl}](${previewUrl})
- **Trigger:** \`/pr-link\`${requesterNotice}

*Deployed under the PromptFM \$0 budget policy.*`;
}

/**
 * Formats the rejection message when an unauthorized user attempts to trigger /pr-link.
 */
export function formatUnauthorizedComment(requestedBy: string): string {
  return `⚠️ @${requestedBy}, only PromptFM core maintainers and administrators can trigger Vercel preview deployments with \`/pr-link\`.

To request a preview link, ask a member of the Board (**@atrifan**) or wait for a core maintainer to review and run the preview deployment.`;
}

