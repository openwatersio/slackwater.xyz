# Station Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a page per station for the 3,607 stations whose data ships on npm, each rendering a real computed curve, with shareable instant URLs and OG cards showing the shared moment.

**Architecture:** The slug table defines the corpus; the data packages supply constituents; predictions are computed, never fetched. Canonical pages prerender at build. Instant URLs and OG cards server-render per request on Workers Paid.

**Tech Stack:** TanStack Start (React + Vite, nitro) on a Cloudflare Worker, `@neaps/tide-predictor`, `@resvg/resvg-wasm`.

**Spec:** `docs/superpowers/specs/2026-08-30-station-pages-design.md`

## Global Constraints

- **Workers Paid.** The design depends on it in three places — SSR on instant URLs, WASM in the script bundle, per-request rasterising. Record that dependency in `wrangler.jsonc`; on the free plan these fail differently rather than obviously.
- **Corpus is 3,607**, not the spec's 4,690. CHS is excluded — see Scope below.
- **Colour comes from the tokens in `src/styles.css`.** No literal hexes in components — except `CurrentCurve`'s SVG paint attributes, which are load-bearing: a rasteriser cannot resolve Tailwind classes.
- **Never claim a feature the app does not have** (`AGENTS.md`).
- **The wordmark never breaks**: one word, capital S, lowercase w, `whitespace-nowrap`.
- Slugs match `^[a-z0-9-]+$`. Canonical URLs must be the ones returning 200, never a redirect.
- Tests are `vitest` (`pnpm test`); `pnpm build` must stay green.

## Scope

**In: 3,607 stations**, every join verified from a clean `npm install`:

| ids | count | source | package |
|---|---:|---|---|
| `noaa/` tide | 1,245 | `stationsById` | `@neaps/tide-database` |
| `ticon/` tide | 1,520 | `stationsById` | `@neaps/tide-database` |
| `noaa/` current | 842 | `currents.json` → `.stations`, ids need a `noaa/` prefix | `@openwaters/noaa-current-stations@0.5.0` |

**Out: 1,082 CHS stations.** They carry no constituents, their predictions may not be
re-served, and 1,048 have no published identity. Tracked in **issue #17**. Their
slugs already exist, so their URLs 404 until that lands — including
`/currents/dodd-narrows`, which `slackwater-ios#187` opens with. That is a known,
accepted gap for v1.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/catalogue.ts` | **New.** Build-time only. Joins the slug table to the two data packages and produces the station list. Never imported by a route — it would drag megabytes into the client bundle. |
| `src/lib/predict.ts` | **New.** Station-parameterised prediction. Replaces `currents.ts`'s module-level predictor. |
| `src/lib/station.ts` | **New.** The per-station payload type shared by pages, OG rendering and tests. |
| `src/components/TideCurve.tsx` | **New.** Height curve. Tides have no direction, no slack, no signed axis — the current renderer does not transfer. |
| `src/components/CurrentCurve.tsx` | Modified. Takes station data as input; accessibility text derives from the station. |
| `src/routes/tides.$slug.tsx` | **New.** Canonical tide page. |
| `src/routes/currents.$slug.tsx` | **New.** Canonical current page. |
| `src/routes/og.$kind.$slug[.]png.ts` | **New.** Per-request OG card. |
| `src/lib/og-image.ts` | **New.** SVG → PNG via resvg-wasm, with the embedded font. |
| `vite.config.ts` | Modified. Explicit `pages` list — see the landmine in Task 3. |

`catalogue.ts` is deliberately separate from `predict.ts`: one knows about packages and the build, the other knows only about a station's constituents and must stay small enough to run per request.

---

## Task 1: Station-parameterised prediction

**Files:**
- Create: `src/lib/station.ts`, `src/lib/predict.ts`, `src/lib/predict.test.ts`
- Modify: `src/lib/currents.ts`

**Interfaces:**
- Produces:
  - `type Kind = "tide" | "current"`
  - `interface Station { id: string; kind: Kind; slug: string; name: string; latitude: number; longitude: number; timezone: string; region?: string; constituents: Array<{name: string; amplitude: number; phase: number}>; offset?: number; floodDirection?: number; ebbDirection?: number }`
  - `predictSeries(station: Station, start: Date, hours: number, fidelitySeconds?: number): Array<{time: Date; level: number}>`
  - `findEvents(station: Station, start: Date, hours: number): CurrentEvent[]` — unchanged shape, now takes a station

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/predict.test.ts
import { describe, expect, it } from 'vitest'
import { predictSeries, findEvents } from './predict'
import type { Station } from './station'

const CURRENT: Station = {
  id: 'noaa/PUG1701', kind: 'current', slug: 'deception-pass', name: 'Deception Pass (Narrows)',
  latitude: 48.4, longitude: -122.64, timezone: 'America/Los_Angeles',
  offset: 0, floodDirection: 101.5, ebbDirection: 281.5,
  constituents: [{ name: 'M2', amplitude: 3.2, phase: 100 }, { name: 'K1', amplitude: 1.1, phase: 250 }],
}
const TIDE: Station = {
  id: 'noaa/9447130', kind: 'tide', slug: 'seattle', name: 'SEATTLE (Madison St.), Elliott Bay',
  latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles',
  constituents: [{ name: 'M2', amplitude: 1.063, phase: 10.8 }, { name: 'K1', amplitude: 0.8, phase: 300 }],
}

describe('predictSeries', () => {
  it('predicts from the station it is given, not a module-level one', () => {
    const start = new Date('2026-09-01T00:00:00Z')
    const a = predictSeries(CURRENT, start, 12)
    const b = predictSeries(TIDE, start, 12)
    expect(a.length).toBeGreaterThan(0)
    expect(b.length).toBe(a.length)
    // Two different stations must not produce an identical curve. This is the
    // regression guard for the module-level predictor this replaces.
    expect(a.map((s) => s.level)).not.toEqual(b.map((s) => s.level))
  })

  it('is deterministic for one station', () => {
    const start = new Date('2026-09-01T00:00:00Z')
    expect(predictSeries(TIDE, start, 6)).toEqual(predictSeries(TIDE, start, 6))
  })

  it('honours a station offset', () => {
    const start = new Date('2026-09-01T00:00:00Z')
    const shifted = { ...CURRENT, offset: 1.5 }
    const base = predictSeries(CURRENT, start, 3)[0].level
    expect(predictSeries(shifted, start, 3)[0].level).toBeCloseTo(base + 1.5, 6)
  })
})

describe('findEvents', () => {
  it('finds slack and peaks for the station given', () => {
    const events = findEvents(CURRENT, new Date('2026-09-01T00:00:00Z'), 24)
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((e) => ['slack', 'flood', 'ebb'].includes(e.kind))).toBe(true)
    expect(events.filter((e) => e.kind === 'slack').every((e) => e.knots === 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/lib/predict.test.ts`
Expected: FAIL — `Cannot find module './predict'`

- [ ] **Step 3: Write `src/lib/station.ts`**

```ts
/** One station's identity and everything needed to predict it. */
export type Kind = 'tide' | 'current'

export interface Constituent {
  name: string
  amplitude: number
  phase: number
}

export interface Station {
  id: string
  kind: Kind
  slug: string
  name: string
  latitude: number
  longitude: number
  timezone: string
  region?: string
  constituents: Constituent[]
  /** Datum or mean-flow offset applied to every prediction. */
  offset?: number
  /** Currents only: the axis the signed velocity is measured along. */
  floodDirection?: number
  ebbDirection?: number
}
```

- [ ] **Step 4: Write `src/lib/predict.ts`**

```ts
import { createTidePredictor } from '@neaps/tide-predictor'
import type { Station } from './station'

export interface Sample {
  time: Date
  /** Signed knots for a current, height for a tide. */
  level: number
}

export type EventKind = 'slack' | 'flood' | 'ebb'

export interface CurrentEvent {
  kind: EventKind
  time: Date
  level: number
}

/**
 * Predictors are built per station and cached by id.
 *
 * The previous shape bound one predictor to one bundled station at module
 * scope, which is why every export here now takes a station: a page for 3,607
 * stations cannot share one. The cache keeps a hot station cheap without making
 * the module stateful in a way that leaks across stations - the key is the id,
 * so two stations can never collide.
 */
const predictors = new Map<string, ReturnType<typeof createTidePredictor>>()

function predictorFor(station: Station) {
  const cached = predictors.get(station.id)
  if (cached) return cached
  const made = createTidePredictor(station.constituents, { offset: station.offset ?? 0 })
  predictors.set(station.id, made)
  return made
}

/**
 * The curve, for drawing.
 *
 * GOTCHA carried over from the single-station version: `getWaterLevelAtTime`
 * snaps to a ~10-minute grid, so sampling it in a loop returns a staircase and
 * scanning that for turning points invents an extreme at every plateau edge.
 * Use the library's own timeline.
 */
export function predictSeries(
  station: Station,
  start: Date,
  hours: number,
  fidelitySeconds = 600,
): Sample[] {
  const end = new Date(start.getTime() + hours * 3600_000)
  return predictorFor(station)
    .getTimelinePrediction({ start, end, timeFidelity: fidelitySeconds })
    .map((p: { time: number; level: number }) => ({ time: new Date(p.time), level: p.level }))
}

/** Slack, max flood and max ebb, in time order. */
export function findEvents(station: Station, start: Date, hours: number): CurrentEvent[] {
  const end = new Date(start.getTime() + hours * 3600_000)
  const extremes = predictorFor(station).getExtremesPrediction({ start, end })
  return extremes.map((e: { time: string | number; level: number; high: boolean }) => ({
    kind: (Math.abs(e.level) < 1e-9 ? 'slack' : e.high ? 'flood' : 'ebb') as EventKind,
    time: new Date(e.time),
    level: e.level,
  }))
}

/** The next event at or after `now`, or undefined past the window. */
export function nextEvent(events: CurrentEvent[], now: Date): CurrentEvent | undefined {
  return events.find((e) => e.time.getTime() >= now.getTime())
}
```

- [ ] **Step 5: Point `currents.ts` at the new module**

`src/lib/currents.ts` keeps `HERO_STATION` for the homepage, but its prediction
functions are now thin wrappers so there is exactly one implementation:

```ts
import station from '../data/hero-station.json'
import { predictSeries as predict, findEvents as events, nextEvent } from './predict'
import type { Station } from './station'

export type { Sample, CurrentEvent, EventKind } from './predict'
export { nextEvent }

export const HERO_STATION: Station = {
  id: station.id, kind: 'current', slug: 'deception-pass', name: station.name,
  latitude: station.latitude, longitude: station.longitude,
  timezone: 'America/Los_Angeles',
  constituents: station.constituents, offset: station.offset,
  floodDirection: station.floodDirection, ebbDirection: station.ebbDirection,
}

export function predictSeries(start: Date, hours: number, fidelitySeconds = 600) {
  return predict(HERO_STATION, start, hours, fidelitySeconds)
}

export function findEvents(start: Date, hours: number) {
  return events(HERO_STATION, start, hours)
}
```

- [ ] **Step 6: Run the whole suite**

Run: `pnpm test`
Expected: PASS — the existing `currents.test.ts` must still pass unchanged. If it
does not, the wrapper changed behaviour and that is a bug, not a test to update.

- [ ] **Step 7: Commit**

```bash
git add src/lib/station.ts src/lib/predict.ts src/lib/predict.test.ts src/lib/currents.ts
git commit -m "feat: predict from a station passed in, not one bound at module scope"
```

---

## Task 2: The catalogue — join the slug table to the data packages

**Files:**
- Create: `src/lib/catalogue.ts`, `src/lib/catalogue.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `Station`, `Kind` (Task 1)
- Produces:
  - `loadCatalogue(): Station[]` — all 3,607, sorted by id
  - `CHS_PREFIX = 'chs-'`

- [ ] **Step 1: Add the data packages**

```bash
pnpm add @openwaters/station-metadata@^4.0.0 @openwaters/noaa-current-stations@^0.5.0 @neaps/tide-database
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/catalogue.test.ts
import { describe, expect, it } from 'vitest'
import { loadCatalogue } from './catalogue'

describe('loadCatalogue', () => {
  const all = loadCatalogue()

  it('yields every station whose data ships on npm', () => {
    expect(all.length).toBe(3607)
    expect(all.filter((s) => s.kind === 'tide').length).toBe(2765)
    expect(all.filter((s) => s.kind === 'current').length).toBe(842)
  })

  it('excludes CHS, whose predictions may not be re-served', () => {
    expect(all.some((s) => s.id.startsWith('chs-'))).toBe(false)
  })

  it('gives every station what it needs to be predicted and addressed', () => {
    for (const s of all) {
      expect(s.slug, s.id).toMatch(/^[a-z0-9-]+$/)
      expect(s.constituents.length, s.id).toBeGreaterThan(0)
      expect(Number.isFinite(s.latitude), s.id).toBe(true)
      expect(s.name.trim(), s.id).not.toBe('')
    }
  })

  it('keeps slugs unique within a kind and allows reuse across kinds', () => {
    for (const kind of ['tide', 'current'] as const) {
      const slugs = all.filter((s) => s.kind === kind).map((s) => s.slug)
      expect(new Set(slugs).size, kind).toBe(slugs.length)
    }
  })

  it('is deterministic', () => {
    expect(loadCatalogue().map((s) => s.id)).toEqual(all.map((s) => s.id))
  })

  it('resolves the hero station, which the homepage also renders', () => {
    const d = all.find((s) => s.id === 'noaa/PUG1701')
    expect(d?.name).toBe('Deception Pass (Narrows)')
    expect(d?.kind).toBe('current')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run src/lib/catalogue.test.ts`
Expected: FAIL — `Cannot find module './catalogue'`

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/catalogue.ts
//
// BUILD-TIME ONLY. Never import this from a route module: it pulls the whole
// tide database and the current bundle, and TanStack loaders are isomorphic, so
// one careless import ships megabytes to every visitor. Task 4 asserts that.
import slugTable from '@openwaters/station-metadata/data/slugs.json' with { type: 'json' }
import currentBundle from '@openwaters/noaa-current-stations/currents.json' with { type: 'json' }
import { stationsById } from '@neaps/tide-database'
import type { Kind, Station } from './station'

/**
 * CHS stations hold slugs but ship no constituents, and their predictions may
 * not be re-served (see the spec, and issue #17). They are excluded here rather
 * than filtered at every call site.
 */
export const CHS_PREFIX = 'chs-'

/** The current bundle keys stations by bare NOAA id; the slug table prefixes them. */
const NOAA = 'noaa/'

function tideRecord(id: string): Record<string, unknown> | undefined {
  const db = stationsById as unknown
  return db instanceof Map ? db.get(id) : (db as Record<string, never>)[id]
}

export function loadCatalogue(): Station[] {
  const currents = new Map(
    (currentBundle.stations as Array<Record<string, never>>).map((s) => [NOAA + s.id, s]),
  )
  const out: Station[] = []

  for (const kind of ['tide', 'current'] as Kind[]) {
    for (const [id, slug] of Object.entries(slugTable[kind] as Record<string, string>)) {
      if (id.startsWith(CHS_PREFIX)) continue

      if (kind === 'tide') {
        const r = tideRecord(id)
        // A slug with no data is a broken corpus, not a station to skip: it
        // means the slug table and the data package disagree about what exists.
        if (!r) throw new Error(`catalogue: no tide data for ${id}`)
        out.push({
          id, kind, slug,
          name: String(r.name),
          latitude: Number(r.latitude), longitude: Number(r.longitude),
          timezone: String(r.timezone), region: r.region ? String(r.region) : undefined,
          constituents: r.harmonic_constituents as Station['constituents'],
        })
      } else {
        const r = currents.get(id)
        if (!r) throw new Error(`catalogue: no current data for ${id}`)
        out.push({
          id, kind, slug,
          name: String(r.name),
          latitude: Number(r.latitude), longitude: Number(r.longitude),
          timezone: String(r.timezone ?? 'UTC'),
          constituents: r.constituents as Station['constituents'],
          offset: Number(r.offset ?? 0),
          floodDirection: Number(r.floodDirection),
          ebbDirection: Number(r.ebbDirection),
        })
      }
    }
  }

  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/lib/catalogue.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/catalogue.ts src/lib/catalogue.test.ts package.json pnpm-lock.yaml
git commit -m "feat: join the slug table to the published station data"
```

---

## Task 3: Prerender a page per station

**Files:**
- Create: `src/routes/tides.$slug.tsx`, `src/routes/currents.$slug.tsx`
- Modify: `vite.config.ts`
- Create: `src/routes/station-routes.test.ts`

**Interfaces:**
- Consumes: `loadCatalogue()` (Task 2), `predictSeries` / `findEvents` (Task 1)
- Produces: prerendered `/tides/<slug>` and `/currents/<slug>` for all 3,607

**THE LANDMINE.** `vite.config.ts` sets `autoStaticPathsDiscovery: true` and
`crawlLinks: true`. TanStack Start **excludes parameterised routes from automatic
discovery**; it reaches them only by crawling links from an already-rendered page.
This design deliberately has no navigation between stations. Left as is, **the build
succeeds and emits zero station pages** — a silent failure that looks like a working
deploy. The `pages` array below is not optional.

- [ ] **Step 1: Write the failing test**

```ts
// src/routes/station-routes.test.ts
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { loadCatalogue } from '../lib/catalogue'

const OUT = '.output/public'

describe('prerendered station pages', () => {
  it('emits exactly one page per station', () => {
    if (!existsSync(OUT)) return expect.fail('run `pnpm build` before this test')
    const all = loadCatalogue()
    const missing = all.filter(
      (s) => !existsSync(`${OUT}/${s.kind === 'tide' ? 'tides' : 'currents'}/${s.slug}/index.html`),
    )
    expect(missing.slice(0, 5).map((s) => s.id)).toEqual([])
    expect(missing.length).toBe(0)
  })

  it('renders the station name and a real curve, not a placeholder', () => {
    const html = readFileSync(`${OUT}/currents/deception-pass/index.html`, 'utf8')
    expect(html).toContain('Deception Pass (Narrows)')
    expect(html).toMatch(/<path[^>]+d="M[\d.,\-L\s]+"/)
    expect(html).toContain('<link rel="canonical" href="https://slackwater.xyz/currents/deception-pass/"')
  })

  it('does not announce the wrong station to screen readers', () => {
    // The accessibility text was hardcoded to one station; across 3,607 pages
    // that would misname every one of them.
    const html = readFileSync(`${OUT}/tides/seattle/index.html`, 'utf8')
    expect(html).not.toContain('Deception Pass')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/routes/station-routes.test.ts`
Expected: FAIL — no `.output/public/currents/...` exists

- [ ] **Step 3: Give the prerenderer an explicit page list**

In `vite.config.ts`, import the catalogue and build the array:

```ts
import { loadCatalogue } from './src/lib/catalogue'

const stationPages = loadCatalogue().map((s) => ({
  path: `/${s.kind === 'tide' ? 'tides' : 'currents'}/${s.slug}/`,
}))
```

and pass it to the plugin:

```ts
    tanstackStart({
      prerender: {
        enabled: true,
        autoSubfolderIndex: true,
        // Parameterised routes are excluded from discovery and this design has
        // no links between stations, so without `pages` the build emits zero
        // station pages and still reports success.
        autoStaticPathsDiscovery: true,
        crawlLinks: true,
        pages: stationPages,
        concurrency: 14,
      },
    }),
```

- [ ] **Step 4: Write the two routes**

```tsx
// src/routes/currents.$slug.tsx
import { createFileRoute, notFound } from '@tanstack/react-router'
import { CurrentCurve } from '#/components/CurrentCurve'
import { loadCatalogue } from '#/lib/catalogue'
import type { Station } from '#/lib/station'

const CANONICAL = 'https://slackwater.xyz/currents/'

/** Build-time only; the loader runs on the server and serialises one station. */
function findStation(slug: string): Station | undefined {
  return loadCatalogue().find((s) => s.kind === 'current' && s.slug === slug)
}

export const Route = createFileRoute('/currents/$slug')({
  loader: ({ params }) => {
    const station = findStation(params.slug)
    if (!station) throw notFound()
    return { station }
  },
  head: ({ loaderData }) => {
    const s = loaderData?.station
    if (!s) return {}
    const title = `${s.name} — tidal currents`
    const description = `Slack water and maximum flood and ebb for ${s.name}, computed from harmonic constituents.`
    return {
      links: [{ rel: 'canonical', href: `${CANONICAL}${s.slug}/` }],
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: `${CANONICAL}${s.slug}/` },
        { property: 'og:image', content: `https://slackwater.xyz/og/currents/${s.slug}.png` },
      ],
    }
  },
  component: CurrentStation,
})

function CurrentStation() {
  const { station } = Route.useLoaderData()
  const start = new Date()
  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-6 sm:pt-20">
      <h1 className="text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">
        {station.name}
      </h1>
      <p className="mt-3 text-sw-steel">{station.region}</p>
      <CurrentCurve station={station} start={start} hours={24} now={start} />
    </main>
  )
}
```

`src/routes/tides.$slug.tsx` is the same shape with three differences: it filters
`s.kind === 'tide'`, renders `TideCurve` (Task 5), and its copy says heights rather
than currents. Write it out in full rather than importing a shared component — the
two pages diverge as soon as either gets station-kind-specific content, and a shared
one would have to branch on kind in every line.

- [ ] **Step 5: Build and run the tests**

Run: `pnpm build && pnpm vitest run src/routes/station-routes.test.ts`
Expected: PASS. The build takes minutes — that is expected at 3,607 pages.

- [ ] **Step 6: Assert the count from the build itself**

Run: `ls .output/public/tides | wc -l && ls .output/public/currents | wc -l`
Expected: `2765` and `842`

- [ ] **Step 7: Commit**

```bash
git add src/routes/tides.$slug.tsx src/routes/currents.$slug.tsx src/routes/station-routes.test.ts vite.config.ts
git commit -m "feat: prerender a page for every station in the catalogue"
```

---

## Task 4: Keep the catalogue out of the client bundle

**Files:**
- Create: `src/lib/bundle-size.test.ts`

**Interfaces:**
- Consumes: the build output from Task 3

TanStack loaders are isomorphic. An ordinary top-level import of `catalogue.ts` in a
route ships the whole tide database to every visitor. This is not hypothetical: the
site's existing `routes-*.js` already contains the hero station's data, because
`currents.ts` imports `hero-station.json` at module scope. At 2 KB that is invisible;
at catalogue scale it is megabytes.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/bundle-size.test.ts
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'

const ASSETS = '.output/public/assets'

describe('client bundle', () => {
  const js = () => readdirSync(ASSETS).filter((f) => f.endsWith('.js'))

  it('ships no station catalogue', () => {
    if (!existsSync(ASSETS)) return expect.fail('run `pnpm build` first')
    for (const f of js()) {
      const src = readFileSync(`${ASSETS}/${f}`, 'utf8')
      // Two stations that must never both appear in one client chunk: their
      // presence together means the catalogue was bundled rather than the one
      // station a page needs.
      const both = src.includes('Deception Pass (Narrows)') && src.includes('SEATTLE (Madison St.)')
      expect(both, `${f} contains more than one station`).toBe(false)
    }
  })

  it('keeps any single chunk under a megabyte', () => {
    for (const f of js()) {
      expect(statSync(`${ASSETS}/${f}`).size, f).toBeLessThan(1_000_000)
    }
  })
})
```

- [ ] **Step 2: Run it against the build from Task 3**

Run: `pnpm vitest run src/lib/bundle-size.test.ts`
Expected: PASS if the loader serialised one station; FAIL loudly if the catalogue leaked

- [ ] **Step 3: If it fails, move the import behind the server boundary**

The loader must not import `catalogue.ts` at module scope in a file that also ships
to the client. Use TanStack's server-only loader path so the import graph the client
sees never reaches it, and re-run.

- [ ] **Step 4: Commit**

```bash
git add src/lib/bundle-size.test.ts
git commit -m "test: fail if the station catalogue reaches the client bundle"
```

---

## Task 5: The tide renderer

**Files:**
- Create: `src/components/TideCurve.tsx`, `src/components/TideCurve.test.tsx`
- Modify: `src/components/CurrentCurve.tsx`

**Interfaces:**
- Consumes: `Station`, `predictSeries`, `findEvents`
- Produces: `<TideCurve station hours start now width? height? />`, `<CurrentCurve station ... />`

Tides are not currents with different numbers. A current has a signed axis, a
direction, a slack window and a speed ramp; a height has none of those. The existing
renderer's whole visual language — flood blue against ebb amber, green for slack —
encodes *state* that a tide does not have.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/TideCurve.test.tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TideCurve } from './TideCurve'
import type { Station } from '#/lib/station'

const SEATTLE: Station = {
  id: 'noaa/9447130', kind: 'tide', slug: 'seattle', name: 'SEATTLE (Madison St.), Elliott Bay',
  latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles',
  constituents: [{ name: 'M2', amplitude: 1.063, phase: 10.8 }, { name: 'K1', amplitude: 0.8, phase: 300 }],
}

describe('TideCurve', () => {
  const svg = renderToStaticMarkup(
    <TideCurve station={SEATTLE} start={new Date('2026-09-01T00:00:00Z')} hours={24} now={new Date('2026-09-01T06:00:00Z')} />,
  )

  it('draws a real path from the station it was given', () => {
    expect(svg).toMatch(/<path[^>]+d="M[\d.,\-L\s]+"/)
  })

  it('names its own station in the accessibility text', () => {
    expect(svg).toContain('SEATTLE (Madison St.), Elliott Bay')
    expect(svg).not.toContain('Deception Pass')
  })

  it('paints with attributes, not classes, so a rasteriser can render it', () => {
    // resvg cannot resolve Tailwind classes; a class-styled chart rasterises blank.
    expect(svg).toMatch(/(fill|stroke)="#[0-9A-Fa-f]{6}"/)
  })

  it('uses no current-only visual language', () => {
    // Green means slack and slack is a current concept. A tide has no slack.
    expect(svg).not.toContain('#88B868')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/components/TideCurve.test.tsx`
Expected: FAIL — `Cannot find module './TideCurve'`

- [ ] **Step 3: Write `TideCurve`**

Model it on `CurrentCurve`'s structure — same viewBox handling, same `useId` for
gradient ids, same attribute-based paint — but drawing a height curve: one line, the
high and low markers, no datum-crossing axis, no ramp, no slack band. Derive the
`aria-label` from `station.name` and the computed extremes.

- [ ] **Step 4: Parameterise `CurrentCurve`**

Add `station: Station` to its `Props`, take the series and events from
`predictSeries(station, ...)` / `findEvents(station, ...)` rather than the module
functions, and replace the two hardcoded strings at `CurrentCurve.tsx:231` and `:236`:

```ts
// before
if (!n) return 'Tidal current predictions for Deception Pass Narrows.'
return `Tidal current at Deception Pass Narrows. Next ${what} at ${hhmm(n.time)}, computed on this device.`

// after
if (!n) return `Tidal current predictions for ${station.name}.`
return `Tidal current at ${station.name}. Next ${what} at ${hhmm(n.time)}, computed on this device.`
```

Update `src/routes/index.tsx` to pass `HERO_STATION`.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: PASS, including the existing homepage tests

- [ ] **Step 6: Commit**

```bash
git add src/components/TideCurve.tsx src/components/TideCurve.test.tsx src/components/CurrentCurve.tsx src/routes/index.tsx
git commit -m "feat: draw heights, and let the current curve name its own station"
```

---

## Task 6: Instant URLs, server-rendered

**Files:**
- Create: `src/routes/tides.$slug.$instant.tsx`, `src/routes/currents.$slug.$instant.tsx`
- Create: `src/routes/instant.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-3, 5
- Produces: `/currents/<slug>/<iso-instant>` rendering the water at that moment

The instant is an absolute ISO instant written in the station's own UTC offset, so it
survives the receiver being in another timezone. Its URL space is unbounded, so it
cannot be prerendered — it server-renders per request, which the paid plan affords.

- [ ] **Step 1: Write the failing test**

```ts
// src/routes/instant.test.ts
import { describe, expect, it } from 'vitest'
import { parseInstant } from './instant-url'

describe('parseInstant', () => {
  it('accepts an offset-bearing ISO instant', () => {
    expect(parseInstant('2026-08-30T14:30-07:00')?.toISOString()).toBe('2026-08-30T21:30:00.000Z')
  })

  it('round-trips through the same offset', () => {
    const iso = '2026-08-30T14:30-07:00'
    expect(parseInstant(iso)).toEqual(parseInstant(iso))
  })

  it('rejects junk rather than rendering an arbitrary moment', () => {
    for (const bad of ['', 'now', '2026-13-45T99:99Z', '../../etc/passwd']) {
      expect(parseInstant(bad), bad).toBeUndefined()
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/routes/instant.test.ts`
Expected: FAIL — `Cannot find module './instant-url'`

- [ ] **Step 3: Write `src/routes/instant-url.ts`**

```ts
/**
 * Parse the instant segment of a share URL.
 *
 * Returns undefined rather than throwing or defaulting to now: a malformed
 * instant means the link is wrong, and silently rendering the current moment
 * would show the receiver different water from the one that was shared.
 */
export function parseInstant(raw: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(raw)) return undefined
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? undefined : d
}
```

- [ ] **Step 4: Write the two instant routes**

Each mirrors its canonical route with three changes: `now` comes from
`parseInstant(params.instant)`, a malformed instant throws `notFound()`, and the head
adds a canonical pointing at the **bare** station URL:

```ts
links: [{ rel: 'canonical', href: `https://slackwater.xyz/currents/${s.slug}/` }],
```

That canonical is what stops an unbounded URL space becoming a crawl trap. Unfurls are
unaffected — OG tags are read from the fetched URL regardless of canonical.

The `og:image` for an instant route points at the instant card:
`https://slackwater.xyz/og/currents/${s.slug}/${params.instant}.png`.

- [ ] **Step 5: Verify against a real Worker**

Instant routes are Worker-rendered and do not resolve under `pnpm dev`:

```bash
pnpm build && npx wrangler dev -c .output/server/wrangler.json
curl -s localhost:8787/currents/deception-pass/2026-08-30T14:30-07:00 | grep -o 'rel="canonical" href="[^"]*"'
```

Expected: the canonical names `/currents/deception-pass/`, not the instant URL.

- [ ] **Step 6: Commit**

```bash
git add src/routes/instant-url.ts src/routes/instant.test.ts src/routes/*.\$instant.tsx
git commit -m "feat: server-render the shared moment"
```

---

## Task 7: OG cards showing the moment

**Files:**
- Create: `src/lib/og-image.ts`, `src/lib/og-image.test.ts`, `src/routes/og.$kind.$slug[.]png.ts`
- Modify: `wrangler.jsonc`

**Interfaces:**
- Consumes: `Station`, `predictSeries`, the curve components
- Produces: `/og/<kind>/<slug>.png` and `/og/<kind>/<slug>/<instant>.png`, 1200×630

- [ ] **Step 1: Add the rasteriser**

```bash
pnpm add @resvg/resvg-wasm
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/og-image.test.ts
import { describe, expect, it } from 'vitest'
import { renderCard } from './og-image'
import type { Station } from './station'

const S: Station = {
  id: 'noaa/PUG1701', kind: 'current', slug: 'deception-pass', name: 'Deception Pass (Narrows)',
  latitude: 48.4, longitude: -122.64, timezone: 'America/Los_Angeles',
  offset: 0, floodDirection: 101.5, ebbDirection: 281.5,
  constituents: [{ name: 'M2', amplitude: 3.2, phase: 100 }],
}

describe('renderCard', () => {
  it('produces a real PNG of the right size', async () => {
    const png = await renderCard(S, new Date('2026-08-30T21:30:00Z'))
    expect(png.slice(0, 8)).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    // IHDR width and height, big-endian at bytes 16..24
    const view = new DataView(png.buffer, png.byteOffset)
    expect(view.getUint32(16)).toBe(1200)
    expect(view.getUint32(20)).toBe(630)
  })

  it('renders a different image for a different moment', async () => {
    const a = await renderCard(S, new Date('2026-08-30T00:00:00Z'))
    const b = await renderCard(S, new Date('2026-08-30T06:00:00Z'))
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).not.toBe(0)
  })

  it('is deterministic for one moment', async () => {
    const a = await renderCard(S, new Date('2026-08-30T00:00:00Z'))
    const b = await renderCard(S, new Date('2026-08-30T00:00:00Z'))
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run src/lib/og-image.test.ts`
Expected: FAIL — `Cannot find module './og-image'`

- [ ] **Step 4: Write `src/lib/og-image.ts`**

Render the curve component to an SVG string with `renderToStaticMarkup` at
1200×630 — a separate size from the 460×210 page variant, because a chart legible at
one is not legible at the other — then rasterise:

```ts
import { initWasm, Resvg } from '@resvg/resvg-wasm'
```

Two things the SVG must satisfy, both already true of the existing chart and both
easy to break:

- **paint in attributes, not Tailwind classes** — resvg cannot resolve classes and
  renders a class-styled chart blank
- **an explicit font family with the font embedded** — the chart's `text` elements
  inherit system fonts, which a rasteriser cannot resolve

Initialise the WASM module once per isolate, not per request.

- [ ] **Step 5: Write the route**

`/og/<kind>/<slug>.png` and `/og/<kind>/<slug>/<instant>.png`, returning
`image/png` with `cache-control: public, max-age=31536000, immutable` — a given
station at a given instant is deterministic and can never change.

- [ ] **Step 6: Record the plan dependency**

In `wrangler.jsonc`, note that this Worker requires the **paid** plan: SSR on instant
routes, WASM in the bundle, and per-request rasterising each exceed the free tier's
10 ms CPU. On free these fail differently rather than obviously.

- [ ] **Step 7: Verify against a real Worker**

```bash
pnpm build && npx wrangler dev -c .output/server/wrangler.json
curl -s -o /tmp/a.png -w '%{content_type} %{size_download}\n' \
  localhost:8787/og/currents/deception-pass/2026-08-30T14:30-07:00.png
file /tmp/a.png
```

Expected: `image/png`, a non-trivial size, and `file` reporting `1200 x 630`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/og-image.ts src/lib/og-image.test.ts src/routes/og.* wrangler.jsonc package.json pnpm-lock.yaml
git commit -m "feat: render the shared moment as the unfurl card"
```

---

## Task 8: Sitemaps, and the corpus in Search Console

**Files:**
- Modify: `public/sitemap.xml` → generated
- Create: `src/lib/sitemap.ts`, `src/lib/sitemap.test.ts`
- Modify: `public/robots.txt`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/sitemap.test.ts
import { describe, expect, it } from 'vitest'
import { buildSitemaps } from './sitemap'
import { loadCatalogue } from './catalogue'

describe('buildSitemaps', () => {
  const maps = buildSitemaps(loadCatalogue())

  it('splits by kind and indexes them', () => {
    expect(Object.keys(maps).sort()).toEqual(['sitemap-currents.xml', 'sitemap-tides.xml', 'sitemap.xml'])
  })

  it('lists every station exactly once, at its canonical URL', () => {
    const tides = maps['sitemap-tides.xml']
    expect((tides.match(/<loc>/g) ?? []).length).toBe(2765)
    expect(tides).toContain('<loc>https://slackwater.xyz/tides/seattle/</loc>')
  })

  it('lists no instant URLs — they canonicalise to the station', () => {
    for (const xml of Object.values(maps)) expect(xml).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/lib/sitemap.test.ts`
Expected: FAIL — `Cannot find module './sitemap'`

- [ ] **Step 3: Write the generator and wire it into the build**

`buildSitemaps(stations)` returns a map of filename → XML: one per kind plus an index
referencing both, with the three existing static routes in the index's own map. Write
them into `public/` as a build step so they ship as assets.

The hand-written `public/sitemap.xml` is replaced — its own comment predicted this.

- [ ] **Step 4: Point robots.txt at the index**

`public/robots.txt` already carries a `Sitemap:` line; confirm it names
`https://slackwater.xyz/sitemap.xml` and that the index references the two kind maps.

- [ ] **Step 5: Build and check the real files**

Run: `pnpm build && grep -c '<loc>' .output/public/sitemap-tides.xml`
Expected: `2765`

- [ ] **Step 6: Commit**

```bash
git add src/lib/sitemap.ts src/lib/sitemap.test.ts public/robots.txt public/sitemap.xml
git commit -m "feat: generate sitemaps for the station corpus"
```

---

## Task 9: Serve the Apple App Site Association file

**Files:**
- Create: `src/routes/.well-known.apple-app-site-association.ts`
- Create: `src/routes/aasa.test.ts`

**Interfaces:**
- Produces: `GET /.well-known/apple-app-site-association` returning `application/json`

This is what makes `slackwater-ios#187`'s app half a path pattern in a JSON file
rather than a second round of entitlement plumbing. Neither this file nor the
`com.apple.developer.associated-domains` entitlement exists in either repo today,
and the referral programme needs the same host — whichever ships first pays for it.

Two details that are easy to get wrong and fail silently, because iOS fetches this
file itself and reports nothing useful when it is malformed:

- **No file extension.** The path is exactly `/.well-known/apple-app-site-association`
  — not `.json`. A route file named for the extension serves the wrong URL.
- **Content type is `application/json`.** Served as anything else, iOS ignores it.

- [ ] **Step 1: Write the failing test**

```ts
// src/routes/aasa.test.ts
import { describe, expect, it } from 'vitest'
import { aasa } from './.well-known.apple-app-site-association'

describe('apple-app-site-association', () => {
  const doc = aasa()

  it('claims the station paths and the referral route', () => {
    const paths = doc.applinks.details.flatMap((d) => d.paths)
    expect(paths).toContain('/tides/*')
    expect(paths).toContain('/currents/*')
    expect(paths).toContain('/r/*')
  })

  it('does not claim the whole site', () => {
    // A bare "*" would hand every marketing page to the app, so someone who has
    // it installed could never open the site itself.
    const paths = doc.applinks.details.flatMap((d) => d.paths)
    expect(paths).not.toContain('*')
    expect(paths).not.toContain('/*')
  })

  it('is serialisable exactly as iOS expects', () => {
    expect(() => JSON.parse(JSON.stringify(doc))).not.toThrow()
    expect(doc.applinks.details.every((d) => typeof d.appID === 'string' && d.appID.includes('.'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/routes/aasa.test.ts`
Expected: FAIL — `Cannot find module './.well-known.apple-app-site-association'`

- [ ] **Step 3: Write the route**

```ts
import { createFileRoute } from '@tanstack/react-router'

/**
 * The app's Team ID and bundle id, as `<TEAMID>.<BUNDLEID>`.
 *
 * Read it from the iOS project rather than inventing it: a wrong appID fails
 * silently - iOS simply does not open the link, with nothing in any log here.
 */
const APP_ID = 'REPLACE_WITH_TEAMID.io.openwaters.slackwater'

export function aasa() {
  return {
    applinks: {
      details: [
        {
          appID: APP_ID,
          // Scoped deliberately. A bare "*" would claim every marketing page,
          // so anyone with the app installed could never open the site itself.
          paths: ['/tides/*', '/currents/*', '/r/*'],
        },
      ],
    },
  }
}

export const Route = createFileRoute('/.well-known/apple-app-site-association')({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify(aasa()), {
          headers: { 'Content-Type': 'application/json' },
        }),
    },
  },
})
```

**Before committing, replace `REPLACE_WITH_TEAMID`** with the real Team ID from
`slackwater-ios/project.yml` or the App Store Connect app record. Do not guess it.

- [ ] **Step 4: Verify against a real Worker**

This is a Worker route and does not resolve under `pnpm dev`:

```bash
pnpm build && npx wrangler dev -c .output/server/wrangler.json
curl -s -D- -o /tmp/aasa.json localhost:8787/.well-known/apple-app-site-association | grep -i 'content-type'
cat /tmp/aasa.json | python3 -m json.tool > /dev/null && echo "valid JSON"
```

Expected: `content-type: application/json`, and valid JSON. Confirm the URL has **no**
`.json` extension.

- [ ] **Step 5: Commit**

```bash
git add src/routes/.well-known.apple-app-site-association.ts src/routes/aasa.test.ts
git commit -m "feat: serve the app site association file"
```

---

## Task 10: Retire the stale documents

**Files:**
- Modify: `AGENTS.md`, `README.md`, `src/routes/index.tsx`

Three documents become false the moment this ships and should not be left to mislead:

- `AGENTS.md` — "This is a landing page. One page, one job" and "don't build the
  referral route, the web client, or a second page … they're missing on purpose."
  Replace the reasoning rather than deleting it, so the next reader knows it was
  reconsidered rather than forgotten.
- `README.md` — the three-surfaces table. The apex now absorbs what
  `web.slackwater.xyz` was reserved for.
- `src/routes/index.tsx` — the `WEB_CLIENT` constant and its comment naming
  `web.slackwater.xyz` as the decided home. That subdomain is not being built;
  remove the dead constant with its comment.

- [ ] **Step 1: Rewrite the three**

- [ ] **Step 2: Confirm nothing still points at a surface that will not exist**

Run: `grep -rn "web.slackwater.xyz" src/ *.md`
Expected: no hits, or only a line explaining that it is not being built

- [ ] **Step 3: Run the suite and build**

Run: `pnpm test && pnpm build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md src/routes/index.tsx
git commit -m "docs: this is no longer a one-page site"
```

---

## Done when

- `pnpm test` and `pnpm build` are green
- `.output/public/tides` holds 2,765 directories and `.output/public/currents` holds 842
- No client JS chunk contains two stations' data, and none exceeds 1 MB
- `/currents/deception-pass/` renders the station's own name and a real path
- An instant URL server-renders and canonicalises to its bare station URL
- `/og/currents/deception-pass/<instant>.png` returns a 1200×630 PNG that differs from the station's own card
- `sitemap-tides.xml` lists 2,765 URLs and no instant URLs
- `/.well-known/apple-app-site-association` returns `application/json` with no extension
- CHS stations 404 — expected, tracked in issue #17
