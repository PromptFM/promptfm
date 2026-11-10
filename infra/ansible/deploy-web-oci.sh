#!/usr/bin/env bash
# Deploys the PromptFM web app to the Oracle host. Mirrors deploy-oci.sh so the
# same repo-owned entrypoint works on a laptop and in CI.
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
  env -u ANSIBLE_VAULT_PASSWORD_FILE ansible-playbook playbook-web-oci.yml \
  -e "ansible_host=$IP" -e "ansible_ssh_private_key_file=$KEY" "$@"
