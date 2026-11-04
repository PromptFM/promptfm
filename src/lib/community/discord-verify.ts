// src/lib/community/discord-verify.ts
// Discord Interaction Request Verification via Ed25519
// Verifies X-Signature-Ed25519 and X-Signature-Timestamp using Node.js crypto (zero external dependencies).

import crypto from 'crypto';

export interface VerifyDiscordSignatureParams {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  publicKey?: string;
}

export const DEFAULT_DISCORD_PUBLIC_KEY = '210ee1d5cc50b819ecd625d4affc05977bbd9b491c2b8f8ec9480a851d934579';

/**
 * Validates Ed25519 request signature from Discord Interactions.
 * Returns true if valid, false if invalid or headers missing.
 */
export function verifyDiscordSignature({
  rawBody,
  signature,
  timestamp,
  publicKey = process.env.DISCORD_PUBLIC_KEY || DEFAULT_DISCORD_PUBLIC_KEY,
}: VerifyDiscordSignatureParams): boolean {
  if (!signature || !timestamp || !publicKey) {
    return false;
  }

  try {
    const keyBuffer = Buffer.concat([
      Buffer.from('302a300506032b6570032100', 'hex'),
      Buffer.from(publicKey, 'hex'),
    ]);
    const pubKey = crypto.createPublicKey({ key: keyBuffer, format: 'der', type: 'spki' });
    const message = Buffer.from(timestamp + rawBody);
    const sigBuffer = Buffer.from(signature, 'hex');

    return crypto.verify(null, message, pubKey, sigBuffer);
  } catch {
    return false;
  }
}
