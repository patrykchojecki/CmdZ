#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname -- "$SCRIPT_DIR")
VERSION=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$PROJECT_DIR/manifest.json")
ARCHIVE="$PROJECT_DIR/dist/CmdZ-$VERSION.zip"

if [ -z "$VERSION" ]; then
  echo "Could not read the extension version from manifest.json." >&2
  exit 1
fi

node --check "$PROJECT_DIR/background.js"
python3 -m json.tool "$PROJECT_DIR/manifest.json" >/dev/null

mkdir -p "$PROJECT_DIR/dist"
cd "$PROJECT_DIR"

zip -FS "$ARCHIVE" \
  manifest.json \
  background.js \
  icons/icon-16.png \
  icons/icon-32.png \
  icons/icon-48.png \
  icons/icon-128.png

unzip -t "$ARCHIVE" >/dev/null
echo "Created $ARCHIVE"
