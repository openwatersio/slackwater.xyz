import type { PlaceLink, StationRow } from '#/lib/catalogue-server'
import { UNPLACED } from '#/lib/places'
import { stationPath, type Kind } from '#/lib/station'
import { DirectoryNav } from './DirectoryNav'
import { TidesExplainerCard } from './TidesExplainerCard'

/**
 * Five regions in the tide database are bare numbers - "02", "08", "10" - NOAA
 * codes for Great Lakes and border waters, covering 58 stations. As a heading a
 * reader can read, "02" is worse than nothing, and they sort ahead of every real
 * place, so the page opened on them. Treated as unplaced.
 */
const isPlace = (region: string) => !/^\d+$/.test(region)

/**
 * Group only when region data covers a meaningful share of the rows.
 *
 * `rows.some((r) => r.region && isPlace(r.region))` was the original rule:
 * group if ANY row has a placeable region. That held while no current
 * station had one at all. Then `boundary-pass` gained a curated region and
 * 23 CHS gates arrived carrying one each — 24 rows out of 865 — and `.some()`
 * fired on that alone, sorting 24 one-station headings ahead of an
 * `Elsewhere` bucket holding the other 841. A reader looking for a US
 * current station scrolled past two dozen Canadian headings to reach the
 * site's entire bulk under a heading that isn't a place.
 *
 * Half is the line, and it is the same guarantee said as a threshold: group
 * and `Elsewhere` can never hold more of the page than the real headings do.
 * Below it a page stays one flat list — the current index at 2.8% placed,
 * Alaska at 49%, where 283 of 559 stations would otherwise pile up under a
 * heading that isn't a place. Above it the water names enough of the page to
 * be worth reading — Japan at 99%, Florida at 63%.
 */
const PLACED_SHARE_TO_GROUP = 0.5

function group(rows: StationRow[]): [string, StationRow[]][] {
  const by = new Map<string, StationRow[]>()
  for (const r of rows) {
    const key = r.region && isPlace(r.region) ? r.region : UNPLACED
    const list = by.get(key)
    list ? list.push(r) : by.set(key, [r])
  }
  // `Elsewhere` last, everything else alphabetical: it is a fallback bucket, not
  // a place, so it should not sort into the middle of real regions.
  return [...by.entries()].sort(([a], [b]) =>
    a === UNPLACED ? 1 : b === UNPLACED ? -1 : a.localeCompare(b),
  )
}

/**
 * One page of a browse index: the places below it, then the stations on it.
 *
 * Four pages share this shape rather than four components — the worldwide
 * index (all places, no stations), a country that fits on one page (no
 * places, all its stations), a country too big to (its subdivisions, plus the
 * few stations no subdivision claims), and a subdivision (its stations). A
 * page can hold both lists, which is what keeps the handful of US stations
 * with no state code reachable from somewhere other than the sitemap.
 *
 * Within a page, stations still group under `region` — the water rather than
 * the jurisdiction. Those regions are a long tail (286 of 542 name a single
 * station), which is why region is a heading here and never a route; see
 * `placeTree` in `places.ts`.
 *
 * Most current stations carry no region at all (the NOAA bundle has no such
 * field) — a curated few (CHS gates, `boundary-pass`) do, but not enough of
 * the corpus to earn grouping, so they render as one alphabetical list. The
 * shape follows the data instead of forcing both kinds into the same
 * furniture. See `PLACED_SHARE_TO_GROUP` for the threshold.
 */
export function StationIndex({
  kind,
  rows,
  places = [],
  title,
  lede,
  up,
}: {
  kind: Kind
  rows: StationRow[]
  places?: PlaceLink[]
  title?: string
  lede?: string
  /** The page one level up, for the crumb above the heading. */
  up?: { href: string; label: string }
}) {
  const placed = rows.filter((r) => r.region && isPlace(r.region)).length
  const grouped = rows.length > 0 && placed / rows.length >= PLACED_SHARE_TO_GROUP
  const label = title ?? (kind === 'tide' ? 'Tide stations' : 'Current stations')
  const back = up ?? { href: '/stations/', label: 'All stations' }
  const blurb =
    lede ??
    `${rows.length.toLocaleString()} stations${kind === 'tide' ? ' worldwide' : ' across the US and Canada'}.`
  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <DirectoryNav />
      <a href={back.href} className="mb-4 inline-block text-sm text-sw-steel hover:text-sw-paper">
        {back.label}
      </a>
      <h1 className="text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">{label}</h1>
      <p className="mt-3 text-sw-steel">{blurb}</p>
      {/* The explainer belongs on the one page a reader arrives at cold — the
          worldwide tide index, the only page with nothing above it — and not
          on the 148 country and subdivision pages under it. */}
      {kind === 'tide' && !up && (
        <div className="mt-8 max-w-3xl">
          <TidesExplainerCard />
        </div>
      )}
      {places.length > 0 && <Places places={places} />}
      {grouped ? (
        group(rows).map(([region, list]) => (
          <section key={region} className="mt-10">
            <h2 className="text-sm font-medium uppercase tracking-wider text-sw-leaf">{region}</h2>
            <List kind={kind} rows={list} />
          </section>
        ))
      ) : rows.length > 0 ? (
        <div className="mt-10">
          <List kind={kind} rows={rows} />
        </div>
      ) : null}
    </main>
  )
}

/**
 * The places below this page, under their continent where they have one.
 *
 * Continent is only ever set on a country, so a subdivision list renders as
 * one block — which is right, since every subdivision on a page shares its
 * country's continent and a heading repeating it would say nothing.
 */
function Places({ places }: { places: PlaceLink[] }) {
  const byContinent = new Map<string, PlaceLink[]>()
  for (const p of places) {
    const key = p.continent ?? ''
    const list = byContinent.get(key)
    list ? list.push(p) : byContinent.set(key, [p])
  }
  return (
    <>
      {[...byContinent.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([continent, list]) => (
          <section key={continent} className="mt-10">
            {continent && (
              <h2 className="text-sm font-medium uppercase tracking-wider text-sw-leaf">
                {continent}
              </h2>
            )}
            <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <li key={p.href}>
                  <a href={p.href} className="text-sw-paper/90 hover:text-sw-leaf">
                    {p.name}
                  </a>{' '}
                  <span className="text-sw-steel">{p.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </>
  )
}

function List({ kind, rows }: { kind: Kind; rows: StationRow[] }) {
  return (
    <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <li key={r.slug}>
          <a href={stationPath(kind, r.slug)} className="text-sw-paper/90 hover:text-sw-leaf">
            {r.name}
          </a>
        </li>
      ))}
    </ul>
  )
}
