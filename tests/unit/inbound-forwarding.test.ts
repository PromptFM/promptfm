import { describe, it, expect } from 'vitest';
import { resolveForwarding, setAliasForwarding, type ForwardingConfig } from '@/lib/email/forwarding';
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

describe('forwarding override and edits', () => {
  it('uses the default override (ADMIN_CONTACT_EMAIL) only where an alias has no forward_to of its own', () => {
    expect(resolveForwarding(['dev@promptfm.live'], cfg, ['env@example.com']).forwardTo).toEqual(['env@example.com']);
    expect(resolveForwarding(['legal@promptfm.live'], cfg, ['env@example.com']).forwardTo).toEqual(['lawyer@example.com']);
    expect(resolveForwarding(['unknown@promptfm.live'], cfg, ['env@example.com']).forwardTo).toEqual(['env@example.com']);
  });

  it('ignores an empty override', () => {
    expect(resolveForwarding(['dev@promptfm.live'], cfg, []).forwardTo).toEqual(['admin@example.com']);
  });
});

describe('setAliasForwarding', () => {
  it('sets the targets of one alias and leaves the rest alone', () => {
    const next = setAliasForwarding(cfg, 'dev', 'a@x.com, B@X.com ,a@x.com');
    expect(next.aliases.dev).toEqual({ category: 'contact', forward_to: ['a@x.com', 'b@x.com'] });
    expect(next.aliases.legal).toEqual(cfg.aliases.legal);
    expect(cfg.aliases.dev).toEqual({ category: 'contact' });
  });

  it('an empty list goes back to the default address', () => {
    const next = setAliasForwarding(cfg, 'legal', '  ');
    expect(next.aliases.legal).toEqual({ category: 'complaint' });
  });

  it('rejects an unknown alias, with the known ones in the message', () => {
    expect(() => setAliasForwarding(cfg, 'nope', 'a@x.com')).toThrow(/unknown alias "nope".*dev, legal, report/i);
  });

  it('rejects an alias that only exists on the object prototype', () => {
    expect(() => setAliasForwarding(cfg, 'constructor', 'a@x.com')).toThrow(/unknown alias/i);
  });

  it('lists the known aliases in alphabetical order, whatever the file order', () => {
    const unsorted: ForwardingConfig = { ...cfg, aliases: { zeta: { category: 'contact' }, alpha: { category: 'contact' } } };
    expect(() => setAliasForwarding(unsorted, 'nope', 'a@x.com')).toThrow('Known aliases: alpha, zeta');
  });

  it('names every invalid email, separated by commas', () => {
    expect(() => setAliasForwarding(cfg, 'dev', 'bad1, ok@x.com, bad2')).toThrow('Not a valid email: bad1, bad2');
  });

  it('rejects an invalid email and names it', () => {
    expect(() => setAliasForwarding(cfg, 'dev', 'ok@x.com, not-an-email')).toThrow(/not-an-email/);
  });

  it('accepts commas, semicolons, spaces and newlines between emails', () => {
    expect(setAliasForwarding(cfg, 'dev', 'a@x.com;b@x.com\nc@x.com d@x.com').aliases.dev?.forward_to).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
      'd@x.com',
    ]);
  });
});
