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
│  Oracle VM (Ubuntu 24.04, us-ashburn-1)                  │
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
- All images used (Icecast `libretime/icecast:2.4.4`, Liquidsoap, Caddy, Node) publish both `linux/amd64` and `linux/arm64`, so the stack runs on either free shape.
- Ansible deploys `deploy/streamer/radio.liq` and `icecast.xml` as they are. That folder is the single source of truth; there are no separate Ansible copies to drift.

---

## Bitrate and listener capacity

**Policy**

- Nothing goes above **128 kbps**: the main stream (`%mp3(bitrate=128)` in `deploy/streamer/radio.liq`) and the audio in the YouTube/TikTok feed (`-b:a 128k` in `controller.js`). A test fails if an encoder in `deploy/streamer` goes higher.
- Spoken word (news, podcasts, announcements) is **64 kbps** mono wherever we own the encoder, and any dedicated news, podcast or talk mount must be 64 kbps or less (same test). Today those clips are mixed into the one 128 kbps music stream, so a listener still downloads 128 kbps while they play. Spoken word only costs 64 kbps once it has its own mount.

**What the free allowance buys** (Oracle: 10 TB/month outbound, listeners connected 24/7)

| Stream | Per listener per month | Listeners per 10 TB |
| :--- | :--- | :--- |
| 128 kbps (music stream) | 41.5 GB (42.9 GB in a 31-day month) | about 240 listeners (233 in a 31-day month) |
| 64 kbps mono (a talk mount) | 20.7 GB (21.4 GB) | about 480 listeners (466) |

Real audiences are far below that, because listeners are not connected around the clock.

**Hard cap.** Icecast refuses new listeners past `max-listeners` 230 on `/stream.mp3` (`clients` 240, which leaves room for the source, the admin page and status polls). Even with every slot full non-stop for a 31-day month that is 230 x 42.9 GB = 9.9 TB, under the 10 TB allowance. Listener 231 gets an HTTP 403 until someone leaves. A test checks this arithmetic, so raising the cap above 233 fails.

**Other outbound traffic counts against the same 10 TB.** Each YouTube/TikTok feed is video plus 128 kbps audio, about 0.5 TB/month (YouTube 1,500 kbps video is 0.55 TB, TikTok 1,200 kbps is 0.44 TB). With both on, about 1 TB is used and about 210 listeners fit, so lower `max-listeners` to 200 if you run both. The video feeds are not deployed on the micro VM.

**Network.** The micro VM is capped at 50 Mbps, which is about 390 listeners at 128 kbps. 230 listeners use about 29 Mbps. The outbound alarm fires at 300 GB/day (about 9.3 TB/month) as an early warning.

---

## 3. The $0 policy, in layers

| Layer | What it does |
| :--- | :--- |
| Terraform validations | `ocpus`, `memory_gb` and `boot_volume_gb` cannot go above the Always Free sizes; `shape` can only be `A1` (`VM.Standard.A1.Flex`) or `micro` (`VM.Standard.E2.1.Micro`), the two Always Free compute shapes. |
| Tenancy quota policy | Oracle itself refuses to create anything except the Always Free allowance (Arm 2 OCPU / 12 GB, 2 micro VMs, 200 GB storage), even from the console (`enforce_quotas = true`). The tenancy's own limits are paid-level (41 Arm OCPUs per availability domain), so this policy is the only thing stopping a billable VM. |
| `prevent_destroy` | Switching between `A1` and `micro` replaces the VM, so Terraform refuses to do it silently. Remove the line on purpose when migrating. |
| Budget | A $1 budget sends an email as soon as any cost appears. |
| Outbound alarm | An email alarm fires when outbound traffic passes 300 GB/day. |
| Network | Only ports 22, 80 and 443 are open. |

---

## 4. Applying it

1. GitHub Actions: run **Apply Terraform (Oracle streamer)** (`.github/workflows/apply-terraform-oci.yml`). It only previews the plan unless `apply` is ticked.
2. If apply fails with `Out of host capacity`, Oracle has no free Arm VM in the region right now. Run `infra/terraform-oci/retry-apply.sh`, which retries across availability domains (2 OCPU / 12 GB first, then 1 OCPU / 6 GB, then the AMD micro) until one launches. The micro VM is the stopgap: `terraform apply -var shape=micro`. It only exists in one availability domain (AD-2 in Ashburn, `micro_availability_domain_index = 1`).
3. Read the outputs: `terraform output public_ip`, `terraform output ansible_inventory_line`, `terraform output instance_ocid`.

### Credentials

Nothing secret is in the repo, in `~/.oci`, or in GitHub for Oracle. One GCP Secret Manager secret, `promptfm-oci-credentials`, holds it all as JSON:

| Key | Used by |
| :--- | :--- |
| `user_ocid`, `tenancy_ocid`, `fingerprint`, `region`, `private_key` | Terraform (Oracle API login) |
| `ssh_public_key` | Terraform (installed on the VM at first boot) |
| `ssh_private_key` | Ansible (`deploy-oci.sh`, deploy workflow) |
| `budget_alert_email` | Terraform (budget and alarm recipient) |

One secret keeps the project at 1 of the 6 free active secret versions.

**It works the same on a laptop and in CI**, because both read the secret from Secret Manager:

| | Laptop | GitHub Actions |
| :--- | :--- | :--- |
| Google login | `gcloud auth login` (or `gcloud auth application-default login`) | `GCP_SA_KEY` repo secret, service account `promptfm-terraform` |
| Read the secret | your account | that service account (it has `secretmanager.secretAccessor` on this one secret) |
| Terraform | `infra/terraform-oci`, token from `gcloud auth print-access-token` | **Apply Terraform (Oracle streamer)** workflow |
| Ansible | `infra/ansible/deploy-oci.sh` | **Deploy Streamer (Oracle)** workflow, which runs the same script |

`deploy-oci.sh` takes the SSH key out of the secret, finds the VM's IP in the Terraform state, and runs `playbook-oci.yml`. The workflow stays in standby unless `go_live` is ticked.

Rotate with the **Rotate Secret** workflow. It adds the new version and destroys the old one (disabled versions still count toward the 6 free, so they must be destroyed).

### State

Terraform state is in the GCS bucket `promptfm-tfstate-promptfm-radio-1793623670`, prefix `terraform/oci-state`. It is separate from the GCP state.

### Budget email

Oracle's Notifications service sends a confirmation email to `budget_alert_email`. Confirm the subscription once from that email, otherwise neither the budget nor the outbound alarm will reach you.

---

## 5. Deploying the stack

Terraform only creates the VM. Ansible deploys the stack with its own playbook, so the GCP flow is untouched:

```bash
cd infra/ansible
./deploy-oci.sh                                  # standby: loops the fallback track, never calls the API
./deploy-oci.sh -e liquidsoap_script=radio.liq   # on air (cutover only)
```

`deploy-oci.sh` gets the SSH key from Secret Manager and the IP from the Terraform state, so there is nothing to configure. The **Deploy Streamer (Oracle)** workflow runs the same script. Icecast and Liquidsoap are restarted when their config changes, because they do not reload it themselves.

The Oracle host is in the `[streamer_oci]` group of `inventory.ini` (`caddy_bind_address=0.0.0.0`, `liquidsoap_script=radio-standby.liq`). `terraform output ansible_inventory_line` gives the host line.

**Standby matters.** Liquidsoap asks the live API for the next track and reports every track start. Two streamers on air at once would consume the queue twice and double every Discord and Telegram "now playing" post. Until cutover the Oracle host runs `deploy/streamer/radio-standby.liq`, which loops the fallback track and never calls the API.

The existing `scripts/run-ansible-iap.ts` runner goes through GCP IAP and only works for the GCP host. Use plain SSH for the Oracle one.

The RTMP controller (ffmpeg bridge to YouTube/TikTok) is defined in `deploy/streamer/docker-compose.yml`. The Ansible compose template does not include it, and the GCP VM does not run it today either. Do not start it on the 1 GB micro VM: ffmpeg video encoding needs a full core. That compose file also starts `cloudflared` unconditionally, so do not run the whole file on Oracle without a tunnel token.

---

## 6. Cutover from GCP

1. Deploy to the Oracle host in standby (section 5). Before cutover, copy the existing TLS certificate so Caddy can serve HTTPS without the name pointing at it: stream the Caddy data volume (`streamer_caddy_data`) from the GCP VM to the Oracle VM. Check with `curl -k --resolve stream.promptfm.live:443:<oracle ip> https://stream.promptfm.live/stream.mp3 -o /dev/null -m 5 -w '%{http_code}\n'`.
2. Go on air on Oracle and off air on GCP in one step, so only one Liquidsoap polls the API: stop `promptfm-liquidsoap` on the GCP VM, then run `ansible-playbook playbook-oci.yml -e liquidsoap_script=radio.liq`.
3. Change the `stream` record to an `A` record with the Oracle IP in `infra/dns/promptfm.live.state.json`, then apply it with `npm run promptfm -- dns apply promptfm.live` or the **Apply Hostinger DNS Changes** workflow. TTL is 300 seconds.
4. Check `https://stream.promptfm.live/stream.mp3` and the web player.
5. Stop the GCP VM (`gcloud compute instances stop promptfm-streamer`) and remove its 80/443 firewall rule so it cannot send traffic.

Known follow-ups at cutover:
- `npm run promptfm -- dns status --strict` and `tests/unit/zero-egress-stream.test.ts` still expect `stream` to be a CNAME to a tunnel (the GCP rule). They need updating when the record becomes an `A` record to Oracle.
- If something goes wrong, point `stream` back to the old CNAME and start the GCP VM again.

---

## 7. Risks

- **Idle reclaim.** Oracle can reclaim Always Free instances it considers idle (CPU, network and memory all under 20% for 7 days). A continuous stream carries steady traffic, but check **Metrics Explorer** after the first week. Upgrading the account to pay-as-you-go removes the reclaim risk. Resources inside the Always Free limits stay free, and the quota policy keeps anything else from being created, so the bill stays $0.
- **No capacity.** Oracle may have no free Arm VM. The retry script handles this by falling back to 1 OCPU / 6 GB and then to the AMD micro.
- **The micro VM is small.** 1/8 of a core, 1 GB of RAM (the VM adds 2 GB of swap) and a 50 Mbps network cap, about 390 listeners at 128 kbps. Enough for audio, not for the YouTube/TikTok video feed. To move to the Arm VM when capacity returns, remove `prevent_destroy` in `main.tf`, run `terraform apply -var shape=A1`, and redeploy with Ansible.
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
