#!/bin/bash
set -e

echo "📦 Building portable release archive..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION=$(node -p "require('$ROOT_DIR/package.json').version")
DIST_DIR="$ROOT_DIR/dist"
ARCHIVE_NAME="kartlan-v${VERSION}.tar.gz"

mkdir -p "$DIST_DIR"
rm -f "$DIST_DIR/$ARCHIVE_NAME"

cd "$ROOT_DIR"
tar -czf "$DIST_DIR/$ARCHIVE_NAME" \
  --exclude="dist" \
  --exclude=".git" \
  --exclude=".system_generated" \
  --exclude="node_modules/.cache" \
  package.json \
  server.js \
  bin \
  public \
  install.sh \
  play.sh \
  update.sh \
  README.md \
  LICENSE

cp "$DIST_DIR/$ARCHIVE_NAME" "$DIST_DIR/kartlan-v1.0.0.tar.gz" 2>/dev/null || true
echo "✅ Created: $DIST_DIR/$ARCHIVE_NAME"
