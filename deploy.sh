#!/bin/bash
# Auto-deploy script for DevAIntArt
set -e

cd /home/dorkitude/a/dev/devaintart

# Allow git to work with this directory (needed when running as different user in Docker)
git config --global --add safe.directory /home/dorkitude/a/dev/devaintart 2>/dev/null || true

echo "$(date): Pulling latest changes..."
git pull origin main

echo "$(date): Building Docker image..."
docker compose build

echo "$(date): Restarting container..."
docker compose up -d

echo "$(date): Deploy complete!"
