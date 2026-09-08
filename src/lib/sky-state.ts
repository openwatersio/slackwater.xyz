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
