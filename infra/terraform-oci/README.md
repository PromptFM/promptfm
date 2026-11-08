# PromptFM streamer on Oracle Cloud (Always Free)

Creates the VCN, a reserved public IP, ports 22/80/443, and an Ubuntu 24.04 Ampere A1 VM
(2 OCPU / 12 GB by default). Oracle gives about 10 TB/month of outbound traffic free, where GCP gives 1 GB.

Credentials are not in this repo or in `~/.oci`. They come from the GCP Secret Manager secret
`promptfm-oci-credentials` (one JSON secret: `user_ocid`, `tenancy_ocid`, `fingerprint`, `region`, `private_key`).
Keep it to one secret: Secret Manager includes 6 active versions free.

```bash
export GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token)   # or use gcloud ADC
terraform init
terraform plan
terraform apply
```

If apply fails with `Out of host capacity`, Oracle has no free A1 in the region right now. Run apply again later.

After apply, `terraform output ansible_inventory_line` gives the line for `infra/ansible/inventory.ini`.
The streamer stack is deployed with the Ansible playbook, not by Terraform.

Rotating the key: add a new version of the secret, then disable the old one so only one version stays active.
