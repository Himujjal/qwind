# AGENTS.md — qwind (for AI agents, not humans)

> Audience split: this file instructs AI agents working in the repo.
> `README.md` is the human-facing doc (why it exists, usage narrative,
> architecture story). Don't duplicate human prose here — point at it.
> Read this file first, then only the source files your task touches.

## Repo contract (compressed)

**qwind**: single binary compiling Tailwind CSS v4 + daisyUI with zero
Node runtime. QuickJS (`rquickjs`) runs the JS core; oxide scanner links
natively in Rust; daisyUI is baked into the JS bundle. Fixture outputs are
byte-identical Rust-vs-Node. Rationale and full usage live in `README.md`;
the CLI contract lives in `src/main.rs` (`USAGE` const) — `USAGE` and
README CLI docs must stay in sync.

## Layout (read only what your task touches)

- `src/main.rs` — agent entry for CLI/engine changes. Read first for any
  CLI, scan, or QuickJS-host work. `USAGE` const = CLI contract.
- `driver-src/driver.js` — read before touching the JS bundle graph,
  module/stylesheet tables, or QuickJS shims. Plain JS only.
- `dist/bundle.js` — never hand-edit; only regenerate via
  `npm run build:bundle`.
- `vendor/` — never edit vendored code to fix a repo bug; fix the repo
  side. Snapshot metadata only in `vendor/VENDOR.md`.
- `fixture*/`, `tests/` — read the matching fixture + test before
  changing compile/scan behavior.
- `scripts/fetch-deps.sh` — daisyUI refresh only; never let it touch
  `vendor/tailwindcss/` or `vendor/crates/`.
- `CONTRIBUTING.md`, `LICENSE`, `vendor/VENDOR.md` — process/license
  references, not implementation.

## Build / test commands (agent preconditions)

- `cargo build` / `cargo build --release` — no Node needed; the binary
  embeds the checked-in `dist/bundle.js`.
- `npm install` — required precondition for `npm test` and
  `npm run build:bundle` only (esbuild). Never needed for `cargo build`.
- `npm run build:bundle` — mandatory after touching `driver-src/` or any
  vendored JS/CSS the bundle graph includes. Commit the regenerated file.
  Failure mode seen before: wrong `NODE_ENV` define quoting emits a bare
  `production` identifier and breaks both Rust and Node at `compileAst`.
- `npm test` — needs Node + Cargo; builds the debug binary if absent.
  Runs `tests/parity.sh` (HTML fixtures + Rust-vs-Node `cmp` + exit-code
  checks) and `tests/tsx.sh` (TSX scan + daisyUI selectors).
- `node driver-src/smoke.mjs <fixture> <out.css> '<candidates-json>'` —
  the smoke `<out.css>` arg is repo-relative (`path.join(root, out)`),
  and parity requires the exact Rust candidate list (the CLI prints it as
  `[tw] candidates N [...]`). The short fallback list only matches
  `fixture/`, never `fixture2/` or TSX.

## Agent workflow (follow this order)

1. Read this file, then only the files your task touches.
2. Make the smallest scoped change; never fix vendored code (fix the
   repo side and note it).
3. If `driver-src/` or vendored JS/CSS inputs changed:
   `npm run build:bundle` and commit `dist/bundle.js`.
4. `cargo build`, then `npm test` for any compile/scan/CLI change.
5. If CLI surface changed, update `USAGE` + README together.

## Pitfalls (learned the hard way)

- `--theme` is parsed but not forwarded (`theme` field unused) —
  don't claim theme support works; the driver default (`light`) applies.
- Never iterate `globalThis.__tw_log` live through the console shim
  (infinite loop → stack overflow); snapshot the array first.
- `smoke.mjs` resolves output against repo root; absolute `/tmp/...`
  out-paths fail with ENOENT — pass repo-relative names.
- `fixture2/` and TSX parity need the exact Rust candidate list from
  `[tw] candidates N [...]`; the short fallback list is `fixture/`-only.

## Rules for making changes

1. **Binary has no Node runtime.** Node/esbuild are build/test tools only.
   Never add `node:*` imports to the driver graph (`--external:node:*`
   must hold); keep the driver plain JS (TS lives only in vendored core
   sources esbuild transpiles).
2. **Rebuild + commit `dist/bundle.js`** whenever `driver-src/` or
   vendored JS/CSS inputs change; the binary embeds it.
3. **Keep `USAGE` and README CLI docs in sync** (flags, `--poll` requires
   `--watch`, `--theme` experimental/no-op status, exit codes 0/1/2,
   default content dir = input file's parent).
4. **Oxide pattern is `**/*`** — content scanning needs no per-extension
   config; `.tsx` works as plain-text token scanning. Use complete class
   names in fixtures (no dynamic fragments).
5. **Vendoring:** file-copy snapshots only; record commit/version/date in
   `vendor/VENDOR.md`; `fetch-deps.sh` touches `vendor/package` only.
   Preserve all `LICENSE*`/`UNLICENSE`/`COPYING` files. Don't prune
   vendor test/bench files casually.
6. **Don't commit** `out*.css`, `target/`, `node_modules/`, `*.tgz`
   (all gitignored). Test outputs go to `mktemp -d`.
7. **Tests over snapshots:** assert representative selectors
   (`.btn`, `.btn-primary`, `--color-primary`, …) + `cmp` Rust-vs-Node
   parity with matching candidate lists; don't assert exact byte counts
   except via `cmp`.
8. **Naming:** repo/binary/npm package is `qwind`. Upstream
   `vendor/tailwindcss` paths are Tailwind's — never rename those.
   Never reintroduce `../tailwindcss` sibling references.
