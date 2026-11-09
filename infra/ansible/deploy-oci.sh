#!/usr/bin/env bash
# Deploys the streamer to the Oracle host. The same script runs on a laptop and in CI:
#  - the SSH deploy key comes from the GCP Secret Manager secret promptfm-oci-credentials
#  - the host comes from the Terraform state in the GCS bucket
# Needs gcloud, terraform and ansible, and a Google login (gcloud auth login, or GOOGLE_APPLICATION_CREDENTIALS in CI).
#   ./deploy-oci.sh                                    # standby: loops the fallback, never calls the API
#   ./deploy-oci.sh -e liquidsoap_script=radio.liq     # on air (cutover only)
set -euo pipefail
cd "$(dirname "$0")"

SECRET="${OCI_SECRET:-promptfm-oci-credentials}"
PROJECT="${GCP_PROJECT_ID:-promptfm-radio-1793623670}"

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
  export GOOGLE_OAUTH_ACCESS_TOKEN
fi

KEY="$(mktemp)"
trap 'rm -f "$KEY"' EXIT
gcloud secrets versions access latest --secret="$SECRET" --project="$PROJECT" \
  | python3 -c 'import json,sys; sys.stdout.write(json.load(sys.stdin)["ssh_private_key"])' > "$KEY"
chmod 600 "$KEY"

terraform -chdir=../terraform-oci init -input=false >/dev/null
IP="$(terraform -chdir=../terraform-oci output -raw public_ip)"

ANSIBLE_CONFIG="$PWD/ansible.cfg" ANSIBLE_HOST_KEY_CHECKING=False \
  ansible-playbook playbook-oci.yml \
  -e "ansible_host=$IP" -e "ansible_ssh_private_key_file=$KEY" "$@"
