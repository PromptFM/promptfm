#!/usr/bin/env bash
# Runs Terraform for the Resend inbound mail setup. The same script runs on a laptop and in CI:
# the Resend API key comes from Secret Manager (promptfm-resend-api-key), so no Resend key is needed in the environment.
# Needs terraform and gcloud (gcloud auth login, or GOOGLE_APPLICATION_CREDENTIALS in CI).
#   ./run.sh plan      # preview (default)
#   ./run.sh apply     # apply
set -euo pipefail
cd "$(dirname "$0")"

ACTION="${1:-plan}"
case "$ACTION" in plan | apply) ;; *) echo "usage: $0 [plan|apply]" >&2; exit 2 ;; esac

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ -z "${GOOGLE_OAUTH_ACCESS_TOKEN:-}" ]; then
  GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
  export GOOGLE_OAUTH_ACCESS_TOKEN
fi

terraform init -input=false >/dev/null
if [ "$ACTION" = "apply" ]; then
  terraform apply -input=false -auto-approve
else
  terraform plan -input=false
fi
