#!/usr/bin/env bash
# Makes the live stream come from the host named in infra/stream-host ("oracle" or "gcp"), with exactly one
# streamer on air. An infra tag points at a commit, so applying a tag means "serve the stream from here".
#
#   infra/converge-stream.sh                # everything, for the host in infra/stream-host
#   infra/converge-stream.sh gcp            # override the file from a laptop (emergency switch)
#   infra/converge-stream.sh quiesce|serve  # the two halves; the CI workflow runs them around its full Terraform apply
#
# Order is what keeps two streamers from being on air at once (that would consume the live queue twice and
# double every Discord and Telegram "now playing" post):
#   quiesce : gcp    -> Oracle goes to standby (loops the fallback track, never calls the API)
#             oracle -> nothing, the next Terraform step stops the GCP VM
#   terraform: GCP VM running or stopped, and its public 80/443 rule present or gone, from one variable
#   serve   : gcp    -> start the containers already on the GCP VM, point DNS at its (new) IP, verify
#             oracle -> check GCP is stopped, Oracle on air, point DNS at Oracle, verify
# Every step is idempotent, so after a failure run the same command again.
#
# Needs: gcloud (logged in), terraform, ansible, npm deps, python3, curl; the Hostinger token (env or Secret Manager).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${GCP_PROJECT_ID:-promptfm-radio-1793623670}"
ZONE="${GCP_ZONE:-us-central1-a}"
INSTANCE="${GCP_INSTANCE:-promptfm-streamer}"
DOMAIN="${DOMAIN_NAME:-promptfm.live}"

# A RETURN trap would fire again on every later function return, after $state is gone (and set -u would fail).
STATE_TMP=""
trap '[ -z "$STATE_TMP" ] || rm -f "$STATE_TMP"' EXIT

STEP="all"
HOST=""
for arg in "$@"; do
  case "$arg" in
    quiesce|serve|all) STEP="$arg" ;;
    oracle|gcp) HOST="$arg" ;;
    *) echo "usage: $0 [oracle|gcp] [quiesce|serve|all]" >&2; exit 2 ;;
  esac
done
HOST="${HOST:-$(tr -d '[:space:]' < infra/stream-host)}"
case "$HOST" in oracle|gcp) ;; *) echo "infra/stream-host must say oracle or gcp, not '$HOST'" >&2; exit 2 ;; esac
echo "Stream host: $HOST (step: $STEP)"

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ -z "${GOOGLE_OAUTH_ACCESS_TOKEN:-}" ]; then
  GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
  export GOOGLE_OAUTH_ACCESS_TOKEN
fi

gcp_status() {
  gcloud compute instances describe "$INSTANCE" --zone="$ZONE" --project="$PROJECT" --format='value(status)'
}

gcp_ip() {
  gcloud compute instances describe "$INSTANCE" --zone="$ZONE" --project="$PROJECT" \
    --format='value(networkInterfaces[0].accessConfigs[0].natIP)'
}

gcp_ssh() {
  gcloud compute ssh "$INSTANCE" --zone="$ZONE" --project="$PROJECT" --quiet --command="$1"
}

oracle_ip() {
  terraform -chdir=infra/terraform-oci init -input=false >/dev/null
  terraform -chdir=infra/terraform-oci output -raw public_ip
}

# Only the VM and its firewall rule are touched, so this is safe to run from a laptop.
terraform_gcp() {
  terraform -chdir=infra/terraform init -input=false >/dev/null
  GITHUB_TOKEN="${GITHUB_TOKEN:-unused}" terraform -chdir=infra/terraform apply -auto-approve -input=false \
    -target=google_compute_instance.streamer -target=google_compute_firewall.allow_web \
    -var streamer_vm_running="$1"
}

# The stream record follows the active host. It is computed at run time because the GCP VM gets a new IP on every start.
point_dns() {
  local ip="$1" state
  # Without a token the dns command only validates a local copy and still exits 0, so the record would not move.
  if [ -z "${HOSTINGER_API_TOKEN:-}" ]; then
    HOSTINGER_API_TOKEN="$(gcloud secrets versions access latest --secret=promptfm-hostinger-api-token --project="$PROJECT" 2>/dev/null || true)"
    export HOSTINGER_API_TOKEN
  fi
  if [ -z "$HOSTINGER_API_TOKEN" ]; then
    echo "No Hostinger API token (env HOSTINGER_API_TOKEN or Secret Manager promptfm-hostinger-api-token): the DNS record cannot be moved." >&2
    exit 1
  fi
  state="$(mktemp)"
  STATE_TMP="$state"
  python3 - "$state" "$ip" "$DOMAIN" <<'PY'
import json, sys
out, ip, domain = sys.argv[1:4]
d = json.load(open(f"infra/dns/{domain}.state.json"))
for r in d["zone"]:
    if r["name"] == "stream":
        r["type"] = "A"
        r["ttl"] = 300
        r["records"] = [{"content": ip, "is_disabled": False}]
json.dump(d, open(out, "w"), indent=2)
PY
  npm run -s promptfm -- dns apply "$DOMAIN" --state "$state" --force
}

verify() {
  local ip="$1" code
  for _ in 1 2 3 4 5 6; do
    # curl exits non-zero when -m cuts the endless audio stream, so only the status code counts
    code="$(curl --resolve "stream.$DOMAIN:443:$ip" -s -o /dev/null -m 6 -w '%{http_code}' "https://stream.$DOMAIN/stream.mp3" || true)"
    if [ "$code" = "200" ]; then
      echo "    stream answers on $ip (HTTP $code)"
      return 0
    fi
    sleep 10
  done
  echo "The stream did not answer HTTP 200 on $ip" >&2
  exit 1
}

quiesce() {
  case "$HOST" in
    gcp)
      echo "quiesce: Oracle to standby"
      infra/ansible/deploy-oci.sh -e liquidsoap_script=radio-standby.liq
      ;;
    oracle)
      :
      ;;
  esac
}

serve_gcp() {
  echo "serve: start the stream on the GCP VM"
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
    gcp_ssh 'true' >/dev/null 2>&1 && break
    sleep 10
  done
  gcp_ssh 'sudo docker start promptfm-icecast promptfm-caddy promptfm-liquidsoap'
  local ip
  ip="$(gcp_ip)"
  [ -n "$ip" ] || { echo "No public IP on $INSTANCE" >&2; exit 1; }
  echo "    GCP VM IP: $ip"
  point_dns "$ip"
  verify "$ip"
}

serve_oracle() {
  echo "serve: Oracle on air"
  local status
  status="$(gcp_status)"
  if [ "$status" != "TERMINATED" ]; then
    echo "The GCP VM is $status, not TERMINATED. Run the Terraform step first (it stops the VM)." >&2
    exit 1
  fi
  infra/ansible/deploy-oci.sh -e liquidsoap_script=radio.liq
  local ip
  ip="$(oracle_ip)"
  echo "    Oracle IP: $ip"
  point_dns "$ip"
  verify "$ip"
}

case "$STEP" in
  quiesce) quiesce ;;
  serve)
    if [ "$HOST" = "gcp" ]; then serve_gcp; else serve_oracle; fi
    ;;
  all)
    quiesce
    if [ "$HOST" = "gcp" ]; then terraform_gcp true; else terraform_gcp false; fi
    if [ "$HOST" = "gcp" ]; then serve_gcp; else serve_oracle; fi
    ;;
esac
echo "Done: the stream is served from $HOST."
