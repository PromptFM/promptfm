// src/lib/email/forwarding.ts
// Which promptfm.live address forwards where. The addresses are declared in config/inbound-forwarding.json,
// which infra/terraform-resend reads too, so the app and the Resend webhook setup cannot drift apart.

import defaultConfig from '../../../config/inbound-forwarding.json';

export interface ForwardingAlias {
  category: 'contact' | 'complaint';
  forward_to?: string[];
}

export interface ForwardingConfig {
  domain: string;
  default_forward_to: string[];
  aliases: Record<string, ForwardingAlias>;
}

export interface ForwardingDecision {
  forwardTo: string[];
  category: 'contact' | 'complaint';
}

function parseAddress(raw: string): { local: string; domain: string } {
  const bracket = raw.match(/<([^>]+)>/);
  const addr = (bracket?.[1] ?? raw).trim().toLowerCase();
  const at = addr.lastIndexOf('@');
  return { local: addr.slice(0, at), domain: addr.slice(at + 1) };
}

export function resolveForwarding(
  recipients: string[],
  config: ForwardingConfig = defaultConfig as ForwardingConfig
): ForwardingDecision {
  const targets: string[] = [];
  let category: 'contact' | 'complaint' = 'contact';

  for (const raw of recipients) {
    const parsed = parseAddress(raw);
    const alias =
      parsed.domain === config.domain && Object.hasOwn(config.aliases, parsed.local)
        ? config.aliases[parsed.local]
        : undefined;
    if (!alias) continue;
    if (alias.category === 'complaint') category = 'complaint';
    targets.push(...(alias.forward_to ?? config.default_forward_to));
  }

  const forwardTo = [...new Set(targets.length > 0 ? targets : config.default_forward_to)];
  return { forwardTo, category };
}
