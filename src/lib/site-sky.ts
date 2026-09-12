import { moonAltAz, moonEvents, moonIllumination, sunAltAz, sunEvents } from '@openwaters/almanac'
import type { Appearance, Observer } from './theme'

export interface SkyPaint { top: string; bottom: string }
export interface SkyBody { x: number; y: number }
export interface MoonBody extends SkyBody { fraction: number; lightAngle: number }
export interface SkyFrame { paint: SkyPaint; sun?: SkyBody; moon?: MoonBody }

const SKY_ANCHORS = [
  { altitude: 10, top: '#2f7fd4', bottom: '#bde3fb' },
  { altitude: 0, top: '#2b4a7a', bottom: '#f8a15f' },
  { altitude: -6, top: '#17264a', bottom: '#8d4a63' },
  { altitude: -12, top: '#0b1430', bottom: '#2a2a52' },
  { altitude: -18, top: '#04060f', bottom: '#0b1023' },
] as const

type RiseSet = { kind: 'rise' | 'set'; time: Date }
type Events = { sun: RiseSet[]; moon: RiseSet[] }
const eventsByDay = new Map<string, Events>()

export function skyPaint(altitude: number): SkyPaint {
  const first = SKY_ANCHORS[0]
  const last = SKY_ANCHORS.at(-1)!
  if (altitude >= first.altitude) return { top: first.top, bottom: first.bottom }
  if (altitude <= last.altitude) return { top: last.top, bottom: last.bottom }
  const lower = SKY_ANCHORS.find((anchor) => altitude >= anchor.altitude)!
  const upper = SKY_ANCHORS[SKY_ANCHORS.indexOf(lower) - 1]!
  const progress = (upper.altitude - altitude) / (upper.altitude - lower.altitude)
  return { top: mix(upper.top, lower.top, progress), bottom: mix(upper.bottom, lower.bottom, progress) }
}

export function stylizedSky(appearance: Appearance): SkyFrame {
  return appearance === 'light'
    ? { paint: skyPaint(10), sun: { x: 0.72, y: 0.18 } }
    : { paint: skyPaint(-18), moon: { x: 0.72, y: 0.18, fraction: 1, lightAngle: 0 } }
}

export function locationSky(observer: Observer, at: Date): SkyFrame {
  try {
    const almanacObserver = { latitudeDeg: observer.latitude, longitudeDeg: observer.longitude }
    const sun = sunAltAz(at, almanacObserver)
    const moon = moonAltAz(at, almanacObserver)
    const events = eventsFor(observer, at, almanacObserver)
    const frame: SkyFrame = { paint: skyPaint(sun.altDeg) }
    if (sun.altDeg >= 0) frame.sun = bodyAt(sun.altDeg, events.sun, at)
    if (sun.altDeg < 0 && moon.altDeg >= 0) {
      const body = bodyAt(moon.altDeg, events.moon, at)
      if (body) {
        const illumination = moonIllumination(at)
        frame.moon = {
          ...body,
          fraction: illumination.fraction,
          lightAngle: Math.atan2(sun.altDeg - moon.altDeg, sun.azDeg - moon.azDeg),
        }
      }
    }
    return frame
  } catch {
    return { paint: skyPaint(-18) }
  }
}

export function transitionSky(from: SkyFrame, to: SkyFrame, progress: number): SkyFrame {
  const amount = clamp(progress)
  if (amount === 0) return from
  if (amount === 1) return to
  return {
    paint: { top: mix(from.paint.top, to.paint.top, amount), bottom: mix(from.paint.bottom, to.paint.bottom, amount) },
    sun: transitionBody(from.sun, to.sun, amount),
    moon: transitionBody(from.moon, to.moon, amount),
  }
}

function eventsFor(observer: Observer, at: Date, almanacObserver: { latitudeDeg: number; longitudeDeg: number }): Events {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
  const key = `${observer.latitude},${observer.longitude},${day.getTime()}`
  const cached = eventsByDay.get(key)
  if (cached) return cached
  const start = new Date(day.getTime() - 24 * 60 * 60 * 1000)
  const end = new Date(day.getTime() + 48 * 60 * 60 * 1000)
  const events = {
    sun: sunEvents(start, end, almanacObserver).filter(isRiseSet),
    moon: moonEvents(start, end, almanacObserver),
  }
  eventsByDay.set(key, events)
  return events
}

function bodyAt(altitude: number, events: RiseSet[], at: Date): SkyBody | undefined {
  const rise = [...events].reverse().find((event) => event.kind === 'rise' && event.time <= at)
  const set = events.find((event) => event.kind === 'set' && event.time > at)
  if (!rise || !set) return undefined
  return {
    x: clamp((at.getTime() - rise.time.getTime()) / (set.time.getTime() - rise.time.getTime())),
    y: 0.82 * (1 - clamp(altitude / 90)),
  }
}

function transitionBody<T extends SkyBody>(from: T | undefined, to: T | undefined, progress: number): T | undefined {
  if (from && to) return { ...to, x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress }
  if (from) return { ...from, x: from.x + (-0.05 - from.x) * progress }
  if (to) return { ...to, x: 1.05 + (to.x - 1.05) * progress }
  return undefined
}

function isRiseSet(event: ReturnType<typeof sunEvents>[number]): event is RiseSet {
  return event.kind === 'rise' || event.kind === 'set'
}

function mix(from: string, to: string, progress: number): string {
  const amount = clamp(progress)
  const channels = [1, 3, 5].map((offset) => Math.round(
    Number.parseInt(from.slice(offset, offset + 2), 16) +
    (Number.parseInt(to.slice(offset, offset + 2), 16) - Number.parseInt(from.slice(offset, offset + 2), 16)) * amount,
  ).toString(16).padStart(2, '0'))
  return `#${channels.join('')}`
}

function clamp(value: number) { return Math.min(1, Math.max(0, value)) }
