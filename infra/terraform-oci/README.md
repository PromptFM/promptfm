# PromptFM streamer on Oracle Cloud (Always Free)

Creates the VCN, a reserved public IP, ports 22/80/443, and an Ubuntu 24.04 Ampere A1 VM
(the AMD micro today, 2 OCPU / 12 GB Arm when Oracle has capacity). Oracle gives about 10 TB/month of outbound traffic free, where GCP gives 1 GB.

Credentials are not in this repo or in `~/.oci`. They come from the GCP Secret Manager secret
`promptfm-oci-credentials` (one JSON secret: `user_ocid`, `tenancy_ocid`, `fingerprint`, `region`, `private_key`,
`ssh_public_key`, `ssh_private_key`, `budget_alert_email`).
Keep it to one secret: Secret Manager includes 6 active versions free.

Run it from GitHub Actions: **Apply Terraform (Oracle streamer)**. It only previews the plan unless you tick `apply`.
It uses the same `GCP_SA_KEY` as the other workflows, and that service account can read the secret.

From a laptop:

```bash
export GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token)   # or use gcloud ADC
terraform init
terraform plan
terraform apply
```

If apply fails with `Out of host capacity`, Oracle has no free Arm VM right now. `./retry-apply.sh` retries across the
availability domains, then falls back to the AMD micro VM (`-var shape=micro`, 1 GB, audio only, availability domain
index 1). Both are Always Free, and the quota policy allows only those.

`shape` is `micro` (the default, because that is what is deployed) or `A1`. Changing it replaces the VM, so `prevent_destroy` makes Terraform refuse; remove
that line on purpose when migrating (for example from micro to A1 when Arm capacity returns).

After apply, `terraform output ansible_inventory_line` gives the line for `infra/ansible/inventory.ini`.
The streamer stack is deployed with the Ansible playbook, not by Terraform.

Rotating the key: run the **Rotate Secret** workflow with `promptfm-oci-credentials`. It adds the new version and
destroys the old one. Disabled versions still count toward the 6 free, so they must be destroyed, not disabled.

Deploying the stack: `infra/ansible/deploy-oci.sh` on a laptop, or the **Deploy Streamer (Oracle)** workflow. Both read
the SSH key from the same secret and the IP from this module's state. See `docs/oracle-always-free-streamer.md`.
