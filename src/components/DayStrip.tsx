import { useMemo } from 'react'
import { sunEvents } from '@openwaters/almanac'
import { CurrentCurve } from './CurrentCurve'
import { TideCurve } from './TideCurve'
import { datumLine } from '#/lib/copy'
import { chartTime, compass16, height } from '#/lib/format'
import {
  findEvents,
  nextEvent,
  predictSeries,
  slackWindows,
  tideExtremes,
  type Sample,
  type StationEvent,
} from '#/lib/predict'
import type { BundledStation, ChsStation } from '#/lib/station'

/**
 * One station-local day, held still: the curve, a reading of the water now,
 * and the day's sunrise and sunset under it.
 *
 * A composer, not a third curve. `TideCurve` and `CurrentCurve` already draw
 * the highs, lows, slacks, maxima and the now line; this adds only what a
 * whole day needs around them. There is no centreline and nothing to drag —
 * the app's scrub view is the interactive one, and this page exists to send a
 * reader to it.
 *
 * `start` is a prop, not derived inside: an eclipse page passes the eclipse
 * night, a Canadian page passes the window DFO sent.
 */
type Props = {
  start: Date
  hours: number
  now: Date
  /** Is `now` the reader's own clock? Only then may the strip read the water "now". */
  live: boolean
} & (
  | { station: BundledStation; fetched?: never }
  | { station: ChsStation; fetched: Fetched }
)

/** A Canadian day, as DFO published it — see `Curve` in StationPage. */
export type Fetched =
  | { kind: 'current'; samples: Sample[]; events: StationEvent[] }
  | { kind: 'tide'; samples: Sample[]; high: Sample; low: Sample }

export function DayStrip(props: Props) {
  const { station, start, hours, now, live } = props
  const end = new Date(start.getTime() + hours * 3600_000)
  const today = now >= start && now < end

  return (
    <div className="relative">
      {live && today && station.source === 'bundled' && (
        <div className="mb-4 flex justify-center">
          {station.kind === 'tide' ? (
            <TideLead station={station} now={now} />
          ) : (
            <CurrentLead station={station} now={now} />
          )}
        </div>
      )}
      {/* `props.fetched`, not the destructured `station`: narrowing one field of
          a discriminated union does not narrow a sibling pulled out of it. */}
      {props.fetched ? (
        props.fetched.kind === 'tide' ? (
          <TideCurve station={props.station} start={start} hours={hours} now={now}
            samples={props.fetched.samples} high={props.fetched.high} low={props.fetched.low} />
        ) : (
          <CurrentCurve station={props.station} start={start} hours={hours} now={now}
            samples={props.fetched.samples} events={props.fetched.events} />
        )
      ) : props.station.kind === 'tide' ? (
        <TideCurve station={props.station} start={start} hours={hours} now={now} />
      ) : (
        <CurrentCurve station={props.station} start={start} hours={hours} now={now} />
      )}
      <SunRow station={station} start={start} end={end} />
      {/* A bundled page names its datum under Station facts. A Canadian page
          may only say this once the curve is on screen, which is the one
          moment this strip exists — see `datumLine` for the wording. */}
      {station.source === 'chs' && station.kind === 'tide' && (
        <p className="mt-3 text-sm text-sw-steel">{datumLine(station)}</p>
      )}
    </div>
  )
}

/**
 * Sunrise and sunset at their true x under the plot, in the app's inks. A
 * polar day or night has neither, and the row goes quiet rather than guessing.
 */
function SunRow({ station, start, end }: { station: BundledStation | ChsStation; start: Date; end: Date }) {
  const events = useMemo(() => {
    try {
      return sunEvents(start, end, { latitudeDeg: station.latitude, longitudeDeg: station.longitude })
        .filter((e) => e.kind === 'rise' || e.kind === 'set')
    } catch {
      return []
    }
  }, [station.latitude, station.longitude, start.getTime(), end.getTime()])
  if (!events.length) return null
  const span = end.getTime() - start.getTime()
  return (
    <div className="relative h-5 font-mono text-[11px] tabular-nums">
      {events.map((e) => (
        <span
          key={e.time.getTime()}
          className={`absolute -translate-x-1/2 whitespace-nowrap ${e.kind === 'rise' ? 'text-sw-sunrise' : 'text-sw-sunset'}`}
          style={{ left: `${((e.time.getTime() - start.getTime()) / span) * 100}%` }}
        >
          {e.kind === 'rise' ? '↑' : '↓'}{chartTime(e.time, station.timezone)}
        </span>
      ))}
    </div>
  )
}

/** The level at one instant, to the second — the curve's own grid is ten minutes. */
function levelAt(station: BundledStation, at: Date): number {
  return predictSeries(station, at, 1 / 3600, 1)[0]?.level ?? 0
}

/**
 * The app's lead card for a tide: the state, the height as the only large
 * thing, the time under it, and what comes next.
 */
function TideLead({ station, now }: { station: BundledStation; now: Date }) {
  const level = levelAt(station, now)
  const rising = levelAt(station, new Date(now.getTime() + 600_000)) > level
  const next = tideExtremes(station, now, 24)[0]
  return (
    <Lead
      state={rising ? 'Rising' : 'Falling'}
      tone={rising ? 'text-sw-flood' : 'text-sw-ebb'}
      value={height(level)}
      unit="ft"
      at={now}
      timeZone={station.timezone}
      next={next && `${next.high ? 'High' : 'Low'} in ${until(next.time, now)}`}
    />
  )
}

/** The same card for a current: state and set lead, speed is the large thing. */
function CurrentLead({ station, now }: { station: BundledStation; now: Date }) {
  const level = levelAt(station, now)
  // Green is slack and only slack, so it follows `slackWindows` rather than the
  // bare threshold: a lull that dips under it and builds back the way it came
  // never reverses.
  const windows = slackWindows(predictSeries(station, new Date(now.getTime() - 3 * 3600_000), 6))
  const slack = windows.some((w) => now >= w.start && now <= w.end)
  const set = level > 0 ? station.floodDirection : station.ebbDirection
  const next = nextEvent(findEvents(station, now, 24), now)
  return (
    <Lead
      state={slack ? 'Slack' : level > 0 ? 'Flooding' : 'Ebbing'}
      tone={slack ? 'text-sw-go' : level > 0 ? 'text-sw-flood' : 'text-sw-ebb'}
      detail={slack || set === undefined ? undefined : compass16(set)}
      value={Math.abs(level).toFixed(1)}
      unit="kn"
      at={now}
      timeZone={station.timezone}
      next={next && `${next.kind === 'slack' ? 'Slack' : `Max ${next.kind}`} in ${until(next.time, now)}`}
    />
  )
}

function Lead({
  state, tone, detail, value, unit, at, timeZone, next,
}: {
  state: string
  tone: string
  detail?: string
  value: string
  unit: string
  at: Date
  timeZone: string
  next?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-white">
      <p className="text-[0.8125rem] font-semibold text-white/85">
        {state}
        {detail && <span className={`ml-1.5 ${tone}`}>{detail}</span>}
      </p>
      <p className="text-[2.75rem] font-medium leading-none tabular-nums">
        {value}
        <span className="ml-1 text-[1.375rem] font-light">{unit}</span>
      </p>
      <p className="text-xs tabular-nums text-white/85">{chartTime(at, timeZone)}</p>
      {next && (
        <p className="mt-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">{next}</p>
      )}
    </div>
  )
}

function until(then: Date, now: Date) {
  const mins = Math.max(0, Math.round((then.getTime() - now.getTime()) / 60_000))
  const h = Math.floor(mins / 60)
  return h ? `${h}h ${mins % 60}m` : `${mins}m`
}
