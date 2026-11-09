#!/usr/bin/env bash
# Oracle's free Arm hosts run out per availability domain ("Out of host capacity").
# This retries terraform apply across the domains, trying 2 OCPU / 12 GB first, then 1 OCPU / 6 GB, then the
# Always Free AMD micro VM (1 GB, audio only, one availability domain), until one launches.
# Any other error stops it. Both shapes are inside the Always Free allowance.
#   INTERVAL=300 MAX_TRIES=96 ./retry-apply.sh
set -u
cd "$(dirname "$0")"
INTERVAL="${INTERVAL:-300}"
MAX_TRIES="${MAX_TRIES:-96}"

# The access token lasts about an hour, so refresh it before every round.
refresh_token() {
  if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
    GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
    export GOOGLE_OAUTH_ACCESS_TOKEN
  fi
}

refresh_token
terraform init -input=false -no-color >/dev/null || exit 1

for ((n = 1; n <= MAX_TRIES; n++)); do
  refresh_token
  for shape in "2 12" "1 6"; do
    set -- $shape
    for ad in 0 1 2; do
      echo "[$(date -u +%H:%M:%S)] try $n: ${1} OCPU / ${2} GB, availability domain $ad"
      out="$(terraform apply -input=false -auto-approve -no-color \
        -var "shape=A1" -var "availability_domain_index=$ad" -var "ocpus=$1" -var "memory_gb=$2" 2>&1)"
      if echo "$out" | grep -q "Out of host capacity"; then
        continue
      fi
      echo "$out" | tail -25
      if echo "$out" | grep -q "Apply complete"; then
        echo "LAUNCHED: ${1} OCPU / ${2} GB in availability domain $ad"
        exit 0
      fi
      echo "Stopped on an error that is not a capacity shortage."
      exit 1
    done
  done

  echo "[$(date -u +%H:%M:%S)] try $n: AMD micro (Always Free, 1 GB)"
  out="$(terraform apply -input=false -auto-approve -no-color -var shape=micro 2>&1)"
  if ! echo "$out" | grep -q "Out of host capacity"; then
    echo "$out" | tail -25
    if echo "$out" | grep -q "Apply complete"; then
      echo "LAUNCHED: AMD micro. Switch to the Arm VM later with shape=A1 once capacity returns (see README)."
      exit 0
    fi
    echo "Stopped on an error that is not a capacity shortage."
    exit 1
  fi
  echo "[$(date -u +%H:%M:%S)] no capacity anywhere, waiting ${INTERVAL}s"
  sleep "$INTERVAL"
done
echo "Gave up after $MAX_TRIES rounds."
exit 2
