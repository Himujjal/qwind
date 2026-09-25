#!/bin/sh
# Refresh the pinned daisyUI package without removing the Tailwind/oxide snapshot.
set -eu
cd "$(dirname "$0")/.."

if [ ! -d vendor/tailwindcss/src ] || [ ! -d vendor/crates/oxide ]; then
  echo "error: missing vendored Tailwind sources or oxide crate; see vendor/VENDOR.md" >&2
  exit 1
fi

DAISYUI_VERSION=5.7.37
echo "==> packing daisyui@$DAISYUI_VERSION"
npm pack "daisyui@$DAISYUI_VERSION"
rm -rf vendor/package
# npm pack extracts its package/ directory beneath vendor/.
tar -xzf "daisyui-$DAISYUI_VERSION.tgz" -C vendor
rm -f "daisyui-$DAISYUI_VERSION.tgz"
echo "==> vendored daisyui@$(node -p "require('./vendor/package/package.json').version")"

echo "==> installing dev dependencies (esbuild)"
npm install

echo "==> bundling driver"
npm run build:bundle
ls -lh dist/bundle.js
