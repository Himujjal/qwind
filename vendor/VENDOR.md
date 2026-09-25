# Vendored dependency snapshot

Snapshot date: 2026-09-25.

- Tailwind CSS 4.3.3: copied from `tailwindcss` upstream commit `41d9cae8e53378d16087fcf359eb785c2fd42ce4` into `vendor/tailwindcss/` (package `src/`, `package.json`, four CSS entry files, and upstream root `LICENSE`).
- Oxide and its local path dependencies: same upstream commit, copied from `crates/{oxide,classification-macros,ignore}/` into `vendor/crates/`. The ignore crate includes `LICENSE-MIT`, `UNLICENSE`, and `COPYING`.
- daisyUI 5.7.37: npm package tarball extracted to `vendor/package/`; its `LICENSE` is retained.

To refresh Tailwind/oxide intentionally, check out the desired upstream Tailwind commit separately, copy the paths above while retaining their relative crate layout, record its commit/version/date here, then run `npm run build:bundle` and `cargo build`. The sibling checkout is only a refresh source, never a build or runtime dependency.

To refresh daisyUI, update the exact `DAISYUI_VERSION` in `scripts/fetch-deps.sh` and the version above, then run `sh scripts/fetch-deps.sh`. This only replaces `vendor/package/`, installs the esbuild dev dependency, and rebuilds `dist/bundle.js`. Node and esbuild are not needed to run a built binary.
