import { TidesFigure } from './LearnFigures'

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

        <TidesFigure className="mx-auto w-full max-w-[180px]" />
      </a>
    </aside>
  )
}
