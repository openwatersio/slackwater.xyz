// Not a route: the leading `-` keeps the router's file scan off it. The two
// kinds' splat routes (`tides.$.tsx`, `currents.$.tsx`) share everything here.
import { notFound, redirect } from '@tanstack/react-router'
import { StationIndex } from '#/components/StationIndex'
import { StationPage } from '#/components/StationPage'
import { resolvePath, type PlaceIndex, type Resolved } from '#/lib/catalogue-server'
import { ogImageAlt, pageDescription, pageTitle } from '#/lib/copy'
import { faqJsonLd, stationJsonLd } from '#/lib/json-ld'
import { APP_STORE_ID } from '#/lib/links'
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
  // A pass guide describes the water; without one a CHS page can promise only its identity.
  const description = page.guide?.description ?? pageDescription(s)
  const alt = ogImageAlt(s)
  const card = `${ORIGIN}/og/${kind === 'tide' ? 'tides' : 'currents'}/${s.slug}`
  // The flat share form, not the page's own path: shipped app builds parse
  // only `/<kind>/<slug>[/<instant>]` (`stationLink(from:)` in slackwater-ios).
  const opens = `${ORIGIN}${kindRoot(kind)}${s.slug}/${page.instant?.raw ?? ''}`
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
      // Replaces the root's banner by name, so Open lands on this station.
      { name: 'apple-itunes-app', content: `app-id=${APP_STORE_ID}, app-argument=${opens}` },
    ],
    // Structured data lives on the canonical page only: an instant page
    // canonicalises there, so a second copy would describe the same place twice.
    ...(page.instant
      ? {}
      : {
          scripts: [
            ...stationJsonLd(s, canonical, page.crumbs),
            ...(page.guide?.faq.length ? [faqJsonLd(page.guide.faq)] : []),
          ].map((json) => ({
            type: 'application/ld+json',
            children: JSON.stringify(json),
          })),
        }),
  }
}

export function Directory({ kind, page }: { kind: Kind; page: Page }) {
  const { now, live } = useLiveNow()
  if (page.page === 'place') {
    const { title, up, places, rows, count } = page.index
    return (
      <StationIndex
        kind={kind}
        title={title}
        up={up}
        places={places}
        rows={rows}
        lede={
          title ? (
            <PlaceIntro kind={kind} index={page.index} />
          ) : (
            <p>{`${count.toLocaleString()} stations across ${places.length} ${places.length === 1 ? 'country' : 'countries'}.`}</p>
          )
        }
      />
    )
  }
  const { station, nearby, crumbs, guide, instant } = page
  // Keyed by station so its state can never outlive it. Station links are
  // plain anchors today, so every station is a fresh document; a client-side
  // `<Link>` would instead reuse this component across splat params, and
  // Victoria's CHS day, fetched curve and selected moment would draw under
  // the next port's name.
  const key = station.id
  if (!instant) return <StationPage key={key} station={station} now={now} live={live} nearby={nearby} crumbs={crumbs} guide={guide} />
  // Never `live`: this page is one fixed shared moment, so a relative "in 30m"
  // would be measured from a moment that may be long past. But `settled` from
  // the first render — that moment came out of the URL and nothing will
  // replace it, which is the opposite of a live page's build-time placeholder.
  return station.source === 'bundled'
    ? <StationPage key={key} station={station} now={now} selectedAt={instant.at} live={live} nearby={nearby} crumbs={crumbs} />
    : <StationPage key={key} station={station} now={instant.at} settled nearby={nearby} crumbs={crumbs} guide={guide} />
}

/**
 * What a place page says before its list: how many stations, whose data they
 * predict from, and whether the other kind covers the same place.
 *
 * Read from the catalogue and nothing else. The three facts a reader landing
 * from a search wants first are whether their water is here, whether to trust
 * it, and where the currents are, and each one is a field, not a sentence
 * someone has to keep true by hand.
 *
 * The heading above already names the place, so the intro never repeats it,
 * and sources come as a label: "published by US National Oceanic and
 * Atmospheric Administration" wants an article the data cannot supply.
 */
function PlaceIntro({ kind, index }: { kind: Kind; index: PlaceIndex }) {
  const { count, sources, other } = index
  const what = kind === 'tide' ? 'tide' : 'tidal current'
  return (
    <>
      <p>
        {`${count.toLocaleString()} ${what} ${count === 1 ? 'station' : 'stations'}.`}
        {sources.length > 0 && ` Sources: ${sources.join(', ')}.`}
      </p>
      <p>
        {other ? (
          <>
            {`${kind === 'tide' ? 'Tidal currents' : 'Tide tables'} are on their own page: `}
            <a href={other.href} className="text-sw-paper/90 underline hover:text-sw-leaf">
              {`${other.count.toLocaleString()} ${kind === 'tide' ? 'current' : 'tide'} ${other.count === 1 ? 'station' : 'stations'}`}
            </a>
            .
          </>
        ) : (
          `Slackwater predicts no ${kind === 'tide' ? 'tidal currents' : 'tides'} here.`
        )}
      </p>
    </>
  )
}
