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
- **Never claim a feature the app doesn't have** (`AGENTS.md`, hard rule). Nine of the
  twenty-three gates are never fitted on device, and nothing published says which nine,
  so no page may claim offline prediction for a CHS station.
- **Nothing in this repo type-checks today.** `pnpm test` is `vitest run`, `pnpm build`
  is Vite, and neither workflow runs `tsc`. Task 3 adds `pnpm typecheck`; until it does,
  a green suite says nothing about types.
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
| `src/lib/copy.ts` | Provenance clause and page description, per station source | **Create** |
| `package.json`, `.github/workflows/*` | `typecheck` script, run on every PR | Modify — nothing type-checks today |
| `src/lib/station.test-d.ts` | Type-level proof that a stub cannot reach prediction | **Create** |
| `src/components/StationPage.test.tsx` | The identity-only page, and the CTA claim | **Create** |
| `src/components/StationPage.tsx` | The shared page body | Modify — identity-only branch, and a CTA that stops claiming offline |
| `src/components/TideCurve.tsx`, `CurrentCurve.tsx` | The curves | Modify — narrow to `BundledStation`, provenance from `copy.ts` |
| `src/routes/{tides,currents}.$slug.tsx` + the two `$instant` routes | Route metadata | Modify — provenance in meta |
| `src/routes/stations.index.tsx` | Browse index landing | Modify — counts and standfirst |
| `src/lib/og-image.ts` | OG card | Modify — identity-only variant |
| `AGENTS.md` | Agent context | Modify — corpus counts |

`registry.ts` and `copy.ts` are new files rather than additions to `catalogue.ts` because each has one job and `catalogue.ts` is already the densest module in `src/lib`.

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

Also #38. Currently inert — it becomes load-bearing in Task 4, and landing it first
means Task 4 cannot introduce a silent duplicate.

There is no failing test to write first here: every merged pair has exactly one
buildable half today, so any assertion would pass before the change. Write the
regression test alongside the dedupe and be honest that it is a tripwire for Task 4
rather than a red-to-green cycle.

**Files:**
- Modify: `src/lib/registry.ts`, `src/lib/catalogue.ts`, `src/lib/catalogue.test.ts`

**Interfaces:**
- Consumes: `curatedBySlug` from Task 1.
- Produces: `REGISTRY_IDS: ReadonlySet<string>`; `loadCatalogue()` returns at most one
  `Station` per `(kind, slug)`.

- [ ] **Step 1: Export the registry's id set**

Add to `src/lib/registry.ts`:

```ts
/** Every id station-metadata's registry names — the curated half of a merged pair. */
export const REGISTRY_IDS: ReadonlySet<string> = new Set(Object.keys(entries))
```

- [ ] **Step 2: Implement the dedupe**

At the end of `loadCatalogue`, replacing the existing `return out.sort(...)`:

```ts
// One row per slug. station-metadata merges duplicate identities by pointing
// both ids at one slug (4.1.2), so a slug can arrive twice. Prefer the id the
// registry names - that is the curated half in every merged pair - and fall
// back to first-seen so this is total rather than conditional.
const bySlug = new Map<string, Station>()
for (const s of out) {
  const key = `${s.kind}/${s.slug}`
  const held = bySlug.get(key)
  if (!held || (!REGISTRY_IDS.has(held.id) && REGISTRY_IDS.has(s.id))) bySlug.set(key, s)
}
return [...bySlug.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
```

Import `REGISTRY_IDS` in `catalogue.ts` alongside `curatedBySlug`.

- [ ] **Step 3: Add the regression test**

In `src/lib/catalogue.test.ts`:

```ts
it('collapses a merged pair to one row', () => {
  // station-metadata 4.1.2 points both ids of a merged pair at one slug. Only
  // one half is buildable today, so this passes before the dedupe exists - it
  // is here as the tripwire for the CHS gates, where both halves build.
  const rows = all.filter((s) => s.kind === 'current' && s.slug === 'boundary-pass')
  expect(rows.length).toBe(1)
})
```

- [ ] **Step 4: Run both checks**

Run: `pnpm typecheck && pnpm test`
Expected: PASS, counts unchanged at 3,607 / 2,765 / 842.

- [ ] **Step 5: Commit**

```bash
git add src/lib
git commit -m "fix: one row per slug, preferring the registry-named id"
```

---

### Task 3: `Station` becomes a discriminated union — and something that checks it

Blocks Task 4. An optional `constituents` would type-check every call site and throw at
prerender, because `predictorFor` passes `station.constituents` straight into
`createTidePredictor` with no guard (`src/lib/predict.ts:37`).

**Nothing in this repo type-checks.** `pnpm test` is bare `vitest run`, which transpiles
TypeScript and never checks it; `pnpm build` is Vite, which strips types the same way;
and neither `deploy.yml` nor `preview.yml` runs `tsc`. So the union's entire safety
argument rests on a compile error that nothing would ever surface. **Step 1 fixes that
first** — without it the rest of this task is theatre, and its "expected: FAIL" steps
would pass.

**Files:**
- Modify: `package.json`, `.github/workflows/deploy.yml`, `.github/workflows/preview.yml`
- Modify: `src/lib/station.ts`, `src/lib/predict.ts`, `src/lib/currents.ts`, `src/lib/catalogue.ts`
- Modify: `src/components/TideCurve.tsx`, `src/components/CurrentCurve.tsx`

**Interfaces:**
- Produces: `type Station = BundledStation | ChsStation`, discriminated on `source`.
  `predictSeries` and `findEvents` take `BundledStation`.

- [ ] **Step 1: Add a type check, and prove it runs**

Add to `package.json` scripts:

```json
"typecheck": "tsc --noEmit"
```

Run it on `main` as it stands:

```bash
pnpm typecheck
```

Expected: PASS with no output. Record that — it is the baseline that makes every later
"expected: FAIL" in this task meaningful.

Add it to both workflows so this cannot rot. In `deploy.yml` and `preview.yml`, after
`pnpm install --frozen-lockfile`:

```yaml
      - run: pnpm run typecheck
```

`preview.yml` currently runs only `pnpm run build` and no tests at all, so a type error
on a PR reaches `main` unchallenged today.

- [ ] **Step 2: Commit the check on its own**

Landing it separately means the diff that adds it is reviewable without the refactor
noise, and `git log` records that the repo was type-clean before the union landed.

```bash
git add package.json .github/workflows
git commit -m "ci: type-check on every PR, which nothing did before"
```

- [ ] **Step 3: Rewrite the type**

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

- [ ] **Step 4: Run the type check and watch it fail**

Run: `pnpm typecheck`
Expected: FAIL, with an error at every site that constructs a `Station` or reads
`.constituents`. That error list is the work for the next step. `pnpm test` will still
pass at this point — which is exactly why Step 1 had to come first.

- [ ] **Step 5: Narrow the prediction API**

In `src/lib/predict.ts`:

```ts
import type { BundledStation } from './station'
```

- `function predictorFor(station: BundledStation)`
- `export function predictSeries(station: BundledStation, ...)`
- `export function findEvents(station: BundledStation, ...)`

In `src/lib/currents.ts`, type `HERO_STATION` as `BundledStation` and add `source: 'bundled',`.

In `src/lib/catalogue.ts`, add `source: 'bundled',` to both station literals.

`TideCurve` and `CurrentCurve` take `station: BundledStation`. They only ever receive
bundled stations; Task 6 keeps CHS away from them entirely.

Add `source: 'bundled'` to the fixtures in `predict.test.ts`, `nearby.test.ts`,
`og-image.test.ts`, `instant-page.test.tsx`, `TideCurve.test.tsx` and
`CurrentCurve.test.tsx`.

- [ ] **Step 6: Prove the union actually rejects a stub**

A type that is never tested is a comment. Add `src/lib/station.test-d.ts`:

```ts
// Type-level assertions. This file is never executed - `tsc --noEmit` is the
// whole test. It exists because the union's only job is to make one specific
// mistake impossible, and nothing else in the suite can observe that.
import { predictSeries } from './predict'
import type { ChsStation } from './station'

const stub: ChsStation = {
  id: 'chs-dodd-narrows', kind: 'current', slug: 'dodd-narrows', name: 'Dodd Narrows',
  source: 'chs', latitude: 49.1, longitude: -123.8, timezone: 'America/Vancouver',
}

// @ts-expect-error - a station with no constituents must not reach prediction.
predictSeries(stub, new Date(), 24)
```

`@ts-expect-error` fails the build if the line ever stops erroring, so this catches
someone widening the signature back to `Station` later.

- [ ] **Step 7: Run both checks**

Run: `pnpm typecheck && pnpm test`
Expected: both PASS.

- [ ] **Step 8: Commit**

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

### Task 5: Page copy stops promising things the page does not contain

Eight sites say "computed from harmonic constituents". On a gate page all eight are
false, and four of them render on the prerendered page before any curve exists.

Swapping the provenance clause alone is not enough. The route description reads
"Slack water and maximum flood and ebb for Dodd Narrows, …" — the page carries **no**
slack water and **no** maxima, so fixing only the trailing clause leaves the sentence
promising results the page does not have. An identity-only page needs its own sentence,
not a substituted phrase.

**Files:**
- Create: `src/lib/copy.ts`, `src/lib/copy.test.ts`
- Modify: `src/components/TideCurve.tsx`, `src/components/CurrentCurve.tsx`
- Modify: `src/routes/tides.$slug.tsx`, `src/routes/currents.$slug.tsx`,
  `src/routes/tides.$slug_.$instant.tsx`, `src/routes/currents.$slug_.$instant.tsx`,
  `src/routes/stations.index.tsx`

**Interfaces:**
- Produces:
  - `provenance(station: Station): string` — a clause, no trailing stop, for the curve's
    accessible description.
  - `pageDescription(station: Station): string` — the whole `<meta name="description">`
    sentence, including the full stop.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/copy.test.ts
import { describe, expect, it } from 'vitest'
import { pageDescription, provenance } from './copy'
import type { BundledStation, ChsStation } from './station'

const bundled = {
  id: 'noaa/x', kind: 'current', slug: 'x', name: 'Deception Pass', source: 'bundled',
  latitude: 0, longitude: 0, timezone: 'UTC', constituents: [],
} satisfies BundledStation

const chs = {
  id: 'chs-dodd-narrows', kind: 'current', slug: 'dodd-narrows', name: 'Dodd Narrows',
  source: 'chs', region: 'Nanaimo',
  latitude: 49.1, longitude: -123.8, timezone: 'America/Vancouver',
} satisfies ChsStation

describe('provenance', () => {
  it('names harmonic constituents for a bundled station', () => {
    expect(provenance(bundled)).toBe('computed from harmonic constituents')
  })

  it('never claims a computation for a CHS station', () => {
    expect(provenance(chs)).not.toMatch(/comput/i)
  })
})

describe('pageDescription', () => {
  it('promises predictions only where the page has them', () => {
    expect(pageDescription(bundled)).toMatch(/Slack water and maximum flood and ebb/)
  })

  it('promises no predictions on an identity-only page', () => {
    const d = pageDescription(chs)
    expect(d).not.toMatch(/Slack water|maximum flood|next high|comput/i)
    expect(d).toContain('Dodd Narrows')
    expect(d).toMatch(/Canadian Hydrographic Service/)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/copy.test.ts`
Expected: FAIL — cannot resolve `./copy`.

- [ ] **Step 3: Write `src/lib/copy.ts`**

```ts
import type { Station } from './station'

/**
 * Where this station's numbers come from, as a clause with no full stop.
 *
 * A claim, not wording. `TideCurve` has said since it was written that
 * "computed from harmonic constituents" has to be true on every rendering
 * path, and a Canadian page adds one where it is not: nothing is computed
 * there, and the licensing posture forbids us publishing a prediction at all.
 */
export function provenance(station: Station): string {
  return station.source === 'bundled'
    ? 'computed from harmonic constituents'
    : 'predicted by the Canadian Hydrographic Service'
}

/**
 * The page's meta description — a whole sentence, because the subject changes
 * and not just the trailing clause.
 *
 * A bundled page carries a curve, so it may promise slack water and maxima. A
 * CHS page carries identity and nothing else, so it must promise identity and
 * nothing else: substituting only the provenance clause would leave it
 * advertising results the page does not contain, in the text a shared unfurl
 * shows.
 */
export function pageDescription(station: Station): string {
  if (station.source === 'chs') {
    const where = station.region ? `${station.name}, ${station.region}` : station.name
    return `Station information for ${where}. Predictions come from the Canadian ` +
      `Hydrographic Service and are available in Slackwater.`
  }
  return station.kind === 'tide'
    ? `Tide heights and the next high and low for ${station.name}, ${provenance(station)}.`
    : `Slack water and maximum flood and ebb for ${station.name}, ${provenance(station)}.`
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm vitest run src/lib/copy.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Replace the eight literals**

In `TideCurve.tsx` `describe()` and **both** branches of `CurrentCurve.tsx` `describe()`
(lines 320 and 327 — there are two, not one), take the clause from `provenance(station)`
instead of the literal, keeping the surrounding sentence.

In all four route `head()` functions, replace the whole hand-built `description` with:

```ts
const description = pageDescription(s)
```

That covers `tides.$slug.tsx`, `currents.$slug.tsx` and both `$instant` routes, which
carry the same sentence.

In `stations.index.tsx`, the standfirst says heights come from harmonic constituents,
which stops being true for the whole list. Reword to describe the list rather than a
method:

```
Every station Slackwater predicts, worldwide for tides and across the US and Canada for currents.
```

- [ ] **Step 6: Run both checks**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/copy.ts src/lib/copy.test.ts src/components src/routes
git commit -m "fix: page copy follows the station instead of a hardcoded claim"
```

---

### Task 6: The gate page renders identity, not a curve — and the CTA stops overclaiming

**The existing CTA is false on nine of these twenty-three pages.** It says Slackwater
"predicts tides and currents offline, on your phone — tides worldwide, currents across
the US and Canada." Nine of the CHS gates are the `fitDays: 0` set: they failed the
on-device fit bar and ship as `online: true`, *"findable, never fitted"*, backed by
official CHS predictions fetched on demand. The app does not predict them offline.
`AGENTS.md` makes this a hard rule: never claim a feature the app doesn't have.

**And the web cannot tell which nine.** Verified against the published registry: the 24
CHS gate entries carry `name`, `context`, `position`, `provider`, `aliases`,
`tideReference`, `cities`, `magnitudeNote`, `source`, `kind` — and **no field
distinguishing an online gate from a fitted one**. The spec deliberately keeps fit
metadata out of any published artifact, so this is by design and not an oversight to
fix here.

That rules out per-gate copy in both directions. "Predicts this water offline" is false
for the nine; "shows official CHS predictions in the app" is false for the other
fourteen, whose curves come from an on-device fit rather than from CHS's published
numbers. **The copy must claim coverage and a source, and no mechanism at all.**

**Files:**
- Modify: `src/components/StationPage.tsx`
- Create: `src/components/StationPage.test.tsx`

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

  it('does not claim the app works offline here', () => {
    // Nine of the 23 gates are never fitted on device, and nothing in the
    // published registry says which nine. Any offline claim is false for some
    // of them, so the page makes none.
    expect(html).not.toMatch(/offline/i)
  })

  it('still offers the app, which is why these pages exist', () => {
    expect(html).toMatch(/TestFlight|beta/i)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/components/StationPage.test.tsx`
Expected: FAIL — the offline assertion fails on the shared CTA, and the component passes
a `ChsStation` into a curve typed for `BundledStation`.

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

and add the panel — coverage and source, no mechanism:

```tsx
/**
 * A Canadian station, named but not predicted.
 *
 * CHS predictions are fetched by each user under DFO's own terms and never
 * re-served, so this page may carry identity and no curve.
 *
 * Deliberately says nothing about HOW the app answers here. Fourteen of these
 * gates are predicted on device from a fitted model; nine are never fitted and
 * are fetched from CHS on demand. Nothing in the published registry says which
 * is which, so any sentence naming a mechanism is false for one group or the
 * other.
 */
function ChsIdentity({ station }: { station: ChsStation }) {
  return (
    <section className="mt-10 rounded-lg border border-sw-steel/20 p-6">
      <p className="text-sw-foam">
        Predictions for {station.name} come from the Canadian Hydrographic Service,
        fetched under DFO&rsquo;s own terms. Slackwater covers this water in the app.
      </p>
    </section>
  )
}
```

- [ ] **Step 4: Fix the CTA in the same task**

`Cta` currently hard-codes the offline claim for every page. Give it the station's
source, and drop the mechanism for a CHS page:

```tsx
function Cta({ station }: { station: Station }) {
  const pitch =
    station.source === 'chs'
      ? 'Slackwater shows tides and tidal currents on your phone — tides worldwide, currents across the US and Canada.'
      : 'Slackwater predicts tides and currents offline, on your phone — tides worldwide, currents across the US and Canada.'
```

and pass it from `StationPage`: `<Cta station={station} />`. The offline claim stays
exactly as it is for the 3,607 bundled pages, where it is true.

- [ ] **Step 5: Run it and watch it pass**

Run: `pnpm typecheck && pnpm vitest run src/components/StationPage.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Assert Nearby actually fills for a gate**

The manual check below is not evidence. Add to `src/lib/catalogue.test.ts`, where the
whole corpus is in scope:

```ts
it('gives a CHS gate neighbours to link to', () => {
  const all = loadCatalogue()
  const dodd = all.find((s) => s.slug === 'dodd-narrows' && s.kind === 'current')!
  const near = nearby(dodd, all, 6)
  expect(near.length).toBe(6)
  expect(near.every((s) => s.kind === 'current')).toBe(true)
  expect(near.some((s) => s.id.startsWith('chs-'))).toBe(true)
})
```

Import `nearby` from `./nearby`.

- [ ] **Step 7: Run everything and look at the page**

Run: `pnpm typecheck && pnpm test && pnpm build`, then
`npx wrangler dev -c .output/server/wrangler.json` and open `/currents/dodd-narrows/`.

Confirm by eye: the station is named, there is no curve, the Nearby list is populated,
the CTA does not say "offline". Screenshot it for the PR — a PR that changes anything
visible shows it.

- [ ] **Step 8: Commit**

```bash
git add src/components src/lib/catalogue.test.ts
git commit -m "feat: name Canadian water without predicting it, or overclaiming offline"
```

---

### Task 7: The OG card for a station with no curve

`renderCard` renders the curve component to SVG, extracts the `<svg>`, and overlays a
header. With no curve there is no base SVG, so this task defines one rather than leaving
the central visual to be invented.

**Layout, explicitly.** Same canvas and the same header geometry as every other card, so
nothing can overlap in a new way:

| Element | Position | Style |
|---|---|---|
| Ground | `<rect>` full bleed | `#00121f` — the colour the header halo already strokes against |
| Title | `x=40 y=52` | 36px, weight 700, `#fcfcfc` — unchanged, via `withHeader` |
| Subtitle | `x=40 y=86` | 22px, weight 500, `#88b868` — the **region**, not a moment |
| Source line | `x=40 y=340` | 28px, weight 500, `#fcfcfc` at 80% |

The subtitle is the region rather than `formatMoment(...)` because a card with no curve
depicts no moment — which is also what makes it byte-identical across times, asserted
below.

**Files:**
- Modify: `src/lib/og-image.ts`, `src/lib/og-image.test.ts`

- [ ] **Step 1: Write the failing test**

Add a `DODD` fixture matching the `ChsStation` in Task 6, then assert the way the
existing tests already do — PNG magic bytes and dimensions, not a length. A length
assertion passes over a blank card.

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
Expected: FAIL — `renderCard` picks a curve component by `station.kind` and passes a
`ChsStation` into one typed for `BundledStation`.

- [ ] **Step 3: Branch before the curve is chosen**

In `renderCard`, take the identity path first so no curve component is selected:

```ts
export async function renderCard(station: Station, now: Date, live = false) {
  const svg =
    station.source === 'chs' ? identityCard(station) : curveCard(station, now, live)
  const resvg = await Resvg.async(svg, { /* unchanged options */ })
  // ...unchanged from here
}
```

Move the existing body — `start`, `Curve`, `renderToStaticMarkup`, the `svgMatch`
guard, `withNamespace`, `subtitle`, `withHeader` — verbatim into `curveCard`. Nothing
about the bundled path changes; the last OG defect was overlapping text, so the working
layout is not touched.

```ts
/**
 * A card for a station whose curve we may not publish.
 *
 * The region rather than a moment as the subtitle: this card depicts no
 * moment, so stamping one on it would claim a reading the image does not
 * contain. It also makes the card identical for every instant URL, which is
 * correct - there is nothing per-instant to draw.
 */
function identityCard(station: ChsStation): string {
  const ground =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" ` +
    `viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#00121f"/>` +
    `<text x="40" y="340" fill="#fcfcfc" fill-opacity="0.8" ` +
    `style="font-family:'${FONT_FAMILY}';font-size:28px;font-weight:500">` +
    `Predictions from the Canadian Hydrographic Service</text>` +
    `</svg>`
  return withHeader(withEmbeddedFont(ground), station.name, station.region ?? '')
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `pnpm typecheck && pnpm vitest run src/lib/og-image.test.ts`
Expected: PASS.

- [ ] **Step 5: Open the PNG**

A byte-length assertion has passed over a broken card here before. Look at it.

```bash
pnpm build && npx wrangler dev -c .output/server/wrangler.json &
curl -s http://localhost:8787/og/currents/dodd-narrows.png -o /tmp/dodd.png && open /tmp/dodd.png
```

Check: the name is legible, the region sits under it without collision, the source line
does not run off the right edge for the longest gate name in the corpus
(`chs-johnstone-strait-central`, "Johnstone Strait - Central"). Attach it to the PR.

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

- [ ] `pnpm typecheck` passes — and existed before this branch only because Task 3 added
      it. Nothing in this repo type-checked before, in CI or locally, so treat a green
      `pnpm test` as saying nothing about the union.
- [ ] `pnpm test` passes.
- [ ] `pnpm build` emits 3,630 station pages and the sitemaps carry 865 current URLs.
- [ ] `/currents/dodd-narrows/` returns 200 from a real Worker and names Dodd Narrows.
- [ ] `/currents/arran-rapids/` still returns 404.
- [ ] `/currents/boundary-pass/` is titled **Boundary Pass**, not "Turn Point, Boundary Pass".
- [ ] No page in `.output/public/currents/` for a CHS gate contains an `<svg>` curve, the
      word "computed", or the word "offline". Grep the built HTML — this is the claim
      that is false for nine of the twenty-three and cannot be checked per gate:

      ```bash
      grep -rliE 'offline|comput' .output/public/currents/dodd-narrows/ && echo FAIL || echo ok
      ```
- [ ] A CHS page's `<meta name="description">` promises identity, not slack water or maxima.
- [ ] The OG PNG for a gate has been opened and looked at.
- [ ] Build wall-clock and slowest prerender recorded before and after.

## What this plan does not do

- **No DFO fetch and no curve for a CHS station.** That is Project C, and it needs the privacy policy updated in the same commit.
- **No CHS tide ports.** Their identity is not published yet; that is Project A2, a `station-metadata` release whose generator probes 1,086 stations at 1.2 s spacing — a ~20-minute operator run that stays out of CI, following the `slugs.json` pattern rather than `check:data`.
- **No redirects.** `/currents/turn-point` still 404s; that is #39, which wants the same registry read this plan adds and should be cheap afterwards.
- **No decision on `chs-arran-rapids`.** Excluded by name, with the reason in the code.
