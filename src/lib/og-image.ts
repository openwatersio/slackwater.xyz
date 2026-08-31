import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Resvg } from '@cf-wasm/resvg'
import fontDataUri from './fonts/RobotoMono.ttf?inline'
import { CurrentCurve } from '#/components/CurrentCurve'
import { TideCurve } from '#/components/TideCurve'
import type { Kind, Station } from './station'

// `@cf-wasm/resvg` wraps `@resvg/resvg-wasm` with a package.json "exports"
// condition per runtime (workerd/node/edge-light), each shipping the wasm in
// the form that runtime accepts. The Worker build resolves "workerd" (an
// already-compiled WebAssembly.Module, imported the way Wrangler's own
// upload step expects) - a plain `@resvg/resvg-wasm` import could only ever
// give raw bytes, and Cloudflare Workers refuse to compile WebAssembly from
// bytes at request time ("Wasm code generation disallowed by embedder" -
// verified against a real Worker, see task-7-report.md). Both builds
// initialise once at module load (a call `@cf-wasm/resvg` makes itself,
// synchronously, as an import side effect - satisfies "once per isolate"
// without this file managing it) and expose the identical `Resvg` API, so
// this file's logic is the same code path in both environments.

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
  // `Resvg.async`, not `new Resvg`: init is a fire-and-forget side effect of
  // importing the package (see the top-of-file comment), so the first
  // request in a fresh isolate can otherwise race ahead of it being ready.
  const resvg = await Resvg.async(svg, {
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
