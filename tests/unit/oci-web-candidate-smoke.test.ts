import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '../..');
const smokePaths = [
  '/api/healthz',
  '/api/status',
  '/admin',
  '/status',
  '/api/radio/next?format=uri',
];

const read = (rel: string) => fs.readFileSync(path.join(rootDir, rel), 'utf8');

describe('OCI web candidate smoke wiring', () => {
  it('passes the candidate smoke path contract from the workflow into the repo-owned deploy entrypoint', () => {
    const workflow = read('.github/workflows/deploy-web-oci.yml');
    const script = read('infra/ansible/deploy-web-oci.sh');

    expect(workflow).toContain('PROMPTFM_WEB_CANDIDATE_SMOKE_PATHS_JSON');
    expect(script).toContain('promptfm_web_candidate_smoke_paths_json');

    for (const smokePath of smokePaths) {
      expect(workflow).toContain(smokePath);
    }
  });

  it('curls the candidate release across the pre-cutover smoke endpoints before traffic switches', () => {
    const tasks = read('infra/ansible/roles/webapp/tasks/main.yml');
    const curlIndex = tasks.indexOf('Curl pre-cutover candidate smoke paths before public cutover');
    const switchIndex = tasks.indexOf('Switch current symlink to the healthy candidate release');

    expect(tasks).toContain('promptfm_web_candidate_smoke_paths');
    expect(tasks).toContain('curl');
    expect(curlIndex).toBeGreaterThan(-1);
    expect(switchIndex).toBeGreaterThan(curlIndex);

    for (const smokePath of smokePaths) {
      expect(tasks).toContain(smokePath);
      expect(tasks).toContain(`{{ item }}`);
    }
  });
});
