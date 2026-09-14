// TwDriver: plain JS (no TS, no node:* imports) entry for esbuild bundling.
// Baked module table: `daisyui` resolves to the vendored package object,
// `tailwindcss` stylesheet resolves to host-provided text. Everything else throws.

import { compile } from '../../tailwindcss/packages/tailwindcss/src/index.ts'
import daisyui from '../vendor/package/index.js'

// --- Host polyfills (QuickJS lacks these Node/browser globals) ---
// structuredClone: recursive deep clone. Unlike the spec it keeps functions
// by reference (spec would throw) — the compat layer only clones data, and
// daisyUI configs carry handler functions alongside data.
// console: buffer every line into globalThis.__tw_log AND forward to the real
// console when one exists. The host flushes __tw_log to stderr after build so
// daisyUI warnings surface (previously this was a silent sink).
globalThis.__tw_log = []
function __tw_fmtArg(a) {
  if (typeof a === 'string') return a
  try {
    return JSON.stringify(a)
  } catch {
    return String(a)
  }
}
{
  const orig = globalThis.console
  const make = (level) => (...args) => {
    const line = '[' + level + '] ' + args.map(__tw_fmtArg).join(' ')
    globalThis.__tw_log.push(line)
    if (orig && typeof orig[level] === 'function') {
      orig[level](...args)
    }
  }
  globalThis.console = {
    log: make('log'),
    warn: make('warn'),
    error: make('error'),
    info: make('info'),
    debug: make('debug'),
    trace: make('trace'),
  }
}

// structuredClone: recursive deep clone. Unlike the spec it keeps functions
// by reference (spec would throw) — the compat layer only clones data, and
// daisyUI configs carry handler functions alongside data.
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = function structuredClone(value) {
    const seen = new Map()
    function clone(v) {
      if (v === null || typeof v !== 'object') return v
      if (seen.has(v)) return seen.get(v)
      if (v instanceof Date) return new Date(v.getTime())
      if (v instanceof RegExp) return new RegExp(v.source, v.flags)
      if (Array.isArray(v)) {
        const c = []
        seen.set(v, c)
        for (const item of v) c.push(clone(item))
        return c
      }
      const c = Object.create(Object.getPrototypeOf(v))
      seen.set(v, c)
      for (const k of Object.keys(v)) c[k] = clone(v[k])
      return c
    }
    return clone(value)
  }
}

function joinPath(base, rel) {
  // Minimal posix join + normalize (no node:path available in QuickJS).
  const parts = (base + '/' + rel).split('/')
  const out = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return '/' + out.join('/')
}

async function build(inputCss, candidatesJson, tailwindCssText, twCssDir, theme) {
  const candidates = JSON.parse(candidatesJson)

  // Pass theme name to the daisyUI module via a global the plugin reads.
  // daemonUI's pluginOptionsHandler reads `globalThis.__tw_daisyui_theme`.
  globalThis.__tw_daisyui_theme = theme || 'light'

  async function loadModule(id, base, resourceHint) {
    if (id === 'daisyui') {
      return { path: 'daisyui', base: '', module: daisyui }
    }
    throw new Error('[TwDriver] cannot load module: ' + id + ' (hint: ' + resourceHint + ')')
  }

  async function loadStylesheet(id, base) {
    if (id === 'tailwindcss' || id === 'tailwindcss/index.css') {
      return { path: 'tailwindcss/index.css', base: twCssDir, content: tailwindCssText }
    }
    if (id.startsWith('./') || id.startsWith('../')) {
      const abs = joinPath(base, id)
      const content = globalThis.__tw_read(abs)
      return { path: abs, base: abs.slice(0, abs.lastIndexOf('/')), content }
    }
    throw new Error('[TwDriver] cannot load stylesheet: ' + id + ' (base: ' + base + ')')
  }

  const compiler = await compile(inputCss, { base: '/', loadModule, loadStylesheet })
  return compiler.build(candidates)
}

globalThis.TwDriver = { build }
