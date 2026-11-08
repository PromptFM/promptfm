# PromptFM Ansible Configuration Management

This Ansible suite automates the software provisioning, container deployment, and configuration of the PromptFM 24/7 continuous stream server on Ubuntu 24.04 LTS.

---

## What It Manages
1. **Host Setup**: Ensures Docker, Docker Compose, and dependencies are installed and enabled.
2. **Icecast 2**: Deploys the high-concurrency audio distribution server.
3. **Liquidsoap 2.2**: Manages dynamic crossfading and integration with PromptFM's `/api/radio/next` clock wheel.
4. **Cloudflare Tunnel (`cloudflared`)**: Optional. Only rendered when `cloudflare_tunnel_token` (or `CLOUDFLARE_TUNNEL_TOKEN`) is set. It does not reduce VM egress: every listener byte still leaves the VM. On the Oracle host there is no tunnel; set `caddy_bind_address=0.0.0.0` so Caddy serves 80/443 directly (see `docs/oracle-always-free-streamer.md`).
5. **Emergency Fallback**: Deploys local ambient audio to prevent silence on network drops.
6. **Healthcheck**: Verifies the stream endpoint responds before reporting success.

---

## Quickstart

### Prerequisites
1. [Ansible](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html) installed locally (`brew install ansible` or `pip install ansible`).
2. SSH access to the VM (uses `~/.ssh/google_compute_engine`).

### Usage
```bash
# 1. Update the host IP in inventory.ini (or let the orchestrator do it automatically)
# inventory.ini: promptfm-streamer ansible_host=<YOUR_EXTERNAL_IP>

# 2. Run the playbook
ansible-playbook -i inventory.ini playbook.yml
```

