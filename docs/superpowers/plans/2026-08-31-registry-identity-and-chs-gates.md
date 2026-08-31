# Registry Identity and CHS Gate Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the catalogue to read `station-metadata`'s registry, then build the 23 Canadian current-gate pages that registry already publishes — taking `/currents/dodd-narrows` off the 404 list.

**Architecture:** `loadCatalogue` gains the registry as a source of curated identity and as a third station source. Curated name and region win over the provider row, joined by slug; two ids sharing a slug collapse to one row. `Station` becomes a discriminated union so a station with no constituents cannot reach prediction code. Gate pages render identity only — no curve, no fetch.

**Tech Stack:** TypeScript, TanStack Start (React), Vitest, Cloudflare Workers via Nitro, `@openwaters/station-metadata` 4.1.2.

**Spec:** `docs/superpowers/specs/2026-08-31-canadian-station-pages-design.md`

**Issues:** #38 (registry read — Tasks 1–3), #17 (CHS pages — Tasks 4–8), #39 (redirects, not in this plan).

## Global Constraints

- **Never proxy IWLS through the Worker, and never prerender a CHS curve.** This plan renders no curve at all; that is Project C. If a task seems to need a DFO fetch, it is the wrong task.
- **Never bundle a provider-minted identifier** (IWLS station id or CHS station code).
- **`chs-arran-rapids` is excluded, explicitly and by name.** It is in the registry, so it becomes buildable by accident unless a rule keeps it out. Deferred owner decision.
- **The catalogue must never reach the client bundle.** `src/lib/bundle-size.test.ts` guards this. `createServerFn` is the code-splitting boundary; `createServerOnlyFn` is not.
- **No literal hex colours in components** — tokens from `src/styles.css` only.
- **Public repo.** No session links in commits or PR bodies.
- **Branch and PR; never push to `main`, never merge your own PR.**
- Verify Worker-owned routes against a real Worker, not `pnpm dev`:
  `pnpm build && npx wrangler dev -c .output/server/wrangler.json`

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/station.ts` | The `Station` type | Modify — becomes a discriminated union |
| `src/lib/registry.ts` | Reads `registry.json`; curated identity by slug; the CHS gate list | **Create** |
| `src/lib/catalogue.ts` | Assembles the corpus from providers + registry | Modify |
| `src/lib/predict.ts` | Harmonic prediction | Modify — narrows to `BundledStation` |
| `src/lib/provenance.ts` | One sentence about where a station's numbers come from | **Create** |
| `src/components/StationPage.tsx` | The shared page body | Modify — identity-only branch |
| `src/components/TideCurve.tsx`, `CurrentCurve.tsx` | The curves | Modify — provenance from a prop |
| `src/routes/{tides,currents}.$slug.tsx` + the two `$instant` routes | Route metadata | Modify — provenance in meta |
| `src/routes/stations.index.tsx` | Browse index landing | Modify — counts and standfirst |
| `src/lib/og-image.ts` | OG card | Modify — identity-only variant |
| `AGENTS.md` | Agent context | Modify — corpus counts |

`registry.ts` and `provenance.ts` are new files rather than additions to `catalogue.ts` because each has one job and `catalogue.ts` is already the densest module in `src/lib`.

---

### Task 1: Curated identity wins over the provider row

Fixes the live defect in #38: `/currents/boundary-pass` is titled "Turn Point, Boundary Pass" while the registry curates it as "Boundary Pass".

**Files:**
- Create: `src/lib/registry.ts`
- Create: `src/lib/registry.test.ts`
- Modify: `src/lib/catalogue.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `curatedBySlug(kind: Kind): Map<string, {name: string; region?: string}>` — keyed by slug, since slug is how a registry entry and a provider row are known to be the same station.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/registry.test.ts
import { describe, expect, it } from 'vitest'
import { curatedBySlug } from './registry'

describe('curatedBySlug', () => {
  it('carries the curated name and region for a registry station', () => {
    const entry = curatedBySlug('current').get('boundary-pass')
    expect(entry?.name).toBe('Boundary Pass')
    expect(entry?.region).toBe('Saturna & Patos Islands')
  })

  it('keys by slug, so a provider row and its registry twin agree', () => {
    // noaa-boundary-pass (registry) and noaa/PUG1717 (provider) are one
    // station 1.5 m apart, merged onto one slug in station-metadata 4.1.2.
    expect(curatedBySlug('current').has('boundary-pass')).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/registry.test.ts`
Expected: FAIL — `Failed to resolve import "./registry"`.

- [ ] **Step 3: Write `src/lib/registry.ts`**

```ts
//
// BUILD-TIME ONLY, like catalogue.ts — it pulls the whole registry.
//
// station-metadata owns curated identity: a hand-written name, a real region,
// and aliases. A provider row for the same water carries the provider's own
// name, which is why /currents/boundary-pass read "Turn Point, Boundary Pass"
// until this existed.
import registry from '@openwaters/station-metadata/data/registry.json' with { type: 'json' }
import slugTable from '@openwaters/station-metadata/data/slugs.json' with { type: 'json' }
import type { Kind } from './station'

interface RegistryEntry {
  name: string
  context?: string
  position: [number, number]
  provider?: string
  kind?: string
  aliases?: string[]
  derived?: unknown
}

const entries = registry as unknown as Record<string, RegistryEntry>

/** A registry entry with no `kind` is a current gate — the registry's own rule. */
const kindOf = (e: RegistryEntry): Kind => (e.kind === 'tide' ? 'tide' : 'current')

export interface Curated {
  name: string
  region?: string
}

/**
 * Curated identity for one kind, keyed by SLUG rather than id.
 *
 * Slug is the join key because that is how station-metadata expresses "these
 * two ids are one station": 4.1.2 merged four duplicate pairs by pointing both
 * ids at one slug. An id join would miss every one of them.
 */
export function curatedBySlug(kind: Kind): Map<string, Curated> {
  const table = slugTable[kind] as Record<string, string>
  const out = new Map<string, Curated>()
  for (const [id, entry] of Object.entries(entries)) {
    if (kindOf(entry) !== kind) continue
    const slug = table[id]
    if (!slug) continue
    out.set(slug, { name: entry.name, ...(entry.context ? { region: entry.context } : {}) })
  }
  return out
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/lib/registry.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Apply it in `loadCatalogue`**

In `src/lib/catalogue.ts`, import it and build the map once per kind, then let the curated name and region win. Inside `loadCatalogue`, before the `for (const kind ...)` body uses a record:

```ts
import { curatedBySlug } from './registry'
```

and inside the kind loop, once per kind:

```ts
const curated = curatedBySlug(kind)
```

then, where each station object is built, replace the `name:` line and add `region`:

```ts
// Curated identity wins. The provider row names the water whatever the
// provider calls it; the registry names it what a mariner calls it.
name: curated.get(slug)?.name ?? cleanName(String(r.name)),
```

The two branches differ in their fallback, because only the tide record has a region.
Tide:

```ts
region: curated.get(slug)?.region ?? (r.region ? String(r.region) : undefined),
```

Current — the NOAA bundle carries no region field at all, so the registry is the only
source and there is nothing to fall back to:

```ts
region: curated.get(slug)?.region,
```

That is how a current station gains a region for the first time. `StationPage` already
handles a station without one: `subtitle` filters empties before joining.

- [ ] **Step 6: Assert the corpus-level effect**

Add to `src/lib/catalogue.test.ts`:

```ts
it('gives a registry station its curated name, not the provider row name', () => {
  const bp = all.find((s) => s.kind === 'current' && s.slug === 'boundary-pass')
  expect(bp?.name).toBe('Boundary Pass')
  expect(bp?.region).toBe('Saturna & Patos Islands')
})
```

- [ ] **Step 7: Run the suite**

Run: `pnpm test`
Expected: PASS. If `catalogue.test.ts`'s count assertions moved, they should NOT have — this task changes names, not membership.

- [ ] **Step 8: Commit**

```bash
git add src/lib/registry.ts src/lib/registry.test.ts src/lib/catalogue.ts src/lib/catalogue.test.ts
git commit -m "fix: curated registry identity wins at the catalogue boundary"
```

---

### Task 2: One row per slug

Also #38. Currently inert — it becomes load-bearing in Task 4, and landing it first means Task 4 cannot introduce a silent duplicate.

**Files:**
- Modify: `src/lib/catalogue.ts`
- Modify: `src/lib/catalogue.test.ts`

**Interfaces:**
- Consumes: `curatedBySlug` from Task 1.
- Produces: `loadCatalogue()` returns at most one `Station` per `(kind, slug)`.

- [ ] **Step 1: Write the failing test**

`catalogue.test.ts` already asserts slug uniqueness within a kind, and it passes today only because one half of each merged pair is unbuildable. Make the intent explicit:

```ts
it('collapses a merged pair to one row, keeping the registry-named id', () => {
  // station-metadata 4.1.2 points both ids of a merged pair at one slug.
  // Building both would put two stations on one URL.
  const rows = all.filter((s) => s.kind === 'current' && s.slug === 'boundary-pass')
  expect(rows.length).toBe(1)
})
```

- [ ] **Step 2: Run it**

Run: `pnpm vitest run src/lib/catalogue.test.ts`
Expected: PASS already — only one half is buildable today. That is the point: this test is the tripwire for Task 4, not a fix for today. Record that it passes.

- [ ] **Step 3: Implement the dedupe**

At the end of `loadCatalogue`, before the `return out.sort(...)`:

```ts
// One row per slug. station-metadata merges duplicate identities by pointing
// both ids at one slug (4.1.2), so a slug can arrive twice. Prefer the id the
// registry names — that is the curated half in every merged pair — and fall
// back to first-seen so this is total rather than conditional.
const bySlug = new Map<string, Station>()
for (const s of out) {
  const key = `${s.kind}/${s.slug}`
  const held = bySlug.get(key)
  if (!held || (!registryNames(held.id) && registryNames(s.id))) bySlug.set(key, s)
}
return [...bySlug.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
```

Add to `src/lib/registry.ts` and export it:

```ts
/** True when station-metadata's registry names this id — the curated half of a merged pair. */
export function registryNames(id: string): boolean {
  return Object.hasOwn(entries, id)
}
```

Import it in `catalogue.ts` alongside `curatedBySlug`.

- [ ] **Step 4: Run the suite**

Run: `pnpm test`
Expected: PASS, counts unchanged at 3,607 / 2,765 / 842.

- [ ] **Step 5: Commit**

```bash
git add src/lib/registry.ts src/lib/catalogue.ts src/lib/catalogue.test.ts
git commit -m "fix: one row per slug, preferring the registry-named id"
```

---

### Task 3: `Station` becomes a discriminated union

Blocks Task 4. An optional `constituents` would type-check every call site and throw at prerender, because `predictorFor` passes `station.constituents` straight into `createTidePredictor` with no guard (`src/lib/predict.ts:37`).

**Files:**
- Modify: `src/lib/station.ts`, `src/lib/predict.ts`, `src/lib/currents.ts`, `src/lib/catalogue.ts`
- Modify: `src/components/TideCurve.tsx`, `src/components/CurrentCurve.tsx`

**Interfaces:**
- Produces: `type Station = BundledStation | ChsStation`, discriminated on `source`. `predictSeries` and `findEvents` take `BundledStation`.

- [ ] **Step 1: Rewrite the type**

`src/lib/station.ts`:

```ts
/** One station's identity, and — for a bundled station — everything needed to predict it. */
export type Kind = 'tide' | 'current'

export interface Constituent {
  name: string
  amplitude: number
  phase: number
}

interface StationIdentity {
  id: string
  kind: Kind
  slug: string
  name: string
  latitude: number
  longitude: number
  timezone: string
  region?: string
}

/** Constituents ship with the page; the curve is synthesised at build time. */
export interface BundledStation extends StationIdentity {
  source: 'bundled'
  constituents: Constituent[]
  /** Datum or mean-flow offset applied to every prediction. */
  offset?: number
  /** Currents only: the axis the signed velocity is measured along. */
  floodDirection?: number
  ebbDirection?: number
}

/**
 * Identity only. CHS publishes no constituents we may re-serve, so this
 * station has no curve until a visitor asks DFO for one themselves.
 */
export interface ChsStation extends StationIdentity {
  source: 'chs'
}

/**
 * A union rather than a type with optional constituents, deliberately.
 * `predictorFor` reads `station.constituents` unguarded, so an optional field
 * would type-check and then throw during prerender across every CHS page.
 * Prediction narrows to `BundledStation`; a stub cannot be passed to it.
 */
export type Station = BundledStation | ChsStation
```

- [ ] **Step 2: Run the type check and watch it fail**

Run: `pnpm test`
Expected: FAIL — type errors at every site that constructs a `Station` or reads `.constituents`. This list is the work.

- [ ] **Step 3: Narrow the prediction API**

In `src/lib/predict.ts`, change the three signatures to take the bundled type:

```ts
import type { BundledStation } from './station'
```

- `function predictorFor(station: BundledStation)`
- `export function predictSeries(station: BundledStation, ...)`
- `export function findEvents(station: BundledStation, ...)`

In `src/lib/currents.ts`, add `source: 'bundled',` to the `HERO_STATION` literal and type it `BundledStation`.

- [ ] **Step 4: Tag the catalogue's output**

In `src/lib/catalogue.ts`, add `source: 'bundled',` to both station literals in `loadCatalogue`.

- [ ] **Step 5: Narrow the curve components**

`TideCurve` and `CurrentCurve` take `station: BundledStation` for now. Task 6 gives them a fetched-samples path; today they only ever receive bundled stations.

- [ ] **Step 6: Run the suite**

Run: `pnpm test`
Expected: PASS. Test fixtures in `predict.test.ts`, `nearby.test.ts`, `og-image.test.ts`, `instant-page.test.tsx`, `TideCurve.test.tsx` and `CurrentCurve.test.tsx` each need `source: 'bundled'` added.

- [ ] **Step 7: Commit**

```bash
git add src/lib src/components
git commit -m "refactor: Station is a union, so a stub cannot reach prediction"
```

---

### Task 4: CHS gates enter the catalogue

**Files:**
- Modify: `src/lib/registry.ts`, `src/lib/catalogue.ts`
- Modify: `src/lib/registry.test.ts`, `src/lib/catalogue.test.ts`

**Interfaces:**
- Consumes: `Station` union (Task 3), dedupe (Task 2).
- Produces: `chsGates(): ChsStation[]` — 23 gates, `chs-arran-rapids` excluded.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/registry.test.ts
import { chsGates } from './registry'

describe('chsGates', () => {
  it('yields every CHS current gate the registry publishes, less the excluded one', () => {
    const gates = chsGates()
    expect(gates.length).toBe(23)
    expect(gates.every((g) => g.source === 'chs')).toBe(true)
  })

  it('excludes chs-arran-rapids by name', () => {
    // slackwater-ios excludes it fully as a hazard call - wrong water under a
    // trusted name - and whether the web may name it is an open owner
    // decision. The registry publishes it, so only an explicit rule keeps it
    // out. Do not remove this without that decision.
    expect(chsGates().some((g) => g.id === 'chs-arran-rapids')).toBe(false)
  })

  it('names Dodd Narrows, the flagship gate', () => {
    const dodd = chsGates().find((g) => g.id === 'chs-dodd-narrows')
    expect(dodd?.name).toBe('Dodd Narrows')
    expect(dodd?.slug).toBe('dodd-narrows')
    expect(dodd?.region).toBe('Nanaimo')
    expect(dodd?.timezone).toBe('America/Vancouver')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/registry.test.ts`
Expected: FAIL — `chsGates is not a function`.

- [ ] **Step 3: Implement `chsGates`**

Add to `src/lib/registry.ts`:

```ts
import tzLookup from 'tz-lookup'
import type { ChsStation } from './station'

/**
 * Deferred by owner decision, and excluded by name because the registry
 * publishes it like any other gate — without this rule it would become a page
 * as a side effect of a data source. slackwater-ios excludes it fully as a
 * hazard call: violent rapids, "wrong water under a trusted name". Whether
 * official DFO predictions change that answer is an open question, not one to
 * settle by deleting this line.
 */
const EXCLUDED = new Set(['chs-arran-rapids'])

/**
 * The Canadian current gates, from identity station-metadata already publishes.
 *
 * No new package and no upstream release: all 24 gates are registry entries
 * with a curated name, region and corrected position. Only the timezone is
 * derived, from the position, the way the tide ports get theirs.
 */
export function chsGates(): ChsStation[] {
  const table = slugTable.current as Record<string, string>
  const out: ChsStation[] = []
  for (const [id, entry] of Object.entries(entries)) {
    if (entry.provider !== 'chs' || kindOf(entry) !== 'current') continue
    if (EXCLUDED.has(id)) continue
    const slug = table[id]
    // A gate with no published slug is a broken corpus, not one to skip: it
    // means the registry and the slug table disagree about what exists.
    if (!slug) throw new Error(`registry: no published slug for gate ${id}`)
    const [latitude, longitude] = entry.position
    out.push({
      id, kind: 'current', slug, source: 'chs',
      name: entry.name,
      ...(entry.context ? { region: entry.context } : {}),
      latitude, longitude,
      timezone: tzLookup(latitude, longitude),
    })
  }
  return out
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/lib/registry.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Add them to the corpus**

In `src/lib/catalogue.ts`, import `chsGates` and push them into `out` before the dedupe added in Task 2:

```ts
out.push(...chsGates())
```

- [ ] **Step 6: Update the corpus assertions**

In `src/lib/catalogue.test.ts`, the counts move by 23 and the exclusion test is now wrong:

```ts
it('yields every station whose data ships on npm, plus the CHS gates', () => {
  expect(all.length).toBe(3630)
  expect(all.filter((s) => s.kind === 'tide').length).toBe(2765)
  expect(all.filter((s) => s.kind === 'current').length).toBe(865)
})

it('still excludes the CHS tide ports, whose identity is not published yet', () => {
  expect(all.some((s) => s.kind === 'tide' && s.id.startsWith('chs-'))).toBe(false)
})

it('builds the flagship gate', () => {
  expect(all.some((s) => s.slug === 'dodd-narrows' && s.kind === 'current')).toBe(true)
})
```

Replace the old `excludes stations no data package can satisfy` test — `all.every((s) => s.id.includes('/'))` is now false by design, and leaving it would fail for the right reason with a misleading message.

The existing `gives every station what it needs to be predicted and addressed` test reads `s.constituents.length`, which no longer type-checks for the union. Narrow it:

```ts
for (const s of all.filter((s) => s.source === 'bundled')) {
  expect(s.constituents.length, s.id).toBeGreaterThan(0)
}
```

- [ ] **Step 7: Run the suite**

Run: `pnpm test`
Expected: PASS. In particular the slug-uniqueness test from Task 2 must still pass — if it fails, the dedupe is not covering the new rows.

- [ ] **Step 8: Commit**

```bash
git add src/lib
git commit -m "feat: build the 23 Canadian current gates from published registry identity"
```

---

### Task 5: Provenance copy stops claiming maths that did not happen

Eight sites say "computed from harmonic constituents". On a gate page all eight are false, and four of them render on the prerendered page before any curve exists.

**Files:**
- Create: `src/lib/provenance.ts`, `src/lib/provenance.test.ts`
- Modify: `src/components/TideCurve.tsx`, `src/components/CurrentCurve.tsx`
- Modify: `src/routes/tides.$slug.tsx`, `src/routes/currents.$slug.tsx`, `src/routes/tides.$slug_.$instant.tsx`, `src/routes/currents.$slug_.$instant.tsx`, `src/routes/stations.index.tsx`

**Interfaces:**
- Produces: `provenance(station: Station): string` — the clause naming where this station's numbers come from, with no trailing full stop.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/provenance.test.ts
import { describe, expect, it } from 'vitest'
import { provenance } from './provenance'
import type { BundledStation, ChsStation } from './station'

const bundled = {
  id: 'noaa/x', kind: 'current', slug: 'x', name: 'X', source: 'bundled',
  latitude: 0, longitude: 0, timezone: 'UTC', constituents: [],
} satisfies BundledStation

const chs = {
  id: 'chs-dodd-narrows', kind: 'current', slug: 'dodd-narrows', name: 'Dodd Narrows',
  source: 'chs', latitude: 49.1, longitude: -123.8, timezone: 'America/Vancouver',
} satisfies ChsStation

describe('provenance', () => {
  it('names harmonic constituents for a bundled station', () => {
    expect(provenance(bundled)).toBe('computed from harmonic constituents')
  })

  it('never claims a computation for a CHS station', () => {
    // The page performs none, and is not permitted to publish one.
    expect(provenance(chs)).not.toMatch(/comput/i)
  })

  it('names the Canadian Hydrographic Service for a CHS station', () => {
    expect(provenance(chs)).toMatch(/Canadian Hydrographic Service/)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/provenance.test.ts`
Expected: FAIL — cannot resolve `./provenance`.

- [ ] **Step 3: Write `src/lib/provenance.ts`**

```ts
import type { Station } from './station'

/**
 * Where this station's numbers come from, as a clause with no full stop.
 *
 * A claim, not wording. `TideCurve` has said since it was written that
 * "computed from harmonic constituents" has to be true on every rendering
 * path, and a Canadian page adds one where it is not: nothing is computed
 * there, and the licensing posture forbids us publishing a prediction at all.
 * Saying so is what keeps the page honest before a visitor asks DFO for a
 * curve themselves.
 */
export function provenance(station: Station): string {
  return station.source === 'bundled'
    ? 'computed from harmonic constituents'
    : 'predicted by the Canadian Hydrographic Service'
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/lib/provenance.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Replace all eight literals**

In `TideCurve.tsx` `describe()` and both branches of `CurrentCurve.tsx` `describe()`, take the clause from `provenance(station)` instead of the literal, keeping the surrounding sentence.

In the four route `head()` functions, replace the literal in `description`. The canonical routes read:

```ts
const description = `Tide heights and the next high and low for ${s.name}, ${provenance(s)}.`
```

and for currents:

```ts
const description = `Slack water and maximum flood and ebb for ${s.name}, ${provenance(s)}.`
```

The two `$instant` routes carry the same sentence — change both.

In `stations.index.tsx`, the standfirst says heights come from harmonic constituents, which stops being true for the whole list. Reword it to describe the list rather than a method:

```
Every station Slackwater predicts, worldwide for tides and across the US and Canada for currents.
```

- [ ] **Step 6: Assert a gate page does not claim a computation**

Add to `src/lib/provenance.test.ts`:

```ts
it('reads as a whole sentence in a page description', () => {
  expect(`Slack water and maximum flood and ebb for Dodd Narrows, ${provenance(chs)}.`)
    .toBe('Slack water and maximum flood and ebb for Dodd Narrows, predicted by the Canadian Hydrographic Service.')
})
```

- [ ] **Step 7: Run the suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/provenance.ts src/lib/provenance.test.ts src/components src/routes
git commit -m "fix: provenance copy follows the station, not a hardcoded claim"
```

---

### Task 6: The gate page renders identity, not a curve

**Files:**
- Modify: `src/components/StationPage.tsx`
- Create: `src/components/StationPage.test.tsx`

**Interfaces:**
- Consumes: `Station` union, `provenance`.
- Produces: a `StationPage` that renders no curve for `source: 'chs'`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/StationPage.test.tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StationPage } from './StationPage'
import type { ChsStation } from '#/lib/station'

const dodd = {
  id: 'chs-dodd-narrows', kind: 'current', slug: 'dodd-narrows', name: 'Dodd Narrows',
  source: 'chs', region: 'Nanaimo',
  latitude: 49.13546639419797, longitude: -123.81735084108287, timezone: 'America/Vancouver',
} satisfies ChsStation

describe('StationPage for a CHS station', () => {
  const html = renderToStaticMarkup(
    <StationPage station={dodd} now={new Date('2026-09-01T12:00:00Z')} />,
  )

  it('names the station', () => {
    expect(html).toContain('Dodd Narrows')
  })

  it('draws no curve', () => {
    expect(html).not.toContain('<svg')
  })

  it('claims no computation', () => {
    expect(html).not.toMatch(/comput/i)
  })

  it('still offers the app, which is why these pages exist', () => {
    expect(html).toMatch(/TestFlight|beta/i)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/components/StationPage.test.tsx`
Expected: FAIL — the component passes a `ChsStation` into a curve typed for `BundledStation`.

- [ ] **Step 3: Branch on `source`**

In `StationPage.tsx`, replace the curve ternary:

```tsx
{station.source === 'chs' ? (
  <ChsIdentity station={station} />
) : station.kind === 'tide' ? (
  <TideCurve station={station} start={start} hours={24} now={now} />
) : (
  <CurrentCurve station={station} start={start} hours={24} now={now} live={live} />
)}
```

and add the panel. It says what the water is and where the numbers would come from, and promises nothing this page does:

```tsx
/**
 * A Canadian station, named but not predicted.
 *
 * CHS predictions are fetched by each user under DFO's own terms and never
 * re-served, so this page may carry identity and no curve. Saying that plainly
 * is better than an empty chart well: the reader learns the station exists,
 * that Slackwater covers it, and where the numbers come from.
 */
function ChsIdentity({ station }: { station: ChsStation }) {
  return (
    <section className="mt-10 rounded-lg border border-sw-steel/20 p-6">
      <p className="text-sw-foam">
        Predictions for {station.name} are {provenance(station)}. Slackwater fetches them
        under DFO&rsquo;s own terms and predicts this water offline in the app.
      </p>
    </section>
  )
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/components/StationPage.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the suite and build**

Run: `pnpm test && pnpm build`
Expected: PASS, and the build emits 3,630 station pages.

- [ ] **Step 6: Look at the page**

Run: `pnpm build && npx wrangler dev -c .output/server/wrangler.json`, open `/currents/dodd-narrows/`, and confirm by eye: the station is named, there is no curve, the Nearby list has six BC gates, and the CTA is present. Screenshot it for the PR — a PR that changes anything visible shows it.

- [ ] **Step 7: Commit**

```bash
git add src/components
git commit -m "feat: a Canadian station page names its water without predicting it"
```

---

### Task 7: The OG card for a station with no curve

**Files:**
- Modify: `src/lib/og-image.ts`
- Modify: `src/lib/og-image.test.ts`

- [ ] **Step 1: Write the failing test**

Add a `DODD` fixture matching the `ChsStation` in Task 6, then assert the way the existing tests already do — PNG magic bytes and dimensions, not a length. A length assertion passes over a blank card.

```ts
it('produces a real PNG for a station with no curve', async () => {
  const png = await renderCard(DODD, new Date('2026-09-01T12:00:00Z'))
  expect(png.slice(0, 8)).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const view = new DataView(png.buffer, png.byteOffset)
  expect(view.getUint32(16)).toBe(1200)
  expect(view.getUint32(20)).toBe(630)
})

it('does not vary with the moment, having no curve to move', async () => {
  const a = await renderCard(DODD, new Date('2026-09-01T00:00:00Z'))
  const b = await renderCard(DODD, new Date('2026-09-01T06:00:00Z'))
  expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0)
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/og-image.test.ts`
Expected: FAIL — `renderCard`'s curve path reads constituents, which a `ChsStation` does not have.

- [ ] **Step 3: Branch the card**

Draw the station name, region and the app wordmark; skip the sparkline entirely for `source: 'chs'`. Keep the existing layout constants — the last OG defect was overlapping text, so change position of nothing that already works.

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/lib/og-image.test.ts`
Expected: PASS.

- [ ] **Step 5: Open the PNG**

Run the Worker and fetch `/og/currents/dodd-narrows.png`, then open the file. A byte-length assertion has passed over a broken card before; look at it.

```bash
curl -s http://localhost:8787/og/currents/dodd-narrows.png -o /tmp/dodd.png && open /tmp/dodd.png
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/og-image.ts src/lib/og-image.test.ts
git commit -m "feat: OG card for a station with no curve"
```

---

### Task 8: Counts, copy, and the cost of 23 more pages

**Files:**
- Modify: `AGENTS.md`, `src/routes/stations.index.tsx`

- [ ] **Step 1: Measure the build before and after**

On `origin/main` and on this branch:

```bash
time pnpm build 2>&1 | tee /tmp/build.log
grep -oE '[0-9]+ms' /tmp/build.log | sort -n | tail -5
```

Record wall-clock and the slowest prerender times in the PR body. Issue #30 exists because a 7x slowdown sat inside a green check; 23 pages should be invisible, and saying so with numbers is the point.

- [ ] **Step 2: Update the corpus counts**

`AGENTS.md` says the corpus is 3,607 of 4,690, that the missing 1,082 are Canadian, and that `/currents/dodd-narrows` genuinely 404s. All three change.

Get the arithmetic right, because the old sentence counted slug-table entries as stations and four of those entries are one station entered twice:

```
slug table          4,690 entries -> 4,686 distinct waters
built by this plan  3,630 pages
still unbuilt       1,056 = 1,055 CHS tide-port slugs (1,058 ids, three of them
                            sharing a slug with a curated twin) + arran-rapids
```

So: 3,630 pages of 4,686 distinct waters; what is missing is the Canadian **tide ports**, whose identity is not published yet, plus `chs-arran-rapids`; and `/currents/dodd-narrows` now resolves.

`stations.index.tsx` hard-codes "2,765 worldwide" and "842 across the US and Canada" in the body and in its meta description. Currents become 865.

- [ ] **Step 3: Run the suite and build**

Run: `pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit and open the PR**

```bash
git add AGENTS.md src/routes/stations.index.tsx
git commit -m "docs: the corpus is 3,630 and Dodd Narrows resolves"
git push -u origin HEAD
```

PR body includes: the Dodd Narrows screenshot, the OG card, and the before/after build numbers. Never merge your own PR.

---

## Verification checklist

Before calling this done, confirm each by running it rather than by reasoning about it:

- [ ] `pnpm test` passes.
- [ ] `pnpm build` emits 3,630 station pages and the sitemaps carry 865 current URLs.
- [ ] `/currents/dodd-narrows/` returns 200 from a real Worker and names Dodd Narrows.
- [ ] `/currents/arran-rapids/` still returns 404.
- [ ] `/currents/boundary-pass/` is titled **Boundary Pass**, not "Turn Point, Boundary Pass".
- [ ] No page in `.output/public/currents/` for a CHS gate contains an `<svg>` curve or the word "computed".
- [ ] The OG PNG for a gate has been opened and looked at.
- [ ] Build wall-clock and slowest prerender recorded before and after.

## What this plan does not do

- **No DFO fetch and no curve for a CHS station.** That is Project C, and it needs the privacy policy updated in the same commit.
- **No CHS tide ports.** Their identity is not published yet; that is Project A2, a `station-metadata` release whose generator probes 1,086 stations at 1.2 s spacing — a ~20-minute operator run that stays out of CI, following the `slugs.json` pattern rather than `check:data`.
- **No redirects.** `/currents/turn-point` still 404s; that is #39, which wants the same registry read this plan adds and should be cheap afterwards.
- **No decision on `chs-arran-rapids`.** Excluded by name, with the reason in the code.
