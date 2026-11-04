import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyDiscordSignature } from '@/lib/community/discord-verify';

describe('Discord Interaction Signature Verification (Ed25519)', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubKeyHex = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');

  it('validates a correct Ed25519 signature', () => {
    const timestamp = '1710000000';
    const rawBody = JSON.stringify({ type: 1 });
    const message = Buffer.from(timestamp + rawBody);
    const signature = crypto.sign(null, message, privateKey).toString('hex');

    const isValid = verifyDiscordSignature({
      rawBody,
      signature,
      timestamp,
      publicKey: pubKeyHex,
    });

    expect(isValid).toBe(true);
  });

  it('rejects an altered body or tampered message', () => {
    const timestamp = '1710000000';
    const rawBody = JSON.stringify({ type: 1 });
    const message = Buffer.from(timestamp + rawBody);
    const signature = crypto.sign(null, message, privateKey).toString('hex');

    const isValid = verifyDiscordSignature({
      rawBody: JSON.stringify({ type: 2 }),
      signature,
      timestamp,
      publicKey: pubKeyHex,
    });

    expect(isValid).toBe(false);
  });

  it('rejects an invalid signature hex', () => {
    const isValid = verifyDiscordSignature({
      rawBody: '{"type":1}',
      signature: '00'.repeat(64),
      timestamp: '1710000000',
      publicKey: pubKeyHex,
    });

    expect(isValid).toBe(false);
  });

  it('returns false when signature or timestamp is missing', () => {
    expect(verifyDiscordSignature({ rawBody: '{}', signature: null, timestamp: '123' })).toBe(false);
    expect(verifyDiscordSignature({ rawBody: '{}', signature: 'abc', timestamp: null })).toBe(false);
  });

  it('returns false on malformed public key or hex errors', () => {
    const isValid = verifyDiscordSignature({
      rawBody: '{}',
      signature: 'invalid_hex',
      timestamp: '123',
      publicKey: 'invalid_key',
    });

    expect(isValid).toBe(false);
  });
});
