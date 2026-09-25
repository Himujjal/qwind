#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if [ ! -x target/debug/qwind ]; then
  cargo build
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
output="$tmp/output.css"

./target/debug/qwind -i fixture-tsx/input.css -o "$output" --content fixture-tsx
printf 'PASS: TSX CLI compile and oxide content scan\n'

for selector in '.btn {' '.btn-primary {' '.text-xl {' '.font-bold {' '.card {' '.badge {' '.bg-primary {' '--color-primary'; do
  if ! grep -Fq -- "$selector" "$output"; then
    printf 'FAIL: output does not contain %s\n' "$selector" >&2
    exit 1
  fi
  printf 'PASS: output contains %s\n' "$selector"
done
