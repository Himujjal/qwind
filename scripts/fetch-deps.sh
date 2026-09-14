#!/bin/sh
# Fetch + vendor the JS-side dependencies for tailwind-qjs-daisyui.
# Layout assumed: <parent>/tailwindcss  (upstream checkout, untouched)
#                 <parent>/tailwind-qjs-daisyui (this repo)
set -eu
cd "$(dirname "$0")/.."

if [ ! -d ../tailwindcss/packages/tailwindcss ]; then
  echo "error: expected upstream checkout at ../tailwindcss (sibling of this repo)" >&2
  exit 1
fi

echo "==> packing daisyui@5"
npm pack daisyui@5
rm -rf vendor
mkdir -p vendor
tar -xzf daisyui-5.*.tgz -C vendor
rm -f daisyui-5.*.tgz
echo "==> vendored $(node -p "require('./vendor/package/package.json').version" 2>/dev/null || cat vendor/package/package.json | grep '"version"')"

echo "==> installing dev dependencies (esbuild)"
npm install

echo "==> bundling driver"
npm run build:bundle
ls -lh dist/bundle.js
