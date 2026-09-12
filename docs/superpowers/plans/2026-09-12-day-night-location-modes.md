# Day, night, system, and location modes implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Slackwater route persistent Auto, Light, Night, and location-aware appearances with an animated Almanac sky.

**Architecture:** Pure functions resolve saved mode, route subject, appearance, sky paint, and body placement. One root React component handles browser storage, system preference, geolocation, the minute clock, and the short canvas transition; CSS tokens recolor the site. Station loader data supplies the initial coordinates and URL instant, while `StationPage` publishes its displayed moment so tide scrubbing keeps the sky and shareable URL synchronized.

**Tech Stack:** React 19, TanStack Start/Router, Tailwind CSS 4, `@openwaters/almanac`, Canvas 2D, Vitest, browser `localStorage`, `matchMedia`, Geolocation, and Popover APIs.

**Spec:** `docs/superpowers/specs/2026-09-12-day-night-location-modes-design.md`

## Global constraints

- Start from `origin/main`; do not copy the spike branch wholesale.
- Add no dependency.
- No stored coordinates: persist only `slackwater-theme` with `auto`, `light`, `night`, or `location`.
- Default to Night when the preference is missing, invalid, or unavailable.
- Auto uses station coordinates and selected URL time on station pages, and system appearance elsewhere; Your location uses browser coordinates and the live clock on every page.
- A tide page's client-side selected moment beats its initial loader instant after scrubbing.
- Location is literal: daylight follows solar altitude, and a moon below the horizon is not drawn.
- The approved control is the orbital button; the approved motion is Passing orbits at 700 milliseconds; the approved Light palette is sea glass.
- Preserve reduced-motion behavior, keyboard access, WCAG AA contrast, deterministic social cards, and the current meanings of every state colour.
- Keep `src/content/privacy.md`, `README.md`, and `AGENTS.md` accurate in the same change.

---

### Task 1: Resolve mode, route subject, and first paint

**Files:**
- Create: `src/lib/theme.ts`
- Create: `src/lib/theme.test.ts`

**Interfaces:**
- Produces: `ThemeMode`, `Appearance`, `Observer`, `ThemeSubject`, `THEME_STORAGE_KEY`, `parseThemeMode`, `resolveAppearance`, `subjectFromMatches`, and `PREPAINT_THEME_SCRIPT`.
- Consumes: active TanStack matches shaped as `{ loaderData?: unknown }`.

- [ ] **Step 1: Write the failing resolver tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  PREPAINT_THEME_SCRIPT,
  parseThemeMode,
  resolveAppearance,
  subjectFromMatches,
} from './theme'

describe('parseThemeMode', () => {
  it('defaults missing and invalid storage to night', () => {
    expect(parseThemeMode(null)).toBe('night')
    expect(parseThemeMode('sepia')).toBe('night')
  })

  it.each(['auto', 'light', 'night', 'location'] as const)('accepts %s', (mode) => {
    expect(parseThemeMode(mode)).toBe(mode)
  })
})

describe('resolveAppearance', () => {
  it('resolves explicit and system modes', () => {
    expect(resolveAppearance('light', true)).toBe('light')
    expect(resolveAppearance('night', false)).toBe('night')
    expect(resolveAppearance('auto', true)).toBe('night')
    expect(resolveAppearance('auto', false)).toBe('light')
  })

  it('uses solar altitude for location and defaults unavailable location to night', () => {
    expect(resolveAppearance('location', false, 0.01)).toBe('light')
    expect(resolveAppearance('location', false, -0.01)).toBe('night')
    expect(resolveAppearance('location', false)).toBe('night')
  })
})

it('takes station coordinates and an instant from active route data', () => {
  const instant = new Date('2026-09-12T03:15:00Z')
  expect(subjectFromMatches([{ loaderData: { station: { latitude: 48.5, longitude: -123.1 }, instant } }])).toEqual({
    observer: { latitude: 48.5, longitude: -123.1 },
    instant,
  })
})

it('shares the storage key and supported values with the pre-paint script', () => {
  expect(PREPAINT_THEME_SCRIPT).toContain('slackwater-theme')
  expect(PREPAINT_THEME_SCRIPT).toContain('prefers-color-scheme: dark')
  expect(PREPAINT_THEME_SCRIPT).toContain('data-appearance')
})
```

- [ ] **Step 2: Run the tests and confirm the missing module fails**

Run: `rtk pnpm test -- src/lib/theme.test.ts`

Expected: FAIL because `./theme` does not exist.

- [ ] **Step 3: Implement the pure theme boundary**

```ts
export const THEME_STORAGE_KEY = 'slackwater-theme'

export type ThemeMode = 'auto' | 'light' | 'night' | 'location'
export type Appearance = 'light' | 'night'
export interface Observer { latitude: number; longitude: number }
export interface ThemeSubject { observer?: Observer; instant?: Date }

const MODES: readonly ThemeMode[] = ['auto', 'light', 'night', 'location']

export function parseThemeMode(value: string | null): ThemeMode {
  return MODES.includes(value as ThemeMode) ? value as ThemeMode : 'night'
}

export function resolveAppearance(
  mode: ThemeMode,
  systemDark: boolean,
  sunAltitude?: number,
): Appearance {
  if (mode === 'light') return 'light'
  if (mode === 'night') return 'night'
  if (mode === 'auto') return systemDark ? 'night' : 'light'
  return (sunAltitude ?? -1) > 0 ? 'light' : 'night'
}

export function subjectFromMatches(matches: readonly { loaderData?: unknown }[]): ThemeSubject {
  for (const { loaderData } of matches.toReversed()) {
    if (!loaderData || typeof loaderData !== 'object') continue
    const data = loaderData as Record<string, unknown>
    const station = data.station as Record<string, unknown> | undefined
    if (typeof station?.latitude !== 'number' || typeof station.longitude !== 'number') continue
    return {
      observer: { latitude: station.latitude, longitude: station.longitude },
      instant: data.instant instanceof Date ? data.instant : undefined,
    }
  }
  return {}
}

export const PREPAINT_THEME_SCRIPT = `(()=>{try{const k='slackwater-theme',m=localStorage.getItem(k);let a='night';if(m==='light')a='light';else if(m==='auto')a=matchMedia('(prefers-color-scheme: dark)').matches?'night':'light';document.documentElement.dataset.appearance=a}catch{}})()`
```

- [ ] **Step 4: Run the focused tests**

Run: `rtk pnpm test -- src/lib/theme.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the resolver**

```bash
rtk git add src/lib/theme.ts src/lib/theme.test.ts
rtk git commit -m "Resolve site appearance"
```

---

### Task 2: Compute and draw the focused sky

**Files:**
- Create: `src/lib/site-sky.ts`
- Create: `src/lib/site-sky.test.ts`
- Create: `src/components/SiteSky.tsx`
- Create: `src/components/SiteSky.test.tsx`

**Interfaces:**
- Consumes: `Appearance` and `Observer` from `src/lib/theme.ts`; `sunAltAz`, `moonAltAz`, `sunEvents`, `moonEvents`, and `moonIllumination` from Almanac.
- Produces: `SkyFrame`, `skyPaint`, `locationSky`, `stylizedSky`, `transitionSky`, and `<SiteSky frame />`.

- [ ] **Step 1: Write failing sky tests for paint, literal visibility, and endpoints**

```ts
import { describe, expect, it } from 'vitest'
import { locationSky, skyPaint, stylizedSky, transitionSky } from './site-sky'

const observer = { latitude: 48.4284, longitude: -123.3656 }

describe('skyPaint', () => {
  it('uses the five approved solar anchors', () => {
    expect(skyPaint(10)).toEqual({ top: '#2f7fd4', bottom: '#bde3fb' })
    expect(skyPaint(0)).toEqual({ top: '#2b4a7a', bottom: '#f8a15f' })
    expect(skyPaint(-18)).toEqual({ top: '#04060f', bottom: '#0b1023' })
  })
})

it('keeps stylized modes stable', () => {
  expect(stylizedSky('light').sun).toMatchObject({ x: 0.72, y: 0.18 })
  expect(stylizedSky('night').moon).toMatchObject({ x: 0.72, y: 0.18, fraction: 1 })
})

it('draws only the literal nighttime body', () => {
  const moonless = locationSky(observer, new Date('2026-09-12T07:00:00Z'))
  expect(moonless.sun).toBeUndefined()
  expect(moonless.moon).toBeUndefined()
})

it('starts and ends a passing-orbits transition exactly at its inputs', () => {
  const from = stylizedSky('night')
  const to = stylizedSky('light')
  expect(transitionSky(from, to, 0)).toEqual(from)
  expect(transitionSky(from, to, 1)).toEqual(to)
})
```

Add a server-markup test for the component:

```tsx
import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SiteSky } from './SiteSky'
import { stylizedSky } from '#/lib/site-sky'

it('is decorative and keeps its canvas out of layout', () => {
  const html = renderToStaticMarkup(<SiteSky frame={stylizedSky('night')} />)
  expect(html).toContain('aria-hidden="true"')
  expect(html).toContain('<canvas')
  expect(html).toContain('pointer-events-none')
})
```

- [ ] **Step 2: Run the tests and confirm the missing modules fail**

Run: `rtk pnpm test -- src/lib/site-sky.test.ts src/components/SiteSky.test.tsx`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the five-anchor interpolation and two sky sources**

Define `SkyFrame` with `paint`, optional sun, and optional moon. Keep coordinates normalized from 0 to 1. `stylizedSky` returns the fixed 72%/18% body. `locationSky` searches a 48-hour event window once per observer/day, projects rise-to-set progress across the width, maps altitude above the horizon into the upper 82% of the viewport, hides the daytime moon, and hides every body Almanac places below the horizon. Catch Almanac range errors and return the night paint with no body.

Use these exact paint anchors:

```ts
const SKY_ANCHORS = [
  { altitude: 10, top: '#2f7fd4', bottom: '#bde3fb' },
  { altitude: 0, top: '#2b4a7a', bottom: '#f8a15f' },
  { altitude: -6, top: '#17264a', bottom: '#8d4a63' },
  { altitude: -12, top: '#0b1430', bottom: '#2a2a52' },
  { altitude: -18, top: '#04060f', bottom: '#0b1023' },
] as const
```

`transitionSky(from, to, progress)` clamps progress, returns the exact inputs at 0 and 1, sends the outgoing body toward `x = -0.05` in a high arc, brings the incoming body from `x = 1.05` in a high arc, and mixes the two paint colours. Large same-body moves also arc; minute drift stays direct. If the target has no literal moon, interpolate only the outgoing sun and paint.

- [ ] **Step 4: Draw the frame on one fixed canvas**

`SiteSky` sizes its canvas to CSS pixels times `devicePixelRatio`, clears before every draw, paints the vertical gradient, draws the sun as a warm disc and glow, and draws the moon as a dark limb plus illuminated ellipse using the Almanac fraction and light angle. It renders nothing except this fixed layer:

```tsx
return (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <canvas ref={canvas} className="h-full w-full" />
  </div>
)
```

- [ ] **Step 5: Run the focused tests**

Run: `rtk pnpm test -- src/lib/site-sky.test.ts src/components/SiteSky.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the sky**

```bash
rtk git add src/lib/site-sky.ts src/lib/site-sky.test.ts src/components/SiteSky.tsx src/components/SiteSky.test.tsx
rtk git commit -m "Draw the site sky"
```

---

### Task 3: Add the root controller and orbital control

**Files:**
- Create: `src/components/ThemeShell.tsx`
- Create: `src/components/ThemeShell.test.tsx`
- Modify: `src/components/StationPage.tsx`
- Modify: `src/routes/__root.tsx`

**Interfaces:**
- Consumes: every Task 1 interface, `locationSky`, `stylizedSky`, and `transitionSky` from Task 2, `useMatches` from TanStack Router, and `SiteSky`.
- Produces: `<ThemeShell>{children}</ThemeShell>` as the single whole-site owner and `useThemeSubject` for station pages to publish the moment they already display.

- [ ] **Step 1: Write the failing markup test**

```tsx
import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ThemeShell } from './ThemeShell'

it('renders the orbital button and four labelled modes', () => {
  const html = renderToStaticMarkup(<ThemeShell matches={[]}><p>Water</p></ThemeShell>)
  expect(html).toContain('Theme: Night')
  expect(html).toContain('Auto (system)')
  expect(html).toContain('Light')
  expect(html).toContain('Night')
  expect(html).toContain('Your location')
  expect(html).toContain('popover')
  expect(html).toContain('Water')
})
```

- [ ] **Step 2: Run the test and confirm the missing component fails**

Run: `rtk pnpm test -- src/components/ThemeShell.test.tsx`

Expected: FAIL because `ThemeShell` does not exist.

- [ ] **Step 3: Implement state and browser effects**

`ThemeShell` receives active `matches` as a required prop and starts with Night on the server. `RootDocument` calls `useMatches()` once and passes the result, while server-markup tests pass an empty array. After hydration:

1. Read and validate `slackwater-theme`.
2. Subscribe to `matchMedia('(prefers-color-scheme: dark)')`.
3. Read station coordinates and optional instant from active matches.
4. For a saved Your location preference on any page, request fresh coordinates immediately.
5. When a reader selects Your location without browser coordinates, request once and save the mode only after success.
6. On geolocation failure, keep the current selection during an attempted change; for an unavailable saved Location, clear storage and use Night.
7. Tick Your location and live Auto station state once per minute; keep Auto instant station routes fixed.
8. Set `document.documentElement.dataset.appearance`, `colorScheme`, and the `theme-color` meta content.
9. Animate an appearance change with one cancellable `requestAnimationFrame` loop over 700 milliseconds; skip it under reduced motion.

Expose a minimal context setter through `useThemeSubject`. `StationPage` calls it with the station latitude, longitude, and its current `at` value. This value must update when tide scrubbing changes the selected moment and URL through `history.replaceState`, because TanStack loader data does not rerun for that in-place URL change. Clear the published subject when the station page unmounts.

The control uses the native Popover API and ordinary radios:

```tsx
<button type="button" popoverTarget="theme-modes" aria-label={`Theme: ${label}`}>
  <span aria-hidden="true">{appearance === 'light' ? '☀︎' : '☾'}</span>
</button>
<div id="theme-modes" popover="auto">
  <fieldset>
    <legend>Appearance</legend>
    {(['auto', 'light', 'night', 'location'] as const).map((value) => (
      <label key={value}>
        <input type="radio" name="theme" value={value} checked={mode === value} onChange={choose} />
        {value === 'auto' ? station ? 'Auto (station location)' : 'Auto (system)' : value === 'location' ? 'Your location' : value[0].toUpperCase() + value.slice(1)}
      </label>
    ))}
    {error && <p role="alert">{error}</p>}
  </fieldset>
</div>
```

- [ ] **Step 4: Mount the shell and pre-paint script at the root**

In `src/routes/__root.tsx`, add the inline `PREPAINT_THEME_SCRIPT` before the analytics script, change the theme-colour meta tag only through the controller after hydration, and pass the active matches into the shell:

```tsx
const matches = useMatches()
return (
  <body className="bg-sw-page text-sw-foam font-sans antialiased">
    <ThemeShell matches={matches}>{children}</ThemeShell>
    <Scripts />
  </body>
)
```

The shell renders `<SiteSky />`, a `relative z-10` content wrapper, and the `fixed z-20` orbital control.

- [ ] **Step 5: Run the focused tests and typecheck**

Run: `rtk pnpm test -- src/lib/theme.test.ts src/lib/site-sky.test.ts src/components/SiteSky.test.tsx src/components/ThemeShell.test.tsx`

Run: `rtk pnpm typecheck`

Expected: both commands PASS.

- [ ] **Step 6: Commit the controller**

```bash
rtk git add src/components/ThemeShell.tsx src/components/ThemeShell.test.tsx src/components/StationPage.tsx src/routes/__root.tsx
rtk git commit -m "Let readers choose the sky"
```

---

### Task 4: Apply the sea-glass tokens across every route

**Files:**
- Modify: `src/styles.css`
- Create: `src/styles.test.ts`
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/privacy.tsx`
- Modify: `src/routes/support.tsx`
- Modify: `src/components/ComparePage.tsx`
- Modify: `src/components/Shot.tsx`
- Modify: `src/components/DayStrip.tsx`

**Interfaces:**
- Consumes: `data-appearance` from `ThemeShell`.
- Produces: complete dark and light token sets with no theme-sensitive literal white utilities.

- [ ] **Step 1: Write the failing token and literal-utility tests**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe('site appearances', () => {
  it('defines the approved sea-glass tokens', () => {
    expect(css).toContain('html[data-appearance="light"]')
    for (const value of ['#eef6f3', '#082437', '#153f4f', '#3f6573', '#4b732f']) {
      expect(css).toContain(value)
    }
    expect(css).toContain('color-scheme: light')
  })

  it('keeps Night as the document default', () => {
    expect(css).toMatch(/html\s*{[^}]*color-scheme:\s*dark/s)
  })
})
```

Add a source scan for `border-white`, `ring-white`, and theme-sensitive `bg-white` in the listed routes and components. Exempt `DayStrip` text and pills only when they sit inside the always-dark curve overlay; document that exemption in the test's file list rather than weakening the scan across all source.

- [ ] **Step 2: Run the style test and confirm it fails**

Run: `rtk pnpm test -- src/styles.test.ts`

Expected: FAIL because the Light token block and named surface tokens do not exist.

- [ ] **Step 3: Add the exact token sets**

Keep the current dark values and add `sw-surface: #ffffff0d`, `sw-rule: #ffffff1a`, and `sw-shadow: #00143299`. Under `html[data-appearance="light"]`, override:

```css
--color-sw-page: #eef6f3;
--color-sw-paper: #082437;
--color-sw-foam: #153f4f;
--color-sw-steel: #3f6573;
--color-sw-leaf: #4b732f;
--color-sw-go: #4b732f;
--color-sw-flood: #276f9d;
--color-sw-ebb: #9b5900;
--color-sw-amber: #b33c2c;
--color-sw-surface: #ffffffb3;
--color-sw-rule: #08243724;
--color-sw-shadow: #6f8c952e;
color-scheme: light;
```

Add a 700 millisecond background-colour transition to the body, disabled under `prefers-reduced-motion: reduce`. The canvas supplies the twilight gradient; CSS supplies the settled page ground.

- [ ] **Step 4: Replace theme-sensitive literal utilities**

Use `border-sw-rule`, `ring-sw-rule`, `bg-sw-surface`, and `shadow-sw-shadow` in the listed files. Keep literal white only for ink drawn over the permanently dark curve area and for source assets whose pixels do not inherit browser theme.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `rtk pnpm test -- src/styles.test.ts src/routes/index.test.tsx src/components/StationPage.test.tsx src/components/DayStrip.test.tsx`

Run: `rtk pnpm typecheck`

Expected: both commands PASS.

- [ ] **Step 6: Commit the palette sweep**

```bash
rtk git add src/styles.css src/styles.test.ts src/routes/index.tsx src/routes/privacy.tsx src/routes/support.tsx src/components/ComparePage.tsx src/components/Shot.tsx src/components/DayStrip.tsx
rtk git commit -m "Give the site a daylight palette"
```

---

### Task 5: Keep public promises and verify the whole site

**Files:**
- Modify: `src/content/privacy.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Update: draft PR body and screenshots

**Interfaces:**
- Consumes: the completed feature and repository build/preview commands.
- Produces: accurate public documentation, passing production output, and visible PR evidence.

- [ ] **Step 1: Write the privacy promise before enabling the final verification**

Add a Website appearance section to `src/content/privacy.md` stating:

```md
## Website appearance

The site stores your chosen appearance mode (`Auto`, `Light`, `Night`, or `Your location`) in your browser. It does not store coordinates.

On a tide or current station page, Auto uses that station's published coordinates and the selected time. On other pages, Auto follows your system appearance. Choosing Your location on any page asks your browser for your current position. The position stays in your browser and is not sent to Slackwater or its analytics provider.
```

- [ ] **Step 2: Update current-state repository guidance**

In `README.md`, describe the four modes, Night default, sea-glass Light palette, station sky under Auto, and visitor sky under Your location. In `AGENTS.md`, keep the rule that all colours use shared dark/light tokens and theme-sensitive literal colour utilities are prohibited.

- [ ] **Step 3: Run the complete verification floor**

Run: `rtk pnpm test`

Run: `rtk pnpm typecheck`

Run: `rtk pnpm build`

Run `rtk pnpm test` once more after the build so the three build-artifact suites execute.

Expected: every command exits 0, all test suites pass, and the build-artifact suites are no longer skipped.

- [ ] **Step 4: Inspect the required visual matrix**

Run the production preview on a LAN-reachable host:

```bash
rtk pnpm preview --ip 0.0.0.0
```

Check desktop and phone widths for:

- `/` in Night and Light;
- `/tides/friday-harbor/` using station coordinates and the live clock;
- `/currents/deception-pass-narrows/` using station coordinates and the live clock;
- one valid instant station URL using the URL time;
- `/privacy/` using browser geolocation only after Location is selected.

For each representative page, verify the orbital popover by keyboard, Auto system changes, manual modes, Location behavior, theme-colour meta value, 700 millisecond Passing orbits motion, literal moonless behavior, and the instant sky's fixed time. Repeat one transition with reduced motion enabled and confirm it is immediate. Capture desktop and phone screenshots showing Night and sea-glass Light.

On the tide instant page, scrub to a different moment and verify the sky follows the selected moment while the URL updates in place.

- [ ] **Step 5: Commit documentation and any visual fixes**

```bash
rtk git add src/content/privacy.md README.md AGENTS.md
rtk git commit -m "Explain site appearance choices"
```

If visual inspection finds a defect, add only the affected source and its focused test to a separate commit before rerunning Step 3.

- [ ] **Step 6: Review branch scope and update the draft PR**

Run: `rtk git log --oneline origin/main..HEAD`

Expected: only the design, plan, and feature commits from this branch.

Run: `rtk git diff --check origin/main...HEAD`

Update the draft PR description so its checklist matches completed work and attach the Night/Light desktop and phone screenshots. Push the branch after a standalone `rtk gh auth status` check. Do not mark the PR ready or merge it.
