#!/bin/bash
set -e

echo "📦 Building Debian package for KARTLAN 3D..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION=$(node -p "require('$ROOT_DIR/package.json').version")
BUILD_DIR="$ROOT_DIR/dist/deb_build"
DIST_DIR="$ROOT_DIR/dist"
PKG_NAME="kartlan_${VERSION}_all"

rm -rf "$BUILD_DIR" "$DIST_DIR/$PKG_NAME.deb" "$DIST_DIR/kartlan_latest_all.deb"
mkdir -p "$BUILD_DIR/DEBIAN"
mkdir -p "$BUILD_DIR/usr/bin"
mkdir -p "$BUILD_DIR/usr/lib/kartlan"
mkdir -p "$BUILD_DIR/usr/share/applications"
mkdir -p "$BUILD_DIR/usr/share/pixmaps"
mkdir -p "$DIST_DIR"

# 1. Control File
cat << CTRL > "$BUILD_DIR/DEBIAN/control"
Package: kartlan
Version: $VERSION
Section: games
Priority: optional
Architecture: all
Depends: nodejs (>= 16.0.0) | nodejs-legacy
Maintainer: Augustalex <augustalex@users.noreply.github.com>
Description: KARTLAN 3D - Arcade Wi-Fi LAN Multiplayer Kart Racer
 A fast-paced, high-octane 3D multiplayer kart racer featuring responsive drift
 physics, 3-tier mini-turbo sparks, items & weapons, synthesized Web Audio,
 and automatic Wi-Fi LAN discovery.
CTRL

# 2. Post-installation script
cat << 'POST' > "$BUILD_DIR/DEBIAN/postinst"
#!/bin/sh
set -e
chmod +x /usr/bin/kartlan
chmod +x /usr/lib/kartlan/bin/kartlan
if command -v update-desktop-database > /dev/null 2>&1; then
    update-desktop-database -q || true
fi
exit 0
POST
chmod 755 "$BUILD_DIR/DEBIAN/postinst"

# 3. Copy Application Files to /usr/lib/kartlan
cp -r "$ROOT_DIR/package.json" "$BUILD_DIR/usr/lib/kartlan/"
cp -r "$ROOT_DIR/server.js" "$BUILD_DIR/usr/lib/kartlan/"
cp -r "$ROOT_DIR/bin" "$BUILD_DIR/usr/lib/kartlan/"
cp -r "$ROOT_DIR/public" "$BUILD_DIR/usr/lib/kartlan/"
if [ -d "$ROOT_DIR/node_modules" ]; then
  cp -r "$ROOT_DIR/node_modules" "$BUILD_DIR/usr/lib/kartlan/"
fi

# 4. /usr/bin/kartlan launcher script
cat << 'LAUNCHER' > "$BUILD_DIR/usr/bin/kartlan"
#!/bin/sh
exec node /usr/lib/kartlan/bin/kartlan "$@"
LAUNCHER
chmod 755 "$BUILD_DIR/usr/bin/kartlan"
chmod 755 "$BUILD_DIR/usr/lib/kartlan/bin/kartlan"

# 5. Desktop Application Shortcut
cat << 'DESK' > "$BUILD_DIR/usr/share/applications/kartlan.desktop"
[Desktop Entry]
Name=KARTLAN 3D
Comment=Arcade Wi-Fi LAN Multiplayer Kart Racer
Exec=/usr/bin/kartlan
Icon=kartlan
Terminal=false
Type=Application
Categories=Game;ArcadeGame;
Keywords=kart;racing;multiplayer;lan;game;
DESK
chmod 644 "$BUILD_DIR/usr/share/applications/kartlan.desktop"

# 6. SVG Icon
mkdir -p "$ROOT_DIR/public/assets"
cat << 'ICON' > "$BUILD_DIR/usr/share/pixmaps/kartlan.svg"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <rect width="128" height="128" rx="28" fill="#070b19"/>
  <circle cx="64" cy="64" r="50" fill="none" stroke="#00f0ff" stroke-width="6"/>
  <path d="M34 78 L64 36 L94 78 L64 68 Z" fill="#ff0055"/>
  <circle cx="44" cy="86" r="10" fill="#111111" stroke="#00f0ff" stroke-width="4"/>
  <circle cx="84" cy="86" r="10" fill="#111111" stroke="#00f0ff" stroke-width="4"/>
</svg>
ICON
cp "$BUILD_DIR/usr/share/pixmaps/kartlan.svg" "$ROOT_DIR/public/assets/kartlan.svg"

# 7. Package using python ar and tar
cd "$BUILD_DIR"
echo "2.0" > debian-binary

# Create control.tar.gz
cd "$BUILD_DIR/DEBIAN"
tar -czf "$BUILD_DIR/control.tar.gz" *
cd "$BUILD_DIR"

# Create data.tar.gz
tar -czf "$BUILD_DIR/data.tar.gz" usr

# Build .deb archive
python3 "$ROOT_DIR/scripts/make_deb.py" "$DIST_DIR/$PKG_NAME.deb" "$BUILD_DIR/debian-binary" "$BUILD_DIR/control.tar.gz" "$BUILD_DIR/data.tar.gz"
cp "$DIST_DIR/$PKG_NAME.deb" "$DIST_DIR/kartlan_1.0.0_all.deb" 2>/dev/null || true

echo "✅ Verifying archive contents:"
ar -t "$DIST_DIR/$PKG_NAME.deb"
