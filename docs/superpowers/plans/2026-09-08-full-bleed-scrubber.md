# Full-bleed scrubber Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page hero with a full-bleed rendering of the app's scrub view — sky over a panning current curve — that auto-scrubs from night to two hours after sunrise once on load, then stops.

**Architecture:** The sky's stars, sun and moon are drawn on a `<canvas>` that redraws each frame; the gradient behind it and the curve in front of it are DOM and SVG, so both prerender. All logic lives in pure functions under `src/lib/` because vitest runs in a node environment with no DOM; components are thin shells tested with `renderToStaticMarkup`. Modules are split by cadence — `skyDays` runs once per window, `skyState` once per frame — and by ownership, so the landing page's intro never enters the shared strip.

**Tech Stack:** TanStack Start + React 19, Tailwind v4, vitest (node environment, `renderToStaticMarkup` for components), `@openwaters/almanac` for astronomy, `@neaps/tide-predictor` via `src/lib/predict.ts` for the curve.

**Spec:** `docs/superpowers/specs/2026-09-08-full-bleed-scrubber-design.md`

## Global Constraints

- **`slackwater-ios/Slackwater/Theme.swift` is the source of truth for every sky value.** Where this plan and that file disagree, that file wins. Do not take values from `openwaters.io/website/src/components/sky/`.
- **Never reuse `openwaters.io`'s `sky/projection.ts`.** It is a 360° chart panorama with east on the left; `skyPoint` fits each body's rise-to-set span to the frame and mirrors it, east on the right.
- **No literal hex colours in components.** Ported colour tables live in `src/lib/`, following `src/lib/ramp.ts`. Everything else comes from the tokens in `src/styles.css`.
- **Colour is state, form is kind.** Green (`--color-sw-go`) means slack and only slack.
- **The wordmark never breaks:** one word, capital S, lowercase w, `whitespace-nowrap`.
- **Never claim a feature the app does not have.** The particle field is designed and unshipped; it must not appear.
- **Anything claiming the present must be gated on `live`** from `src/lib/use-live-now.ts`. Server renders freeze at `SERVER_NOW`.
- **Comments state WHY, one line, no history.** See `.github/skills/code-comments`.
- **Never hard-wrap prose.** Commit subjects are imperative and plain-language.
- **Eclipses are out of scope**, but the seam stays open: `Sky` takes a whole `SkyState`, never spread props, and no placeholder `eclipses` argument is added.
- Verify with `pnpm test`, `pnpm typecheck`, `pnpm build`. Do not report a visual change as done without looking at it.

---

### Task 1: Add Almanac and the star catalogue

**Files:**
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Create: `src/data/stars.json`
- Test: `src/data/stars.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `@openwaters/almanac` resolvable, and `src/data/stars.json` as `[ra, dec, mag][]` — 288 rows, degrees J2000, visual magnitude.

- [ ] **Step 1: Pin the release so pnpm will accept it**

`@openwaters/almanac@0.3.0` published 2026-09-07. pnpm 11 refuses packages under a day old, so add it to the existing exclude list in `pnpm-workspace.yaml`:

```yaml
minimumReleaseAgeExclude:
  - '@openwaters/noaa-current-stations@0.5.0'
  - '@openwaters/station-metadata@4.1.2'
  - '@openwaters/almanac@0.3.0'
```

- [ ] **Step 2: Install**

```bash
pnpm add @openwaters/almanac@0.3.0
```

- [ ] **Step 3: Copy the star catalogue**

The app's own cut of the Yale Bright Star Catalog, every star brighter than magnitude 3.5.

```bash
cp ../slackwater-ios/Slackwater/Resources/stars.json src/data/stars.json
```

- [ ] **Step 4: Write the failing test**

Create `src/data/stars.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import stars from './stars.json' with { type: 'json' }

describe('star catalogue', () => {
  it('is the app’s own cut, brightest first', () => {
    expect(stars).toHaveLength(288)
    expect(stars[0]).toEqual([101.287, -16.716, -1.44])
  })

  it('carries degrees, not radians or hours', () => {
    for (const [ra, dec, mag] of stars) {
      expect(ra).toBeGreaterThanOrEqual(0)
      expect(ra).toBeLessThan(360)
      expect(Math.abs(dec)).toBeLessThanOrEqual(90)
      expect(mag).toBeLessThanOrEqual(3.5)
    }
  })
})
```

- [ ] **Step 5: Run the test**

Run: `pnpm vitest run src/data/stars.test.ts`
Expected: PASS. A failure on the length means the app's catalogue changed — reconcile before continuing.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml src/data/stars.json src/data/stars.test.ts
git commit -m "Add Almanac and the app's star catalogue

The catalogue is 7 KB and the astronomy is deterministic, so both ship in the
bundle and the hero draws its sky without a network request. The version pin
is there because pnpm refuses a release under a day old."
```

---

### Task 2: Port the sky math from Theme.swift

**Files:**
- Create: `src/lib/sky.ts`
- Test: `src/lib/sky.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface SkyPaint { top: string; bottom: string }`
  - `interface HorizonSpan { riseAz: number; setAz: number }`
  - `skyPaint(sunAltitude: number): SkyPaint`
  - `skyOpacity(sunAltitude: number): number`
  - `starOpacity(sunAltitude: number): number`
  - `starHazeOpacity(altitude: number): number`
  - `starTwinkle(index: number, seconds: number, reduceMotion: boolean): number`
  - `moonGlowRadius(fraction: number): number`
  - `moonGlareOpacity(distance: number): number`
  - `skyPoint(args: { azimuth: number; altitude: number; latitude: number; span?: HorizonSpan; pad?: number; width: number; height: number }): { x: number; y: number }`
  - Constants `SUN_DISC_RADIUS = 8`, `SUN_GLOW_RADIUS = 27`, `MOON_GLYPH_SIZE = 22`, `SKY_ALTITUDE_SCALE = 3`, `SKY_HORIZON_OVERLAP = 16`

- [ ] **Step 1: Write the failing test**

Create `src/lib/sky.test.ts`. Every expected value is `Theme.swift`'s own; the midpoint hexes are its `mixedHex` evaluated by hand.

```ts
import { describe, expect, it } from 'vitest'
import {
  MOON_GLYPH_SIZE, SKY_ALTITUDE_SCALE, SUN_DISC_RADIUS, SUN_GLOW_RADIUS,
  moonGlareOpacity, moonGlowRadius, skyOpacity, skyPaint, skyPoint,
  starHazeOpacity, starOpacity, starTwinkle,
} from './sky'

describe('skyPaint', () => {
  it('sits on the anchors Almanac uses for its twilight events', () => {
    expect(skyPaint(10)).toEqual({ top: '#2f7fd4', bottom: '#bde3fb' })
    expect(skyPaint(0)).toEqual({ top: '#2b4a7a', bottom: '#f8a15f' })
    expect(skyPaint(-6)).toEqual({ top: '#17264a', bottom: '#8d4a63' })
    expect(skyPaint(-12)).toEqual({ top: '#0b1430', bottom: '#2a2a52' })
    expect(skyPaint(-18)).toEqual({ top: '#04060f', bottom: '#0b1023' })
  })

  it('holds the ends past the outermost anchors', () => {
    expect(skyPaint(80)).toEqual(skyPaint(10))
    expect(skyPaint(-40)).toEqual(skyPaint(-18))
  })

  it('interpolates halfway between two anchors', () => {
    expect(skyPaint(-3)).toEqual({ top: '#213862', bottom: '#c37661' })
  })
})

describe('the opacity ramps', () => {
  it('caps stars at 0.7 and clears them by civil twilight', () => {
    expect(starOpacity(-18)).toBeCloseTo(0.7)
    expect(starOpacity(-40)).toBeCloseTo(0.7)
    expect(starOpacity(-12)).toBeCloseTo(0.35)
    expect(starOpacity(-6)).toBe(0)
    expect(starOpacity(10)).toBe(0)
  })

  it('mutes the daylight gradient but never the night one', () => {
    expect(skyOpacity(0)).toBeCloseTo(0.55)
    expect(skyOpacity(20)).toBeCloseTo(0.55)
    expect(skyOpacity(-6)).toBe(1)
    expect(skyOpacity(-3)).toBeCloseTo(0.775)
  })

  it('hazes stars out at the horizon and runs them below it', () => {
    expect(starHazeOpacity(-10)).toBe(0)
    expect(starHazeOpacity(-20)).toBe(0)
    expect(starHazeOpacity(0)).toBeCloseTo(0.2)
    expect(starHazeOpacity(40)).toBe(1)
    expect(starHazeOpacity(90)).toBe(1)
  })

  it('does not twinkle under reduced motion', () => {
    expect(starTwinkle(3, 12.5, true)).toBe(1)
    expect(starTwinkle(3, 12.5, false)).toBeGreaterThanOrEqual(0.86)
    expect(starTwinkle(3, 12.5, false)).toBeLessThanOrEqual(1)
  })
})

describe('the moon against the sun', () => {
  it('grows its glow with the lit fraction', () => {
    expect(moonGlowRadius(0)).toBe(12)
    expect(moonGlowRadius(1)).toBe(32)
  })

  it('fades out inside the sun’s glare and is clear beyond the glow', () => {
    const touching = SUN_DISC_RADIUS + MOON_GLYPH_SIZE / 2
    const clear = SUN_GLOW_RADIUS + MOON_GLYPH_SIZE / 2
    expect(moonGlareOpacity(touching)).toBe(0)
    expect(moonGlareOpacity(touching - 5)).toBe(0)
    expect(moonGlareOpacity(clear)).toBe(1)
    expect(moonGlareOpacity(100)).toBe(1)
    expect(moonGlareOpacity((touching + clear) / 2)).toBeCloseTo(0.5)
  })
})

describe('skyPoint', () => {
  const size = { width: 400, height: 300 }

  it('scales altitude at a fixed rate, not with the frame', () => {
    const horizon = skyPoint({ azimuth: 180, altitude: 0, latitude: 48, ...size })
    const up = skyPoint({ azimuth: 180, altitude: 10, latitude: 48, ...size })
    expect(horizon.y).toBe(300)
    expect(horizon.y - up.y).toBeCloseTo(10 * SKY_ALTITUDE_SCALE)
  })

  it('puts east on the right in the northern hemisphere', () => {
    const span = { riseAz: 90, setAz: 270 }
    const rising = skyPoint({ azimuth: 90, altitude: 0, latitude: 48, span, ...size })
    const setting = skyPoint({ azimuth: 270, altitude: 0, latitude: 48, span, ...size })
    expect(rising.x).toBeCloseTo(400)
    expect(setting.x).toBeCloseTo(0)
  })

  it('keeps east on the right south of the equator too', () => {
    const span = { riseAz: 90, setAz: 270 }
    const rising = skyPoint({ azimuth: 90, altitude: 0, latitude: -33, span, ...size })
    const setting = skyPoint({ azimuth: 270, altitude: 0, latitude: -33, span, ...size })
    expect(rising.x).toBeGreaterThan(setting.x)
  })

  it('spans the whole horizon when the body has no rise and set to fit', () => {
    const meridian = skyPoint({ azimuth: 180, altitude: 45, latitude: 48, ...size })
    expect(meridian.x).toBeCloseTo(200)
  })

  it('pads by the body’s radius so a disc clears the edge as it rises', () => {
    const span = { riseAz: 90, setAz: 270 }
    const padded = skyPoint({ azimuth: 90, altitude: 0, latitude: 48, span, pad: 8, ...size })
    expect(padded.x).toBeCloseTo(408)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/sky.test.ts`
Expected: FAIL — `Failed to resolve import "./sky"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/sky.ts`:

```ts
/**
 * The sky's paint, ramps and projection, ported from the app's `Theme.swift`,
 * which is the single source of truth. If a value here disagrees with that
 * file, that file wins.
 *
 * The anchors are the altitudes Almanac uses for its twilight events (0°, −6°,
 * −12°, −18°), so the gradient can never disagree with the twilight times.
 */

export interface SkyPaint {
  top: string
  bottom: string
}

/** Descending by altitude; `skyPaint` interpolates between neighbours. */
const ANCHORS: readonly { readonly altitude: number; readonly top: string; readonly bottom: string }[] = [
  { altitude: 10, top: '#2f7fd4', bottom: '#bde3fb' },
  { altitude: 0, top: '#2b4a7a', bottom: '#f8a15f' },
  { altitude: -6, top: '#17264a', bottom: '#8d4a63' },
  { altitude: -12, top: '#0b1430', bottom: '#2a2a52' },
  { altitude: -18, top: '#04060f', bottom: '#0b1023' },
] as const

function hexToRgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}

function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function skyPaint(sunAltitude: number): SkyPaint {
  const first = ANCHORS[0]
  if (sunAltitude >= first.altitude) return { top: first.top, bottom: first.bottom }
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const high = ANCHORS[i]
    const low = ANCHORS[i + 1]
    if (sunAltitude <= low.altitude) continue
    const t = (high.altitude - sunAltitude) / (high.altitude - low.altitude)
    return { top: mixHex(high.top, low.top, t), bottom: mixHex(high.bottom, low.bottom, t) }
  }
  const last = ANCHORS[ANCHORS.length - 1]
  return { top: last.top, bottom: last.bottom }
}

/** Symbols, many times the bodies' true half-degree. */
export const SUN_DISC_RADIUS = 8
export const SUN_GLOW_RADIUS = 27
export const MOON_GLYPH_SIZE = 22
/** Pixels per degree of altitude. Fixed, so a winter noon sits under a summer one. */
export const SKY_ALTITUDE_SCALE = 3
/** How far the horizon sits inside the plot, so a peak never covers a rising sun. */
export const SKY_HORIZON_OVERLAP = 16

export function moonGlowRadius(fraction: number): number {
  return 12 + fraction * 20
}

/**
 * The bodies are symbols many times their true size, so near every new moon the
 * two would otherwise overlap like an eclipse. `distance` is between their
 * projected centres.
 */
export function moonGlareOpacity(distance: number): number {
  const touching = SUN_DISC_RADIUS + MOON_GLYPH_SIZE / 2
  const clear = SUN_GLOW_RADIUS + MOON_GLYPH_SIZE / 2
  return clamp((distance - touching) / (clear - touching), 0, 1)
}

export function starOpacity(sunAltitude: number): number {
  return clamp(((-sunAltitude - 6) / 12) * 0.7, 0, 0.7)
}

export function starTwinkle(index: number, seconds: number, reduceMotion: boolean): number {
  if (reduceMotion) return 1
  return 0.86 + 0.14 * Math.sin(seconds * (0.55 + (index % 5) * 0.08) + index * 1.7)
}

export function skyOpacity(sunAltitude: number): number {
  return 1 - clamp((sunAltitude + 6) / 6, 0, 1) * 0.45
}

/** Stars brighten from the horizon up into the zenith's clear air. */
export function starHazeOpacity(altitude: number): number {
  return clamp((altitude + 10) / 50, 0, 1)
}

/**
 * Where a body crosses the horizon: the azimuths at its last rise at or before
 * a moment and its first set at or after it.
 */
export interface HorizonSpan {
  riseAz: number
  setAz: number
}

/**
 * The sky as a window whose side edges are the horizon. A body's own
 * rise-to-set azimuths stretch across the width, so it rises at the RIGHT edge
 * and sets at the left: the horizon is a circle, and a rectangle's edges can
 * only be it by fitting each body's arc to the frame. Mirrored from a sky chart
 * — east on the right, in either hemisphere — because the frame is the
 * timeline, not a compass, so a body sweeps with the curve it drives.
 *
 * `pad` is the body's disc radius: at the horizon the disc has just cleared the
 * edge. With no span the window is the whole 360°.
 */
export function skyPoint({
  azimuth, altitude, latitude, span, pad = 0, width, height,
}: {
  azimuth: number
  altitude: number
  latitude: number
  span?: HorizonSpan
  pad?: number
  width: number
  height: number
}): { x: number; y: number } {
  const center = latitude >= 0 ? 180 : 0
  // Degrees from the meridian, negative toward the rising side.
  const signed = (az: number) => {
    const s = ((az - center + 540) % 360) - 180
    return latitude >= 0 ? s : -s
  }
  let rise = -180
  let set = 180
  if (span && signed(span.riseAz) < signed(span.setAz)) {
    rise = signed(span.riseAz)
    set = signed(span.setAz)
  }
  const perDegree = (width + 2 * pad) / (set - rise)
  return {
    x: width + pad - (signed(azimuth) - rise) * perDegree,
    y: height - altitude * SKY_ALTITUDE_SCALE,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/sky.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sky.ts src/lib/sky.test.ts
git commit -m "Port the sky's paint, ramps and projection from the app

The values are Theme.swift's and the tests assert them directly, the way
ramp.ts does for the speed ramp — which is also what keeps literal hexes out
of the components.

The projection is the app's and not openwaters.io's. That page is a compass
and puts east on the left; this frame is a timeline, so a body has to sweep
with the curve it drives."
```

---

### Task 3: Build the sky's state, once per window and once per frame

**Files:**
- Create: `src/lib/sky-state.ts`
- Test: `src/lib/sky-state.test.ts`

**Interfaces:**
- Consumes: `HorizonSpan`, `skyPaint`, `skyOpacity` from `src/lib/sky.ts`; `sunEvents`, `moonEvents`, `sunAltAz`, `moonAltAz`, `moonIllumination` from `@openwaters/almanac`; `src/data/stars.json`.
- Produces:
  - `interface SkyDays { sunRises: Date[]; sunSets: Date[]; moonRises: Date[]; moonSets: Date[] }`
  - `interface PlacedStar { index: number; magnitude: number; altDeg: number; azDeg: number }`
  - `interface SkyState { latitude: number; sun?: AltAz; sunSpan?: HorizonSpan; moon?: AltAz; moonSpan?: HorizonSpan; illumination?: MoonIllumination; stars: PlacedStar[]; paint: SkyPaint; opacity: number; moonLightAngle: number }`
  - `skyDays(latitude: number, longitude: number, from: Date, to: Date): SkyDays`
  - `skyState(args: { time: Date; latitude: number; longitude: number; days: SkyDays }): SkyState`

- [ ] **Step 1: Write the failing test**

Create `src/lib/sky-state.test.ts`. Deception Pass on 2026-09-08 is the fixture; the sun rises at 13:38:01Z with its centre at −0.21° because Almanac's rise is the upper limb with refraction.

```ts
import { describe, expect, it } from 'vitest'
import { skyDays, skyState } from './sky-state'

const LAT = 48.40618896484375
const LON = -122.64
const FROM = new Date('2026-09-08T00:00:00Z')
const TO = new Date('2026-09-10T00:00:00Z')
const days = skyDays(LAT, LON, FROM, TO)
// The rise Almanac itself reports, not a literal: `span` selects the last rise
// at or before the moment, and a literal truncated to the second falls before
// the real crossing, so the span it is meant to find comes back undefined.
const SUNRISE = days.sunRises[0]

describe('skyDays', () => {
  it('finds both bodies rising and setting across the window', () => {
    expect(days.sunRises.length).toBeGreaterThanOrEqual(2)
    expect(days.sunSets.length).toBeGreaterThanOrEqual(1)
    expect(days.moonRises.length).toBeGreaterThanOrEqual(1)
    expect(days.moonSets.length).toBeGreaterThanOrEqual(1)
  })

  it('returns only crossings, not the twilights Almanac also reports', () => {
    for (const t of days.sunRises) {
      expect(t.getTime()).toBeGreaterThanOrEqual(FROM.getTime())
      expect(t.getTime()).toBeLessThanOrEqual(TO.getTime())
    }
    expect(days.sunRises[0].toISOString()).toMatch(/^2026-09-08T13:38/)
  })
})

describe('skyState', () => {
  const atSunrise = skyState({ time: SUNRISE, latitude: LAT, longitude: LON, days })
  const atNight = skyState({
    time: new Date(SUNRISE.getTime() - 4 * 3600_000), latitude: LAT, longitude: LON, days,
  })

  it('places the sun on the horizon at the rise it was given', () => {
    expect(atSunrise.sun!.altDeg).toBeCloseTo(-0.21, 1)
    expect(atSunrise.sun!.azDeg).toBeCloseTo(80.7, 0)
  })

  it('places every catalogue star', () => {
    expect(atSunrise.stars).toHaveLength(288)
    expect(atSunrise.stars[0].magnitude).toBe(-1.44)
  })

  it('spans the sun from the rise behind the moment to the set ahead of it', () => {
    expect(atSunrise.sunSpan).toBeDefined()
    expect(atSunrise.sunSpan!.riseAz).toBeCloseTo(80.7, 0)
    expect(atSunrise.sunSpan!.setAz).toBeGreaterThan(180)
  })

  it('paints night dark and dawn lighter, and never mutes the night gradient', () => {
    expect(atNight.paint.top).toBe('#04060f')
    expect(atNight.opacity).toBe(1)
    expect(atSunrise.opacity).toBeLessThan(1)
  })

  it('reports the moon’s lit fraction, not a phase name', () => {
    expect(atSunrise.illumination!.fraction).toBeCloseTo(0.084, 2)
  })

  it('aims the moon’s terminator with a finite angle', () => {
    expect(Number.isFinite(atSunrise.moonLightAngle)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/sky-state.test.ts`
Expected: FAIL — `Failed to resolve import "./sky-state"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/sky-state.ts`:

```ts
import {
  moonAltAz, moonEvents, moonIllumination, starAltAz, sunAltAz, sunEvents,
} from '@openwaters/almanac'
import type { AltAz, MoonIllumination, Observer } from '@openwaters/almanac'
import stars from '#/data/stars.json' with { type: 'json' }
import { skyOpacity, skyPaint } from './sky'
import type { HorizonSpan, SkyPaint } from './sky'

/** J2000 right ascension and declination in degrees, and visual magnitude. */
const CATALOGUE = stars as [number, number, number][]

export interface SkyDays {
  sunRises: Date[]
  sunSets: Date[]
  moonRises: Date[]
  moonSets: Date[]
}

export interface PlacedStar {
  /** Its position in the catalogue, which is what seeds its twinkle. */
  index: number
  magnitude: number
  altDeg: number
  azDeg: number
}

export interface SkyState {
  latitude: number
  sun?: AltAz
  sunSpan?: HorizonSpan
  moon?: AltAz
  moonSpan?: HorizonSpan
  illumination?: MoonIllumination
  stars: PlacedStar[]
  paint: SkyPaint
  opacity: number
  moonLightAngle: number
}

/**
 * The window's day chrome — every rise and set both bodies make inside it.
 *
 * Called ONCE per window, never per frame: an Almanac event search costs about
 * two orders of magnitude more than a position lookup (~0.6 ms against
 * ~0.005 ms), which is the whole reason this is not folded into `skyState`.
 */
export function skyDays(latitude: number, longitude: number, from: Date, to: Date): SkyDays {
  const observer: Observer = { latitudeDeg: latitude, longitudeDeg: longitude }
  const sun = sunEvents(from, to, observer)
  const moon = moonEvents(from, to, observer)
  const at = <T extends { kind: string; time: Date }>(events: T[], kind: string) =>
    events.filter((e) => e.kind === kind).map((e) => e.time)
  return {
    sunRises: at(sun, 'rise'),
    sunSets: at(sun, 'set'),
    moonRises: at(moon, 'rise'),
    moonSets: at(moon, 'set'),
  }
}

function span(
  rises: Date[], sets: Date[], time: Date, altAz: (at: Date) => AltAz | undefined,
): HorizonSpan | undefined {
  const rise = rises.filter((t) => t <= time).at(-1)
  const set = sets.find((t) => t >= time)
  if (!rise || !set) return undefined
  const riseAz = altAz(rise)?.azDeg
  const setAz = altAz(set)?.azDeg
  if (riseAz === undefined || setAz === undefined) return undefined
  return { riseAz, setAz }
}

/** The sun's tangent direction at the moon, continuous across the azimuth seam. */
function lightAngle(sun: AltAz | undefined, moon: AltAz | undefined, latitude: number): number {
  if (!sun || !moon) return 0
  const sunAlt = (sun.altDeg * Math.PI) / 180
  const moonAlt = (moon.altDeg * Math.PI) / 180
  const deltaAz = ((sun.azDeg - moon.azDeg) * Math.PI) / 180
  const horizontal = Math.cos(sunAlt) * Math.sin(deltaAz) * (latitude >= 0 ? -1 : 1)
  const vertical =
    Math.sin(sunAlt) * Math.cos(moonAlt) - Math.cos(sunAlt) * Math.sin(moonAlt) * Math.cos(deltaAz)
  return Math.atan2(-vertical, horizontal)
}

const attempt = <T>(f: () => T): T | undefined => {
  try {
    return f()
  } catch {
    // Almanac throws outside its supported range rather than returning null; a
    // sky with no sun draws as deep night, which is the honest fallback.
    return undefined
  }
}

/**
 * Everything the sky needs to draw one moment. Called once per FRAME — measured
 * at 0.34 ms for the whole catalogue plus both bodies, so it recomputes rather
 * than interpolating.
 */
export function skyState({
  time, latitude, longitude, days,
}: {
  time: Date
  latitude: number
  longitude: number
  days: SkyDays
}): SkyState {
  const observer: Observer = { latitudeDeg: latitude, longitudeDeg: longitude }
  const sun = attempt(() => sunAltAz(time, observer))
  const moon = attempt(() => moonAltAz(time, observer))
  const placed: PlacedStar[] = []
  for (let i = 0; i < CATALOGUE.length; i++) {
    const [ra, dec, magnitude] = CATALOGUE[i]
    const at = attempt(() => starAltAz(ra, dec, time, observer))
    if (at) placed.push({ index: i, magnitude, altDeg: at.altDeg, azDeg: at.azDeg })
  }
  // Deep night when Almanac cannot place the sun, matching the app's `?? -18`.
  const altitude = sun?.altDeg ?? -18
  return {
    latitude,
    sun,
    sunSpan: span(days.sunRises, days.sunSets, time, (at) => attempt(() => sunAltAz(at, observer))),
    moon,
    moonSpan: span(days.moonRises, days.moonSets, time, (at) => attempt(() => moonAltAz(at, observer))),
    illumination: attempt(() => moonIllumination(time)),
    stars: placed,
    paint: skyPaint(altitude),
    opacity: skyOpacity(altitude),
    moonLightAngle: lightAngle(sun, moon, latitude),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/sky-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Check the per-frame cost has not regressed**

Run: `pnpm vitest run src/lib/sky-state.test.ts --reporter=verbose`
Expected: the whole file completes in well under a second. If `skyState` has become slow enough to notice, the likely cause is an event search leaking into it — `skyDays` is the only place one belongs.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sky-state.ts src/lib/sky-state.test.ts
git commit -m "Build the sky's state at two cadences

skyDays runs once per window and skyState once per frame. That split is the
performance argument made structural: an Almanac event search costs about two
orders of magnitude more than a position lookup, so folding the two together
would put a search in every frame.

It is also where the eclipse search lands when the station pages need one."
```

---

### Task 4: Draw the sky onto a 2D context

**Files:**
- Create: `src/lib/sky-draw.ts`
- Test: `src/lib/sky-draw.test.ts`

**Interfaces:**
- Consumes: `SkyState`, `PlacedStar` from `src/lib/sky-state.ts`; the ramps and `skyPoint` from `src/lib/sky.ts`.
- Produces:
  - `interface SkySurface` — the subset of `CanvasRenderingContext2D` this uses: `save`, `restore`, `beginPath`, `arc`, `ellipse`, `fill`, `translate`, `rotate`, and the settable `globalAlpha` and `fillStyle`. `fillStyle` carries the context's own `string | CanvasGradient | CanvasPattern`, because a property narrowed to `string` makes a real context unassignable to this interface.
  - `drawSky(ctx: SkySurface, state: SkyState, geo: { width: number; height: number; seconds: number; reduceMotion: boolean }): void`

Vitest runs in a node environment with no canvas, so the drawing is a pure function over a context-shaped object and the test records the calls.

- [ ] **Step 1: Write the failing test**

Create `src/lib/sky-draw.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { drawSky } from './sky-draw'
import { skyDays, skyState } from './sky-state'
import type { SkySurface } from './sky-draw'

const LAT = 48.40618896484375
const LON = -122.64
const days = skyDays(LAT, LON, new Date('2026-09-08T00:00:00Z'), new Date('2026-09-10T00:00:00Z'))
const SUNRISE = new Date('2026-09-08T13:38:01Z')

function recorder() {
  const calls: string[] = []
  const alphas: number[] = []
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    arc: () => calls.push('arc'),
    ellipse: () => calls.push('ellipse'),
    translate: () => calls.push('translate'),
    rotate: () => calls.push('rotate'),
    fill: () => {
      calls.push('fill')
      alphas.push(ctx.globalAlpha)
    },
  } as SkySurface & { globalAlpha: number }
  return { ctx, calls, alphas }
}

const geo = { width: 400, height: 300, seconds: 0, reduceMotion: true }

const at = (time: Date) => skyState({ time, latitude: LAT, longitude: LON, days })

describe('drawSky', () => {
  it('draws a star field at night and none of it by day', () => {
    const night = recorder()
    const day = recorder()
    drawSky(night.ctx, at(new Date(SUNRISE.getTime() - 4 * 3600_000)), geo)
    drawSky(day.ctx, at(new Date(SUNRISE.getTime() + 6 * 3600_000)), geo)
    const fills = (r: ReturnType<typeof recorder>) => r.calls.filter((c) => c === 'fill').length
    expect(fills(night)).toBeGreaterThan(20)
    // By day only the bodies remain: two fills for the sun, at most two for the moon.
    expect(fills(day)).toBeLessThan(6)
  })

  it('fades stars through the ramp instead of drawing them at full strength', () => {
    const { ctx, alphas, calls } = recorder()
    drawSky(ctx, at(new Date(SUNRISE.getTime() - 4 * 3600_000)), geo)
    // starOpacity caps at 0.7; anything above means the ramp was bypassed.
    expect(Math.max(...alphas)).toBeLessThanOrEqual(0.7)
    // The haze guard drops stars below the horizon, so not all 288 are drawn.
    expect(calls.filter((c) => c === 'fill').length).toBeLessThan(288)
  })

  it('balances every save with a restore', () => {
    const { ctx, calls } = recorder()
    drawSky(ctx, at(SUNRISE), geo)
    expect(calls.filter((c) => c === 'save')).toHaveLength(calls.filter((c) => c === 'restore').length)
  })

  it('draws no moon while the moon is below the horizon', () => {
    const { ctx, calls } = recorder()
    // The moon sets at 01:16Z and does not rise again until 10:22Z.
    const moonDown = at(new Date('2026-09-08T05:00:00Z'))
    drawSky(ctx, moonDown, geo)
    expect(moonDown.moon!.altDeg).toBeLessThan(0)
    expect(calls).not.toContain('ellipse')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/sky-draw.test.ts`
Expected: FAIL — `Failed to resolve import "./sky-draw"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/sky-draw.ts`:

```ts
import {
  MOON_GLYPH_SIZE, SKY_ALTITUDE_SCALE, SUN_DISC_RADIUS, SUN_GLOW_RADIUS,
  moonGlareOpacity, moonGlowRadius, skyPoint, starHazeOpacity, starOpacity, starTwinkle,
} from './sky'
import type { SkyState } from './sky-state'

/** The slice of `CanvasRenderingContext2D` the sky needs, so it can be recorded in a test. */
export interface SkySurface {
  /** The context's own union, not `string`: a narrower property makes a real context unassignable. */
  fillStyle: string | CanvasGradient | CanvasPattern
  globalAlpha: number
  save(): void
  restore(): void
  beginPath(): void
  arc(x: number, y: number, r: number, from: number, to: number): void
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, from: number, to: number, counter?: boolean): void
  translate(x: number, y: number): void
  rotate(radians: number): void
  fill(): void
}

const TAU = Math.PI * 2
/**
 * The app's sky band tops out near 62 degrees (186pt at three pixels per
 * degree) and its bodies fill it. Drawing a taller band at the same scale
 * would end the star field partway up, at a hard edge exactly where the haze
 * ramp is brightest, so the same range is fitted to the height on offer.
 */
const SKY_VISIBLE_CEILING_DEG = 62
/** Below these a body's whole symbol is under the horizon. Radii are pixels and the scale is pixels per degree, so the quotient is degrees. */
const SUN_FLOOR_DEG = -SUN_DISC_RADIUS / SKY_ALTITUDE_SCALE
const MOON_FLOOR_DEG = -(MOON_GLYPH_SIZE / 2) / SKY_ALTITUDE_SCALE
/** The moon's own ink; the sky's colours are the gradient's, not the canvas's. */
const MOON_INK = '#e6eeff'
const STAR_INK = '#ffffff'
const SUN_INK = '#f0c860'

function disc(ctx: SkySurface, x: number, y: number, r: number, ink: string, alpha: number) {
  if (alpha <= 0) return
  ctx.globalAlpha = alpha
  ctx.fillStyle = ink
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
}

export function drawSky(
  ctx: SkySurface,
  state: SkyState,
  geo: { width: number; height: number; seconds: number; reduceMotion: boolean },
): void {
  const { width, height, seconds, reduceMotion } = geo
  const band = SKY_VISIBLE_CEILING_DEG * SKY_ALTITUDE_SCALE
  const stretch = height / band
  const size = { width, height: band, latitude: state.latitude }
  /** `skyPoint` places into the app's own band; the stretch fits that band to this one. */
  const place = (p: { x: number; y: number }) => ({ x: p.x, y: height - (band - p.y) * stretch })
  const altitude = state.sun?.altDeg ?? -18
  const stars = starOpacity(altitude)

  if (stars > 0) {
    for (const star of state.stars) {
      const haze = starHazeOpacity(star.altDeg)
      if (haze <= 0) continue
      const point = place(skyPoint({ azimuth: star.azDeg, altitude: star.altDeg, span: state.sunSpan, ...size }))
      const radius = Math.max(0.5, 1.6 - 0.3 * star.magnitude)
      disc(ctx, point.x, point.y, radius, STAR_INK,
        stars * haze * starTwinkle(star.index, seconds, reduceMotion))
    }
  }

  // Below the horizon a body is past an edge, so nothing is drawn for it.
  const sunPoint = state.sun && state.sun.altDeg > SUN_FLOOR_DEG
    ? place(skyPoint({ azimuth: state.sun.azDeg, altitude: state.sun.altDeg, span: state.sunSpan, pad: SUN_DISC_RADIUS, ...size }))
    : undefined
  if (sunPoint) {
    disc(ctx, sunPoint.x, sunPoint.y, SUN_GLOW_RADIUS, SUN_INK, 0.24)
    disc(ctx, sunPoint.x, sunPoint.y, SUN_DISC_RADIUS, SUN_INK, 1)
  }

  if (state.moon && state.illumination && state.moon.altDeg > MOON_FLOOR_DEG) {
    const point = place(skyPoint({
      azimuth: state.moon.azDeg, altitude: state.moon.altDeg, span: state.moonSpan,
      pad: MOON_GLYPH_SIZE / 2, ...size,
    }))
    const glare = sunPoint ? Math.hypot(sunPoint.x - point.x, sunPoint.y - point.y) : Infinity
    const visible = moonGlareOpacity(glare)
    if (visible > 0) {
      const fraction = state.illumination.fraction
      disc(ctx, point.x, point.y, moonGlowRadius(fraction), MOON_INK,
        visible * 0.28 * (0.1 + fraction * 0.66))
      drawMoonGlyph(ctx, point.x, point.y, fraction, state.moonLightAngle, visible)
    }
  }
  ctx.globalAlpha = 1
}

/** `rotate` aims the lit limb at the sun; without it a dawn crescent points the wrong way. */
function drawMoonGlyph(
  ctx: SkySurface, cx: number, cy: number, fraction: number, lightAngle: number, alpha: number,
) {
  const r = MOON_GLYPH_SIZE / 2
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = MOON_INK
  ctx.translate(cx, cy)
  ctx.rotate(lightAngle)
  ctx.beginPath()
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2)
  // Non-obvious: the sweep flips at exactly the quarters, where the terminator's bow reverses.
  ctx.ellipse(0, 0, r * Math.abs(1 - 2 * fraction), r, 0, Math.PI / 2, -Math.PI / 2, fraction < 0.5)
  ctx.fill()
  ctx.restore()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/sky-draw.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sky-draw.ts src/lib/sky-draw.test.ts
git commit -m "Draw the sky onto a context-shaped object

The drawing is a pure function over the slice of CanvasRenderingContext2D it
actually uses, because vitest runs in a node environment with no canvas. A
recording stub then asserts the things that matter: stars only at night, no
body drawn below the horizon, every save balanced by a restore."
```

---

### Task 5: The Sky component

**Files:**
- Create: `src/components/Sky.tsx`
- Test: `src/components/Sky.test.tsx`

**Interfaces:**
- Consumes: `SkyState` from `src/lib/sky-state.ts`; `drawSky` from `src/lib/sky-draw.ts`.
- Produces: `<Sky state={SkyState} width={number} height={number} seconds={number} />` — a block sized to `height` in CSS pixels, containing the gradient and the canvas. Its box must equal the size it draws at, or the sky stretches.

The gradient is a DOM element with an inline `background` so it server-renders; only the bodies need the canvas. That is what gives a reader who has not run JavaScript a real night sky rather than a blank rectangle.

- [ ] **Step 1: Write the failing test**

Create `src/components/Sky.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Sky } from './Sky'
import { skyDays, skyState } from '#/lib/sky-state'

const LAT = 48.40618896484375
const LON = -122.64
const days = skyDays(LAT, LON, new Date('2026-09-08T00:00:00Z'), new Date('2026-09-10T00:00:00Z'))
const night = skyState({ time: new Date('2026-09-08T09:38:01Z'), latitude: LAT, longitude: LON, days })

describe('Sky', () => {
  const html = renderToStaticMarkup(<Sky state={night} width={400} height={300} seconds={0} />)

  it('server-renders the gradient, so a reader without JavaScript gets a sky', () => {
    expect(html).toContain('#04060f')
    expect(html).toContain('linear-gradient')
  })

  it('is decorative, and says so', () => {
    expect(html).toContain('aria-hidden="true"')
  })

  it('leaves the bodies to the canvas rather than inventing DOM for them', () => {
    expect(html).toContain('<canvas')
    expect(html).not.toContain('<circle')
  })

  it('takes the box it was told to draw in, so the horizon lands where the caller put it', () => {
    expect(html).toMatch(/height:\s*300px/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/Sky.test.tsx`
Expected: FAIL — `Failed to resolve import "./Sky"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/Sky.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { drawSky } from '#/lib/sky-draw'
import type { SkyState } from '#/lib/sky-state'

/**
 * The sky behind a scrub strip: a gradient with the bodies drawn over it.
 *
 * Takes the whole `SkyState` rather than spread props, the way `SkyBackdrop`
 * does — anything the sky gains later is then a field on one object instead of
 * a new argument at every call site.
 *
 * Decorative, and hidden from assistive technology: the readings are the
 * readout's job, not this one's.
 */
export function Sky({
  state, width, height, seconds,
}: {
  state: SkyState
  width: number
  height: number
  /** Wall-clock seconds, for the twinkle. */
  seconds: number
}) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.current!.width = width * dpr
    canvas.current!.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    drawSky(ctx, state, { width, height, seconds, reduceMotion })
  }, [state, width, height, seconds])

  return (
    // Sized to the height it draws at: the canvas has no viewBox, so a CSS box
    // taller than its backing store stretches the sky and moves the horizon.
    <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height }} aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${state.paint.top}, ${state.paint.bottom})`,
          opacity: state.opacity,
        }}
      />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/components/Sky.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sky.tsx src/components/Sky.test.tsx
git commit -m "Add the Sky component

The gradient is DOM and the bodies are canvas. That split is what lets the sky
prerender: a reader who has not run JavaScript gets a real night gradient
rather than a blank rectangle, on a page whose pitch is that it loads
instantly.

It takes the whole SkyState so that anything the sky gains later is a field on
one object instead of an argument at every call site."
```

---

### Task 6: The intro window and its easing

**Files:**
- Create: `src/lib/scrub.ts`
- Modify: `src/lib/format.ts`
- Test: `src/lib/scrub.test.ts`

**Interfaces:**
- Consumes: `sunEvents` from `@openwaters/almanac`; `Station` from `src/lib/station.ts`.
- Produces:
  - `INTRO_HOLD_SECONDS = 0.8`, `INTRO_SCRUB_SECONDS = 5`, `INTRO_DURATION_SECONDS = 5.8`
  - `introWindow(station: Station, now: Date): { from: Date; to: Date }`
  - `introProgress(elapsedSeconds: number): number`
  - `introTime(from: Date, to: Date, elapsedSeconds: number): Date`
  - `countdown(from: Date, to: Date): string` exported from `src/lib/format.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/scrub.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { INTRO_DURATION_SECONDS, INTRO_HOLD_SECONDS, introProgress, introTime, introWindow } from './scrub'
import { countdown } from './format'
import { HERO_STATION } from './currents'

describe('introWindow', () => {
  it('rests two hours after the sunrise nearest the moment it is given', () => {
    const { to } = introWindow(HERO_STATION, new Date('2026-09-08T18:00:00Z'))
    // Sunrise at Deception Pass on 2026-09-08 is 13:38:01Z.
    expect(to.toISOString()).toMatch(/^2026-09-08T15:38/)
  })

  it('starts four hours before that sunrise, which is dark', () => {
    const { from, to } = introWindow(HERO_STATION, new Date('2026-09-08T18:00:00Z'))
    expect(to.getTime() - from.getTime()).toBe(6 * 3600_000)
    expect(from.toISOString()).toMatch(/^2026-09-08T09:38/)
  })

  it('picks the same window whether the visitor loads before or after that sunrise', () => {
    const early = introWindow(HERO_STATION, new Date('2026-09-08T11:00:00Z'))
    const late = introWindow(HERO_STATION, new Date('2026-09-08T20:00:00Z'))
    expect(early.to.toISOString()).toBe(late.to.toISOString())
  })
})

describe('introProgress', () => {
  it('holds at the start so the star field registers before anything moves', () => {
    expect(introProgress(0)).toBe(0)
    expect(introProgress(INTRO_HOLD_SECONDS)).toBe(0)
  })

  it('eases in and out rather than running at a constant rate', () => {
    expect(introProgress(INTRO_HOLD_SECONDS + 2.5)).toBeCloseTo(0.5)
    expect(introProgress(INTRO_HOLD_SECONDS + 0.5)).toBeLessThan(0.1)
    expect(introProgress(INTRO_HOLD_SECONDS + 4.5)).toBeGreaterThan(0.9)
  })

  it('is finished at the end and stays finished', () => {
    expect(introProgress(INTRO_DURATION_SECONDS)).toBe(1)
    expect(introProgress(600)).toBe(1)
  })
})

describe('introTime', () => {
  const from = new Date('2026-09-08T09:38:00Z')
  const to = new Date('2026-09-08T15:38:00Z')

  it('is the night start until the hold is over', () => {
    expect(introTime(from, to, 0).toISOString()).toBe(from.toISOString())
  })

  it('lands exactly on the rest moment', () => {
    expect(introTime(from, to, INTRO_DURATION_SECONDS).toISOString()).toBe(to.toISOString())
  })
})

describe('countdown', () => {
  it('reads minutes under the hour and hours above it', () => {
    const t = new Date('2026-09-08T12:00:00Z')
    expect(countdown(t, new Date('2026-09-08T12:42:00Z'))).toBe('42m')
    expect(countdown(t, new Date('2026-09-08T14:14:00Z'))).toBe('2h 14m')
  })

  it('floors at zero rather than counting backwards', () => {
    const t = new Date('2026-09-08T12:00:00Z')
    expect(countdown(t, new Date('2026-09-08T11:00:00Z'))).toBe('0m')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/lib/scrub.test.ts`
Expected: FAIL — `Failed to resolve import "./scrub"`.

- [ ] **Step 3: Add `countdown` to `src/lib/format.ts`**

Append to `src/lib/format.ts`:

```ts
/** "42m" / "2h 14m" until `to`, floored at zero. */
export function countdown(from: Date, to: Date): string {
  const minutes = Math.max(Math.floor((to.getTime() - from.getTime()) / 60_000), 0)
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
```

- [ ] **Step 4: Write `src/lib/scrub.ts`**

```ts
import { sunEvents } from '@openwaters/almanac'
import type { Station } from './station'

/** Long enough for the star field to register before anything moves. */
export const INTRO_HOLD_SECONDS = 0.8
export const INTRO_SCRUB_SECONDS = 5
export const INTRO_DURATION_SECONDS = INTRO_HOLD_SECONDS + INTRO_SCRUB_SECONDS

const HOURS_BEFORE_SUNRISE = 4
const HOURS_AFTER_SUNRISE = 2
const DAY_MS = 24 * 3600_000

/**
 * The night-to-morning window the hero scrubs across.
 *
 * It rests after sunrise rather than at the present because half of all visits
 * would otherwise end in darkness. The sunrise is the one nearest `now`, which
 * needs no timezone arithmetic: within twelve hours either side there is
 * exactly one, and it is the station's own.
 */
export function introWindow(station: Station, now: Date): { from: Date; to: Date } {
  const rises = sunEvents(
    new Date(now.getTime() - DAY_MS),
    new Date(now.getTime() + DAY_MS),
    { latitudeDeg: station.latitude, longitudeDeg: station.longitude },
  ).filter((e) => e.kind === 'rise')

  const nearest = rises.reduce<Date | undefined>((best, e) => {
    if (!best) return e.time
    const closer = Math.abs(e.time.getTime() - now.getTime()) < Math.abs(best.getTime() - now.getTime())
    return closer ? e.time : best
  }, undefined)

  // ponytail: a polar station in its own summer or winter has no rise to find;
  // rest at `now` rather than invent one. Revisit if the hero ever moves north.
  const rest = nearest ?? now
  return {
    from: new Date(rest.getTime() - HOURS_BEFORE_SUNRISE * 3600_000),
    to: new Date(rest.getTime() + HOURS_AFTER_SUNRISE * 3600_000),
  }
}

/**
 * Held, then eased, then finished.
 *
 * The app's own `introTime` is linear because a scroll view supplies its
 * easing; this one is driven directly, so the smoothstep is here.
 */
export function introProgress(elapsedSeconds: number): number {
  const t = Math.min(1, Math.max(0, (elapsedSeconds - INTRO_HOLD_SECONDS) / INTRO_SCRUB_SECONDS))
  return t * t * (3 - 2 * t)
}

export function introTime(from: Date, to: Date, elapsedSeconds: number): Date {
  return new Date(from.getTime() + (to.getTime() - from.getTime()) * introProgress(elapsedSeconds))
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/lib/scrub.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/scrub.ts src/lib/scrub.test.ts src/lib/format.ts
git commit -m "Add the intro window and its easing

The scrub rests two hours after sunrise rather than at the present, because
half of all visits would otherwise end in darkness — which is the opposite of
what the hero is for.

The sunrise is the one nearest the moment, which needs no timezone arithmetic:
within twelve hours either side there is exactly one, and it is the station's."
```

---

### Task 7: The current scrub strip

**Files:**
- Create: `src/components/CurrentScrubStrip.tsx`
- Test: `src/components/CurrentScrubStrip.test.tsx`

**Interfaces:**
- Consumes: `Sky` from `src/components/Sky.tsx`; `SkyDays`, `skyState` from `src/lib/sky-state.ts`; `SKY_HORIZON_OVERLAP` from `src/lib/sky.ts`; `predictSeries`, `findEvents`, `nextEvent`, `SLACK_KNOTS` from `src/lib/predict.ts`; `speedColor` from `src/lib/ramp.ts`; `countdown` from `src/lib/format.ts`.
- Produces: `<CurrentScrubStrip station={BundledStation} days={SkyDays} from={Date} to={Date} scrubTime={Date} seconds={number} />` — it measures its own box with a `ResizeObserver` and falls back to 900×620 for the server render.

This is the unit the station pages reuse. It knows a station and a scrub time and **nothing** about why the scrub time is what it is — no pill, no intro, no download.

- [ ] **Step 1: Write the failing test**

Create `src/components/CurrentScrubStrip.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CurrentScrubStrip } from './CurrentScrubStrip'
import { skyDays } from '#/lib/sky-state'
import { HERO_STATION } from '#/lib/currents'

const FROM = new Date('2026-09-08T09:38:00Z')
const TO = new Date('2026-09-08T15:38:00Z')
const days = skyDays(HERO_STATION.latitude, HERO_STATION.longitude, FROM, TO)

// A server render has no layout, so the strip draws in FALLBACK_BOX here.
const render = (scrubTime: Date) =>
  renderToStaticMarkup(
    <CurrentScrubStrip
      station={HERO_STATION} days={days} from={FROM} to={TO}
      scrubTime={scrubTime} seconds={0}
    />,
  )

describe('CurrentScrubStrip', () => {
  it('draws a real path from the station it was given', () => {
    expect(render(FROM)).toMatch(/<path[^>]+d="M[\d.,\-L\s]+"/)
  })

  it('pans the curve so the scrub sits under the centerline', () => {
    const at = (html: string) => Number(html.match(/translate\((-?[\d.]+) 0\)/)![1])
    expect(at(render(FROM))).toBeGreaterThan(at(render(TO)))
  })

  it('paints with attributes, not classes, so a rasteriser can render it', () => {
    expect(render(FROM)).toMatch(/(fill|stroke)="#[0-9A-Fa-f]{6}"/)
  })

  it('clips the fill in screen space, not in the panning curve’s space', () => {
    // A clipPath referenced from inside the translated group pans with it and
    // shears the fill off the trailing edge — invisible to a transform assertion.
    expect(render(TO)).toMatch(/<g clip-path="url\(#above-[^)]+\)"><g transform="translate/)
  })

  it('knows nothing about the landing page', () => {
    // The boundary the station pages depend on: no pill, no download, no intro.
    const html = render(FROM)
    expect(html).not.toMatch(/TestFlight|Slackwater|beta/i)
  })

  it('names its own station for a reader who cannot see it', () => {
    expect(render(FROM)).toContain('Deception Pass (Narrows)')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/CurrentScrubStrip.test.tsx`
Expected: FAIL — `Failed to resolve import "./CurrentScrubStrip"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/CurrentScrubStrip.tsx`:

```tsx
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Sky } from './Sky'
import { SKY_HORIZON_OVERLAP } from '#/lib/sky'
import { skyState } from '#/lib/sky-state'
import type { SkyDays } from '#/lib/sky-state'
import { findEvents, nextEvent, predictSeries, slackWindows } from '#/lib/predict'
import { speedColor } from '#/lib/ramp'
import { countdown } from '#/lib/format'
import type { BundledStation } from '#/lib/station'

/**
 * SVG paint is literal because resvg cannot resolve Tailwind classes; a
 * class-styled chart rasterises blank. These are `--color-sw-foam` and
 * `--color-sw-paper` from `src/styles.css` — change them there and here together.
 */
const CURVE_INK = '#e4f0e4'
const CENTERLINE_INK = '#fcfcfc'

/**
 * The box the strip draws in before it has measured itself — and what the
 * prerender uses, since a server render has no layout to measure.
 */
const FALLBACK_BOX = { width: 900, height: 620 }

/**
 * The strip's own rendered size in CSS pixels.
 *
 * The app reads this from a `GeometryReader` for the same reason: the sky is a
 * projection into whatever box it has, not a fixed-aspect illustration, so
 * drawing at invented dimensions and letting CSS stretch the result puts the
 * horizon in the wrong place.
 */
function useBox(ref: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = useState(FALLBACK_BOX)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setBox({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return box
}

/** Hours across the frame. The app is 18pt/hour, which is about this at phone width. */
const WINDOW_HOURS = 24
/** The plot's share of the frame, matching the app's 150pt of an 850pt screen. */
const PLOT_FRACTION = 0.22
const PLOT_MIN = 140
const PLOT_MAX = 220

export function CurrentScrubStrip({
  station, days, from, to, scrubTime, seconds,
}: {
  station: BundledStation
  days: SkyDays
  /** The sampled span. Stable across frames — the curve is computed once and panned. */
  from: Date
  to: Date
  scrubTime: Date
  seconds: number
}) {
  // Ids must be per-instance: two strips on one page would otherwise both
  // resolve to the first one's gradients, and the second would paint nothing.
  const uid = useId().replace(/:/g, '')
  const frame = useRef<HTMLDivElement>(null)
  const { width, height } = useBox(frame)
  const plot = Math.min(PLOT_MAX, Math.max(PLOT_MIN, height * PLOT_FRACTION))
  const skyHeight = height - plot + SKY_HORIZON_OVERLAP

  // The curve either side of the window, so panning never reaches an empty edge.
  const pad = (WINDOW_HOURS / 2) * 3600_000
  const { path, area, x, events, windows } = useMemo(() => {
    const start = new Date(from.getTime() - pad)
    const hours = (to.getTime() - from.getTime() + 2 * pad) / 3600_000
    const samples = predictSeries(station, start, hours)
    const peak = Math.max(...samples.map((s) => Math.abs(s.level))) || 1
    const perHour = width / WINDOW_HOURS
    const x = (t: Date) => ((t.getTime() - start.getTime()) / 3600_000) * perHour
    const y = (level: number) => plot / 2 - (level / peak) * (plot / 2)
    const points = samples.map((s) => `${x(s.time).toFixed(2)},${y(s.level).toFixed(2)}`)
    return {
      x,
      windows: slackWindows(samples),
      path: `M${points.join('L')}`,
      area: `M${x(start).toFixed(2)},${y(0)}L${points.join('L')}L${x(samples.at(-1)!.time).toFixed(2)},${y(0)}Z`,
      events: findEvents(station, start, hours),
    }
  }, [station, from, to, width, plot, pad])

  const level = levelAt(station, scrubTime)
  // Green is slack and only slack, so it follows `slackWindows` rather than the
  // bare threshold: a lull that dips under it and builds back the way it came
  // never reverses, and colouring it green would promise a transit that never opens.
  const slack = windows.some((w) => scrubTime >= w.start && scrubTime <= w.end)
  const nextSlack = nextEvent(events.filter((e) => e.kind === 'slack'), scrubTime)
  const state = slack ? 'Slack' : level > 0 ? 'Flooding' : 'Ebbing'
  const pan = `translate(${(width / 2 - x(scrubTime)).toFixed(2)} 0)`

  return (
    <div ref={frame} className="relative h-full w-full">
      <Sky state={skyState({ time: scrubTime, latitude: station.latitude, longitude: station.longitude, days })}
        width={width} height={skyHeight} seconds={seconds} />

      <div className="absolute inset-x-0 bottom-0" style={{ height: plot }}>
        <svg viewBox={`0 0 ${width} ${plot}`} className="h-full w-full" role="img"
          aria-label={`Tidal current at ${station.name}, ${state.toLowerCase()}`}>
          <defs>
            <linearGradient id={`flood-${uid}`} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={plot / 2} y2={0}>
              <stop offset="0" stopColor={speedColor(0)} stopOpacity="0.25" />
              <stop offset="1" stopColor={speedColor(1)} stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id={`ebb-${uid}`} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={plot / 2} y2={plot}>
              <stop offset="0" stopColor={speedColor(0)} stopOpacity="0.25" />
              <stop offset="1" stopColor={speedColor(1)} stopOpacity="0.85" />
            </linearGradient>
            {/* Each gradient only spans its own half, so each lobe is clipped to the half it belongs in. */}
            <clipPath id={`above-${uid}`}><rect x={0} y={0} width={width} height={plot / 2} /></clipPath>
            <clipPath id={`below-${uid}`}><rect x={0} y={plot / 2} width={width} height={plot / 2} /></clipPath>
          </defs>
          {/* The clip sits OUTSIDE the pan. A clipPath referenced from inside the
              translated group is resolved in that group's user space, so it pans
              with the curve and shears the fill off the strip's trailing edge. */}
          <g clipPath={`url(#above-${uid})`}>
            <g transform={pan}><path d={area} fill={`url(#flood-${uid})`} /></g>
          </g>
          <g clipPath={`url(#below-${uid})`}>
            <g transform={pan}><path d={area} fill={`url(#ebb-${uid})`} /></g>
          </g>
          <g transform={pan}>
            <path d={path} fill="none" stroke={CURVE_INK} strokeWidth="2" />
          </g>
          <line x1={width / 2} x2={width / 2} y1={0} y2={plot} stroke={CENTERLINE_INK} strokeOpacity="0.5" />
        </svg>
      </div>

      <div className="absolute inset-x-0 flex flex-col items-center text-sw-foam"
        style={{ bottom: plot + 12 }}>
        <p className="text-4xl font-semibold text-sw-foam [font-variant-numeric:tabular-nums]">
          {Math.abs(level).toFixed(1)}<span className="ml-1 text-xl font-normal">kn</span>
        </p>
        <p className={slack ? 'text-sw-go' : 'text-sw-foam'}>{state}</p>
        {nextSlack ? (
          <p className="text-sm text-sw-steel">Slack in {countdown(scrubTime, nextSlack.time)}</p>
        ) : null}
      </div>
    </div>
  )
}

/** The level under the centerline, to the second — the curve's own grid is ten minutes. */
function levelAt(station: BundledStation, at: Date): number {
  const [sample] = predictSeries(station, at, 1 / 3600, 1)
  return sample?.level ?? 0
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/components/CurrentScrubStrip.test.tsx`
Expected: PASS. If the pan assertion fails, check that `x` is computed from the padded `start` and not from `from`.

- [ ] **Step 5: Commit**

```bash
git add src/components/CurrentScrubStrip.tsx src/components/CurrentScrubStrip.test.tsx
git commit -m "Add the current scrub strip

The curve is sampled once across the whole window and panned with a single
transform, so a frame costs one attribute write rather than a re-prediction.

It takes a station and a scrub time and knows nothing about where the scrub
time came from. A test asserts that directly, because this is the piece the
station pages reuse and the expensive mistake is a shared component that turns
out to know about the pill."
```

---

### Task 8: The intro driver and the hero

**Files:**
- Create: `src/lib/use-scrub-intro.ts`
- Create: `src/components/ScrubHero.tsx`
- Test: `src/components/ScrubHero.test.tsx`

**Interfaces:**
- Consumes: `introWindow`, `introTime`, `INTRO_DURATION_SECONDS` from `src/lib/scrub.ts`; `useLiveNow` from `src/lib/use-live-now.ts`; `CurrentScrubStrip`; `TESTFLIGHT` from `src/lib/links.ts`; `HERO_STATION` from `src/lib/currents.ts`; `hhmm` from `src/lib/format.ts`.
- Produces: `useScrubIntro(station, now, live)` returning `{ scrubTime: Date; from: Date; to: Date; seconds: number }`, and `<ScrubHero />`.

`use-scrub-intro.ts` carries no test of its own: every decision it makes lives in `scrub.ts` and is tested there. What remains is a rAF loop, which a node environment cannot run.

- [ ] **Step 1: Write the failing test**

Create `src/components/ScrubHero.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScrubHero } from './ScrubHero'

const html = renderToStaticMarkup(<ScrubHero />)

describe('ScrubHero', () => {
  it('makes no claim about a clock before it has a real one', () => {
    // The server render freezes at SERVER_NOW; a time in this HTML is stale by
    // however long ago the site was built.
    expect(html).not.toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/)
  })

  it('carries the page’s only heading, and the wordmark does not break', () => {
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain('Slackwater')
    expect(html).toMatch(/whitespace-nowrap[^>]*>\s*Slackwater/)
  })

  it('offers the download', () => {
    expect(html).toMatch(/TestFlight|opening soon/)
  })

  it('keeps the station’s name attached to the water it describes', () => {
    expect(html).toContain('Deception Pass (Narrows)')
    expect(html).toContain('/currents/deception-pass-narrows/')
  })

  it('fills the viewport with a dynamic unit, not a static one', () => {
    expect(html).toContain('100dvh')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/ScrubHero.test.tsx`
Expected: FAIL — `Failed to resolve import "./ScrubHero"`.

- [ ] **Step 3: Write the driver**

Create `src/lib/use-scrub-intro.ts`:

```ts
import { useEffect, useMemo, useState } from 'react'
import { INTRO_DURATION_SECONDS, introTime, introWindow } from './scrub'
import type { Station } from './station'

/**
 * Plays the night-to-morning scrub once, then stops.
 *
 * The loop genuinely ends: at rest the sun is up, so no star is drawn and there
 * is nothing left to twinkle. Reduced motion lands on the rest frame without
 * starting it at all.
 *
 * Every decision this makes lives in `scrub.ts`; what is here is the rAF loop.
 */
export function useScrubIntro(station: Station, now: Date, live: boolean) {
  // Keyed on the hour, not the clock: `useLiveNow` hands over a fresh `now`
  // every minute, and the nearest sunrise cannot move within an hour. Keying on
  // `now` would re-run two Almanac event searches a minute — and hand `skyDays`
  // fresh Date identities, re-running two more.
  const hour = Math.floor(now.getTime() / 3600_000)
  const { from, to } = useMemo(() => introWindow(station, now), [station, hour])
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!live) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setElapsed(INTRO_DURATION_SECONDS)
      return
    }
    let frame = 0
    const started = performance.now()
    const tick = (at: number) => {
      const seconds = (at - started) / 1000
      setElapsed(seconds)
      if (seconds < INTRO_DURATION_SECONDS) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [live, from.getTime(), to.getTime()])

  return { from, to, seconds: elapsed, scrubTime: introTime(from, to, elapsed) }
}
```

- [ ] **Step 4: Write the hero**

Create `src/components/ScrubHero.tsx`:

```tsx
import { useMemo } from 'react'
import { CurrentScrubStrip } from './CurrentScrubStrip'
import { skyDays } from '#/lib/sky-state'
import { useScrubIntro } from '#/lib/use-scrub-intro'
import { useLiveNow } from '#/lib/use-live-now'
import { HERO_STATION } from '#/lib/currents'
import { TESTFLIGHT } from '#/lib/links'
import { hhmm } from '#/lib/format'

export function ScrubHero() {
  const { now, live } = useLiveNow()
  const { from, to, scrubTime, seconds } = useScrubIntro(HERO_STATION, now, live)
  const days = useMemo(
    () => skyDays(HERO_STATION.latitude, HERO_STATION.longitude,
      new Date(from.getTime() - 24 * 3600_000), new Date(to.getTime() + 24 * 3600_000)),
    [from, to],
  )

  return (
    <section className="relative w-full overflow-hidden" style={{ height: '100dvh', minHeight: 560 }}>
      <CurrentScrubStrip station={HERO_STATION} days={days} from={from} to={to}
        scrubTime={scrubTime} seconds={seconds} />

      <div className="absolute inset-x-0 top-0 flex justify-center px-5 pt-10 sm:pt-16">
        <div className="max-w-xl rounded-2xl border border-white/15 bg-sw-navy-deep/40 px-6 py-5 text-center backdrop-blur-sm">
          <h1 className="whitespace-nowrap text-4xl font-semibold tracking-tight text-sw-paper sm:text-5xl">
            Slackwater
          </h1>
          <p className="mt-3 text-lg leading-snug text-sw-foam">
            All tide and current predictions, offline on your phone.
          </p>
          <div className="mt-5">
            {TESTFLIGHT ? (
              <a href={TESTFLIGHT}
                className="inline-block rounded-md bg-sw-leaf px-5 py-3 font-medium text-sw-navy-deep transition hover:bg-sw-leaf/90">
                Get the beta on TestFlight
              </a>
            ) : (
              <span className="inline-block rounded-md border border-sw-leaf/30 px-5 py-3 font-medium text-sw-steel">
                iPhone beta — opening soon
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="absolute inset-x-0 bottom-0 px-5 pb-5 text-center font-mono text-[0.65rem] uppercase tracking-[0.14em] text-sw-foam/70">
        <a href="/currents/deception-pass-narrows/" className="underline underline-offset-4">
          {HERO_STATION.name}
        </a>
        {/* Gated on `live`: a time in the prerendered HTML is stale by however long ago the site was built. */}
        {live ? <> · {hhmm(scrubTime, HERO_STATION.timezone)}</> : null}
        {' '}· computed in this browser
      </p>
    </section>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/components/ScrubHero.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/use-scrub-intro.ts src/components/ScrubHero.tsx src/components/ScrubHero.test.tsx
git commit -m "Add the scrub hero and its intro driver

The intro sits in its own hook rather than in the strip. A station page
scrubbing to the present has no use for a marketing opening, and a strip that
assumed one would force it on every page that reused it.

The caption's clock renders only once `live` is true. The server render
freezes at SERVER_NOW, so a time baked into that HTML is stale by however long
ago the site was built and drifts further every day."
```

---

### Task 9: Put the hero on the page

**Files:**
- Modify: `src/routes/index.tsx:68-135`

**Interfaces:**
- Consumes: `ScrubHero` from `src/components/ScrubHero.tsx`.
- Produces: the landing page.

- [ ] **Step 1: Replace the header, the CTA and the old hero section**

In `src/routes/index.tsx`, delete the `Cta` function, the `<header>` block and the `hero-station` `<section>` — everything from the start of `Home`'s return through the closing tag of that section. Keep `Eyebrow`. The `<main>` becomes a fragment so the hero can be full-bleed while the rest stays in the container:

```tsx
function Home() {
  return (
    <>
      <ScrubHero />
      <main className="mx-auto max-w-5xl px-5 pb-24 sm:px-6">
        {/* ── Correctness first, per gtm.md's ordering ───────────────────── */}
        <section className="mt-20 sm:mt-28">
```

Everything from "Currents, not just tides" down is untouched. Close the `<main>` and the fragment after the footer.

- [ ] **Step 2: Drop the imports the page no longer uses**

Remove `CurrentCurve`, `TESTFLIGHT`, `useLiveNow` and `HERO_STATION` from the imports at the top of `src/routes/index.tsx`; add `import { ScrubHero } from '#/components/ScrubHero'`. Keep `Shot` and `SITE_DESCRIPTION`.

- [ ] **Step 3: Typecheck and build**

```bash
pnpm build && pnpm typecheck
```

Expected: both clean. `pnpm typecheck` must run **after** `pnpm build`, because `src/routeTree.gen.ts` is generated and git-ignored.

- [ ] **Step 4: Run the whole suite, including the build-dependent budgets**

```bash
pnpm test
```

Expected: PASS, with `src/lib/bundle-size.test.ts` included now that `.output/public` exists. That suite is what catches Almanac or the star catalogue arriving heavier than expected.

- [ ] **Step 5: Look at it**

```bash
pnpm dev
```

Open `http://localhost:5174`. Confirm, and do not skip any of these:
- It opens on a dark sky with a visible star field, holds briefly, then scrubs to a lit morning and stops.
- The moon's crescent points at the sun.
- The curve pans leftward under the centerline as the scrub advances.
- The pill, the readout and the caption are all legible against the sky at both ends of the animation.
- Scrolling reaches "Currents, not just tides" and everything below it, unchanged.
- With Reduce Motion on in System Settings, the page lands on the lit morning frame immediately and never animates.

- [ ] **Step 6: Commit**

```bash
git add src/routes/index.tsx
git commit -m "Open the landing page on the scrubber

The page's argument is that the predictions are real and need no server. The
app's own scrub view, running on a real station against bundled constituents
with real astronomy over it, demonstrates that rather than asserting it."
```

- [ ] **Step 7: Open the pull request**

```bash
git push -u origin feat/full-bleed-scrubber
gh pr create --title "Open the landing page on the app's scrubber" --body "$(cat <<'BODY'
The landing page opens on a full-bleed rendering of the app's scrub view — the sky over a real current curve for Deception Pass (Narrows), filling the viewport. It loads at night, scrubs through dawn over about six seconds, and rests two hours after sunrise. Scrolling reaches the sections the page already carried, unchanged.

The sky is new to the web. It is the app's own `Theme.swift` maths — the five twilight anchors, the fixed altitude scale, the rise-to-set azimuth fit that puts east on the right because the frame is a timeline rather than a compass — over the app's own 288-star catalogue, computed in the browser from `@openwaters/almanac`. Nothing is fetched to draw any of it, so `src/content/privacy.md` is unchanged.

The modules are built for the station pages to reuse, which is a separate spec. `skyDays` runs once per window and `skyState` once per frame, because an Almanac event search costs about two orders of magnitude more than a position lookup. The intro lives in its own hook so a station page scrubbing to the present does not inherit it. `CurrentScrubStrip` has a test asserting it knows nothing about the pill.

Eclipses are deferred rather than declined — they ship with the station pages, since an eclipse is a thing people share. `Sky` takes a whole `SkyState` so that adding them is a field on one object, and the search will go in `skyDays`.

Design: `docs/superpowers/specs/2026-09-08-full-bleed-scrubber-design.md`
Plan: `docs/superpowers/plans/2026-09-08-full-bleed-scrubber.md`

- [ ] Looked at on the preview URL, at both ends of the animation
- [ ] Checked with Reduce Motion on
BODY
)"
```

The PR preview workflow publishes a `pr-<n>` URL on the run. AGENTS.md requires a screenshot for anything visible, so attach two — the night frame and the rest frame — and link the preview URL alongside them, because a still cannot show a six-second scrub.

**Never merge this PR yourself.**

---

## Self-Review

**Spec coverage.** Layout — Task 7 (plot fraction, horizon overlap, 24-hour window) and Task 8 (`100dvh`, pill, caption). Canvas-behind-SVG — Tasks 4 and 5. Sky port — Task 2, including the note that the projection is the app's. Cost — measured in Task 3's step 5. Eclipse seam — held by `Sky` taking a whole `SkyState` in Task 5, with no placeholder argument anywhere. Scrub clock — Task 6. Pill, readout, caption and the `live` gate — Tasks 7 and 8, asserted in Task 8's first test. Station — `HERO_STATION` throughout. Modules — Tasks 2 through 8, one per module. Verification — Task 9 steps 3 to 5.

**One divergence from the spec, deliberate.** The spec lists `Sky.tsx` as owning the drawing. Vitest runs `environment: 'node'` with no canvas, so the drawing is extracted to `src/lib/sky-draw.ts` and tested with a recording stub. `Sky.tsx` is still the only thing that touches a real canvas.

**One divergence from the app, deliberate.** `Timeline.introTime` is linear because a `UIScrollView` supplies its easing. Nothing here has one, so `introProgress` carries a hold and a smoothstep. Noted at the function.

**Types.** `SkyState` is produced by `skyState` (Task 3) and consumed by `drawSky` (Task 4) and `Sky` (Task 5). `SkyDays` is produced by `skyDays` (Task 3) and consumed by `CurrentScrubStrip` (Task 7) and `ScrubHero` (Task 8). `HorizonSpan` is defined in Task 2 and used in Task 3. `introWindow` returns `{ from, to }`, consumed under those names in Tasks 7 and 8. `countdown` is added in Task 6 and used in Task 7.
