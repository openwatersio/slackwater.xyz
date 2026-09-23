export function TidesExplainerCard() {
  return (
    <aside>
      <a
        href="/learn/tides/"
        className="group grid gap-6 rounded-2xl border border-white/10 bg-sw-canvas p-6 transition hover:border-white/25 sm:grid-cols-[1fr_180px] sm:items-center"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-sw-steel">
            Visual guide
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-sw-paper">
            Why does the Moon make two high tides?
          </h2>
          <p className="mt-3 leading-relaxed text-sw-steel">
            Follow the Moon&rsquo;s pull, Earth&rsquo;s wobble, and the far-side bulge one step at a
            time.
          </p>
          <span className="mt-4 inline-block font-medium text-sw-foam underline underline-offset-4 group-hover:text-sw-paper">
            Learn how tides work <span aria-hidden>→</span>
          </span>
        </div>

        <svg viewBox="0 0 180 120" aria-hidden className="mx-auto w-full max-w-[180px]">
          <line
            x1="18"
            x2="164"
            y1="60"
            y2="60"
            stroke="currentColor"
            strokeDasharray="3 7"
            className="text-sw-foam/20"
          />
          <ellipse
            cx="58"
            cy="60"
            rx="47"
            ry="34"
            fill="currentColor"
            className="text-sw-canvas-glow"
          />
          <circle
            cx="58"
            cy="60"
            r="31"
            fill="var(--color-sw-navy-deep)"
            stroke="currentColor"
            strokeWidth="2"
            className="text-sw-foam/60"
          />
          <ellipse
            cx="58"
            cy="60"
            rx="47"
            ry="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-sw-foam/70"
          />
          <circle cx="72" cy="60" r="3" fill="currentColor" className="text-sw-foam" />
          <circle
            cx="156"
            cy="60"
            r="13"
            fill="currentColor"
            className="text-sw-sunrise"
          />
        </svg>
      </a>
    </aside>
  )
}
