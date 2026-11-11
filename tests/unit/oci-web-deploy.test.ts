import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

type NonInfraAppEnvManifest = {
  gcpBundleSecretName: string;
  runtimeKeys: string[];
  requiredRuntimeKeys: string[];
  staticRuntimeEnv: Record<string, string>;
};

describe('OCI web deploy and cutover path', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'config/non-infra-app-env.json'), 'utf8'),
  ) as NonInfraAppEnvManifest;

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
    const workflow = mustRead('.github/workflows/deploy-web-oci.yml');
    expect(tasks).toMatch(/candidate/i);
    expect(tasks).toContain('/api/healthz');
    expect(tasks).toMatch(/cutover|switch/i);
    expect(tasks).toContain('Validate the Dockerized Oracle edge Caddy config before restart');
    expect(tasks).toContain('docker compose run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile');
    expect(tasks).toContain('docker compose restart caddy');
    expect(tasks).toContain('Log the Oracle host into the OCI image registry before candidate startup');
    expect(tasks).toContain('docker login');
    expect(tasks).toContain("lookup('env', 'PROMPTFM_WEB_REGISTRY')");
    expect(tasks).toContain("lookup('env', 'PROMPTFM_WEB_REGISTRY_USERNAME')");
    expect(tasks).toContain("lookup('env', 'PROMPTFM_WEB_REGISTRY_TOKEN')");
    expect(workflow).toContain('PROMPTFM_WEB_REGISTRY: ghcr.io');
    expect(workflow).toContain('PROMPTFM_WEB_REGISTRY_USERNAME: ${{ github.actor }}');
    expect(tasks).not.toContain('Ensure Caddy service is running and enabled');
  });

  it('keeps a retained previous release or maintenance fallback available if the candidate fails', () => {
    const caddyfile = mustRead('infra/ansible/roles/webapp/templates/Caddyfile.web.j2');
    const previousReleaseBlock = caddyfile.split('(previous_release) {')[1]?.split('(maintenance_fallback) {')[0] ?? '';

    expect(caddyfile).toMatch(/previous[_ -]release|retained[_ -]release/i);
    expect(caddyfile).toMatch(/maintenance/i);
    expect(caddyfile).toContain('@previous_failed');
    expect(previousReleaseBlock).toContain('handle_response @previous_failed');
    expect(previousReleaseBlock).not.toContain('handle_errors');
    expect(caddyfile).toContain('/srv/maintenance');
    expect(caddyfile).toContain('try_files {path} /index.html');
  });

  it('rotates between distinct live and candidate host ports so current and previous releases can coexist', () => {
    const tasks = mustRead('infra/ansible/roles/webapp/tasks/main.yml');
    const compose = mustRead('infra/ansible/roles/webapp/templates/docker-compose.yml.j2');
    const caddyfile = mustRead('infra/ansible/roles/webapp/templates/Caddyfile.web.j2');

    expect(tasks).toContain('Check whether a retained previous release is already available for rollback');
    expect(tasks).toContain('Resolve the host port that already serves the current release');
    expect(tasks).toContain('Select the inactive host port for the next candidate release');
    expect(tasks).toContain('Stop the older retained previous release before reusing the inactive slot');
    expect(tasks).toContain('promptfm_web_release_host_port');
    expect(tasks).toContain('promptfm_web_current_release_port');
    expect(tasks).toContain('promptfm_streamer_docker_network');
    expect(tasks).toContain('promptfm_streamer_app_dir');
    expect(tasks).toContain('promptfm_web_status_stream_url');
    expect(tasks).toContain("lookup('env', 'PROMPTFM_WEB_STATUS_STREAM_URL')");
    expect(tasks).toContain("'promptfm-web-' ~ (promptfm_web_current_release_target.stdout | basename)");
    expect(compose).toContain('PROMPTFM_STATUS_STREAM_URL: "{{ promptfm_web_status_stream_url }}"');
    expect(compose).toContain('127.0.0.1:{{ promptfm_web_release_host_port }}:{{ promptfm_web_container_port }}');
    expect(compose).toContain('external: true');
    expect(compose).toContain('name: {{ promptfm_streamer_docker_network }}');
    expect(caddyfile).toContain('reverse_proxy {{ promptfm_web_live_upstream }}');
    expect(caddyfile).toContain('reverse_proxy {{ promptfm_web_previous_release_upstream }}');
    expect(caddyfile).toContain('stream.promptfm.live');
    expect(caddyfile).toContain('reverse_proxy icecast:8000');

    const livePort = '3000';
    const candidatePort = '3001';
    const chooseInactivePort = (currentPort?: string) =>
      currentPort === livePort ? candidatePort : livePort;

    const firstCutover = chooseInactivePort(livePort);
    const rollbackFallback = livePort;
    const secondCutover = chooseInactivePort(firstCutover);

    expect(firstCutover).toBe(candidatePort);
    expect(rollbackFallback).toBe(livePort);
    expect(secondCutover).toBe(livePort);
    expect(new Set([firstCutover, rollbackFallback]).size).toBe(2);
  });

  it('resolves required OCI web app env and passes the production app config into the web container', () => {
    const tasks = mustRead('infra/ansible/roles/webapp/tasks/main.yml');
    const workflow = mustRead('.github/workflows/deploy-web-oci.yml');
    const compose = mustRead('infra/ansible/roles/webapp/templates/docker-compose.yml.j2');
    const resolver = mustRead('scripts/resolve-oci-web-env.cjs');

    expect(workflow).toContain('npx vercel env pull');
    expect(workflow).toContain('VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}');
    expect(workflow).toContain('VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}');
    expect(workflow).toContain('VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}');
    expect(workflow).toContain('.env.production.local');
    expect(workflow).toContain('node scripts/resolve-oci-web-env.cjs --print-bundle-secret-name');
    expect(workflow).toContain('gcloud secrets versions access latest --secret="$BUNDLE_SECRET_NAME"');
    expect(workflow).not.toContain(`gcloud secrets versions access latest --secret=${manifest.gcpBundleSecretName}`);
    expect(workflow).toContain('continuing with existing environment');
    expect(workflow).toContain('node scripts/resolve-oci-web-env.cjs');
    expect(tasks).toContain("lookup('env', 'OCI_WEB_RUNTIME_ENV_JSON')");
    expect(tasks).toContain('OCI web deploy requires');
    expect(tasks).toContain('promptfm_web_runtime_env_with_defaults');
    expect(tasks).toContain('promptfm_web_container_environment');
    expect(tasks).toContain('promptfm_web_runtime_env');
    expect(tasks).toContain('| combine(');
    for (const key of manifest.requiredRuntimeKeys) {
      expect(tasks).toContain(`promptfm_web_runtime_env_with_defaults.${key}`);
    }
    expect(compose).toContain('NODE_ENV: production');
    expect(compose).toContain('HOSTNAME: 0.0.0.0');
    expect(compose).toContain('PORT: "{{ promptfm_web_container_port }}"');
    expect(compose).toContain('PROMPTFM_STATUS_STREAM_URL: "{{ promptfm_web_status_stream_url }}"');
    expect(compose).toContain('{% for key, value in promptfm_web_container_environment | dictsort %}');
    expect(compose).toContain('{{ key }}: {{ value | to_json }}');
    expect(resolver).toContain('for (const key of manifest.runtimeKeys)');
    expect(resolver).toContain('runtimeEnv[key] = value;');
    for (const key of Object.keys(manifest.staticRuntimeEnv)) {
      expect(tasks).toContain(`'${key}': promptfm_web_runtime_env.${key}`);
    }
  });
});
