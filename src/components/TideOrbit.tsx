import { useEffect, useId, useRef, useState } from 'react'

const EARTH_RADIUS = 88
const EARTH_ORBIT = 62
const MOON_ORBIT = 240
const BULGE = 24
const EARTH_MASS = 5.9724
const MOON_MASS = 0.07346
const MEAN_DISTANCE_KM = 384_400
const SIDEREAL_PERIOD_DAYS = 27.3217

export function earthMoonMeasurements() {
  const earthToBarycenterKm =
    (MEAN_DISTANCE_KM * MOON_MASS) / (EARTH_MASS + MOON_MASS)
  const periodSeconds = SIDEREAL_PERIOD_DAYS * 86_400

  return {
    earthToMoonKm: MEAN_DISTANCE_KM,
    earthToBarycenterKm,
    barycenterToMoonKm: MEAN_DISTANCE_KM - earthToBarycenterKm,
    earthSpeedMps: (2 * Math.PI * earthToBarycenterKm * 1_000) / periodSeconds,
  }
}

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

export function wobbleGeometry(referencePoint: 'center' | 'barycenter') {
  return tideOrbitGeometry(referencePoint === 'barycenter' ? 1 : 0)
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

function useOrbitMotion() {
  const [running, setRunning] = useState(true)
  const svg = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      svg.current?.pauseAnimations()
      setRunning(false)
    }
  }, [])

  function toggle() {
    if (running) svg.current?.pauseAnimations()
    else svg.current?.unpauseAnimations()
    setRunning(!running)
  }

  return { svg, running, toggle }
}

function MotionButton({ running, toggle }: { running: boolean; toggle: () => void }) {
  return (
    <button
      type="button"
      onClick={toggle}
      className="motion-reduce:hidden rounded-full border border-white/15 px-3 py-1.5 text-sm text-sw-foam transition hover:border-white/30"
    >
      {running ? 'Pause motion' : 'Play motion'}
    </button>
  )
}

function ArrowMarker({ id }: { id: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth="5"
      markerHeight="5"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 Z" fill="currentColor" />
    </marker>
  )
}

function IntroAnimation({ stage }: { stage: 'pull' | 'wobble' }) {
  const motion = useOrbitMotion()
  const id = useId().replaceAll(':', '')
  const [referencePoint, setReferencePoint] = useState<'center' | 'barycenter'>('barycenter')
  const pull = stage === 'pull'
  const barycenter = referencePoint === 'barycenter'
  const model = pull ? tideOrbitGeometry(0) : wobbleGeometry(referencePoint)
  const title = pull ? 'The Moon pulling the nearest water' : 'Center and barycenter compared'
  const caption = pull
    ? 'For this first view, Earth is held still and the far-side response is hidden.'
    : barycenter
      ? 'Around the barycenter, Earth’s center follows the dotted circle and the far-side water line moves outward.'
      : 'Around Earth’s center, the planet stays fixed and the water line remains even.'

  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-sw-canvas">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          {pull ? (
            <p className="font-semibold text-sw-foam">Hold Earth still</p>
          ) : (
            <div
              className="inline-flex rounded-full border border-white/15 bg-sw-page/40 p-1 text-sm"
              role="group"
              aria-label="Earth orbit reference point"
            >
              <button
                type="button"
                aria-pressed={!barycenter}
                onClick={() => setReferencePoint('center')}
                className={`rounded-full px-3 py-1.5 transition ${
                  barycenter ? 'text-sw-steel hover:text-sw-foam' : 'bg-sw-foam text-sw-page'
                }`}
              >
                Center
              </button>
              <button
                type="button"
                aria-pressed={barycenter}
                onClick={() => setReferencePoint('barycenter')}
                className={`rounded-full px-3 py-1.5 transition ${
                  barycenter ? 'bg-sw-foam text-sw-page' : 'text-sw-steel hover:text-sw-foam'
                }`}
              >
                Barycenter
              </button>
            </div>
          )}
          <MotionButton running={motion.running} toggle={motion.toggle} />
        </div>
        <svg
          ref={motion.svg}
          viewBox="-500 -280 1000 560"
          role="img"
          aria-labelledby={`${id}-title ${id}-desc`}
          className="block aspect-[16/9] w-full"
        >
          <title id={`${id}-title`}>{title}</title>
          <desc id={`${id}-desc`}>{caption}</desc>
          {pull && (
            <defs>
              <ArrowMarker id={`pull-${id}`} />
            </defs>
          )}

          <circle
            r={MOON_ORBIT}
            fill="none"
            stroke="currentColor"
            strokeDasharray="3 10"
            className="text-white/10"
          />
          {!pull && barycenter && (
            <circle
              r={model.earthOrbit}
              fill="none"
              stroke="currentColor"
              strokeDasharray="3 7"
              className="text-sw-foam/30"
            />
          )}

          <g>
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 0 0"
              to="360 0 0"
              dur="20s"
              repeatCount="indefinite"
            />
            {pull && (
              <path
                d={waterPath(model.earthX, model.nearBulge, 0)}
                fill="currentColor"
                className="text-sw-canvas-glow"
              />
            )}
            {!pull && (
              <path
                d={waterPath(model.earthX, 8, 8 + model.farBulge)}
                fill="currentColor"
                className="text-sw-canvas-glow"
              />
            )}
            <circle
              cx={model.earthX}
              r={EARTH_RADIUS}
              fill="var(--color-sw-navy-deep)"
              stroke="currentColor"
              strokeWidth="2"
              className="text-sw-foam/25"
            />
            {pull ? (
              <>
                <path
                  d={waterPath(model.earthX, model.nearBulge, 0)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-sw-foam/70"
                />
                <line
                  x1={70}
                  x2={118}
                  stroke="currentColor"
                  strokeWidth="3"
                  markerEnd={`url(#pull-${id})`}
                  className="text-sw-foam"
                />
              </>
            ) : (
              <>
                <path
                  d={waterPath(model.earthX, 8, 8 + model.farBulge)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-sw-foam/70"
                />
                <circle cx={model.earthX} r="5" fill="currentColor" className="text-sw-foam" />
              </>
            )}
            <circle
              cx={model.moonX}
              r="28"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="3"
              className="text-sw-sunrise"
            />
          </g>

          {!pull && (
            <g>
              <circle r="9" fill="currentColor" className="text-sw-page" />
              <circle r="5" fill="currentColor" className="text-sw-foam" />
              <text x="16" y="-12" fill="currentColor" fontSize="14" className="text-sw-steel">
                {barycenter ? 'Barycenter' : 'Center'}
              </text>
            </g>
          )}
        </svg>
      </div>
      <figcaption className="mt-3 text-sm leading-relaxed text-sw-steel">{caption}</figcaption>
    </figure>
  )
}

export function MoonPullAnimation() {
  return <IntroAnimation stage="pull" />
}

export function EarthWobbleAnimation() {
  return <IntroAnimation stage="wobble" />
}

export function TideOrbit() {
  const [reveal, setReveal] = useState(1)
  const motion = useOrbitMotion()
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
      : 'Earth’s center begins tracing a small circle around the barycenter. The second bulge appears as we stop treating Earth as fixed.'

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
          <MotionButton running={motion.running} toggle={motion.toggle} />
        </div>

        <svg
          ref={motion.svg}
          viewBox="-500 -280 1000 560"
          role="img"
          aria-labelledby="tide-orbit-title tide-orbit-desc"
          className="mt-1 block aspect-[16/9] w-full"
        >
          <title id="tide-orbit-title">The Earth and Moon orbiting together</title>
          <desc id="tide-orbit-desc">{explanation}</desc>
          <defs>
            <ArrowMarker id={arrowId} />
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
              Barycenter
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

function Dimension({
  x1,
  x2,
  y,
  label,
}: {
  x1: number
  x2: number
  y: number
  label: string
}) {
  return (
    <g>
      <line x1={x1} x2={x2} y1={y} y2={y} stroke="currentColor" />
      <line x1={x1} x2={x1} y1={y - 7} y2={y + 7} stroke="currentColor" />
      <line x1={x2} x2={x2} y1={y - 7} y2={y + 7} stroke="currentColor" />
      <text
        x={(x1 + x2) / 2}
        y={y - 10}
        textAnchor="middle"
        fill="currentColor"
        fontSize="13"
        letterSpacing="0.04em"
      >
        {label}
      </text>
    </g>
  )
}

export function TideBlueprint() {
  const values = earthMoonMeasurements()
  const earthToBarycenter = Math.round(values.earthToBarycenterKm).toLocaleString('en-US')
  const barycenterToMoon = Math.round(values.barycenterToMoonKm).toLocaleString('en-US')
  const earthSpeed = values.earthSpeedMps.toFixed(1)

  return (
    <figure className="m-0 min-w-0 max-w-full">
      <div className="max-w-full overflow-hidden rounded-3xl border border-sw-foam/20 bg-sw-canvas shadow-2xl shadow-black/20">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-sw-foam/15 px-5 py-4 sm:px-7">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-sw-steel">
              Plate 01 · Mean Earth–Moon geometry
            </p>
            <p className="mt-1 font-semibold text-sw-paper">Section through both centers</p>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-sw-steel">
            Distance compressed · bodies enlarged
          </p>
        </div>

        <div
          className="max-w-full overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Scrollable Earth and Moon dimension drawing"
        >
          <svg
            viewBox="0 0 1120 620"
            role="img"
            aria-labelledby="blueprint-title blueprint-description"
            className="block w-full min-w-[760px] font-mono text-sw-foam"
          >
            <title id="blueprint-title">Dimensions of the Earth–Moon system</title>
            <desc id="blueprint-description">
              A blueprint-style section through Earth and Moon, naming their centers, the
              barycenter, diameters, and mean distances.
            </desc>
            <defs>
              <pattern id="blueprint-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-sw-foam/10"
                />
              </pattern>
            </defs>

            <rect width="1120" height="620" fill="url(#blueprint-grid)" />

            <g fill="none" stroke="currentColor" className="text-sw-foam/40">
              <line x1="72" x2="1056" y1="302" y2="302" strokeDasharray="8 8" />
              <line x1="240" x2="240" y1="142" y2="478" strokeDasharray="4 8" />
              <line x1="321" x2="321" y1="142" y2="478" strokeDasharray="4 8" />
              <line x1="980" x2="980" y1="142" y2="478" strokeDasharray="4 8" />
            </g>

            <g fill="none" stroke="currentColor" className="text-sw-foam">
              <Dimension x1={240} x2={980} y={62} label="EARTH CENTER — MOON CENTER  384,400 km" />
              <Dimension
                x1={321}
                x2={980}
                y={108}
                label={`BARYCENTER — MOON CENTER  ${barycenterToMoon} km`}
              />
              <Dimension x1={130} x2={350} y={500} label="EARTH DIAMETER  12,742 km" />
              <Dimension
                x1={240}
                x2={321}
                y={550}
                label={`CENTER — BARYCENTER  ${earthToBarycenter} km`}
              />
            </g>

            <g>
              <circle
                cx="240"
                cy="302"
                r="110"
                fill="var(--color-sw-navy-deep)"
                stroke="currentColor"
                strokeWidth="2"
                className="text-sw-foam"
              />
              <circle
                cx="240"
                cy="302"
                r="116"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-sw-foam/65"
              />
              <path
                d="M 129 267 A 116 116 0 0 1 351 267"
                fill="none"
                stroke="currentColor"
                strokeDasharray="3 6"
                className="text-sw-foam/55"
              />
              <text x="240" y="171" textAnchor="middle" fill="currentColor" fontSize="18">
                EARTH
              </text>
              <text x="105" y="225" textAnchor="end" fill="currentColor" fontSize="12">
                OCEAN SURFACE
              </text>
              <line
                x1="112"
                x2="142"
                y1="229"
                y2="245"
                stroke="currentColor"
                className="text-sw-foam/70"
              />
            </g>

            <g>
              <circle cx="240" cy="302" r="5" fill="currentColor" />
              <text x="240" y="331" textAnchor="middle" fill="currentColor" fontSize="12">
                EARTH CENTER
              </text>
              <circle cx="321" cy="302" r="9" fill="var(--color-sw-canvas)" />
              <circle cx="321" cy="302" r="5" fill="currentColor" />
              <text x="321" y="279" textAnchor="middle" fill="currentColor" fontSize="12">
                BARYCENTER
              </text>
              <path
                d="M 321 354 L 350 383 L 378 383"
                fill="none"
                stroke="currentColor"
                className="text-sw-foam/70"
              />
              <text x="386" y="388" fill="currentColor" fontSize="12">
                1,700 km BELOW SURFACE
              </text>
            </g>

            <g>
              <path
                d="M 570 288 l 12 28 12 -28 12 28 12 -28"
                fill="var(--color-sw-canvas)"
                stroke="currentColor"
                strokeWidth="2"
              />
              <text x="600" y="344" textAnchor="middle" fill="currentColor" fontSize="11">
                DISTANCE BREAK
              </text>
            </g>

            <g>
              <circle
                cx="980"
                cy="302"
                r="45"
                fill="var(--color-sw-navy-deep)"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="980" cy="302" r="5" fill="currentColor" />
              <text x="980" y="234" textAnchor="middle" fill="currentColor" fontSize="18">
                MOON
              </text>
              <text x="980" y="373" textAnchor="middle" fill="currentColor" fontSize="12">
                MOON CENTER
              </text>
              <line x1="1048" x2="1048" y1="257" y2="347" stroke="currentColor" />
              <line x1="1041" x2="1055" y1="257" y2="257" stroke="currentColor" />
              <line x1="1041" x2="1055" y1="347" y2="347" stroke="currentColor" />
              <text
                x="1070"
                y="302"
                fill="currentColor"
                fontSize="12"
                textAnchor="middle"
                transform="rotate(90 1070 302)"
              >
                3,475 km
              </text>
            </g>
          </svg>
        </div>

        <div className="grid border-t border-sw-foam/15 sm:grid-cols-3">
          <div className="px-5 py-5 sm:px-7">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-sw-steel">
              Earth&rsquo;s center
            </p>
            <p className="mt-2 text-2xl font-semibold text-sw-paper">{earthSpeed} m/s</p>
            <p className="mt-1 text-sm text-sw-steel">44.8 km/h around the barycenter</p>
          </div>
          <div className="border-t border-sw-foam/15 px-5 py-5 sm:border-l sm:border-t-0 sm:px-7">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-sw-steel">
              Moon relative to Earth
            </p>
            <p className="mt-2 text-2xl font-semibold text-sw-paper">1.022 km/s</p>
            <p className="mt-1 text-sm text-sw-steel">Mean orbital speed</p>
          </div>
          <div className="border-t border-sw-foam/15 px-5 py-5 sm:border-l sm:border-t-0 sm:px-7">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-sw-steel">
              One shared orbit
            </p>
            <p className="mt-2 text-2xl font-semibold text-sw-paper">27.3217 days</p>
            <p className="mt-1 text-sm text-sw-steel">Relative to the distant stars</p>
          </div>
        </div>
      </div>

      <figcaption className="mt-4 grid gap-3 text-sm leading-relaxed text-sw-steel sm:grid-cols-2 sm:gap-8">
        <p>
          The barycenter follows from{' '}
          <span className="font-mono text-sw-foam">r = d × Mₘ ÷ (Mₑ + Mₘ)</span>. At the mean
          distance, Earth&rsquo;s center is 4,671 km from it.
        </p>
        <p>
          Earth&rsquo;s speed follows <span className="font-mono text-sw-foam">v = 2πr ÷ T</span>.
          Over the elliptical orbit, the Moon&rsquo;s distance varies from 363,300 to 405,500 km and
          its speed from 0.970 to 1.082 km/s.
        </p>
      </figcaption>
    </figure>
  )
}
