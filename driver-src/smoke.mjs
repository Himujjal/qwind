// Node smoke test: must pass before touching Rust.
// Usage: node driver-src/smoke.mjs [fixtureDir=fixture] [outFile=out.node.css] [candidatesJson]
// The candidatesJson should be the exact oxide scan() output (the Rust CLI
// prints it as `[tw] candidates N [...]`); byte-parity with the host requires
// identical candidate lists.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const fixtureName = process.argv[2] ?? 'fixture'
const outName = process.argv[3] ?? 'out.node.css'
const candidatesArg = process.argv[4]

// Host bridge (mirrors the Rust `__tw_read` global).
globalThis.__tw_read = (p) => fs.readFileSync(p, 'utf8')

await import('../dist/bundle.js')

const inputCss = fs.readFileSync(path.join(root, fixtureName, 'input.css'), 'utf8')
// Sibling checkout layout: <parent>/tailwindcss (upstream repo) next to this repo.
const twRoot = path.resolve(root, '../tailwindcss/packages/tailwindcss')
const tailwindCssText = fs.readFileSync(path.join(twRoot, 'index.css'), 'utf8')
const twCssDir = twRoot

// Fallback for the original fixture (extra scan words like `class`/`hello`
// generate no CSS, so the short list is output-identical there).
const candidates = candidatesArg ?? JSON.stringify(['btn', 'btn-primary', 'card'])

const out = await globalThis.TwDriver.build(inputCss, candidates, tailwindCssText, twCssDir)
console.log('[smoke] fixture =', fixtureName)
console.log('[smoke] output length =', out.length)
// Snapshot first: our console shim buffers every console.* call, so iterating
// __tw_log live while logging would loop forever. Write via stdout directly
// to avoid re-buffering.
const lines = [...(globalThis.__tw_log ?? [])]
for (const line of lines) process.stdout.write('[tw-log] ' + line + '\n')
fs.writeFileSync(path.join(root, outName), out)
console.log('[smoke] wrote', outName)
console.log('[smoke] OK')
