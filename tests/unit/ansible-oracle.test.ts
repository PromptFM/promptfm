// tests/unit/ansible-oracle.test.ts
// The Oracle host serves the public directly, so Caddy's bind address must be configurable.
// Defaults keep the GCP behaviour (loopback only, Cloudflare Tunnel).

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const rootDir = path.resolve(__dirname, "../../");
const compose = fs.readFileSync(
  path.join(
    rootDir,
    "infra/ansible/roles/streamer/templates/docker-compose.yml.j2",
  ),
  "utf8",
);
const inventory = fs.readFileSync(
  path.join(rootDir, "infra/ansible/inventory.ini"),
  "utf8",
);

describe("Ansible streamer compose template (Oracle support)", () => {
  it("parameterises the Caddy bind address with a 127.0.0.1 default for both ports", () => {
    expect(compose).toMatch(
      /"\{\{ caddy_bind_address \| default\('127\.0\.0\.1'\) \}\}:\{\{ caddy_http_port \| default\(80\) \}\}:80"/,
    );
    expect(compose).toMatch(
      /"\{\{ caddy_bind_address \| default\('127\.0\.0\.1'\) \}\}:\{\{ caddy_https_port \| default\(443\) \}\}:443"/,
    );
  });

  it("renders cloudflared only when a tunnel token is set", () => {
    const start = compose.indexOf("{% if");
    const end = compose.indexOf("{% endif %}");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = compose.slice(start, end);
    expect(block).toContain("cloudflare_tunnel_token");
    expect(block).toContain("cloudflared:");
    expect(compose.slice(0, start)).not.toContain("cloudflared:");
    expect(compose.slice(end)).not.toContain("cloudflared:");
  });

  it("does not make caddy or liquidsoap depend on cloudflared", () => {
    expect(compose).not.toMatch(/depends_on:\s*\n(\s+- .*\n)*\s+- cloudflared/);
  });

  it("keeps icecast bound to 127.0.0.1", () => {
    expect(compose).toMatch(
      /"127\.0\.0\.1:\{\{ icecast_port \| default\(8000\) \}\}:8000"/,
    );
    expect(compose).not.toMatch(/caddy_bind_address[^\n]*:8000/);
  });

  it("uses an Icecast image that publishes linux/arm64 (Oracle A1 is Arm)", () => {
    const streamerCompose = fs.readFileSync(
      path.join(rootDir, "deploy/streamer/docker-compose.yml"),
      "utf8",
    );
    for (const content of [compose, streamerCompose]) {
      expect(content).toContain("image: libretime/icecast:2.4.4");
      expect(content).not.toContain("infiniteproject/icecast");
    }
  });

  it("documents the Oracle host in the inventory as a comment only", () => {
    expect(inventory).toMatch(
      /^#\s*promptfm-streamer-oci ansible_host=<.*caddy_bind_address=0\.0\.0\.0/m,
    );
    expect(inventory).not.toMatch(/^promptfm-streamer-oci/m);
  });
});
