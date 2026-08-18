#!/bin/bash
set -e

# ==============================================================================
#   🏎️   KARTLAN 3D - Auto-Updating Friend Install & Play Script   🏎️
# ==============================================================================

echo ""
echo "======================================================================"
echo "    🏎️   KARTLAN 3D - WI-FI LAN MULTIPLAYER KART RACER   🏎️"
echo "======================================================================"

# 1. Check Node.js runtime
if ! command -v node > /dev/null 2>&1; then
  echo "❌ Node.js is required to play KARTLAN 3D."
  echo "   Please install Node.js from: https://nodejs.org/"
  echo "   On Debian/Ubuntu: sudo apt-get update && sudo apt-get install -y nodejs npm"
  echo "   On macOS: brew install node"
  exit 1
fi

APP_DIR="$HOME/kartlan"

# Check if currently running inside an existing kartlan clone
if [ -f "package.json" ] && [ -f "server.js" ] && [ -d ".git" ]; then
  echo "🔄 Checking for latest updates from GitHub..."
  git fetch origin main --quiet || true
  git reset --hard origin/main --quiet 2>/dev/null || git pull --quiet || true
  TARGET_DIR="."
else
  # Running from outside or via curl | bash
  if [ ! -d "$APP_DIR" ]; then
    echo "📥 Downloading KARTLAN 3D for the first time..."
    if command -v git > /dev/null 2>&1; then
      git clone --depth 1 https://github.com/Augustalex/kartlan.git "$APP_DIR" --quiet
    else
      mkdir -p "$APP_DIR"
      curl -sSL https://github.com/Augustalex/kartlan/archive/refs/heads/main.tar.gz | tar -xz -C "$APP_DIR" --strip-components=1
    fi
  else
    echo "🔄 Updating existing KARTLAN installation to latest version..."
    if [ -d "$APP_DIR/.git" ]; then
      cd "$APP_DIR"
      git fetch origin main --quiet || true
      git reset --hard origin/main --quiet 2>/dev/null || git pull --quiet || true
    else
      # If installed without git, redownload latest tarball
      curl -sSL https://github.com/Augustalex/kartlan/archive/refs/heads/main.tar.gz | tar -xz -C "$APP_DIR" --strip-components=1
    fi
  fi
  TARGET_DIR="$APP_DIR"
fi

cd "$TARGET_DIR"

# 2. Ensure dependencies are up to date
echo "📦 Verifying dependencies..."
npm install --production --silent

echo "======================================================================"
echo " 🚀 Launching KARTLAN 3D (Latest Version)..."
echo " Opening game in your browser... Press Ctrl+C to exit."
echo "======================================================================"

exec node bin/kartlan "$@"
