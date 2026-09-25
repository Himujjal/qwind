# Contributing

## Fresh setup

Clone the repository and install Node dev dependencies with `npm install` (for tests and bundle rebuilds). Use Rust edition 2024 with rustc >= 1.88; Node v26.7.0 and rustc 1.97.1 were tested. Building/running the checked-in bundle does not require Node.

## Build and test

- `cargo build` builds the debug binary from the checked-in `dist/bundle.js`.
- `npm run build:bundle` rebuilds `dist/bundle.js` from the driver and vendored JS sources.
- `npm test` runs the shell parity and TSX integration tests (which build the debug binary if absent).

## Vendored dependencies

See `vendor/VENDOR.md` for pinned versions, provenance, licenses, and manual upstream refresh instructions. `sh scripts/fetch-deps.sh` refreshes **daisyUI only**, installs the esbuild dependency, and rebuilds the bundle; it does not refresh Tailwind/oxide.

## Pull requests

Run `npm test` before submitting. If driver or vendored JS changes, rebuild and include the updated `dist/bundle.js`. Keep CLI `USAGE` in `src/main.rs` and README CLI documentation in sync. Do not commit generated CSS outputs or build artifacts.
