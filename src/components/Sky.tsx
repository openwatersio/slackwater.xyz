import { useEffect, useRef } from 'react'
import { drawSky } from '#/lib/sky-draw'
import type { SkyState } from '#/lib/sky-state'

/**
 * The sky behind a scrub strip: a gradient with the bodies drawn over it.
 *
 * Takes the whole `SkyState` rather than spread props, the way `SkyBackdrop`
 * does — anything the sky gains later is then a field on one object instead of
 * a new argument at every call site.
 *
 * Decorative, and hidden from assistive technology: the readings are the
 * readout's job, not this one's.
 */
export function Sky({
  state, width, height, seconds,
}: {
  state: SkyState
  width: number
  height: number
  /** Wall-clock seconds, for the twinkle. */
  seconds: number
}) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.current!.width = width * dpr
    canvas.current!.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    drawSky(ctx, state, { width, height, seconds, reduceMotion })
  }, [state, width, height, seconds])

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${state.paint.top}, ${state.paint.bottom})`,
          opacity: state.opacity,
        }}
      />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
