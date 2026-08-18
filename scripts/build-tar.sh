#!/bin/bash
set -e

echo "📦 Building portable release archive..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
TMP_DIR="$DIST_DIR/kartlan-1.0.0"

rm -rf "$TMP_DIR" "$DIST_DIR/kartlan-v1.0.0.tar.gz"
mkdir -p "$TMP_DIR" "$DIST_DIR"

cp -r "$ROOT_DIR/package.json" "$TMP_DIR/"
cp -r "$ROOT_DIR/server.js" "$TMP_DIR/"
cp -r "$ROOT_DIR/bin" "$TMP_DIR/"
cp -r "$ROOT_DIR/public" "$TMP_DIR/"
cp -r "$ROOT_DIR/install.sh" "$TMP_DIR/" 2>/dev/null || true
if [ -d "$ROOT_DIR/node_modules" ]; then
  cp -r "$ROOT_DIR/node_modules" "$TMP_DIR/"
fi

# Play launcher helper
cat << 'PLAY' > "$TMP_DIR/play.sh"
#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node > /dev/null 2>&1; then
  echo "Node.js is required to run KARTLAN 3D."
  echo "Please install Node.js: https://nodejs.org/"
  exit 1
fi
node bin/kartlan "$@"
PLAY
chmod +x "$TMP_DIR/play.sh"

cd "$DIST_DIR"
tar -czf "$DIST_DIR/kartlan-v1.0.0.tar.gz" "kartlan-1.0.0"
rm -rf "$TMP_DIR"

echo "✅ Created: $DIST_DIR/kartlan-v1.0.0.tar.gz"
