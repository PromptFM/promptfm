// Sets where one promptfm.live address forwards, in config/inbound-forwarding.json.
//   npm run email:forward -- <alias> "<email>, <email>"     (empty list = back to the default address)
import * as fs from 'fs';
import * as path from 'path';
import { setAliasForwarding, type ForwardingConfig } from '../src/lib/email/forwarding';

const [alias, ...rest] = process.argv.slice(2);
if (!alias) {
  console.error('Usage: npm run email:forward -- <alias> "<email>, <email>"');
  process.exit(2);
}

const file = path.resolve(__dirname, '../config/inbound-forwarding.json');
const current = JSON.parse(fs.readFileSync(file, 'utf8')) as ForwardingConfig;

try {
  const next = setAliasForwarding(current, alias, rest.join(' '));
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
  const to = next.aliases[alias].forward_to ?? next.default_forward_to;
  console.log(`${alias}@${next.domain} -> ${to.join(', ')}${next.aliases[alias].forward_to ? '' : ' (default)'}`);
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
