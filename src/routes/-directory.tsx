// Not a route: the leading `-` keeps the router's file scan off it. The two
// kinds' splat routes (`tides.$.tsx`, `currents.$.tsx`) share everything here.
import { notFound, redirect } from '@tanstack/react-router'
import { StationIndex } from '#/components/StationIndex'
import { StationPage } from '#/components/StationPage'
import { resolvePath, type Resolved } from '#/lib/catalogue-server'
import { ogImageAlt, pageDescription, pageTitle } from '#/lib/copy'
import { stationJsonLd } from '#/lib/json-ld'
import { placeHead } from '#/lib/place-head'
import { kindRoot } from '#/lib/places'
import type { Kind } from '#/lib/station'
import { useLiveNow } from '#/lib/use-live-now'
import { parseInstant } from './instant-url'

const ORIGIN = 'https://slackwater.xyz'

type Page =
  | Exclude<Resolved, { page: 'redirect' }> & {
      /** The moment a shared link fixed, and the segment it came from. */
      instant?: { at: Date; raw: string }
    }

/**
 * Every page under `/tides/` or `/currents/`: the index, a country, a
 * subdivision, a station, and a station at a shared moment.
 *
 * One route rather than one per shape, because the shapes collide:
 * `/tides/us/pa/` is a subdivision and `/tides/jp/kushiro/` a station, and
 * a station at an instant is one segment deeper than either. The last segment
 * is an instant when it parses as one; the rest is a path only the catalogue
 * can place.
 *
 * A malformed instant must 404, never fall back to "now": that would show the
 * receiver different water from the one that was actually shared. It does,
 * because an unparseable last segment stays in the path and matches nothing.
 */
export async function loadDirectory(kind: Kind, splat: string | undefined): Promise<Page> {
  const segments = (splat ?? '').split('/').filter(Boolean)
  const raw = segments.at(-1)
  const at = raw ? parseInstant(raw) : undefined
  if (at) segments.pop()
  const path = kindRoot(kind) + segments.map((s) => `${s}/`).join('')
  const hit = await resolvePath({ data: { kind, path } })
  if (!hit) throw notFound()
  if (hit.page === 'redirect') throw redirect({ href: at ? hit.path + raw : hit.path, statusCode: 301 })
  if (hit.page === 'place' && at) throw notFound()
  return at ? { ...hit, instant: { at, raw: raw! } } : hit
}

export function directoryHead(kind: Kind, page: Page | undefined) {
  if (!page) return {}
  if (page.page === 'place') return placeHead(kind, page.index, page.path)
  const s = page.station
  const canonical = ORIGIN + s.path
  const title = pageTitle(s)
  const description = pageDescription(s)
  const alt = ogImageAlt(s)
  const card = `${ORIGIN}/og/${kind === 'tide' ? 'tides' : 'currents'}/${s.slug}`
  return {
    // An instant URL points at the bare station URL, not itself: the instant
    // space is unbounded, so treating each shared moment as its own canonical
    // page would turn every link into an indexable near-duplicate.
    links: [{ rel: 'canonical', href: canonical }],
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: page.instant ? canonical + page.instant.raw : canonical },
      { property: 'og:image', content: page.instant ? `${card}/${page.instant.raw}.png` : `${card}.png` },
      // Overrides the site default only where it would be false — see `ogImageAlt`.
      ...(alt ? [{ property: 'og:image:alt', content: alt }] : []),
    ],
    // Structured data lives on the canonical page only: an instant page
    // canonicalises there, so a second copy would describe the same place twice.
    ...(page.instant
      ? {}
      : {
          scripts: stationJsonLd(s, canonical, page.crumbs).map((json) => ({
            type: 'application/ld+json',
            children: JSON.stringify(json),
          })),
        }),
  }
}

export function Directory({ kind, page }: { kind: Kind; page: Page }) {
  const { now, live } = useLiveNow()
  if (page.page === 'place') {
    const { name, up, places, rows, count } = page.index
    const what = kind === 'tide' ? 'tide' : 'current'
    return (
      <StationIndex
        kind={kind}
        title={name}
        up={up}
        places={places}
        rows={rows}
        lede={
          name
            ? `${count.toLocaleString()} ${what} stations.`
            : `${count.toLocaleString()} stations across ${places.length} ${places.length === 1 ? 'country' : 'countries'}.`
        }
      />
    )
  }
  const { station, nearby, crumbs, instant } = page
  if (!instant) return <StationPage station={station} now={now} live={live} nearby={nearby} crumbs={crumbs} />
  // Never `live`: this page is one fixed shared moment, so a relative "in 30m"
  // would be measured from a moment that may be long past. But `settled` from
  // the first render — that moment came out of the URL and nothing will
  // replace it, which is the opposite of a live page's build-time placeholder.
  return station.source === 'bundled'
    ? <StationPage station={station} now={now} selectedAt={instant.at} live={live} nearby={nearby} crumbs={crumbs} />
    : <StationPage station={station} now={instant.at} settled nearby={nearby} crumbs={crumbs} />
}
