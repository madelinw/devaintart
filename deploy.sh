#!/bin/bash
# Auto-deploy script for DevAIntArt
set -e

cd /home/dorkitude/a/dev/devaintart

# Allow git to work with this directory (needed when running as different user in Docker)
# Set it globally and also use -c flag to ensure it's used for this command
export GIT_DIR=/home/dorkitude/a/dev/devaintart/.git
export GIT_WORK_TREE=/home/dorkitude/a/dev/devaintart
git config --global --add safe.directory /home/dorkitude/a/dev/devaintart 2>/dev/null || true
git config --global --add safe.directory '*' 2>/dev/null || true

echo "$(date): Pulling latest changes..."
git -c safe.directory=/home/dorkitude/a/dev/devaintart pull origin main

echo "$(date): Building Docker image..."
docker compose build

echo "$(date): Restarting container..."
docker compose up -d

echo "$(date): Deploy complete!"
