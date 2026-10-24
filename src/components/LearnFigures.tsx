/** The tides guide's figure in miniature: Earth inside its stretched tidal
 *  bulge, the Earth–Moon barycentre off its centre, and the Moon pulling from
 *  the right. Decorative; the link beside it carries the meaning. */
export function TidesFigure({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 180 120" className={className}>
      <line x1="18" x2="164" y1="60" y2="60" stroke="currentColor" strokeDasharray="3 7" className="text-sw-foam/20" />
      <ellipse cx="58" cy="60" rx="47" ry="34" fill="currentColor" className="text-sw-canvas-glow" />
      <circle
        cx="58"
        cy="60"
        r="31"
        fill="var(--color-sw-navy-deep)"
        stroke="currentColor"
        strokeWidth="2"
        className="text-sw-foam/60"
      />
      <ellipse cx="58" cy="60" rx="47" ry="34" fill="none" stroke="currentColor" strokeWidth="2" className="text-sw-foam/70" />
      <circle cx="72" cy="60" r="3" fill="currentColor" className="text-sw-foam" />
      <circle cx="156" cy="60" r="13" fill="currentColor" className="text-sw-sunrise" />
    </svg>
  )
}

type RunKind = 'flood' | 'ebb' | 'slack'
const RUN_COLOR: Record<RunKind, string> = { flood: 'text-sw-flood', ebb: 'text-sw-ebb', slack: 'text-sw-go' }

/** A sine-shaped current sampled across `width`, split into runs coloured as
 *  the app colours a current: flood above the line, ebb below, and slack
 *  where the stream is under `slack` of its maximum. Each run starts where the
 *  last ended, so the colours meet. */
function currentRuns({ width, mid, amp, cycles, phase, slack }: {
  width: number; mid: number; amp: number; cycles: number; phase: number; slack: number
}) {
  const at = (x: number) => Math.sin((x / width) * Math.PI * 2 * cycles + phase)
  const runs: { kind: RunKind; points: string[] }[] = []
  for (let x = 0; x <= width; x += 2) {
    const v = at(x)
    const kind: RunKind = Math.abs(v) < slack ? 'slack' : v > 0 ? 'flood' : 'ebb'
    const point = `${x} ${(mid - v * amp).toFixed(1)}`
    const last = runs[runs.length - 1]
    if (last?.kind === kind) last.points.push(point)
    else runs.push({ kind, points: last ? [last.points[last.points.length - 1], point] : [point] })
  }
  return { runs, at }
}

/** A current through two turns, coloured as the app colours it: flood blue
 *  above the line, ebb amber below, and green only where the stream is slow
 *  enough to call slack. A dot marks one slack. Decorative. */
export function SlackFigure({ className }: { className?: string }) {
  const W = 180
  const mid = 60
  // Below a third of a maximum the stream counts as slack, wide enough at
  // this size for the window to read as a stretch, not a point.
  const { runs, at } = currentRuns({ width: W, mid, amp: 38, cycles: 1.2, phase: 0.35, slack: 0.32 })
  // The slack between the first flood and the ebb after it.
  let dot = 0
  for (let x = 2; x <= W; x += 2) if (at(x - 2) > 0 && at(x) <= 0) { dot = x; break }
  return (
    <svg aria-hidden viewBox="0 0 180 120" className={className}>
      <line x1="0" x2={W} y1={mid} y2={mid} stroke="currentColor" strokeDasharray="3 7" className="text-sw-foam/20" />
      {runs.map((r, n) => (
        <path
          key={n}
          d={`M${r.points.join(' L')}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={r.kind === 'slack' ? 4 : 2.5}
          strokeLinecap="round"
          className={RUN_COLOR[r.kind]}
        />
      ))}
      <circle cx={dot} cy={mid} r="5" fill="var(--color-sw-paper)" />
    </svg>
  )
}

/** The app's curve cut into an illustration's water, for a situation card.
 *  Below the curve is the card's own navy, so the scene runs into the card's
 *  text with no edge. No times, no numbers: the shape is the point.
 *
 *  Its viewBox matches the band it fills (the bottom 35% of a 4:3 scene), so
 *  nothing stretches. A current is coloured flood, ebb and slack; a tide is
 *  one line dipping to a marked low. Decorative. */
export function SceneCurve({ kind, phase = 0, className }: { kind: 'current' | 'tide'; phase?: number; className?: string }) {
  const W = 300
  const H = 79
  const mid = 44
  const amp = 22
  const { runs, at } = currentRuns({ width: W, mid, amp, cycles: 1.5, phase, slack: 0.3 })
  const all = runs.flatMap((r, n) => (n === 0 ? r.points : r.points.slice(1)))
  const below = `M${all.join(' L')} L${W} ${H} L0 ${H} Z`
  let low = 0
  for (let x = 0; x <= W; x += 2) if (at(x) < at(low)) low = x
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} className={className}>
      <path d={below} fill="var(--color-sw-canvas)" />
      {kind === 'current' ? (
        runs.map((r, n) => (
          <path
            key={n}
            d={`M${r.points.join(' L')}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={r.kind === 'slack' ? 4 : 2.5}
            strokeLinecap="round"
            className={RUN_COLOR[r.kind]}
          />
        ))
      ) : (
        <>
          <path d={`M${all.join(' L')}`} fill="none" stroke="currentColor" strokeWidth={2.5} className="text-sw-flood" />
          <circle cx={low} cy={mid - at(low) * amp} r="5" fill="currentColor" className="text-sw-ebb" />
        </>
      )}
    </svg>
  )
}
