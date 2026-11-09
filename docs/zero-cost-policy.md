# $0 Policy: Google Cloud, Vercel and Oracle Cloud

PromptFM runs at **$0/month**. Each provider gets three things: a design that stays inside the free allowance, a hard limit where the provider offers one, and alerts. Only some controls stop spending. The rest only tell you.

| Provider | What we rely on | Stops spending? | Alerts |
| :--- | :--- | :--- | :--- |
| **Oracle Cloud** | Always Free Arm VM (or AMD micro), 10 TB/month outbound, 200 GB storage | **Yes**: quota policy blocks anything billable | $1 budget email, 300 GB/day outbound alarm |
| **Google Cloud** | Always Free e2-micro, 5 GB GCS, 6 Secret Manager versions, free logging and monitoring | **No hard stop**: budgets only alert | `$1 Monthly Budget Alert` at 50%, 90%, 100%, 150% |
| **Vercel** | Hobby plan, 4 hours/month of Fluid Active CPU | Hobby plans are not billed for overage (usage past a limit is blocked), plus our deploy gate | Vercel usage emails, turned on in the dashboard |

A **budget is an alert, not a cap.** It emails you after the money is spent. The things that actually prevent spending are the Oracle quota policy, the Terraform size checks, the Icecast listener cap and the Vercel deploy gate.

---

## Oracle Cloud

The audio stream runs here because GCP only includes 1 GB/month of outbound traffic and one 128 kbps listener is about 41 GB/month. Full detail: [oracle-always-free-streamer.md](oracle-always-free-streamer.md).

| Layer | What it does | Stops spending? |
| :--- | :--- | :--- |
| Quota policy `promptfm-always-free-only` | Oracle refuses any compute except the free Arm allowance (2 OCPU / 12 GB) and 2 AMD micro VMs, and any block storage past 200 GB. Applies to the console and Terraform alike | **Yes** |
| Terraform validations | `shape` can only be `A1` or `micro`; size and boot volume cannot exceed the free allowance | Yes, before the API call |
| `prevent_destroy` | Terraform refuses to replace the live VM when switching shape | Yes (protects the stream) |
| Listener cap | Icecast `max-listeners` 230 on `/stream.mp3`: 230 x 128 kbps for a 31-day month is 9.9 TB of the 10 TB free | **Yes** |
| Bitrate ceiling | Nothing encodes above 128 kbps, spoken word is 64 kbps. A test enforces it | Yes |
| $1 budget `promptfm-1-usd-alert` | Emails when actual Oracle spend reaches $1 | No, alert only |
| Outbound alarm `promptfm-streamer-egress-daily` | Emails when the streamer sends more than 300 GB in a day (about 9.3 TB/month) | No, alert only |
| Ports | Only 22, 80 and 443 are open | n/a |

Things to know:
- The tenancy's own limits are paid-level (41 Arm OCPUs per availability domain). The quota policy is the only thing stopping a billable VM, so do not delete it.
- Oracle sent a confirmation email for the alert subscription. Confirm it once, or neither alert reaches you.
- Oracle can reclaim Always Free instances it considers idle. Check Metrics Explorer after the first week.
- Both alerts and the quota are Terraform in `infra/terraform-oci/`, applied by the **Apply Terraform (Oracle streamer)** workflow.

Dashboards: [Compute instances](https://cloud.oracle.com/compute/instances?region=us-ashburn-1) · [Metrics Explorer](https://cloud.oracle.com/monitoring/metrics-explorer?region=us-ashburn-1) · [Alarms](https://cloud.oracle.com/monitoring/alarms?region=us-ashburn-1) · [Cost Analysis](https://cloud.oracle.com/account-management/cost-analysis) · [Budgets](https://cloud.oracle.com/account-management/budgets) · [Quota policy](https://cloud.oracle.com/quotas)

---

## Google Cloud

Everything in the project must stay inside Always Free:

- One `e2-micro` VM, `pd-standard` disk of at most 30 GB. Never `e2-small`, `pd-balanced` or `pd-ssd`.
- No static IP (billed). The VM uses an ephemeral one.
- GCS holds Terraform state only (5 GB free).
- Secret Manager: at most 6 active secret versions. The **Rotate Secret** workflow destroys old versions, because disabled versions still count. Oracle's credentials are one JSON secret to save versions.
- **Outbound traffic is the only real risk**: 1 GB/month free. That is why the stream moves to Oracle. After the cutover the GCP VM is stopped and its 80/443 firewall rule removed, so GCP sends no audio.

Alerts:
- Budget `$1 Monthly Budget Alert` on the PromptFM billing account, thresholds 50%, 90%, 100% and 150% of $1.
- Alert only. There is no hard cap on GCP. If something runs away, the emergency lever is to stop the VM (`gcloud compute instances stop promptfm-streamer --zone=us-central1-a`) or unlink billing from the project.

Dashboards: [Console](https://console.cloud.google.com/?project=promptfm-radio-1793623670) · [Cloud Monitoring](https://console.cloud.google.com/monitoring/dashboards/builder/ce33f584-e48f-407a-b2e7-1d1fa9e990ff?project=promptfm-radio-1793623670) · [Billing reports](https://console.cloud.google.com/billing)

---

## Vercel

Vercel Hobby is free, with **4 hours/month of Fluid Active CPU**. Guardrails in the repo (details in [admin-guide.md](admin-guide.md), section 7):

- **Deploy gate** (`scripts/vercel-budget-gate.js`, set in `vercel.json` as `ignoreCommand`): production builds only for release tags (`promptfm/<version>` or `v*.*.*`); routine merges to `main` are cancelled. Preview builds are off by default and opt-in with `[preview]` in the commit message. Bot branches and forked PRs are skipped or need approval.
- **Caching and polling**: Edge CDN caching on the public radio endpoints, and client polling pauses in background tabs.
- **CI minutes**: GitHub Actions concurrency groups, path detection and Playwright browser caching keep the 2,000 free minutes.

Alerts: **not set by this repo**. In Vercel, open Account Settings, Notifications, and turn on usage notifications so you get an email as you approach a limit. Hobby plans are not billed for overage; usage past a limit is blocked until it resets, so the risk is the site pausing, not a bill.

Dashboards: [Project](https://vercel.com/alextrifan/promptfm) · [Usage](https://vercel.com/account/usage) · [Analytics](https://vercel.com/alextrifan/promptfm/analytics) · [Logs](https://vercel.com/alextrifan/promptfm/logs)

---

## When an alert fires

| Alert | First look | Likely fix |
| :--- | :--- | :--- |
| Oracle outbound alarm (300 GB/day) | Metrics Explorer, `oci_vcn` `VnicToNetworkBytes` | Lower `max-listeners` in `deploy/streamer/icecast.xml` and redeploy; check no video feed is running |
| Oracle $1 budget | Cost Analysis | Find the billable resource; the quota policy should have blocked it, so check the policy still exists |
| GCP budget | Billing reports | Stop the VM if it is sending audio; check for a static IP, a bigger disk or a second VM |
| Vercel usage email | Usage page | Check for a runaway cron or polling; cancel preview deploys |
