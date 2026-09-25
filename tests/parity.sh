#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

if [ ! -x target/debug/tailwindcss-qjs-poc ]; then
  cargo build
fi
bin=./target/debug/tailwindcss-qjs-poc
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

require_contains() {
  if ! grep -Fq -- "$2" "$1"; then
    printf 'FAIL: %s does not contain %s\n' "$1" "$2" >&2
    exit 1
  fi
}

require_absent() {
  if grep -Fq -- "$2" "$1"; then
    printf 'FAIL: %s unexpectedly contains %s\n' "$1" "$2" >&2
    exit 1
  fi
}

rust_candidates() {
  while IFS= read -r line; do
    case "$line" in
      '[tw] candidates '*)
        line=${line#'[tw] candidates '}
        printf '%s\n' "${line#* }"
        return 0
        ;;
    esac
  done < "$1"
  printf 'FAIL: no Rust candidate list in %s\n' "$1" >&2
  return 1
}

for fixture in fixture fixture2; do
  "$bin" -i "$fixture/input.css" -o "$tmp/$fixture.rust.css" --content "$fixture" > "$tmp/$fixture.cli.log" 2>&1
  candidates=$(rust_candidates "$tmp/$fixture.cli.log")
  require_contains "$tmp/$fixture.cli.log" '"btn"'
  require_contains "$tmp/$fixture.rust.css" '.btn {'
  require_contains "$tmp/$fixture.rust.css" '--color-primary'
  require_contains "$tmp/$fixture.rust.css" '@layer daisyui'
  if [ "$fixture" = fixture ]; then
    require_contains "$tmp/$fixture.cli.log" '"btn-primary"'
    require_contains "$tmp/$fixture.cli.log" '"card"'
    require_absent "$tmp/$fixture.rust.css" '.btn-nonexistent-xyz'
  else
    require_contains "$tmp/$fixture.cli.log" '"card"'
    require_contains "$tmp/$fixture.cli.log" '"toggle"'
    require_contains "$tmp/$fixture.cli.log" '"badge"'
    require_contains "$tmp/$fixture.rust.css" '.card {'
    require_contains "$tmp/$fixture.rust.css" '.toggle {'
    require_contains "$tmp/$fixture.rust.css" '.badge {'
  fi
  printf 'PASS: %s CLI compile, oxide candidates and daisyUI CSS\n' "$fixture"

  # smoke.mjs resolves its output against the repo root, so pass a relative path.
  node_out=$(node -p 'require("node:path").relative(process.cwd(), process.argv[1])' "$tmp/$fixture.node.css")
  node driver-src/smoke.mjs "$fixture" "$node_out" "$candidates" > "$tmp/$fixture.node.log" 2>&1
  cmp "$tmp/$fixture.rust.css" "$tmp/$fixture.node.css"
  printf 'PASS: %s Rust/Node byte parity\n' "$fixture"
done

# Missing input is a CLI usage error; an unsupported @plugin fails during build.
if "$bin" -i "$tmp/missing.css" -o "$tmp/missing.out.css" > "$tmp/missing.log" 2>&1; then
  status=0
else
  status=$?
fi
if [ "$status" -ne 2 ]; then
  printf 'FAIL: missing input exited %s (expected 2)\n' "$status" >&2
  exit 1
fi
require_contains "$tmp/missing.log" 'input file not found'
require_contains "$tmp/missing.log" 'Usage:'
printf 'PASS: missing input exits 2 with usage error\n'

printf '@import "tailwindcss";\n@plugin "not-daisyui";\n' > "$tmp/invalid.css"
if "$bin" -i "$tmp/invalid.css" -o "$tmp/invalid.out.css" --content fixture > "$tmp/invalid.log" 2>&1; then
  status=0
else
  status=$?
fi
if [ "$status" -ne 1 ]; then
  printf 'FAIL: invalid plugin exited %s (expected 1)\n' "$status" >&2
  exit 1
fi
require_contains "$tmp/invalid.log" 'error: build failed:'
require_contains "$tmp/invalid.log" 'not-daisyui'
printf 'PASS: invalid plugin exits 1 with build error\n'
