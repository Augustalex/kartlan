#!/bin/bash
set -e

# ==============================================================================
#   🏎️   KARTLAN 3D - Quick Friend Install & Play Script   🏎️
# ==============================================================================

echo ""
echo "======================================================================"
echo "    🏎️   KARTLAN 3D - WI-FI LAN MULTIPLAYER KART RACER   🏎️"
echo "======================================================================"
echo " Preparing game environment..."

# Check Node.js
if ! command -v node > /dev/null 2>&1; then
  echo "❌ Node.js is required to run KARTLAN 3D."
  echo "   Please install Node.js (v16+) from https://nodejs.org/"
  echo "   On Debian/Ubuntu: sudo apt-get update && sudo apt-get install -y nodejs npm"
  echo "   On macOS: brew install node"
  exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 16 ]; then
  echo "⚠️ Warning: Node.js version is $(node -v). Recommended >= v16."
fi

# Target directory
APP_DIR="$HOME/kartlan"

if [ -f "package.json" ] && [ -f "server.js" ]; then
  # Already in project directory
  TARGET_DIR="."
else
  if [ ! -d "$APP_DIR" ]; then
    echo "📥 Downloading KARTLAN 3D repository..."
    if command -v git > /dev/null 2>&1; then
      git clone --depth 1 https://github.com/Augustalex/kartlan.git "$APP_DIR"
    else
      mkdir -p "$APP_DIR"
      curl -sSL https://github.com/Augustalex/kartlan/archive/refs/heads/main.tar.gz | tar -xz -C "$APP_DIR" --strip-components=1
    fi
  else
    echo "🔄 Updating existing installation in $APP_DIR..."
    if [ -d "$APP_DIR/.git" ]; then
      cd "$APP_DIR" && git pull || true
    fi
  fi
  TARGET_DIR="$APP_DIR"
fi

cd "$TARGET_DIR"

if [ ! -d "node_modules" ]; then
  echo "📦 Installing lightweight dependencies..."
  npm install --production --silent
fi

echo "======================================================================"
echo " 🚀 Launching KARTLAN 3D..."
echo " Opening game in your browser... Press Ctrl+C to exit."
echo "======================================================================"

exec node bin/kartlan "$@"
