#!/bin/sh
# Zips src/ for upload to the Chrome Web Store, named after the version in src/manifest.json.
set -eu
cd "$(dirname "$0")"

VERSION=$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' src/manifest.json)
ZIP="simple-tab-sorter-v$VERSION.zip"

rm -f "$ZIP"
(cd src && zip -qr -X "../$ZIP" . -x '*.DS_Store')
echo "Created $ZIP"
