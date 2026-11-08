# PromptFM streamer on Oracle Cloud (Always Free)

Creates the VCN, a reserved public IP, ports 22/80/443, and an Ubuntu 24.04 Ampere A1 VM
(2 OCPU / 12 GB by default). Oracle gives about 10 TB/month of outbound traffic free, where GCP gives 1 GB.

Credentials are not in this repo or in `~/.oci`. They come from the GCP Secret Manager secret
`promptfm-oci-credentials` (one JSON secret: `user_ocid`, `tenancy_ocid`, `fingerprint`, `region`, `private_key`).
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

If apply fails with `Out of host capacity`, Oracle has no free A1 in the region right now. Run apply again later.

After apply, `terraform output ansible_inventory_line` gives the line for `infra/ansible/inventory.ini`.
The streamer stack is deployed with the Ansible playbook, not by Terraform.

Rotating the key: run the **Rotate Secret** workflow with `promptfm-oci-credentials`. It adds the new version and
destroys the old one. Disabled versions still count toward the 6 free, so they must be destroyed, not disabled.
