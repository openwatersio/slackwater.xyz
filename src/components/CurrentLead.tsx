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
  /** The set in degrees. Absent when the station publishes none — the app drops
      its arrow rather than pointing at a bearing it does not have. */
  setDegrees?: number
  slack: boolean
  at: Date
  timeZone: string
}) {
  const state = slack ? 'Slack' : level > 0 ? 'Flooding' : 'Ebbing'
  const phase = slack ? 'text-sw-go' : level > 0 ? 'text-sw-flood' : 'text-sw-ebb'

  return (
    <div className="flex flex-col items-center gap-1 text-white">
      <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-white/85">
        <span className="font-medium">{state}</span>
        <span className={`flex items-center gap-1 ${phase}`}>
          {slack ? <SlackGlyph />
            : setDegrees === undefined ? null
            : <><SetArrow deg={setDegrees} />{compass16(setDegrees)}</>}
        </span>
      </p>
      <p className="font-rounded text-[2.75rem] font-medium leading-none tabular-nums">
        {Math.abs(level).toFixed(1)}
        {/* ReadoutType.leadUnit is `.title2.weight(.light)` with no rounded design,
            so the unit steps back out of the face the value is set in. */}
        <span className="ml-1 font-sans text-[1.375rem] font-light">kn</span>
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
