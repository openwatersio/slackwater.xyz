import { useCallback, useEffect, useRef } from 'react'
import { CurrentScrubber, TideScrubber } from '@slackwater/react'
import { SLACK_KNOTS } from '#/lib/predict'
import type { Readings } from '#/lib/readings'
import type { Station } from '#/lib/station'

/**
 * The clock and calendar language of every strip. Fixed rather than the
 * reader's, because the server render and the hydrating browser must format
 * the same moment the same way, and the rest of the page speaks en-US.
 */
export const STRIP_LOCALE = 'en-US'

/**
 * How far the strip reaches either side of the station-local start of the
 * day it opens on: 96 hours back and 180 ahead, the window the package's own
 * station page loads.
 */
export const STRIP_BEFORE_HOURS = 96
export const STRIP_AFTER_HOURS = 180

interface Props {
  station: Station
  readings: Readings
  /** A finite window — one CHS day — rather than the continuous strip. */
  bounded?: boolean
  /**
   * The reader's clock in ms, and only once it is theirs. Left out of the
   * server render, so the HTML draws no now dot, no Today and no Now pill;
   * the browser adds them when it reads its own clock.
   */
  now?: number
  /** The moment a shared link points at, in ms. The server render opens on it too. */
  selected?: number
  /**
   * Each moment the strip moves to after it opens. The package's own
   * `onSelect` also reports where it opened — the shared moment, or now —
   * which is no move; that first report is dropped here, once per mount, so a
   * strip that remounts drops its own opening too.
   */
  onMove?: (time: number) => void
  onNow?: (time: number) => void
  /**
   * Every moment the strip reads, the one it opens on included, for the tiles
   * under it: once it has the reader's clock or a shared moment, since before
   * that it may open clamped to a window built around the build's clock. The
   * last moment it read before then is passed on when the clock arrives.
   */
  onReading?: (time: number) => void
}

/** A station's strip: `@slackwater/react`'s tide or current strip, fed the site's own numbers. */
export function StationStrip({ station, readings, bounded, now, selected, onMove, onNow, onReading }: Props) {
  const opened = useRef(false)
  const move = useRef(onMove)
  move.current = onMove
  const read = useRef(onReading)
  read.current = onReading
  const ours = now !== undefined || selected !== undefined
  const known = useRef(ours)
  known.current = ours
  // The last moment the strip read, and whether the tiles have heard it.
  const last = useRef<{ time: number; told: boolean } | undefined>(undefined)
  // Stable, because the package reports again whenever `onSelect` changes.
  const onSelect = useCallback((time: number) => {
    last.current = { time, told: known.current }
    if (known.current) read.current?.(time)
    if (opened.current) move.current?.(time)
    opened.current = true
  }, [])
  useEffect(() => {
    if (!ours || !last.current || last.current.told) return
    last.current.told = true
    read.current?.(last.current.time)
  }, [ours])
  const common = {
    timezone: station.timezone,
    latitude: station.latitude,
    longitude: station.longitude,
    locale: STRIP_LOCALE,
    bounded,
    now,
    selected,
    onSelect,
    onNow,
  }
  if (readings.kind === 'tide') {
    // Feet above chart datum: the site's corpus converts at build time and
    // `iwls.ts` converts DFO's metres on arrival. Every bundled tide station
    // names a chart datum (`catalogue.test.ts` checks), so this marks 0 for
    // all of them; the check only keeps a nameless one from claiming a datum.
    const chartDatum = station.source === 'chs' || Boolean(station.chartDatum)
    return <TideScrubber {...common} timeline={readings.timeline} extremes={readings.extremes} units="feet" chartDatum={chartDatum} />
  }
  const directions = station.source === 'bundled' ? { flood: station.floodDirection, ebb: station.ebbDirection } : undefined
  return (
    <CurrentScrubber {...common} timeline={readings.timeline} events={readings.events} directions={directions} threshold={SLACK_KNOTS} />
  )
}
