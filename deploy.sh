#!/bin/bash
# Auto-deploy script for DevAIntArt
set -e

cd /home/dorkitude/a/dev/devaintart

# Allow git to work with this directory (needed when running as different user in Docker)
git config --global --add safe.directory /home/dorkitude/a/dev/devaintart 2>/dev/null || true
git config --global --add safe.directory '*' 2>/dev/null || true

# Fix SSH permissions and disable strict host checking for automated deploys
export GIT_SSH_COMMAND="ssh -i /root/.ssh/id_ed25519 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -F /dev/null"

echo "$(date): Pulling latest changes..."
git -c safe.directory=/home/dorkitude/a/dev/devaintart pull origin main

echo "$(date): Building Docker image..."
docker compose build

echo "$(date): Restarting container..."
docker compose up -d

echo "$(date): Deploy complete!"
