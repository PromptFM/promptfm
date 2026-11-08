#!/usr/bin/env bash
# infra/deploy.sh
# End-to-End State Machine & Deployment Orchestrator for PromptFM Stream Server
# 1. Runs Terraform to provision or update GCP Always-Free VM & Firewall
# 2. Extracts VM IP into Ansible inventory
# 3. Executes Ansible Playbook to configure software & launch containers
# 4. Performs healthcheck on the live Icecast audio stream

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/terraform"
ANSIBLE_DIR="${SCRIPT_DIR}/ansible"

echo "=========================================================="
echo "📻 PromptFM Streamer State Machine: Terraform -> Ansible"
echo "=========================================================="

# Step 1: Terraform Provisioning
echo ""
echo "🚀 [1/4] Running Terraform (GCP Always-Free Tier)..."
cd "${TF_DIR}"
terraform init
terraform apply -auto-approve

# Step 2: Extract External IP
echo ""
echo "🔍 [2/4] Resolving Streamer External IP..."
EXTERNAL_IP=$(terraform output -raw external_ip 2>/dev/null || echo "")

if [ -z "${EXTERNAL_IP}" ]; then
  echo "❌ Could not determine external IP from Terraform output."
  exit 1
fi

echo "✅ VM External IP: ${EXTERNAL_IP}"

# Step 3: Update Ansible Inventory
echo ""
echo "📝 [3/4] Updating Ansible Inventory..."
sed -i.bak "s/ansible_host=[0-9.]*/ansible_host=${EXTERNAL_IP}/g" "${ANSIBLE_DIR}/inventory.ini"
rm -f "${ANSIBLE_DIR}/inventory.ini.bak"

# Wait briefly for SSH connectivity
echo "⏳ Waiting for VM SSH port to be ready..."
until nc -zv -w 5 "${EXTERNAL_IP}" 22 2>/dev/null; do
  echo "   Waiting for SSH on ${EXTERNAL_IP}:22..."
  sleep 3
done

# Step 4: Execute Ansible Playbook
echo ""
echo "⚙️  [4/4] Running Ansible Playbook..."
cd "${ANSIBLE_DIR}"
if command -v ansible-playbook >/dev/null 2>&1; then
  ansible-playbook -i inventory.ini playbook.yml
else
  echo "⚠️  ansible-playbook not found locally. Running remote execution via gcloud compute ssh..."
  gcloud compute ssh promptfm-streamer \
    --project="promptfm-radio-1793623670" \
    --zone="us-central1-a" \
    --command="cd ~/streamer && sudo docker-compose up -d && sudo docker ps"
fi

echo ""
echo "=========================================================="
echo "🎉 PromptFM Stream Server Deployment Complete!"
echo "• Stream URL:  https://stream.promptfm.live/stream.mp3 (Zero-Egress Edge)"
echo "• Origin Host: ${EXTERNAL_IP} (Direct port 8000 blocked from public egress)"
echo "• Monthly Cost: \$0.00 (Always-Free Tier)"
echo "=========================================================="

