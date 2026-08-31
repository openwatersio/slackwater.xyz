import type { StationRow } from '#/lib/catalogue-server'
import type { Kind } from '#/lib/station'

/** Stations with no region of their own, gathered at the end rather than dropped. */
const UNPLACED = 'Elsewhere'

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
 * A quarter is the line: below it, region data is too thin to be worth the
 * extra furniture and the page stays one flat list (currents, at 2.8%
 * placed); at or above it, region carries enough of the corpus that
 * grouping earns its place (tides, at 94.8% placed).
 */
const PLACED_SHARE_TO_GROUP = 0.25

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
 * Every station of one kind, on one page.
 *
 * One page rather than a page per region: the regions are a long tail — 237 of
 * the 461 hold a single station — so a route per region would mint hundreds of
 * pages carrying one link each, which is the thin-content problem the corpus
 * already has to answer for.
 *
 * Most current stations carry no region at all (the NOAA bundle has no such
 * field) — a curated few (CHS gates, `boundary-pass`) do, but not enough of
 * the corpus to earn grouping, so they render as one alphabetical list. The
 * shape follows the data instead of forcing both kinds into the same
 * furniture. See `PLACED_SHARE_TO_GROUP` for the threshold.
 */
export function StationIndex({ kind, rows }: { kind: Kind; rows: StationRow[] }) {
  const placed = rows.filter((r) => r.region && isPlace(r.region)).length
  const grouped = rows.length > 0 && placed / rows.length >= PLACED_SHARE_TO_GROUP
  const label = kind === 'tide' ? 'Tide stations' : 'Current stations'
  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <h1 className="text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">{label}</h1>
      <p className="mt-3 text-sw-steel">
        {rows.length.toLocaleString()} stations
        {kind === 'tide' ? ' worldwide' : ' across the US and Canada'}.
      </p>
      {grouped ? (
        group(rows).map(([region, list]) => (
          <section key={region} className="mt-10">
            <h2 className="text-sm font-medium uppercase tracking-wider text-sw-leaf">{region}</h2>
            <List kind={kind} rows={list} />
          </section>
        ))
      ) : (
        <div className="mt-10">
          <List kind={kind} rows={rows} />
        </div>
      )}
    </main>
  )
}

function List({ kind, rows }: { kind: Kind; rows: StationRow[] }) {
  const base = kind === 'tide' ? '/tides/' : '/currents/'
  return (
    <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <li key={r.slug}>
          <a href={`${base}${r.slug}/`} className="text-sw-paper/90 hover:text-sw-leaf">
            {r.name}
          </a>
        </li>
      ))}
    </ul>
  )
}
