import { useEffect, useState } from 'react'
import { CurrentCurve } from './CurrentCurve'
import { TideCurve } from './TideCurve'
import { useLiveNow } from '#/lib/use-live-now'
import { fetchBrowserChsDay, hasChsDay } from '#/lib/chs-day'
import { hhmm, dayLabel } from '#/lib/format'
import type { Refined } from '#/lib/refine'
import type { Station } from '#/lib/station'

export function ChsDay({ station }: { station: Station }) {
  const hasDay = hasChsDay(station)
  const [day, setDay] = useState<Refined>()
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const [cancel, setCancel] = useState<() => void>(() => () => {})
  const [selected, setSelected] = useState<Date>()
  const { now, live } = useLiveNow()

  useEffect(() => {
    if (!live || !hasDay) return
    const stop = new AbortController()
    setDay(undefined)
    setSelected(undefined)
    setError(undefined)
    setPending(true)
    setCancel(() => () => {
      stop.abort()
      setPending(false)
      setError('CHS request cancelled.')
    })
    fetchBrowserChsDay(station, new Date(), (url, options) => fetch(url, { ...options, signal: stop.signal }))
      .then((result) => {
        if (!stop.signal.aborted) setDay(result)
      })
      .catch((reason) => {
        if (!stop.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'CHS predictions are unavailable.')
      })
      .finally(() => {
        if (!stop.signal.aborted) setPending(false)
      })
    return () => stop.abort()
  }, [station.id, station.latitude, station.longitude, station.timezone, station.source, hasDay, live])

  if (!hasDay)
    return station.source === 'chs' ? (
      <section className="py-8">
        <h1 className="text-2xl text-sw-paper">{station.name}</h1>
        <p className="mt-3 text-sw-steel">This derived gate has no CHS station to fetch.</p>
      </section>
    ) : null
  const curve = day && {
    station,
    start: day.start,
    hours: day.hours,
    now: selected ?? now,
    actualNow: now,
    trackingNow: !selected,
    onSelect: setSelected,
    onCommit: setSelected,
  }
  const rows =
    day?.kind === 'tide'
      ? day.turns.map((e) => ({ time: e.time, label: e.high ? 'High' : 'Low', value: `${e.level.toFixed(1)} ft` }))
      : day?.events.map((e) => ({
          time: e.time,
          label: e.kind === 'slack' ? 'Slack' : e.kind === 'flood' ? 'Max flood' : 'Max ebb',
          value: e.kind === 'slack' ? '' : `${Math.abs(e.level).toFixed(1)} kn`,
        }))

  return (
    <section aria-label="CHS published day" className="mb-8 rounded-2xl border border-sw-steel/25 py-6">
      <div className="px-5">
        <h1 className="text-2xl text-sw-paper">{station.name}</h1>
        <h2 className="mt-2 text-lg text-sw-paper">CHS {day ? dayLabel(day.start, station.timezone) : 'today'}</h2>
        <p className="mt-2 text-sm text-sw-steel">
          One published day, fetched directly from the Canadian Hydrographic Service by your browser.{' '}
          {station.kind === 'tide' ? 'Heights are feet above chart datum.' : 'Speeds are in knots.'}
        </p>
        {pending && (
          <p role="status" className="mt-3 text-sm text-sw-foam">
            Fetching today’s predictions…{' '}
            <button onClick={cancel} className="ml-2 underline">
              Cancel
            </button>
          </p>
        )}
        {error && (
          <p role="status" className="mt-3 text-sm text-sw-steel">
            {error}
          </p>
        )}
      </div>
      {day && curve && (
        <>
          {/* The shared scrolling strip needs a multi-day window; the CHS contract supplies one day. */}
          <div className="sm:hidden">
            {day.kind === 'tide' ? (
              <TideCurve {...curve} width={390} samples={day.samples} high={day.high} low={day.low} turns={day.turns} />
            ) : (
              <CurrentCurve {...curve} width={390} samples={day.samples} events={day.events} />
            )}
          </div>
          <div className="hidden sm:block">
            {day.kind === 'tide' ? (
              <TideCurve {...curve} width={736} samples={day.samples} high={day.high} low={day.low} turns={day.turns} />
            ) : (
              <CurrentCurve {...curve} width={736} samples={day.samples} events={day.events} />
            )}
          </div>
        </>
      )}
      {rows && (
        <ol className="mx-5 mt-4 divide-y divide-sw-steel/20">
          {rows.map((e) => (
            <li key={+e.time}>
              <button
                className="flex w-full justify-between gap-4 py-3 text-left text-sm text-sw-foam"
                onClick={() => setSelected(e.time)}
              >
                <span>{hhmm(e.time, station.timezone)}</span>
                <span>{e.label}</span>
                <span>{e.value}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="mx-5 mt-4 text-xs text-sw-steel">
        Only today is fetched.{' '}
        <a className="underline" href="https://tides.gc.ca/en/copyright-and-disclaimer">
          Canadian Hydrographic Service copyright and disclaimer
        </a>
        .
      </p>
    </section>
  )
}
