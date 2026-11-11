import { execFileSync } from 'node:child_process';
import { afterEach, describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type NonInfraAppEnvManifest = {
  gcpBundleSecretName: string;
  runtimeKeys: string[];
  requiredRuntimeKeys: string[];
  staticRuntimeEnv: Record<string, string>;
};

describe('OCI web deploy and cutover path', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const tmpDirs: string[] = [];
  const manifest = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'config/non-infra-app-env.json'), 'utf8'),
  ) as NonInfraAppEnvManifest;

  const mustRead = (rel: string) => {
    const fullPath = path.join(rootDir, rel);
    expect(fs.existsSync(fullPath), `${rel} should exist`).toBe(true);
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
  };

  const createDeployScriptFixture = () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfm-oci-web-deploy-'));
    tmpDirs.push(tmpDir);

    const write = (rel: string, content: string, mode = 0o644) => {
      const filePath = path.join(tmpDir, rel);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, { mode });
      return filePath;
    };

    write('infra/ansible/deploy-web-oci.sh', mustRead('infra/ansible/deploy-web-oci.sh'), 0o755);
    write('scripts/resolve-oci-web-env.cjs', mustRead('scripts/resolve-oci-web-env.cjs'), 0o755);
    write('config/non-infra-app-env.json', mustRead('config/non-infra-app-env.json'));
    write('infra/ansible/ansible.cfg', '');
    write('infra/ansible/playbook-web-oci.yml', '---\n');
    fs.mkdirSync(path.join(tmpDir, 'infra/terraform-oci'), { recursive: true });

    const logs = {
      gcloud: path.join(tmpDir, 'gcloud.log'),
      terraform: path.join(tmpDir, 'terraform.log'),
      npx: path.join(tmpDir, 'npx.log'),
      ansibleArgs: path.join(tmpDir, 'ansible-args.log'),
      ociEnv: path.join(tmpDir, 'oci-runtime-env.json'),
    };

    write(
      'bin/gcloud',
      `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$TEST_GCLOUD_LOG"
if [ "$1" = "auth" ] && [ "$2" = "print-access-token" ]; then
  printf '%s' 'test-access-token'
  exit 0
fi

if [ "$1" = "secrets" ] && [ "$2" = "versions" ] && [ "$3" = "access" ]; then
  case "$*" in
    *"--secret=promptfm-oci-credentials"*)
      printf '%s' '{"ssh_private_key":"test-private-key"}'
      exit 0
      ;;
    *"--secret=promptfm-web-app-env"*)
      printf '%s' '{"NEXT_PUBLIC_SUPABASE_URL":"https://bundle.supabase.co","NEXT_PUBLIC_SUPABASE_ANON_KEY":"bundle-anon-key","SUPABASE_SERVICE_ROLE_KEY":"bundle-service-role-key","ADMIN_API_KEY":"bundle-admin-key","NEXT_PUBLIC_SITE_URL":"https://bundle.promptfm.live"}'
      exit 0
      ;;
  esac
fi

exit 1
`,
      0o755,
    );

    write(
      'bin/terraform',
      `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$TEST_TERRAFORM_LOG"
case "$*" in
  *"init -input=false"*)
    exit 0
    ;;
  *"output -raw public_ip"*)
    printf '%s' '203.0.113.10'
    exit 0
    ;;
esac

exit 1
`,
      0o755,
    );

    write(
      'bin/npx',
      `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$TEST_NPX_LOG"
if [ "$1" = "vercel" ] && [ "$2" = "env" ] && [ "$3" = "pull" ]; then
  cat > "$PWD/.env.production.local" <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://pulled.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=pulled-anon-key
SUPABASE_SERVICE_ROLE_KEY=pulled-service-role-key
ADMIN_API_KEY=pulled-admin-key
NEXT_PUBLIC_STREAM_URL=https://pulled-stream.promptfm.live/stream.mp3
EOF
  exit 0
fi

exit 1
`,
      0o755,
    );

    write(
      'bin/ansible-playbook',
      `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" > "$TEST_ANSIBLE_ARGS"
printf '%s' "\${OCI_WEB_RUNTIME_ENV_JSON:-}" > "$TEST_OCI_ENV"
`,
      0o755,
    );

    return {
      tmpDir,
      binDir: path.join(tmpDir, 'bin'),
      scriptPath: path.join(tmpDir, 'infra/ansible/deploy-web-oci.sh'),
      pulledEnvFile: path.join(tmpDir, '.env.production.local'),
      logs,
    };
  };

  afterEach(() => {
    while (tmpDirs.length > 0) {
      const tmpDir = tmpDirs.pop();
      if (tmpDir) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  });

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
    const script = mustRead('infra/ansible/deploy-web-oci.sh');
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
    expect(script).toContain('if [ -z "${OCI_WEB_RUNTIME_ENV_JSON:-}" ]; then');
    expect(script).toContain('REPO_ROOT="$(cd ../.. && pwd)"');
    expect(script).toContain('PULLED_ENV_FILE="$REPO_ROOT/.env.production.local"');
    expect(script).toContain('npx vercel env pull .env.production.local --environment=production --yes');
    expect(script).toContain('Vercel env pull failed, continuing with the GCP bundle secret and existing environment.');
    expect(script).toContain('VERCEL_TOKEN not provided, continuing with the GCP bundle secret and existing environment.');
    expect(script).toContain('node "$RESOLVER" --print-bundle-secret-name');
    expect(script).toContain('gcloud secrets versions access latest --secret="$BUNDLE_SECRET_NAME" --project="$PROJECT"');
    expect(script).not.toContain(`gcloud secrets versions access latest --secret=${manifest.gcpBundleSecretName}`);
    expect(script).toContain('GCP_BUNDLED_APP_ENV_JSON="$GCP_BUNDLED_APP_ENV_JSON" node "$RESOLVER"');
    expect(script).toContain('export OCI_WEB_RUNTIME_ENV_JSON');
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

  it('self-resolves OCI_WEB_RUNTIME_ENV_JSON locally from the bundle secret and optional Vercel pull before ansible runs', () => {
    const fixture = createDeployScriptFixture();

    execFileSync('bash', [fixture.scriptPath, '-e', 'promptfm_web_release_id=test-release'], {
      cwd: fixture.tmpDir,
      encoding: 'utf8',
      env: {
        PATH: `${fixture.binDir}:${process.env.PATH ?? ''}`,
        TEST_GCLOUD_LOG: fixture.logs.gcloud,
        TEST_TERRAFORM_LOG: fixture.logs.terraform,
        TEST_NPX_LOG: fixture.logs.npx,
        TEST_ANSIBLE_ARGS: fixture.logs.ansibleArgs,
        TEST_OCI_ENV: fixture.logs.ociEnv,
        GOOGLE_APPLICATION_CREDENTIALS: '',
        VERCEL_TOKEN: 'test-vercel-token',
        VERCEL_ORG_ID: 'test-org',
        VERCEL_PROJECT_ID: 'test-project',
      },
      stdio: 'pipe',
    });

    const runtimeEnv = JSON.parse(fs.readFileSync(fixture.logs.ociEnv, 'utf8')) as Record<string, string>;
    const gcloudLog = fs.readFileSync(fixture.logs.gcloud, 'utf8');
    const terraformLog = fs.readFileSync(fixture.logs.terraform, 'utf8');
    const npxLog = fs.readFileSync(fixture.logs.npx, 'utf8');
    const ansibleArgs = fs.readFileSync(fixture.logs.ansibleArgs, 'utf8');

    expect(fs.existsSync(fixture.pulledEnvFile)).toBe(true);
    expect(npxLog).toContain('vercel env pull .env.production.local --environment=production --yes');
    expect(gcloudLog).toContain('auth print-access-token');
    expect(gcloudLog).toContain('secrets versions access latest --secret=promptfm-oci-credentials --project=promptfm-radio-1793623670');
    expect(gcloudLog).toContain('secrets versions access latest --secret=promptfm-web-app-env --project=promptfm-radio-1793623670');
    expect(terraformLog).toContain('-chdir=../terraform-oci init -input=false');
    expect(terraformLog).toContain('-chdir=../terraform-oci output -raw public_ip');
    expect(ansibleArgs).toContain('playbook-web-oci.yml');
    expect(ansibleArgs).toContain('promptfm_web_release_id=test-release');
    expect(runtimeEnv.NEXT_PUBLIC_SUPABASE_URL).toBe('https://pulled.supabase.co');
    expect(runtimeEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('pulled-anon-key');
    expect(runtimeEnv.SUPABASE_SERVICE_ROLE_KEY).toBe('pulled-service-role-key');
    expect(runtimeEnv.ADMIN_API_KEY).toBe('pulled-admin-key');
    expect(runtimeEnv.NEXT_PUBLIC_STREAM_URL).toBe('https://pulled-stream.promptfm.live/stream.mp3');
    expect(runtimeEnv.NEXT_PUBLIC_SITE_URL).toBe('https://bundle.promptfm.live');
    expect(runtimeEnv.VERCEL_ENV).toBe('production');
  });

  it('preserves a CI-provided OCI_WEB_RUNTIME_ENV_JSON and skips the local resolver path', () => {
    const fixture = createDeployScriptFixture();

    execFileSync('bash', [fixture.scriptPath], {
      cwd: fixture.tmpDir,
      encoding: 'utf8',
      env: {
        PATH: `${fixture.binDir}:${process.env.PATH ?? ''}`,
        TEST_GCLOUD_LOG: fixture.logs.gcloud,
        TEST_TERRAFORM_LOG: fixture.logs.terraform,
        TEST_NPX_LOG: fixture.logs.npx,
        TEST_ANSIBLE_ARGS: fixture.logs.ansibleArgs,
        TEST_OCI_ENV: fixture.logs.ociEnv,
        VERCEL_TOKEN: 'test-vercel-token',
        OCI_WEB_RUNTIME_ENV_JSON: JSON.stringify({ FROM_CI: '1' }),
      },
      stdio: 'pipe',
    });

    const runtimeEnv = JSON.parse(fs.readFileSync(fixture.logs.ociEnv, 'utf8')) as Record<string, string>;
    const gcloudLog = fs.readFileSync(fixture.logs.gcloud, 'utf8');

    expect(runtimeEnv).toEqual({ FROM_CI: '1' });
    expect(fs.existsSync(fixture.pulledEnvFile)).toBe(false);
    expect(fs.existsSync(fixture.logs.npx)).toBe(false);
    expect(gcloudLog).toContain('secrets versions access latest --secret=promptfm-oci-credentials --project=promptfm-radio-1793623670');
    expect(gcloudLog).not.toContain('promptfm-web-app-env');
  });
});
