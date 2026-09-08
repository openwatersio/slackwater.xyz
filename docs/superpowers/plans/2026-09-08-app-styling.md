# App type and chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the app's graph inks, rounded reading type and card treatment across to the site, and rebuild the hero's readout as the app's own lead card.

**Architecture:** Seven tasks, each ending on a green test and a commit, the last verifying the whole. Tokens land first because everything else reads them; the two formatters follow; then the readout component, the strip's fill, the card treatment, and a full verification pass. The two shared curve components are deliberately untouched — they feed 3,640 station pages and every OG card, and belong to a follow-up.

**Tech Stack:** TanStack Start + React 19, Tailwind v4 (`@theme` tokens in `src/styles.css`), vitest in a node environment with `renderToStaticMarkup` for components.

**Spec:** `docs/superpowers/specs/2026-09-08-app-styling-design.md`

## Global Constraints

- **`slackwater-ios` is the source of truth for every value here.** Where this plan and that repo disagree, that repo wins. Do not invent a colour, a size or a weight.
- This is a **public repo**. Code, comments and commit messages are published.
- **Reach for less.** Add nothing a task does not name.
- **Colour is state, form is kind.** Green (`--color-sw-go`) means slack water and only slack water.
- **`--color-sw-paper` is the wordmark's token and only the wordmark's.** The lead card's value is `Color.white` in the app; use Tailwind's own `text-white`.
- **The wordmark never breaks:** one word, capital S, lowercase w, `whitespace-nowrap`.
- **Never claim a feature the app does not have.**
- **The readout is a claim about the present** and stays gated on `live` from `src/lib/use-live-now.ts`. Nothing in it may reach prerendered HTML.
- **Do not touch `src/components/TideCurve.tsx`, `src/components/CurrentCurve.tsx` or `src/lib/og-image.ts`.** They are the follow-up. `og-image.ts` rasterises through resvg, which cannot resolve a CSS variable.
- **No webfont.** `styles.css` bans loading one; `ui-rounded` is native and costs nothing.
- Comments state WHY in one line, never what/how, and never reference history or the change being made.
- Commit subjects are imperative and plain-language; the body explains why.
- Never push. Never merge. Commit only.
- Verify with `pnpm build`, then `pnpm typecheck` (it needs the generated `src/routeTree.gen.ts`), then `pnpm test`.

---

### Task 1: The app's tokens

**Files:**
- Modify: `src/styles.css`
- Test: `src/styles.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind utilities `bg-sw-graph-line` / `text-sw-graph-line` and siblings for `-high` and `-low`; `bg-sw-card-fill`, `border-sw-card-stroke`, `text-sw-shadow`; and the `font-rounded` family utility. Also the raw CSS variables, e.g. `var(--color-sw-graph-line)`, for SVG paint.

- [ ] **Step 1: Write the failing test**

Create `src/styles.test.ts`. These are the app's own values; the test is what stops them drifting, the way `ramp.test.ts` does for the speed ramp.

```ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('the app’s tokens', () => {
  it('carries the graph inks CurveDrawing fills and lines with', () => {
    expect(css).toContain('--color-sw-graph-line: #38bdf8')
    expect(css).toContain('--color-sw-graph-high: #2dd4bf')
    expect(css).toContain('--color-sw-graph-low: #fbbf24')
  })

  it('carries the card surface', () => {
    expect(css).toContain('--color-sw-card-fill: #ffffff0d')
    expect(css).toContain('--color-sw-card-stroke: #88b8682a')
    expect(css).toContain('--color-sw-shadow: #001432')
    expect(css).toMatch(/--shadow-card:\s*0 10px 24px/)
  })

  it('sets readings in the app’s rounded face without loading a webfont', () => {
    expect(css).toMatch(/--font-rounded:\s*ui-rounded/)
    expect(css).not.toMatch(/@font-face|fonts\.googleapis|fonts\.gstatic/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/styles.test.ts`
Expected: FAIL on the first assertion — the token does not exist.

- [ ] **Step 3: Add the tokens**

In `src/styles.css`, inside the existing `@theme { ... }` block, after the `--color-sw-sunset` line, add:

```css
  /* the app's graph inks — the curve fills and lines in CurveDrawing.swift.
     Named after the Tailwind entries SN took them from. */
  --color-sw-graph-line: #38bdf8;   /* sky-400: every curve fill */
  --color-sw-graph-high: #2dd4bf;   /* teal-400: rising, and a high */
  --color-sw-graph-low: #fbbf24;    /* amber-400: falling, a low, water below datum */

  /* card chrome — SN.cardFill, SN.cardStroke, SN.shadow */
  --color-sw-card-fill: #ffffff0d;    /* white at 5% */
  --color-sw-card-stroke: #88b8682a;  /* leaf at 16% */
  --color-sw-shadow: #001432;
```

Then, immediately after the existing `--font-mono` line, add the rounded face:

```css
  /* Readings are SF Rounded in the app (ReadoutType). Native on Apple devices,
     so it costs no download on a page that sells "no waiting". */
  --font-rounded: ui-rounded, "SF Pro Rounded", system-ui, sans-serif;
```

Then, as the last entry in the `@theme` block, the card's shadow as a token so no component carries the literal:

```css
  /* SN.shadow at 24%, 12pt radius, 10pt down. A SwiftUI radius is about half a CSS blur. */
  --shadow-card: 0 10px 24px color-mix(in srgb, var(--color-sw-shadow) 24%, transparent);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/styles.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/styles.test.ts
git commit -m "Add the app's graph inks, card surface and rounded face

The colour tokens already matched Palette.swift hex for hex, but the inks the
app actually fills its curves with were never among them, and neither was the
rounded face every reading is set in.

ui-rounded resolves natively on Apple devices, so the rounded face costs no
download on a page whose pitch is that it loads instantly."
```

---

### Task 2: The app's two formatters

**Files:**
- Modify: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `chartTime(d: Date, timeZone: string): string` returning e.g. `"7:42am"`, and `compass16(deg: number): string` returning one of the sixteen point names.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/format.test.ts`:

```ts
describe('chartTime', () => {
  it('reads the way the app reads, twelve-hour and lowercase', () => {
    // 14:42Z is 07:42 in Pacific daylight time.
    expect(chartTime(new Date('2026-09-08T14:42:00Z'), 'America/Los_Angeles')).toBe('7:42am')
  })

  it('names both twelves without a leading zero', () => {
    expect(chartTime(new Date('2026-09-08T07:15:00Z'), 'America/Los_Angeles')).toBe('12:15am')
    expect(chartTime(new Date('2026-09-08T19:15:00Z'), 'America/Los_Angeles')).toBe('12:15pm')
  })

  it('leaves no space before the meridiem, whichever space the platform used', () => {
    // Newer ICU emits U+202F rather than a plain space before AM/PM.
    expect(chartTime(new Date('2026-09-08T14:42:00Z'), 'America/Los_Angeles')).not.toMatch(/\s/)
  })
})

describe('compass16', () => {
  it('names the sixteen points', () => {
    expect(compass16(0)).toBe('N')
    expect(compass16(22.5)).toBe('NNE')
    expect(compass16(90)).toBe('E')
    expect(compass16(180)).toBe('S')
    expect(compass16(270)).toBe('W')
    expect(compass16(292.5)).toBe('WNW')
  })

  it('wraps past north rather than running off the end', () => {
    expect(compass16(350)).toBe('N')
    expect(compass16(360)).toBe('N')
    expect(compass16(720)).toBe('N')
  })

  it('takes a negative bearing', () => {
    expect(compass16(-90)).toBe('W')
  })
})
```

Add `chartTime` and `compass16` to the existing import from `./format` at the top of that file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/format.test.ts`
Expected: FAIL — `chartTime is not a function`.

- [ ] **Step 3: Add both to `src/lib/format.ts`**

Append:

```ts
/**
 * "7:42am" — the app's `chartTime`, which pins `en_US_POSIX` so it is always
 * twelve-hour. Deliberately not `hhmm`: this is the reading the app's lead card
 * shows, and it reads the way the app reads it.
 */
export function chartTime(d: Date, timeZone: string): string {
  return d
    .toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true })
    // Newer ICU separates the meridiem with U+202F, which `\s` matches and a literal space does not.
    .replace(/\s/g, '')
    .toLowerCase()
}

const POINTS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const

/** The sixteen-point name for a bearing — `compass16` in the app. */
export function compass16(deg: number): string {
  const d = ((deg % 360) + 360) % 360
  return POINTS_16[Math.round(d / 22.5) % 16]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "Add the app's chart time and compass point

chartTime is deliberately not hhmm. The app pins en_US_POSIX and reads
twelve-hour, and this is the reading its lead card shows, so the readout reads
the way the app does even though the station pages stay on the site's
twenty-four-hour clock."
```

---

### Task 3: The lead card

**Files:**
- Create: `src/components/CurrentLead.tsx`
- Test: `src/components/CurrentLead.test.tsx`

**Interfaces:**
- Consumes: `chartTime`, `compass16` from `src/lib/format.ts`.
- Produces: `<CurrentLead level={number} setDegrees={number} slack={boolean} at={Date} timeZone={string} />`. `level` is signed knots — positive floods.

This is the app's `CurrentLead`: the state word and the set on one line, the value large beneath, the time beneath that. It knows nothing about the landing page and later gets reused by the station pages.

- [ ] **Step 1: Write the failing test**

Create `src/components/CurrentLead.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { CurrentLead } from './CurrentLead'

const AT = new Date('2026-09-08T14:42:00Z')
const TZ = 'America/Los_Angeles'
const render = (level: number, slack = false) =>
  renderToStaticMarkup(
    <CurrentLead level={level} setDegrees={290} slack={slack} at={AT} timeZone={TZ} />,
  )

describe('CurrentLead', () => {
  it('leads with the state and the set, the way the app does', () => {
    const html = render(-3.1)
    expect(html).toContain('Ebbing')
    expect(html).toContain('WNW')
    expect(html).toContain('rotate(290deg)')
  })

  it('shows the speed unsigned, to one decimal, with its unit beside it', () => {
    const html = render(-3.14)
    expect(html).toContain('3.1')
    expect(html).not.toContain('-3.1')
    expect(html).toContain('kn')
  })

  it('sets the reading in the rounded face with tabular digits', () => {
    const html = render(3.1)
    expect(html).toContain('font-rounded')
    expect(html).toContain('tabular-nums')
  })

  it('reads the time the way the app reads it', () => {
    expect(render(3.1)).toContain('7:42am')
  })

  it('tints by phase, and green is slack alone', () => {
    expect(render(3.1)).toContain('text-sw-flood')
    expect(render(-3.1)).toContain('text-sw-ebb')
    expect(render(3.1)).not.toContain('text-sw-go')
    expect(render(0.2, true)).toContain('text-sw-go')
  })

  it('points both ways at slack, because the water does', () => {
    const html = render(0.2, true)
    expect(html).toContain('Slack')
    expect(html).not.toContain('WNW')
  })

  it('imports nothing the landing page owns', () => {
    const source = readFileSync(new URL('./CurrentLead.tsx', import.meta.url), 'utf8')
    for (const forbidden of ['HERO_STATION', 'TESTFLIGHT', 'use-scrub-intro', 'ScrubHero']) {
      expect(source).not.toContain(forbidden)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/CurrentLead.test.tsx`
Expected: FAIL — `Failed to resolve import "./CurrentLead"`.

- [ ] **Step 3: Write the component**

Create `src/components/CurrentLead.tsx`:

```tsx
import { chartTime, compass16 } from '#/lib/format'

/**
 * The reading under the centerline, as the app's `CurrentLead` composes it: the
 * state and the set lead, the value is the only large thing, and the time sits
 * alone beneath it.
 *
 * White rather than `sw-paper`, which is the wordmark's alone — the app's lead
 * takes `Color.white`.
 */
export function CurrentLead({
  level, setDegrees, slack, at, timeZone,
}: {
  /** Signed knots; positive floods. */
  level: number
  setDegrees: number
  slack: boolean
  at: Date
  timeZone: string
}) {
  const state = slack ? 'Slack' : level > 0 ? 'Flooding' : 'Ebbing'
  const phase = slack ? 'text-sw-go' : level > 0 ? 'text-sw-flood' : 'text-sw-ebb'

  return (
    <div className="flex flex-col items-center gap-1 text-white">
      <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-white/85">
        {state}
        <span className={`flex items-center gap-1 ${phase}`}>
          {slack ? <SlackGlyph /> : <><SetArrow deg={setDegrees} />{compass16(setDegrees)}</>}
        </span>
      </p>
      <p className="font-rounded text-[2.75rem] font-medium leading-none tabular-nums">
        {Math.abs(level).toFixed(1)}
        <span className="ml-1 text-[1.375rem] font-light">kn</span>
      </p>
      <p className="text-xs tabular-nums">{chartTime(at, timeZone)}</p>
    </div>
  )
}

/** North is up, so the bearing is the rotation. */
function SetArrow({ deg }: { deg: number }) {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true"
      style={{ transform: `rotate(${deg}deg)` }}>
      <path d="M6 1 L10 11 L6 8.5 L2 11 Z" fill="currentColor" />
    </svg>
  )
}

/** At slack the water goes both ways, so the glyph does too. */
function SlackGlyph() {
  return (
    <svg viewBox="0 0 16 12" className="h-3 w-4" aria-hidden="true">
      <path d="M1 6 L4 3 L4 5 L12 5 L12 3 L15 6 L12 9 L12 7 L4 7 L4 9 Z" fill="currentColor" />
    </svg>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/components/CurrentLead.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/CurrentLead.tsx src/components/CurrentLead.test.tsx
git commit -m "Add the app's lead card

The set is the hero of this card in the app, and the readout it replaces had no
direction in it at all — not a styling gap but a missing reading.

At slack the glyph points both ways, because the water does and a set means
nothing there."
```

---

### Task 4: The strip's fill is anchored at zero

**Files:**
- Modify: `src/components/CurrentScrubStrip.tsx`
- Test: `src/components/CurrentScrubStrip.test.tsx`

**Interfaces:**
- Consumes: `--color-sw-graph-line` from Task 1.
- Produces: no interface change.

The app fills a current curve with `graphLine` alone — clear at slack, intensifying outward, symmetric about zero — because the set carries direction and the fill only says how far from slack the water is. One gradient spanning the whole plot replaces the two half-plot gradients, which also removes both clip paths and the nesting they needed.

- [ ] **Step 1: Write the failing test**

In `src/components/CurrentScrubStrip.test.tsx`, replace the test named `clips the fill in screen space, not in the panning curve’s space` and the one named `paints with attributes, not classes, so a rasteriser can render it` with these:

```tsx
  it('fills from the app’s graph ink, clear at slack and intensifying outward', () => {
    const html = render(FROM)
    expect(html).toContain('var(--color-sw-graph-line)')
    // Three stops: strong, clear at the midline, strong again.
    expect(html).toMatch(/stop-opacity="0\.5"[\s\S]*stop-opacity="0"[\s\S]*stop-opacity="0\.5"/)
  })

  it('needs no clip, because one gradient spans the whole plot', () => {
    expect(render(FROM)).not.toContain('clip-path')
  })

  it('no longer paints the fill with the speed ramp', () => {
    // The ramp moved to the stroke in the app; a fill in ramp yellow is the old arrangement.
    expect(render(FROM)).not.toContain('#f5c96b')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/CurrentScrubStrip.test.tsx`
Expected: FAIL — the graph ink is absent and `clip-path` is present.

- [ ] **Step 3: Rework the fill**

In `src/components/CurrentScrubStrip.tsx`:

Remove the `import { speedColor } from '#/lib/ramp'` line, and add this constant beside `CURVE_INK`:

```tsx
/** `CurveStyle.fillOpacity`. */
const FILL_OPACITY = 0.5
```

Replace the two `linearGradient` elements and the two `clipPath` elements inside `<defs>` with one gradient:

```tsx
            {/* The fill says only how far from slack the water is: the set carries
                direction. Clear at zero, intensifying to either extreme. */}
            <linearGradient id={`fill-${uid}`} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={0} y2={plot}>
              <stop offset="0" stopColor="var(--color-sw-graph-line)" stopOpacity={FILL_OPACITY} />
              <stop offset="0.5" stopColor="var(--color-sw-graph-line)" stopOpacity="0" />
              <stop offset="1" stopColor="var(--color-sw-graph-line)" stopOpacity={FILL_OPACITY} />
            </linearGradient>
```

Replace the two clip-wrapped groups and the stroke group with:

```tsx
          <g transform={pan}>
            <path d={area} fill={`url(#fill-${uid})`} />
            <path d={path} fill="none" stroke={CURVE_INK} strokeWidth="2" />
          </g>
```

The `<line>` centerline stays exactly where it is, after that group.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/components/CurrentScrubStrip.test.tsx`
Expected: PASS. If `stop-opacity="0.5"` does not appear, check that `FILL_OPACITY` is interpolated as a number and not a string.

- [ ] **Step 5: Commit**

```bash
git add src/components/CurrentScrubStrip.tsx src/components/CurrentScrubStrip.test.tsx
git commit -m "Anchor the strip's fill at zero, in the app's graph ink

The app fills a current curve with graphLine alone, clear at slack and
intensifying outward, because the set arrows carry direction and the fill only
says how far from slack the water is. Filling with the speed ramp is the older
arrangement; in the app that ramp now colours the stroke.

One gradient across the whole plot replaces two half-plot ones, which takes
both clip paths and the nesting they needed with it."
```

---

### Task 5: The strip shows the lead card, and the caption gives up its clock

**Files:**
- Modify: `src/components/CurrentScrubStrip.tsx`
- Modify: `src/components/ScrubHero.tsx`
- Modify: `src/lib/format.ts`
- Test: `src/components/CurrentScrubStrip.test.tsx`
- Test: `src/components/ScrubHero.test.tsx`
- Test: `src/lib/format.test.ts`

**Interfaces:**
- Consumes: `<CurrentLead>` from Task 3.
- Produces: no interface change to either component's props.

- [ ] **Step 1: Write the failing tests**

In `src/components/CurrentScrubStrip.test.tsx`, add:

```tsx
  it('shows the set, which the reading is incomplete without', () => {
    const live = renderToStaticMarkup(
      <CurrentScrubStrip
        station={HERO_STATION} days={days} from={FROM} to={TO}
        scrubTime={FROM} seconds={0} live
      />,
    )
    expect(live).toContain('rotate(')
    expect(live).toMatch(/N|NNE|NE|ENE|E|ESE|SE|SSE|S|SSW|SW|WSW|W|WNW|NW|NNW/)
  })

  it('still says nothing about the present when it has no live clock', () => {
    expect(render(FROM)).not.toMatch(/\d{1,2}:\d{2}/)
    expect(render(FROM)).not.toMatch(/Ebbing|Flooding|Slack/i)
  })
```

In `src/components/ScrubHero.test.tsx`, add:

```tsx
  it('leaves the clock to the readout, where the app puts it', () => {
    // The caption keeps the station and the claim; the time belongs to the lead card.
    expect(html).toContain('computed in this browser')
    expect(html).not.toMatch(/\d{1,2}:\d{2}/)
  })
```

In `src/lib/format.test.ts`, delete the whole `describe('countdown', ...)` block.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/components/CurrentScrubStrip.test.tsx`
Expected: FAIL on the set assertion — no rotation is rendered.

- [ ] **Step 3: Render the lead card in the strip**

In `src/components/CurrentScrubStrip.tsx`:

Replace the `countdown` import with the component, and drop the event helpers it no longer uses:

```tsx
import { predictSeries, slackWindows } from '#/lib/predict'
import { CurrentLead } from './CurrentLead'
```

Delete `events` from the `useMemo`'s returned object and from its destructuring, and delete the `nextSlack` binding. **Keep `state`** — the SVG's `aria-label` still reads it, and that label is the curve's only accessible description.

Replace the whole readout `<div>` with:

```tsx
        <div className="absolute inset-x-0 flex justify-center" style={{ bottom: plot + 12 }}>
          <CurrentLead
            level={level}
            setDegrees={level > 0 ? (station.floodDirection ?? 0) : (station.ebbDirection ?? 0)}
            slack={slack}
            at={scrubTime}
            timeZone={station.timezone}
          />
        </div>
```

- [ ] **Step 4: Take the clock out of the caption**

In `src/components/ScrubHero.tsx`, remove the `hhmm` import and the gated time fragment from the caption, leaving the station link and the claim:

```tsx
      <p className="absolute inset-x-0 bottom-0 px-5 pb-5 text-center font-mono text-[0.65rem] uppercase tracking-[0.14em] text-sw-foam/70">
        <a href={`/currents/${HERO_STATION.slug}/`} className="underline underline-offset-4">
          {HERO_STATION.name}
        </a>
        {' '}· computed in this browser
      </p>
```

- [ ] **Step 5: Delete `countdown`, which now has no caller**

Remove the `countdown` function from `src/lib/format.ts`. It was added for the readout this task replaces; the follow-up can add it back in three lines if a station page wants it.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
pnpm vitest run src/components/CurrentScrubStrip.test.tsx src/components/ScrubHero.test.tsx src/lib/format.test.ts
pnpm typecheck
```

Expected: all pass, and typecheck clean. A `noUnusedLocals` error here means a binding the readout used is still declared — delete it rather than referencing it.

- [ ] **Step 7: Commit**

```bash
git add src/components/CurrentScrubStrip.tsx src/components/ScrubHero.tsx src/lib/format.ts src/components/CurrentScrubStrip.test.tsx src/components/ScrubHero.test.tsx src/lib/format.test.ts
git commit -m "Show the set, and give the clock to the readout

The hero reported a speed and a state with no direction at all. The app's lead
card leads with the set for that reason, and the time sits with the reading it
belongs to rather than in the caption underneath the whole page.

countdown goes with the line that used it."
```

---

### Task 6: The card treatment

**Files:**
- Modify: `src/components/ScrubHero.tsx`
- Modify: `src/routes/index.tsx:119` and `src/routes/index.tsx:226`
- Test: `src/components/ScrubHero.test.tsx`
- Test: `src/routes/index-chrome.test.ts`

**Interfaces:**
- Consumes: `--color-sw-card-fill`, `--color-sw-card-stroke`, `--color-sw-shadow` from Task 1.
- Produces: no interface change.

Three surfaces take the app's card, and no others: the hero's pill, the validation stat grid, and "The deal". The footer's top rule is a rule, not a card.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/ScrubHero.test.tsx`:

```tsx
  it('gives the pill the app’s card corner and hairline', () => {
    expect(html).toContain('rounded-3xl')
    expect(html).toContain('border-sw-card-stroke')
  })
```

Create `src/routes/index-chrome.test.ts`:

```tsx
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')

describe('the landing page’s surfaces', () => {
  it('gives its two cards the app’s corner and hairline', () => {
    // The stat grid and "The deal" — the only two carded sections on the page.
    expect(source.match(/rounded-3xl/g)).toHaveLength(2)
    expect(source.match(/border-sw-card-stroke/g)).toHaveLength(2)
  })

  it('leaves no card on the old radius', () => {
    expect(source).not.toContain('rounded-lg')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/routes/index-chrome.test.ts src/components/ScrubHero.test.tsx`
Expected: FAIL — `rounded-3xl` appears zero times.

- [ ] **Step 3: Restyle the pill**

In `src/components/ScrubHero.tsx`, change the pill's wrapper class to:

```tsx
        <div className="max-w-xl rounded-3xl border border-sw-card-stroke bg-sw-navy-deep/40 px-6 py-5 text-center shadow-card backdrop-blur-sm">
```

The fill stays `bg-sw-navy-deep/40` rather than becoming `bg-sw-card-fill`: the app's cards sit on a fixed dark ground, and this one sits over a sky that runs from night to noon, where white at 5% would leave the wordmark unreadable at the bright end.

- [ ] **Step 4: Restyle the two sections**

In `src/routes/index.tsx`, line 119, change the stat grid's class to:

```tsx
          <dl className="grid gap-px overflow-hidden rounded-3xl border border-sw-card-stroke bg-white/10 sm:grid-cols-2">
```

`bg-white/10` stays: with `gap-px` it is what draws the hairlines between the cells, not a surface fill.

At line 226, change "The deal" section's class to:

```tsx
      <section className="mt-20 rounded-3xl border border-sw-card-stroke bg-sw-card-fill p-6 shadow-card sm:mt-28 sm:p-8">
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm vitest run src/routes/index-chrome.test.ts src/components/ScrubHero.test.tsx
```

Expected: PASS. If the `rounded-lg` assertion still fails, another element on the page carries it — find it and decide whether it is one of the three surfaces before changing it.

- [ ] **Step 6: Commit**

```bash
git add src/components/ScrubHero.tsx src/routes/index.tsx src/routes/index-chrome.test.ts src/components/ScrubHero.test.tsx
git commit -m "Give the page's cards the app's corner, hairline and shadow

Three surfaces take it and no others: the pill, the validation grid and the
deal. The footer's top rule is a rule.

The pill keeps its navy fill rather than the card's white-at-five-percent: the
app's cards sit on a fixed dark ground and this one sits over a sky that runs
from night to noon."
```

---

### Task 7: Verify the whole thing

**Files:**
- No source changes.

- [ ] **Step 1: Build, typecheck, test, in that order**

```bash
pnpm build && pnpm typecheck && pnpm test
```

`pnpm typecheck` must run after `pnpm build` because `src/routeTree.gen.ts` is generated and gitignored. `pnpm build` prints `ERROR [nitro] Preview server exited with code 143` near the end; CONTRIBUTING.md documents that as normal and the exit code is what matters.

Expected: all clean, and `src/lib/bundle-size.test.ts` included now that `.output/public` exists.

- [ ] **Step 2: Check the prerendered page**

Inspect `.output/public/index.html` with python, not `grep` — plain grep treats that file as binary and silently reports nothing.

```bash
python3 -c "
import re
h = open('.output/public/index.html').read()
gone = ['kn</span>','Ebbing','Flooding','Slack','7:4','#f5c96b']
here = ['100dvh','<canvas','Deception Pass (Narrows)','var(--color-sw-graph-line)','rounded-3xl','border-sw-card-stroke','font-rounded']
for m in gone: print(('LEAK ' if m.lower() in h.lower() else 'gone '), m)
for m in here: print(('ok   ' if m in h else 'MISS '), m)
print('h1:', h.count('<h1'), '| clock:', re.findall(r'\d{1,2}:\d{2}[ap]m', h))
"
```

Expected: every `gone` item gone from the hero, every `here` item present, exactly one `<h1>`, and no `h:mma` clock in the prerender. `Ebbing`, `Flooding` and `Slack` appear in the screenshot alt text below the fold — check the reported position is below the "Currents, not just tides" heading before treating a hit as a leak.

- [ ] **Step 3: Confirm the new utilities actually generated**

Tailwind v4 emits only the utilities something uses, so a token existing in `styles.css` does not mean `shadow-card` or `font-rounded` reached the stylesheet. Nothing checked that until now.

```bash
python3 -c "
import glob
css = ''.join(open(f).read() for f in glob.glob('.output/public/assets/*.css'))
for u in ['.font-rounded', '.shadow-card', '.border-sw-card-stroke', '.bg-sw-card-fill']:
    print(('ok   ' if u in css else 'MISS '), u)
print('graph ink var defined:', '--color-sw-graph-line' in css)
"
```

Expected: every utility present. A `MISS` on `.shadow-card` means `--shadow-*` is not the namespace this Tailwind version uses for box shadows — report it rather than papering over it with an arbitrary value, because that would put a literal colour back into a component.

- [ ] **Step 4: Report what could not be checked**

There is no browser in this environment. Do not claim to have looked at the page. Report explicitly that the rounded face, the fill's new colour, the set arrow's bearing and the card treatment are unverified visually, and that they need the PR preview URL.

- [ ] **Step 5: Commit nothing**

This task produces no commit. Report the results.

---

## Self-Review

**Spec coverage.** Graph inks and `fillOpacity` — Task 1 and Task 4. Rounded type — Task 1 (token) and Task 3 (use). Card treatment and its three surfaces — Task 6. The lead card, the set, the phase tint, the slack glyph, the value and unit — Task 3; wired in Task 5. The clock's divergence from `hhmm` — Task 2, with the reason in the commit. The strip's zero-anchored symmetric fill — Task 4. `live` gating preserved — Task 5's second test. Out-of-scope files are named in the Global Constraints and touched by no task.

**One thing the spec says that no task implements, deliberately.** The spec notes the app's fill is symmetric about zero "even when the plot is not". This plot always centres zero — `y` maps `level / peak` about `plot / 2` — so the symmetric span and the plot agree by construction and no extra arithmetic is needed. It becomes real work only when a station page fits its plot to the day's range, which is the follow-up.

**Placeholders.** None. Every step carries the code or the command it needs.

**Types.** `chartTime(Date, string)` and `compass16(number)` are defined in Task 2 and consumed in Task 3. `<CurrentLead level setDegrees slack at timeZone />` is defined in Task 3 and rendered with exactly those props in Task 5. `FILL_OPACITY` is introduced and used within Task 4. `countdown` is removed in Task 5, and its only caller is removed in the same task.
