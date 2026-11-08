# 24/7 PromptFM Stream Server on Oracle Cloud Always Free ($0.00 / Month)

The 24/7 audio stream is moving from a GCP `e2-micro` to an Oracle Cloud Always Free Ampere A1 VM. The Terraform module is [`infra/terraform-oci`](../infra/terraform-oci/README.md). Until the cutover in section 6 is done, the live stream still runs on GCP ([GCP doc](gcp-always-free-streamer.md)).

---

## 1. Why Oracle

| | GCP Always Free | Oracle Always Free |
| :--- | :--- | :--- |
| Outbound traffic to the internet | 1 GB/month | about 10 TB/month |
| One 128 kbps listener (about 41 GB/month) | over the allowance | 0.4% of the allowance |
| 10 listeners (about 415 GB/month) | about $35/month in overage | free |
| Compute | `e2-micro`, 1 GB RAM | Ampere A1 (Arm), 2 OCPU / 12 GB |

A Cloudflare Tunnel does not help on GCP: it only changes the path, and every listener byte still leaves the VM, so GCP bills it. On Oracle the free allowance is large enough that the VM serves listeners directly and no Cloudflare is needed.

Oracle's A1 allowance is 1,500 OCPU-hours and 9,000 GB-hours a month, which is 2 OCPU / 12 GB running all month.

---

## 2. Architecture

```
 Listeners ──► stream.promptfm.live (A record ➔ Oracle reserved public IP)
                     │  443 (TLS), 80 (certificate issuance + redirect)
                     ▼
┌──────────────────────────────────────────────────────────┐
│  Oracle VM (Ubuntu 24.04 Arm, us-ashburn-1)              │
│                                                          │
│  Caddy ──► Icecast (127.0.0.1:8000) ◄── Liquidsoap       │
│                        │                                 │
│                        └──► RTMP controller (ffmpeg)     │
│                             ➔ YouTube / TikTok           │
└──────────────────────────────────────────────────────────┘
```

- Caddy terminates TLS on 443 and proxies to Icecast. Port 8000 is never public.
- The Ansible role renders Caddy on `127.0.0.1` by default (GCP behaviour). The Oracle host sets `caddy_bind_address=0.0.0.0` in the inventory.
- `cloudflared` is only added to the compose file when a tunnel token is set, so it is absent on Oracle.
- All images used (Icecast `libretime/icecast:2.4.4`, Liquidsoap, Caddy, Node) publish `linux/arm64`.

---

## 3. The $0 policy, in layers

| Layer | What it does |
| :--- | :--- |
| Terraform validations | `ocpus`, `memory_gb` and `boot_volume_gb` cannot go above the Always Free sizes; the shape is fixed to `VM.Standard.A1.Flex`. |
| Tenancy quota policy | Oracle itself refuses to create anything except the Always Free allowance, even from the console (`enforce_quotas = true`). |
| Budget | A $1 budget sends an email as soon as any cost appears. |
| Outbound alarm | An email alarm fires when outbound traffic passes 300 GB/day. |
| Network | Only ports 22, 80 and 443 are open. |

---

## 4. Applying it

1. GitHub Actions: run **Apply Terraform (Oracle streamer)** (`.github/workflows/apply-terraform-oci.yml`). It only previews the plan unless `apply` is ticked.
2. If apply fails with `Out of host capacity`, Oracle has no free A1 in the region right now. Run `infra/terraform-oci/retry-apply.sh`, which retries across availability domains (2 OCPU / 12 GB first, then 1 OCPU / 6 GB) until one launches.
3. Read the outputs: `terraform output public_ip`, `terraform output ansible_inventory_line`, `terraform output instance_ocid`.

### Credentials

Credentials are not in the repo or in `~/.oci`. They are in the GCP Secret Manager secret `promptfm-oci-credentials`, one JSON secret with `user_ocid`, `tenancy_ocid`, `fingerprint`, `region` and `private_key`. One secret keeps the project within the 6 free active secret versions.

Rotate it with the **Rotate Secret** workflow. It adds the new version and destroys the old one (disabled versions still count toward the 6 free, so they must be destroyed).

### State

Terraform state is in the GCS bucket `promptfm-tfstate-promptfm-radio-1793623670`, prefix `terraform/oci-state`. It is separate from the GCP state.

### Budget email

Oracle's Notifications service sends a confirmation email to `budget_alert_email`. Confirm the subscription once from that email, otherwise neither the budget nor the outbound alarm will reach you.

---

## 5. Deploying the stack

Terraform only creates the VM. Ansible deploys the stack:

```bash
# infra/ansible/inventory.ini: uncomment the promptfm-streamer-oci line and set ansible_host
promptfm-streamer-oci ansible_host=<terraform output public_ip> ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/google_compute_engine caddy_bind_address=0.0.0.0

cd infra/ansible && ansible-playbook -i inventory.ini playbook.yml --limit promptfm-streamer-oci
```

The existing `scripts/run-ansible-iap.ts` runner goes through GCP IAP and only works for the GCP host. Use plain SSH for the Oracle one.

The RTMP controller (ffmpeg bridge to YouTube/TikTok) is defined in `deploy/streamer/docker-compose.yml`. The Ansible compose template does not include it yet, so start it separately on the Oracle host (`deploy/streamer`, `docker-compose up -d rtmp-controller`) until it is added to the role. That compose file also starts `cloudflared` unconditionally, so do not run the whole file on Oracle without a tunnel token.

---

## 6. Cutover from GCP

1. Deploy to the Oracle host (section 5). Check on the VM: `curl -I http://127.0.0.1:8000/stream.mp3` and `sudo docker ps`.
2. Test Caddy before touching the live name. Caddy can only issue a certificate once the name points at it, so either:
   - copy the certificate data from the GCP Caddy volume (`caddy_data`) to the Oracle host, then `curl -k --resolve stream.promptfm.live:443:<oracle ip> https://stream.promptfm.live/stream.mp3 -o /dev/null -m 5 -w '%{http_code}\n'`; or
   - add a temporary `stream-test` A record to the Oracle IP and add `stream-test.promptfm.live` to the Caddyfile site address, test it, then remove both.
3. Change the `stream` record from the `CNAME` (`promptfm-stream.cfargotunnel.com.`) to an `A` record with the Oracle IP in `infra/dns/promptfm.live.state.json`, then apply it with `npm run promptfm -- dns apply promptfm.live` or the **Apply Hostinger DNS Changes** workflow. TTL is 300 seconds. If you did not copy a certificate, Caddy issues one within a minute of the name resolving.
4. Check `https://stream.promptfm.live/stream.mp3` and the web player.
5. Stop the GCP VM (`gcloud compute instances stop promptfm-streamer`) and remove its 80/443 firewall rule so it cannot send traffic.

Known follow-ups at cutover:
- `npm run promptfm -- dns status --strict` and `tests/unit/zero-egress-stream.test.ts` still expect `stream` to be a CNAME to a tunnel (the GCP rule). They need updating when the record becomes an `A` record to Oracle.
- If something goes wrong, point `stream` back to the old CNAME and start the GCP VM again.

---

## 7. Risks

- **Idle reclaim.** Oracle can reclaim Always Free instances it considers idle (CPU, network and memory all under 20% for 7 days). A continuous stream carries steady traffic, but check **Metrics Explorer** after the first week. Upgrading the account to pay-as-you-go removes the reclaim risk. Resources inside the Always Free limits stay free, and the quota policy keeps anything else from being created, so the bill stays $0.
- **No capacity.** Oracle may have no free A1. The retry script handles this; the 1 OCPU / 6 GB fallback is enough for the stream.
- **Region.** The A1 allowance only works in the tenancy's home region (`us-ashburn-1`).

---

## 8. Oracle dashboards & metrics

All of these are free to open ($0.00).

| Page | Link | What it shows |
| :--- | :--- | :--- |
| Compute instances | [cloud.oracle.com/compute/instances](https://cloud.oracle.com/compute/instances?region=us-ashburn-1) | VM state, shape, public IP |
| Instance details | `https://cloud.oracle.com/compute/instances/<instance_ocid>?region=us-ashburn-1` | This VM. Get the id with `terraform output instance_ocid`. |
| Metrics Explorer | [cloud.oracle.com/monitoring/metrics-explorer](https://cloud.oracle.com/monitoring/metrics-explorer?region=us-ashburn-1) | Namespace `oci_computeagent` for CPU and memory; namespace `oci_vcn`, metric `VnicToNetworkBytes` for outbound bytes |
| Alarms | [cloud.oracle.com/monitoring/alarms](https://cloud.oracle.com/monitoring/alarms?region=us-ashburn-1) | The 300 GB/day outbound alarm |
| Cost Analysis | [cloud.oracle.com/account-management/cost-analysis](https://cloud.oracle.com/account-management/cost-analysis) | Should stay at $0 |
| Budgets | [cloud.oracle.com/account-management/budgets](https://cloud.oracle.com/account-management/budgets) | The $1 budget |
| Quota policies | [cloud.oracle.com/quotas](https://cloud.oracle.com/quotas) | The policy that blocks everything except Always Free |
| Limits, Quotas and Usage | [cloud.oracle.com/limits](https://cloud.oracle.com/limits) | Current usage against the Always Free limits |
