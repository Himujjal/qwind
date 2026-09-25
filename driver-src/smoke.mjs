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
const virtualTwDir = '/vendor/tailwindcss'
globalThis.__tw_read = (p) => {
  if (p.startsWith(virtualTwDir + '/')) {
    const name = p.slice(virtualTwDir.length + 1)
    if (['theme.css', 'preflight.css', 'utilities.css'].includes(name)) {
      return fs.readFileSync(path.join(root, 'vendor/tailwindcss', name), 'utf8')
    }
  }
  return fs.readFileSync(p, 'utf8')
}

await import('../dist/bundle.js')

const inputCss = fs.readFileSync(path.join(root, fixtureName, 'input.css'), 'utf8')
const tailwindCssText = fs.readFileSync(path.join(root, 'vendor/tailwindcss/index.css'), 'utf8')
const twCssDir = virtualTwDir

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
