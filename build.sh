#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

TW_VERSION="v3.4.17"

case "$(uname -m)" in
  aarch64|arm64) TW_BIN="tailwindcss-linux-arm64" ;;
  armv7l)        TW_BIN="tailwindcss-linux-armv7" ;;
  x86_64)        TW_BIN="tailwindcss-linux-x64" ;;
  *) echo "Unsupported CPU: $(uname -m)"; exit 1 ;;
esac

mkdir -p bin fonts

if [ ! -x bin/tailwindcss ]; then
  echo "Downloading Tailwind $TW_VERSION ($TW_BIN)..."
  curl -fsSL -o bin/tailwindcss \
    "https://github.com/tailwindlabs/tailwindcss/releases/download/$TW_VERSION/$TW_BIN"
  chmod +x bin/tailwindcss
fi

if [ ! -f fonts/inter-latin-wght-normal.woff2 ]; then
  echo "Downloading Inter (variable, latin)..."
  curl -fsSL -o fonts/inter-latin-wght-normal.woff2 \
    "https://cdn.jsdelivr.net/npm/@fontsource-variable/inter@5/files/inter-latin-wght-normal.woff2"
fi

echo "Building styles.css..."
./bin/tailwindcss -c tailwind.config.js -i input.css -o styles.css --minify
echo "Done. Commit styles.css and fonts/."
