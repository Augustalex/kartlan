#!/bin/bash
set -e
echo "🔄 Updating KARTLAN 3D to the latest version..."
cd "$(dirname "$0")"

if [ -d ".git" ]; then
  git fetch origin main --quiet || true
  git reset --hard origin/main --quiet 2>/dev/null || git pull --quiet || true
else
  curl -sSL https://github.com/Augustalex/kartlan/archive/refs/heads/main.tar.gz | tar -xz -C . --strip-components=1
fi

npm install --production --silent
echo "✅ Updated to latest version successfully!"
echo "Run ./play.sh or npm start to launch the game."
