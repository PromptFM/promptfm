import { describe, it, expect } from 'vitest';
import { resolveForwarding, type ForwardingConfig } from '@/lib/email/forwarding';
import config from '../../config/inbound-forwarding.json';

const cfg: ForwardingConfig = {
  domain: 'promptfm.live',
  default_forward_to: ['admin@example.com'],
  aliases: {
    dev: { category: 'contact' },
    legal: { category: 'complaint', forward_to: ['lawyer@example.com'] },
    report: { category: 'complaint' },
  },
};

describe('resolveForwarding (config/inbound-forwarding.json)', () => {
  it('sends a known alias to the default address with its category', () => {
    expect(resolveForwarding(['dev@promptfm.live'], cfg)).toEqual({
      forwardTo: ['admin@example.com'],
      category: 'contact',
    });
  });

  it('uses the alias own forward_to when it has one', () => {
    expect(resolveForwarding(['legal@promptfm.live'], cfg).forwardTo).toEqual(['lawyer@example.com']);
  });

  it('is complaint when any recipient alias is a complaint alias', () => {
    expect(resolveForwarding(['dev@promptfm.live', 'report@promptfm.live'], cfg).category).toBe('complaint');
  });

  it('matches case-insensitively and with a display name', () => {
    expect(resolveForwarding(['PromptFM <LEGAL@PromptFM.live>'], cfg).category).toBe('complaint');
  });

  it('still forwards unknown addresses to the default address, as contact', () => {
    expect(resolveForwarding(['random@promptfm.live'], cfg)).toEqual({
      forwardTo: ['admin@example.com'],
      category: 'contact',
    });
  });

  it('tolerates spaces inside the angle brackets and addresses without an @', () => {
    expect(resolveForwarding(['PromptFM < legal@promptfm.live >'], cfg).category).toBe('complaint');
    expect(resolveForwarding(['not-an-address'], cfg).category).toBe('contact');
  });

  it('does not treat object prototype names as aliases', () => {
    expect(resolveForwarding(['constructor@promptfm.live', 'toString@promptfm.live'], cfg)).toEqual({
      forwardTo: ['admin@example.com'],
      category: 'contact',
    });
  });

  it('ignores aliases on another domain', () => {
    expect(resolveForwarding(['legal@other.com'], cfg).category).toBe('contact');
  });

  it('merges and de-duplicates the targets of several aliases', () => {
    const r = resolveForwarding(['legal@promptfm.live', 'dev@promptfm.live', 'legal@promptfm.live'], cfg);
    expect(r.forwardTo).toEqual(['lawyer@example.com', 'admin@example.com']);
  });

  it('the committed file has the four registered addresses and valid targets', () => {
    expect(Object.keys(config.aliases).sort()).toEqual(['contact', 'dev', 'legal', 'report']);
    expect(config.domain).toBe('promptfm.live');
    for (const e of config.default_forward_to) expect(e).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });
});
