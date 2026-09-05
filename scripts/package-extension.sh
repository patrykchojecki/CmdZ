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

if [ -e "$ARCHIVE" ]; then
  echo "Release archive already exists: $ARCHIVE. Increment manifest.json's version before packaging." >&2
  exit 1
fi

node --check "$PROJECT_DIR/background.js"
node --check "$PROJECT_DIR/content.js"
node --check "$PROJECT_DIR/recovery.js"
node --test "$PROJECT_DIR/tests/"*.test.js
python3 -m json.tool "$PROJECT_DIR/manifest.json" >/dev/null

mkdir -p "$PROJECT_DIR/dist"
PACKAGE_DIR=$(mktemp -d "$PROJECT_DIR/dist/.package.XXXXXX")
trap 'rm -rf "$PACKAGE_DIR"' EXIT HUP INT TERM
cd "$PROJECT_DIR"

zip "$PACKAGE_DIR/extension.zip" \
  manifest.json \
  background.js \
  content.js \
  recovery.html \
  recovery.js \
  icons/icon-16.png \
  icons/icon-32.png \
  icons/icon-48.png \
  icons/icon-128.png

unzip -t "$PACKAGE_DIR/extension.zip" >/dev/null
# Publish only a complete archive, without replacing an existing release.
ln "$PACKAGE_DIR/extension.zip" "$ARCHIVE"
echo "Created $ARCHIVE"
