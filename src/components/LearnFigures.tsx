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

/** A current through two turns, coloured as the app colours it: flood blue
 *  above the line, ebb amber below, and green only where the stream is slow
 *  enough to call slack. A dot marks one slack. Decorative. */
export function SlackFigure({ className }: { className?: string }) {
  const W = 180
  const mid = 60
  const amp = 38
  // Below this fraction of a maximum the stream counts as slack, wide
  // enough at this size for the window to read as a stretch, not a point.
  const slack = 0.32
  const at = (i: number) => {
    const t = (i / W) * Math.PI * 2.4 + 0.35
    return { x: i, v: Math.sin(t) }
  }
  type Run = { kind: 'flood' | 'ebb' | 'slack'; points: string[] }
  const runs: Run[] = []
  for (let i = 0; i <= W; i += 2) {
    const { x, v } = at(i)
    const kind = Math.abs(v) < slack ? 'slack' : v > 0 ? 'flood' : 'ebb'
    const point = `${x} ${(mid - v * amp).toFixed(1)}`
    const last = runs[runs.length - 1]
    if (last?.kind === kind) last.points.push(point)
    // A new run starts where the last one ended, so the colours meet.
    else runs.push({ kind, points: last ? [last.points[last.points.length - 1], point] : [point] })
  }
  // The slack between the first flood and the ebb after it.
  let dot = 0
  for (let i = 2; i <= W; i += 2) if (at(i - 2).v > 0 && at(i).v <= 0) { dot = i; break }
  const color = { flood: 'text-sw-flood', ebb: 'text-sw-ebb', slack: 'text-sw-go' }
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
          className={color[r.kind]}
        />
      ))}
      <circle cx={dot} cy={mid} r="5" fill="var(--color-sw-paper)" />
    </svg>
  )
}
