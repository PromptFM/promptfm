#!/usr/bin/env bash
# deploy/streamer/setup.sh
# One-shot provisioning script to initialize the PromptFM Streamer on Ubuntu 24.04 LTS

set -e

echo "📻 PromptFM Streamer VM Setup (GCP Always-Free Tier)..."

# 1. Update and install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose curl

# 2. Add ubuntu user to docker group
sudo usermod -aG docker "$USER"

# 3. Create emergency fallback audio if not exists
if [ ! -f fallback.mp3 ]; then
  echo "Downloading fallback ambient audio..."
  curl -sSL "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" -o fallback.mp3
fi

# 4. Start the stack
echo "Starting Icecast and Liquidsoap..."
docker-compose up -d

echo "✅ PromptFM Streamer is live on port 8000!"
