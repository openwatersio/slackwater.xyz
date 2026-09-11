# Station pages that answer the search

A station page exists to win a query like "tides victoria bc" and turn the reader into an app user. The page answers first — today's highs and lows, dated, in the first screen — and only then explains itself. Everything below the answer is there to rank, to convert, or to send a reader to the next station.

The incumbent for that query is a slow, ad-carried page that puts thirty days of tables on one URL and links to nothing. This page is fast, has no ads, carries structured data, and links every station to its neighbours.

## URLs

Station pages live at `/tides/<slug>/` and `/currents/<slug>/`. The destination is a geographic hierarchy (`/tides/ca/bc/victoria/`, with country and region landing pages and permanent redirects from the short paths), specified in the planning repo's `station-database.md`. Today's data cannot place a station in that hierarchy — the tide database publishes country names, not codes, and its Canadian `region` is a GeoNames admin1 number — so the move rides the unified station database migration.

To make that move one change, every station URL on the site is built by `stationPath(kind, slug)` in `src/lib/station.ts`: routes, breadcrumb, JSON-LD, nearby links, sitemap, OG. The migration replaces that function and adds a redirect table; nothing else moves.

## What the reader sees

Top to bottom, on a phone:

1. **Breadcrumb.** `Slackwater › Tide stations › Victoria`. Real pages only; the country and region crumbs arrive with the hierarchy.
2. **Heading.** `Victoria tide times` or `Deception Pass (Narrows) currents`, with a place line beneath: the curated water context, the subdivision, the country — `Inner Harbour · BC, Canada`.
3. **The answer.** One dated line that is true in prerendered HTML: `Fri 11 Sep · High 9.6 ft at 15:10 · Low 0.8 ft at 06:20`. For a current station, the day's slack windows and maxima. Once hydrated, a lead reading sits above it — the state word, the height or speed, the time, and a commentary pill (`High in 3h 41m`) — the app's readout, gated on `live` because it claims the present.
4. **Today and tomorrow.** Two day strips, both in the HTML, switched by a pair of radio inputs styled as tabs. No script runs the switch; it works before hydration and in a crawler. The labels read `Today` and `Tomorrow` only when the page is live; prerendered and instant pages show the dates.
5. **Call to action.** The TestFlight button, directly under the strip.
6. **Seven days.** A table of every high and low (or slack and maximum) for the next seven station-local days, grouped by day. This is the long-tail content: it is visible, not hidden in a tab, so it carries full weight.
7. **Station facts.** Position to four decimals, chart datum with its note, time zone, provenance, region and country.
8. **Nearby.** The nearest stations of the same kind, each a link with its water context, distance and compass bearing; then a map with a pin per station, loaded only when it scrolls into view.
9. **All stations.** The link back to the directory.

### Canadian stations

The 33 CHS ports prerender identity only; the reader's browser fetches the day from DFO. They get the breadcrumb, heading, identity sentence, facts, nearby and CTA, and today's strip once the fetch lands. No tomorrow tab and no seven-day table: the site does not re-serve CHS predictions, and a second day would double the DFO requests for a page that cannot cache them.

## The day strip

The strip is the app's scrub view held still on one station-local day: the sky over the curve, the app's inks, the app's readout. There is no centreline and nothing to drag. Time runs left to right from midnight to midnight; the sky is painted for the moment the page is about — now on today's strip, this time tomorrow on the other.

`DayStrip` composes the modules the landing page hero already uses — `Sky`, `TideCurve` or `CurrentCurve`, `CurrentLead` — rather than generalising `CurrentScrubStrip`, which would need a no-centreline mode, a sky time separate from the scrub time, an arbitrary now position, event and day rows it does not draw, and a tide sibling. The composer is smaller than that set of switches, and it leaves the hero's only consumer alone.

The box has a fixed height so the page does not shift when the canvas paints. Day boundaries come from `dayStart` in `src/lib/format.ts`, which resolves station-local midnight through `Intl`, so a DST day is 23 or 25 hours wide and the curve fits it.

Past is faded to 35% on the curve, the way the app fades it, by two stops in the existing edge-fade gradient at the now position. Tomorrow's strip has no now position inside its window, so nothing fades.

Sunrise and sunset sit in a day row under the plot, at their true x, in the sunrise and sunset inks. Event times — highs and lows, or slacks — sit in their own row above it.

## Structured data

Each station page emits two JSON-LD objects from `stationJsonLd` in `src/lib/json-ld.ts`:

- `Place` with `GeoCoordinates` and a `PostalAddress` carrying the subdivision and country where known. A Canadian tide page carries the country only.
- `BreadcrumbList` mirroring the visible breadcrumb. The two are fed from one list so they cannot disagree.

Nothing else. `Dataset` surfaces only in Dataset Search; `FAQPage` and `Event` are restricted or deprecated for this kind of content.

## Freshness

Prerendered HTML is frozen at the build clock. That clock is injected at build time, one value shared by the server and client bundles, and the site rebuilds nightly, so the dated content a crawler reads is never more than a day stale. Anything phrased as "now" stays gated on `live`, as before.

## The map

Leaflet, loaded on first intersection of the map's box, with OpenStreetMap raster tiles. The list above it is the accessible and crawlable version; the map is `aria-hidden`. Pins are circle markers — no image sprites, no bundler path problems — and clicking one navigates to the station. Leaflet is never imported at module scope: it touches `window` on evaluation, and a static import would break every prerender.

The reader's browser fetches tiles from openstreetmap.org when the map appears; the privacy page says so.

## Eclipses

The strip is built to host a future `/eclipse/<slug>/` page without changes to its shape. `dayStart` is a prop, not derived inside, so an eclipse page passes the eclipse night and paints the sky at greatest eclipse. The day row is where the app draws its eclipse glyph. The search itself — `nextLunarEclipse` and `lunarEclipseVisibility` from `@openwaters/almanac` — belongs in `skyDays`, once per window, never per frame; and `Sky` takes the whole `SkyState`, so the umbra and penumbral wash become fields on it rather than new props at every call site. Almanac covers lunar eclipses only; solar is off its roadmap until a consumer needs the geoid work.

## Out of scope

- Country and region landing pages, and redirects from the short paths.
- Any interaction on the strip.
- A thirty-day table.
- Solar eclipses.
