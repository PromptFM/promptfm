import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('OCI web deploy and cutover path', () => {
  const rootDir = path.resolve(__dirname, '../..');

  const mustRead = (rel: string) => {
    const fullPath = path.join(rootDir, rel);
    expect(fs.existsSync(fullPath), `${rel} should exist`).toBe(true);
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
  };

  it('adds a repo-owned entrypoint script and playbook for OCI web deploys', () => {
    expect(fs.existsSync(path.join(rootDir, 'infra/ansible/deploy-web-oci.sh'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'infra/ansible/playbook-web-oci.yml'))).toBe(true);
  });

  it('stages a candidate release behind Caddy before public cutover', () => {
    const tasks = mustRead('infra/ansible/roles/webapp/tasks/main.yml');
    expect(tasks).toMatch(/candidate/i);
    expect(tasks).toContain('/api/healthz');
    expect(tasks).toMatch(/cutover|switch/i);
  });

  it('keeps a retained previous release or maintenance fallback available if the candidate fails', () => {
    const caddyfile = mustRead('infra/ansible/roles/webapp/templates/Caddyfile.web.j2');
    expect(caddyfile).toMatch(/previous[_ -]release|retained[_ -]release/i);
    expect(caddyfile).toMatch(/maintenance/i);
  });
});
