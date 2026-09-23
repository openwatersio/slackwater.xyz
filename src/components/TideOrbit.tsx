import { useEffect, useId, useRef, useState } from 'react'

const EARTH_RADIUS = 88
const EARTH_ORBIT = 62
const MOON_ORBIT = 320
const BULGE = 24

export function tideOrbitGeometry(reveal: number) {
  const amount = Math.max(0, Math.min(1, reveal))
  return {
    earthX: amount === 0 ? 0 : -EARTH_ORBIT * amount,
    moonX: MOON_ORBIT,
    nearBulge: BULGE,
    farBulge: BULGE * amount,
    earthOrbit: EARTH_ORBIT * amount,
  }
}

function waterPath(earthX: number, nearBulge: number, farBulge: number) {
  const left = earthX - EARTH_RADIUS - farBulge
  const right = earthX + EARTH_RADIUS + nearBulge
  const side = EARTH_RADIUS - 7
  return [
    `M ${left} 0`,
    `C ${left + 5} -52 ${earthX - 52} ${-side} ${earthX} ${-side}`,
    `C ${earthX + 52} ${-side} ${right - 8} -52 ${right} 0`,
    `C ${right - 8} 52 ${earthX + 52} ${side} ${earthX} ${side}`,
    `C ${earthX - 52} ${side} ${left + 5} 52 ${left} 0 Z`,
  ].join(' ')
}

export function TideOrbit() {
  const [reveal, setReveal] = useState(0)
  const [running, setRunning] = useState(true)
  const svg = useRef<SVGSVGElement>(null)
  const arrowId = `pull-${useId().replaceAll(':', '')}`
  const model = tideOrbitGeometry(reveal)
  const shared = reveal >= 0.75
  const beginning = reveal < 0.25

  const heading = beginning
    ? 'The familiar shortcut'
    : shared
      ? 'The shared orbit'
      : 'Now let Earth move too'
  const explanation = beginning
    ? 'Hold Earth still and the Moon draws the nearest water toward it. That explains the near-side bulge.'
    : shared
      ? 'Near water pulls ahead of Earth. Far water also falls toward the Moon, but Earth falls faster. Relative to Earth, both sides bulge outward.'
      : 'Earth’s centre begins tracing a small circle around the barycentre. The second bulge appears as we stop treating Earth as fixed.'

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      svg.current?.pauseAnimations()
      setRunning(false)
    }
  }, [])

  function toggleMotion() {
    if (running) svg.current?.pauseAnimations()
    else svg.current?.unpauseAnimations()
    setRunning(!running)
  }

  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-sw-canvas shadow-2xl shadow-black/20">
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-7">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-sw-steel">
              Earth–Moon system
            </p>
            <p className="mt-1 text-xl font-semibold text-sw-foam">{heading}</p>
          </div>
          <button
            type="button"
            onClick={toggleMotion}
            className="motion-reduce:hidden rounded-full border border-white/15 px-3 py-1.5 text-sm text-sw-foam transition hover:border-white/30"
          >
            {running ? 'Pause motion' : 'Play motion'}
          </button>
        </div>

        <svg
          ref={svg}
          viewBox="-500 -280 1000 560"
          role="img"
          aria-labelledby="tide-orbit-title tide-orbit-desc"
          className="mt-1 block aspect-[16/9] w-full"
        >
          <title id="tide-orbit-title">The Earth and Moon orbiting together</title>
          <desc id="tide-orbit-desc">{explanation}</desc>
          <defs>
            <marker
              id={arrowId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 Z" fill="currentColor" />
            </marker>
          </defs>

          <circle
            r={MOON_ORBIT}
            fill="none"
            stroke="currentColor"
            strokeDasharray="3 10"
            className="text-white/10"
          />
          <circle
            r={model.earthOrbit}
            fill="none"
            stroke="currentColor"
            strokeDasharray="3 7"
            className="text-sw-foam/30"
            style={{ opacity: reveal }}
          />

          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 0 0"
              to="360 0 0"
              dur="20s"
              repeatCount="indefinite"
            />
            <path
              d={waterPath(model.earthX, model.nearBulge, model.farBulge)}
              fill="currentColor"
              className="text-sw-canvas-glow"
            />
            <circle
              cx={model.earthX}
              r={EARTH_RADIUS}
              fill="var(--color-sw-navy-deep)"
              stroke="currentColor"
              strokeWidth="2"
              className="text-sw-foam/25"
            />
            <path
              d={waterPath(model.earthX, model.nearBulge, model.farBulge)}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-sw-foam/70"
            />

            {[[-70, 22], [0, 34], [70, 48]].map(([offset, length], index) => (
              <line
                key={offset}
                x1={model.earthX + offset}
                x2={model.earthX + offset + length}
                stroke="currentColor"
                strokeWidth="3"
                markerEnd={`url(#${arrowId})`}
                className="text-sw-foam"
                style={{ opacity: index === 2 ? 0.9 : reveal * 0.9 }}
              />
            ))}

            <circle
              cx={model.moonX}
              r="28"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="3"
              className="text-sw-sunrise"
            />
          </g>

          <g style={{ opacity: reveal }}>
            <circle r="9" fill="currentColor" className="text-sw-page" />
            <circle r="5" fill="currentColor" className="text-sw-foam" />
            <text x="16" y="-12" fill="currentColor" fontSize="14" className="text-sw-steel">
              Barycentre
            </text>
          </g>
        </svg>

        <div className="border-t border-white/10 px-5 pb-5 pt-4 sm:px-7 sm:pb-7">
          <label htmlFor="orbit-reveal" className="block font-medium text-sw-foam">
            Reveal the shared orbit
          </label>
          <input
            id="orbit-reveal"
            type="range"
            min="0"
            max="100"
            value={Math.round(reveal * 100)}
            onChange={(event) => setReveal(Number(event.currentTarget.value) / 100)}
            className="mt-3 w-full accent-sw-foam"
          />
          <div className="mt-1 flex justify-between text-xs text-sw-steel" aria-hidden>
            <span>Earth held still</span>
            <span>Actual shared orbit</span>
          </div>
          <p className="mt-4 max-w-3xl leading-relaxed text-sw-foam">{explanation}</p>
        </div>
      </div>
      <figcaption className="mt-3 text-sm leading-relaxed text-sw-steel">
        The three arrows show the Moon&rsquo;s pull: strongest on the near side, weakest on the far
        side. Sizes, distances, and the water&rsquo;s shape are exaggerated.
      </figcaption>
    </figure>
  )
}
