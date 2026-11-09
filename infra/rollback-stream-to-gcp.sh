#!/usr/bin/env bash
# Puts the live stream back on the GCP VM. Use it when the Oracle host fails after the cutover.
#
# A tag rollback (rollback-infra.yml) does NOT do this: it only replays the GCP Terraform at an older commit.
# It does not touch Oracle, DNS or Liquidsoap, and the DNS file in the 0.1.0 tag points at a tunnel that does not exist.
#
# Order matters, so only one streamer is ever on air (two would double every Discord/Telegram post):
#   1. Oracle goes to standby (loops the fallback, never calls the API)
#   2. the GCP VM is started; its public IP is NEW after a stop/start, so it is read back
#   3. GCP's public 80/443 rule is recreated if it was removed
#   4. the GCP containers are started
#   5. the stream record is pointed at the new GCP IP (TTL 300, so listeners follow within ~5 minutes)
# Then fix infra/dns/promptfm.live.state.json to the printed IP and commit it.
#
# Needs: gcloud (logged in), ansible, terraform, and the Hostinger token (HOSTINGER_API_TOKEN or Secret Manager).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${GCP_PROJECT_ID:-promptfm-radio-1793623670}"
ZONE="${GCP_ZONE:-us-central1-a}"
INSTANCE="${GCP_INSTANCE:-promptfm-streamer}"
DOMAIN="${DOMAIN_NAME:-promptfm.live}"

echo "1/5 Oracle to standby"
infra/ansible/deploy-oci.sh -e liquidsoap_script=radio-standby.liq

echo "2/5 start the GCP VM"
gcloud compute instances start "$INSTANCE" --zone="$ZONE" --project="$PROJECT" --quiet
IP="$(gcloud compute instances describe "$INSTANCE" --zone="$ZONE" --project="$PROJECT" \
  --format='value(networkInterfaces[0].accessConfigs[0].natIP)')"
[ -n "$IP" ] || { echo "No public IP on $INSTANCE" >&2; exit 1; }
echo "    GCP VM public IP: $IP"

echo "3/5 public 80/443 rule"
if ! gcloud compute firewall-rules describe allow-http-https --project="$PROJECT" >/dev/null 2>&1; then
  gcloud compute firewall-rules create allow-http-https --project="$PROJECT" --network=default \
    --allow=tcp:80,tcp:443 --source-ranges=0.0.0.0/0 --target-tags=http-server,https-server \
    --description="Rollback: HTTP/HTTPS for the Caddy stream proxy on the GCP VM"
fi

echo "4/5 start the GCP containers"
for _ in 1 2 3 4 5 6; do
  if gcloud compute ssh "$INSTANCE" --zone="$ZONE" --project="$PROJECT" --quiet \
    --command='sudo docker start promptfm-icecast promptfm-caddy promptfm-liquidsoap'; then
    break
  fi
  sleep 10
done

echo "5/5 point the stream record at $IP"
STATE="$(mktemp)"
trap 'rm -f "$STATE"' EXIT
python3 - "$STATE" "$IP" "$DOMAIN" <<'PY'
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
npm run -s promptfm -- dns apply "$DOMAIN" --state "$STATE" --force

echo
echo "Rolled back. Stream host: GCP VM at $IP. Update infra/dns/$DOMAIN.state.json to this IP, set streamer_vm_running = true (infra/terraform) so a later apply does not stop the VM, and commit both."
