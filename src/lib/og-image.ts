import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
// `?inline` forces Vite to embed the wasm binary as a base64 data: URI at
// build time. This is NOT the intended fix, it is a known, reported problem -
// see the long comment on `ready()` below. It is the only import form that
// gets `pnpm build` to complete in this toolchain (nitro 3.0.260522-beta +
// Vite 8/Rolldown + Wrangler's `no_bundle` output): a bare
// `@resvg/resvg-wasm/index_bg.wasm` import (static OR dynamic) fails
// `pnpm build` outright - Vite 8's built-in `builtin:vite-wasm-fallback`
// (a native Rolldown plugin, source not inspectable from JS) throws
// "Could not load ... .wasm" before nitro's own unwasm plugin - configured
// via `wasm: { esmImport: true }` in nitro's cloudflare-module preset
// specifically to hand real `.wasm` imports to Wrangler - ever gets a chance
// to run. Marking `.wasm` external in vite.config.ts gets past that but
// leaves a dangling `import ".../index_bg.wasm"` that nothing resolves,
// breaking every prerendered page, not just these two OG routes.
import wasmDataUri from '@resvg/resvg-wasm/index_bg.wasm?inline'
import fontDataUri from './fonts/RobotoMono.ttf?inline'
import { CurrentCurve } from '#/components/CurrentCurve'
import { TideCurve } from '#/components/TideCurve'
import type { Kind, Station } from './station'

// The OG card size - deliberately not the page's 460x210 viewBox, because a
// chart legible at one is not legible at the other.
const WIDTH = 1200
const HEIGHT = 630
// Matches the family name baked into fonts/RobotoMono.ttf's own name table
// (verified with fontTools), which is how resvg's fontBuffers matching finds it.
const FONT_FAMILY = 'Roboto Mono'

function bytesFromDataUri(dataUri: string): Uint8Array {
  const binary = atob(dataUri.slice(dataUri.indexOf(',') + 1))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const fontBytes = bytesFromDataUri(fontDataUri)

// initWasm throws if called twice, and a Worker isolate serves many requests
// off one module instance - so the promise itself (not just a flag) is cached
// at module scope and every request awaits the same one.
//
// KNOWN PROBLEM, not fixed: `initWasm` here is handed raw bytes decoded from
// the `?inline` data: URI above, which makes `__wbg_load` call
// `WebAssembly.instantiate(bytes, imports)` - the COMPILING overload. Verified
// against a real Worker (`npx wrangler dev -c .output/server/wrangler.json`),
// every request to either OG route 500s with:
//   CompileError: WebAssembly.instantiate(): Wasm code generation disallowed
//   by embedder
// Cloudflare Workers only allow instantiating an ALREADY-COMPILED
// WebAssembly.Module (the form a real `.wasm` module import gives you,
// compiled ahead of time at upload) - not compiling from bytes at request
// time, for any reason, ever. This is a platform security restriction, not
// something fixable in this file. See og-image.test.ts and the task report
// for what was tried. Reported rather than routed around further: the two
// non-`?inline` import forms above (bare and dynamic) fail `pnpm build`
// itself, so `?inline` is what ships here to keep the build green, with this
// runtime failure left visible rather than papered over.
let wasmReady: Promise<void> | undefined
function ready() {
  if (!wasmReady) wasmReady = initWasm(bytesFromDataUri(wasmDataUri))
  return wasmReady
}

/**
 * The chart's <text> elements are styled with Tailwind classes, which mean
 * nothing here - there is no stylesheet attached to a raw SVG string, and
 * resvg has no filesystem and no system fonts to fall back to in a Worker.
 * Left alone every label rasterises with invisible glyphs, not a wrong font.
 * One catch-all rule, not a per-label match of the page's sizes: this is a
 * share-card render, not a pixel-for-pixel copy of the live page.
 */
function withEmbeddedFont(svg: string): string {
  return svg.replace(
    '</defs>',
    `<style>text{font-family:'${FONT_FAMILY}';font-size:16px;font-weight:600;}</style></defs>`,
  )
}

/**
 * Renders a station's curve, centred on `now`, as a 1200x630 PNG - the image
 * behind both the canonical and instant OG card routes.
 */
export async function renderCard(station: Station, now: Date): Promise<Uint8Array> {
  await ready()
  const start = new Date(now.getTime() - 6 * 3600_000)
  const Curve = station.kind === 'tide' ? TideCurve : CurrentCurve
  const markup = renderToStaticMarkup(
    createElement(Curve, { station, start, hours: 24, now, width: WIDTH, height: HEIGHT }),
  )
  // The component's root element is a <figure> wrapping the <svg> plus a
  // sr-only <figcaption> - resvg needs an SVG document as its root, so pull
  // just the <svg>...</svg> out rather than feeding it the whole figure.
  const svgMatch = markup.match(/<svg[\s\S]*<\/svg>/)
  if (!svgMatch) throw new Error('curve component did not render an <svg>')
  // React's SSR output omits xmlns - fine embedded in an HTML page, but
  // resvg parses this string as a standalone XML document and rejects one
  // with no namespaced root ("document does not have a root node").
  const withNamespace = svgMatch[0].replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
  const svg = withEmbeddedFont(withNamespace)
  const resvg = new Resvg(svg, {
    font: { fontBuffers: [fontBytes], defaultFontFamily: FONT_FAMILY, monospaceFamily: FONT_FAMILY },
    // The chart itself paints no background (it's drawn assuming the app's
    // dark page behind it - its own text halo is stroked this exact colour,
    // --color-sw-page from styles.css) - without this every card unfurls on
    // whatever white the client puts behind a transparent PNG.
    background: '#00121f',
  })
  return resvg.render().asPng()
}

/** The URL's plural kind segment (`currents`/`tides`) to the catalogue's singular Kind. */
export function stationKindFromUrl(urlKind: string): Kind | undefined {
  if (urlKind === 'currents') return 'current'
  if (urlKind === 'tides') return 'tide'
  return undefined
}
