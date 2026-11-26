import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  RangeOutlook, SummaryTiles, fortnightWindow, nextMaxTile, outlookWindow, rangeTile, swingHeights, useOutlookWeek,
  type Extreme,
} from '@slackwater/react'
import { STRIP_LOCALE } from './StationStrip'
import { findEvents, tideExtremes } from '#/lib/predict'
import { currentEvent, extreme, type Readings } from '#/lib/readings'
import type { BundledStation, Station } from '#/lib/station'

/**
 * The strip's moment, for the tiles alone: the strip reports every frame of a
 * drag, and only the tiles read each one, so the page around them doesn't
 * re-render as the strip moves.
 */
export interface MomentStore {
  get: () => number | undefined
  set: (time: number) => void
  subscribe: (onChange: () => void) => () => void
}

/** A page's `MomentStore`, starting on the moment its server render opens on, or none. */
export function useMomentStore(initial?: number): MomentStore {
  const [store] = useState<MomentStore>(() => {
    let value = initial
    const listeners = new Set<() => void>()
    return {
      get: () => value,
      set: (time) => {
        if (time === value) return
        value = time
        for (const l of listeners) l()
      },
      subscribe: (onChange) => {
        listeners.add(onChange)
        return () => listeners.delete(onChange)
      },
    }
  })
  return store
}

/** `predict.ts`'s start and length for a package window. */
const span = (window: { start: string; end: string }) => ({
  start: new Date(window.start),
  hours: (Date.parse(window.end) - Date.parse(window.start)) / 3600_000,
})

/**
 * The strip's own highs and lows and the hours they cover: from its first
 * sample to its last, inside which a merged port's strip holds CHS's turns and
 * the seam's eased ones in place of the computed ones.
 */
export interface StripTurns {
  from: number
  to: number
  extremes: Extreme[]
}

/**
 * The strip's readings as `StripTurns`, for a tide. A current's are never
 * spliced: no current is merged with CHS (`catalogue.test.ts` fails if one
 * is), so a computed current's strip holds only computed events.
 */
export function stripTurns(readings: Readings): StripTurns | undefined {
  if (readings.kind !== 'tide' || !readings.timeline.length) return undefined
  return {
    from: readings.timeline[0].time.getTime(),
    to: readings.timeline[readings.timeline.length - 1].time.getTime(),
    extremes: readings.extremes,
  }
}

/**
 * A tide's computed highs and lows over a window, with the strip's own turns
 * in their place over the hours the strip covers. So a merged port's Range is
 * ranked, and its bars measured, against the same turns the strip and the
 * 7-day table give, CHS's and the seam's included, and never against a
 * computed twin the seam dropped.
 */
export function splicedExtremes(station: BundledStation, window: { start: string; end: string }, strip?: StripTurns): Extreme[] {
  const { start, hours } = span(window)
  const computed = tideExtremes(station, start, hours).map(extreme)
  if (!strip) return computed
  const end = start.getTime() + hours * 3600_000
  const at = (t: Extreme) => t.time.getTime()
  return [
    ...computed.filter((t) => at(t) < strip.from || at(t) > strip.to),
    ...strip.extremes.filter((t) => at(t) >= start.getTime() && at(t) <= end),
  ].sort((a, b) => at(a) - at(b))
}

/**
 * The moment a computed station's tiles rank against: the first moment they
 * read, held while the strip's moment stays in the fifteen days either side,
 * so each reading is compared with the same month. A moment outside it, after
 * Now from a far shared link or on a page left open for weeks, starts again.
 */
export function rankedAround(held: number | undefined, time: number | undefined, timeZone: string): number | undefined {
  if (time === undefined) return held
  if (held === undefined) return time
  const window = fortnightWindow(held, timeZone)
  return time >= Date.parse(window.start) && time < Date.parse(window.end) ? held : time
}

/**
 * What a computed station's number ranks against over `fortnightWindow(around)`:
 * a tide's swings, from `splicedExtremes`, or a current's slacks and maxima.
 * A current's lulls are left out, since the ranking reads only its maxima.
 */
export function fortnightOf(station: BundledStation, around: number, strip?: StripTurns) {
  const window = fortnightWindow(around, station.timezone)
  if (station.kind === 'tide') return { kind: 'tide' as const, swings: swingHeights(splicedExtremes(station, window, strip)) }
  const { start, hours } = span(window)
  return {
    kind: 'current' as const,
    events: findEvents(station, start, hours).map((e) => currentEvent(e, e.kind === 'flood' ? station.floodDirection : station.ebbDirection)),
  }
}

/** How long the strip must rest before the month's ranking runs: longer than its 650 ms opening glide. */
const RANK_DELAY_MS = 1000

interface Props {
  station: Station
  /** The strip's own readings, so a tile names the turns the strip draws. */
  readings: Readings
  moment: MomentStore
  /** The moment the server render opened on; the first browser render reads it too. */
  initial?: number
}

type Ranked = { around: number; strip?: StripTurns; fortnight: ReturnType<typeof fortnightOf> }

/**
 * `@slackwater/react`'s summary tiles under the strip, as in the app: the
 * station's own number, Range or Next max, beside the Moon and the Sun, read
 * at the strip's moment. A page with no moment yet, the server render of a
 * station's own page, reads nothing until the browser opens the strip.
 *
 * A computed station's number is ranked against its month (`rankedAround`)
 * in the browser only, once the strip's moment has held still a second: a month of turns
 * is too much to compute for every shared link the Worker renders, or during
 * the strip's opening glide or a drag. Until then the number reads unranked,
 * as a CHS-only day's always does.
 */
export function StationTiles({ station, readings, moment, initial }: Props) {
  // `StationStrip` reports only once it has the reader's clock or a shared
  // moment, so every moment here may seed the month. A strip whose window
  // can't reach the reader's clock never reports a clamped moment: it is
  // remounted on the reader's own day first (`stripAnchor` in `StationPage`).
  const time = useSyncExternalStore(moment.subscribe, moment.get, () => initial)
  const tz = station.timezone
  const computed = station.source === 'bundled' ? station : undefined
  const strip = useMemo(() => stripTurns(readings), [readings])
  const [ranked, setRanked] = useState<Ranked>()
  // The moment waiting to be ranked around: the first one offered outside the
  // held month, not whichever the strip passes through before the timer fires,
  // and forgotten if the strip comes back inside the held month first.
  const pending = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!computed) return
    const held = ranked?.around
    const next = rankedAround(held, time, tz)
    if (next === undefined) return
    if (next === held) {
      pending.current = undefined
      // New readings, a CHS day or a moved window, re-rank the same month.
      if (ranked?.strip === strip) return
    } else if (pending.current === undefined || rankedAround(pending.current, next, tz) !== pending.current) {
      pending.current = next
    }
    // Both the month's turns and the re-rank wait for the strip to rest.
    const timer = setTimeout(() => {
      const around = pending.current ?? next
      pending.current = undefined
      setRanked({ around, strip, fortnight: fortnightOf(computed, around, strip) })
    }, RANK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [computed, ranked, time, tz, strip])
  // Only while it still applies: a month the moment has left, or one ranked
  // before the strip's turns changed, would mark a reading against the wrong
  // water for the second until the new one is ranked. Unranked until then.
  const fortnight =
    ranked && ranked.strip === strip && rankedAround(ranked.around, time, tz) === ranked.around
      ? ranked.fortnight
      : undefined
  const primary = readings.kind === 'tide'
    ? rangeTile(readings.extremes, time, fortnight?.kind === 'tide' ? fortnight.swings : undefined, 'feet', STRIP_LOCALE)
    : nextMaxTile(readings.events, time, fortnight?.kind === 'current' ? fortnight.events : undefined, tz, STRIP_LOCALE)
  return (
    <SummaryTiles
      className="mt-4"
      time={time}
      timezone={tz}
      latitude={station.latitude}
      longitude={station.longitude}
      locale={STRIP_LOCALE}
      primary={primary}
      outlook={computed?.kind === 'tide' && (
        <Outlook station={computed} strip={strip} time={time} start={initial ?? time} />
      )}
    />
  )
}

/**
 * The Range tile's week of bars, from `splicedExtremes`. It starts on the day
 * the page opened on, a shared link's or the reader's own, as the package's
 * station page starts on the day it opened. With no moment it holds its place
 * and says nothing, since the server render would otherwise describe the week
 * the site was built in.
 */
function Outlook({ station, strip, time, start }: {
  station: BundledStation
  strip?: StripTurns
  time?: number
  /** The moment whose day starts the week. */
  start?: number
}) {
  const tz = station.timezone
  // Held from the first moment, so a drag doesn't restart the week.
  const [opened, setOpened] = useState(start)
  if (opened === undefined && start !== undefined) setOpened(start)
  // Any moment in the day will do: the package finds the day's start by its
  // own rule, which a day whose midnight a clock change skips depends on.
  const week = useOutlookWeek(opened ?? 0, time, tz)
  const read = time !== undefined && opened !== undefined
  const extremes = useMemo(
    () => (read ? splicedExtremes(station, outlookWindow(week, tz), strip) : undefined),
    [read, station, week, tz, strip],
  )
  return <RangeOutlook week={week} extremes={extremes} units="feet" time={time} timezone={tz} locale={STRIP_LOCALE} />
}
