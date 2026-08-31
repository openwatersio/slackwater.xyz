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

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** "Thu 30 Aug 14:30", in the station's own timezone - never the server's. */
function formatMoment(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('weekday')} ${get('day')} ${get('month')} ${get('hour')}:${get('minute')}`
}

/**
 * An anonymous curve is not a share card - "the image is the message" needs
 * the station name and the moment legible in a thumbnail, not just the water.
 * Drawn last (appended right before </svg>) so it paints over the chart
 * rather than under it, and the shared text{...} rule from withEmbeddedFont
 * already gives it the right font - only size/weight need overriding here,
 * done via inline `style` since that's the one thing that outranks a
 * stylesheet rule in the cascade. Stroked with the same dark halo technique
 * the chart's own labels use (`paint-order:stroke`), not an opaque band: a
 * band tall enough to guarantee contrast would cover the chart's peaks.
 */
function withHeader(svg: string, title: string, subtitle: string): string {
  const halo = 'paint-order:stroke;stroke:#00121f;stroke-width:6'
  const header =
    `<text x="40" y="52" fill="#fcfcfc" style="${halo};font-family:'${FONT_FAMILY}';font-size:36px;font-weight:700">${escapeXml(title)}</text>` +
    `<text x="40" y="86" fill="#88b868" style="${halo};font-family:'${FONT_FAMILY}';font-size:22px;font-weight:500">${escapeXml(subtitle)}</text>`
  return svg.replace('</svg>', `${header}</svg>`)
}

/**
 * Renders a station's curve, centred on `now`, as a 1200x630 PNG - the image
 * behind both the canonical and instant OG card routes.
 *
 * `live`: the bare route renders "now" and goes stale by the minute, so its
 * card says "Current conditions" rather than a timestamp that would read as
 * a stale promise. The instant route (`live` false, the default) shares one
 * fixed moment, so the card names it - in the station's own timezone, not
 * the server's or the viewer's, because the moment being shared is the
 * station's local water, not an instant in the ether.
 */
export async function renderCard(station: Station, now: Date, live = false): Promise<Uint8Array<ArrayBuffer>> {
  // CHS stations carry no constituents, so no card can be drawn for one. The
  // catalogue does not ship any yet; this is here so the day it does, a stub
  // reaching this route fails loudly instead of `predictorFor` throwing deep
  // inside `resvg` with a much less legible stack.
  if (station.source !== 'bundled') {
    throw new Error(`renderCard: no curve for a CHS station (${station.id})`)
  }
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
  const subtitle = live ? 'Current conditions' : formatMoment(now, station.timezone)
  const svg = withHeader(withEmbeddedFont(withNamespace), station.name, subtitle)
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
  // asPng() is typed Uint8Array<ArrayBufferLike>, which no longer satisfies
  // BodyInit (SharedArrayBuffer is in the union). resvg allocates a plain
  // ArrayBuffer; narrowing here keeps the `new Response(png)` call sites clean.
  return resvg.render().asPng() as Uint8Array<ArrayBuffer>
}

/** The URL's plural kind segment (`currents`/`tides`) to the catalogue's singular Kind. */
export function stationKindFromUrl(urlKind: string): Kind | undefined {
  if (urlKind === 'currents') return 'current'
  if (urlKind === 'tides') return 'tide'
  return undefined
}
