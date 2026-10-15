#!/bin/sh
# Builds dist/neat-tab-sorter-v<version>.zip for the Chrome Web Store from src/ (plus the license),
# using the version in src/manifest.json.
set -eu
cd "$(dirname "$0")"

VERSION=$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' src/manifest.json)
ZIP="dist/neat-tab-sorter-v$VERSION.zip"

mkdir -p dist
rm -f "$ZIP"
(cd src && zip -qr -X "../$ZIP" . -x '*.DS_Store')
zip -q -X "$ZIP" LICENSE
echo "Created $ZIP"
