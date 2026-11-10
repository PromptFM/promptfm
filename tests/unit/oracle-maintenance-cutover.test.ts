import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Oracle maintenance cutover support', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const read = (rel: string) => fs.readFileSync(path.join(rootDir, rel), 'utf8');

  it('commits a maintenance page for promptfm.live and www', () => {
    const html = read('infra/ansible/roles/streamer/files/maintenance/index.html');
    expect(html).toContain('PromptFM');
    expect(html).toMatch(/Under Maintenance|Maintenance/i);
  });

  it('copies the maintenance page into the streamer app directory', () => {
    const tasks = read('infra/ansible/roles/streamer/tasks/main.yml');
    expect(tasks).toContain('{{ app_dir }}/maintenance');
    expect(tasks).toContain('maintenance/index.html');
  });

  it('mounts the maintenance directory into the Caddy container', () => {
    const compose = read('infra/ansible/roles/streamer/templates/docker-compose.yml.j2');
    expect(compose).toContain('./maintenance:/srv/maintenance:ro');
  });

  it('serves promptfm.live and www from the maintenance directory', () => {
    const caddyfile = read('infra/ansible/roles/streamer/templates/Caddyfile.j2');
    expect(caddyfile).toContain('promptfm.live, www.promptfm.live');
    expect(caddyfile).toContain('root * /srv/maintenance');
    expect(caddyfile).toContain('file_server');
  });

  it('keeps stream.promptfm.live proxied to Icecast', () => {
    const caddyfile = read('infra/ansible/roles/streamer/templates/Caddyfile.j2');
    expect(caddyfile).toContain('stream.promptfm.live');
    expect(caddyfile).toContain('reverse_proxy icecast:8000');
  });

  it('restarts Caddy when its config changes', () => {
    const tasks = read('infra/ansible/roles/streamer/tasks/main.yml');
    expect(tasks).toContain('register: caddy_conf');
    expect(tasks).toContain('docker compose restart caddy');
    expect(tasks).toMatch(/when: caddy_conf is changed/);
  });

  it('adds a dedicated webapp cutover template that can leave the previous release or maintenance page serving traffic', () => {
    const webCaddyPath = path.join(rootDir, 'infra/ansible/roles/webapp/templates/Caddyfile.web.j2');
    expect(fs.existsSync(webCaddyPath)).toBe(true);

    if (!fs.existsSync(webCaddyPath)) {
      return;
    }

    const webCaddy = fs.readFileSync(webCaddyPath, 'utf8');
    expect(webCaddy).toMatch(/previous[_ -]release|retained[_ -]release/i);
    expect(webCaddy).toMatch(/maintenance/i);
    expect(webCaddy).toContain('@previous_failed');
    expect(webCaddy).toContain('/srv/maintenance');
    expect(webCaddy).toContain('stream.promptfm.live');
    expect(webCaddy).toContain('reverse_proxy icecast:8000');
  });

  it('gates web cutover on a candidate health probe before switching live traffic', () => {
    const webTasksPath = path.join(rootDir, 'infra/ansible/roles/webapp/tasks/main.yml');
    expect(fs.existsSync(webTasksPath)).toBe(true);

    if (!fs.existsSync(webTasksPath)) {
      return;
    }

    const webTasks = fs.readFileSync(webTasksPath, 'utf8');
    expect(webTasks).toContain('/api/healthz');
    expect(webTasks).toMatch(/cutover|switch/i);
  });

  it('retains the real live release target before pruning old release directories', () => {
    const webTasksPath = path.join(rootDir, 'infra/ansible/roles/webapp/tasks/main.yml');
    expect(fs.existsSync(webTasksPath)).toBe(true);

    if (!fs.existsSync(webTasksPath)) {
      return;
    }

    const webTasks = fs.readFileSync(webTasksPath, 'utf8');
    expect(webTasks).toContain('readlink');
    expect(webTasks).toContain('promptfm_web_current_release_target.stdout');
    expect(webTasks).toMatch(/Prune OCI web releases/i);
  });

  it('tracks the actual current live port so previous-release failover stays routable across cutovers', () => {
    const webTasks = read('infra/ansible/roles/webapp/tasks/main.yml');
    const webCompose = read('infra/ansible/roles/webapp/templates/docker-compose.yml.j2');
    const webCaddy = read('infra/ansible/roles/webapp/templates/Caddyfile.web.j2');

    expect(webTasks).toContain('Resolve the host port that already serves the current release');
    expect(webTasks).toContain('Select the inactive host port for the next candidate release');
    expect(webTasks).toContain('Stop the older retained previous release before reusing the inactive slot');
    expect(webTasks).toContain('promptfm_web_current_release_port');
    expect(webTasks).toContain('promptfm_web_release_host_port');
    expect(webTasks).toContain('promptfm_streamer_docker_network');
    expect(webTasks).toContain('Log the Oracle host into the OCI image registry before candidate startup');
    expect(webTasks).toContain('docker login');
    expect(webTasks).toContain('docker compose restart caddy');
    expect(webTasks).not.toContain('Ensure Caddy service is running and enabled');
    expect(webTasks).toContain("lookup('env', 'PROMPTFM_WEB_REGISTRY')");
    expect(webTasks).toContain("lookup('env', 'PROMPTFM_WEB_REGISTRY_USERNAME')");
    expect(webTasks).toContain("lookup('env', 'PROMPTFM_WEB_REGISTRY_TOKEN')");
    expect(webCompose).toContain('127.0.0.1:{{ promptfm_web_release_host_port }}:{{ promptfm_web_container_port }}');
    expect(webCompose).toContain('name: {{ promptfm_streamer_docker_network }}');
    expect(webCaddy).toContain('reverse_proxy {{ promptfm_web_live_upstream }}');
    expect(webCaddy).toContain('reverse_proxy {{ promptfm_web_previous_release_upstream }}');
    expect(webCaddy).toContain('stream.promptfm.live');
    expect(webCaddy).toContain('reverse_proxy icecast:8000');
  });
});
