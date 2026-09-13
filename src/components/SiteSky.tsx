import { useEffect, useRef } from 'react'
import type { SkyFrame } from '#/lib/site-sky'

export function SiteSky({ frame }: { frame: SkyFrame }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const draw = () => {
      if (canvas.current) drawFrame(canvas.current, frame)
    }
    draw()
    addEventListener('resize', draw)
    return () => removeEventListener('resize', draw)
  }, [frame])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-svh overflow-hidden">
      <canvas ref={canvas} className="h-full w-full" />
    </div>
  )
}

function drawFrame(canvas: HTMLCanvasElement, frame: SkyFrame) {
  const { width, height } = canvas.getBoundingClientRect()
  const ratio = devicePixelRatio || 1
  canvas.width = Math.ceil(width * ratio)
  canvas.height = Math.ceil(height * ratio)
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  const paint = context.createLinearGradient(0, 0, 0, height)
  // Keep the page ground behind text while the sky's anchor hues fade out.
  paint.addColorStop(0, `${frame.paint.top}1f`)
  paint.addColorStop(0.45, `${frame.paint.bottom}14`)
  paint.addColorStop(1, `${frame.paint.bottom}00`)
  context.fillStyle = paint
  context.fillRect(0, 0, width, height)
  if (frame.sun) drawSun(context, frame.sun.x * width, frame.sun.y * height)
  if (frame.moon) drawMoon(context, frame.moon.x * width, frame.moon.y * height, frame.moon.fraction, frame.moon.lightAngle)
}

function drawSun(context: CanvasRenderingContext2D, x: number, y: number) {
  const sun = token('--color-sw-sun')
  const glow = context.createRadialGradient(x, y, 0, x, y, 72)
  glow.addColorStop(0, sun)
  glow.addColorStop(1, `${sun}00`)
  context.fillStyle = glow
  context.fillRect(x - 72, y - 72, 144, 144)
  context.fillStyle = sun
  context.beginPath()
  context.arc(x, y, 20, 0, Math.PI * 2)
  context.fill()
}

function drawMoon(context: CanvasRenderingContext2D, x: number, y: number, fraction: number, lightAngle: number) {
  const radius = 18
  context.fillStyle = token('--color-sw-night')
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
  if (fraction <= 0) return
  context.save()
  context.translate(x, y)
  context.rotate(lightAngle)
  context.fillStyle = token('--color-sw-foam')
  context.beginPath()
  context.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2)
  // The terminator crosses the center at quarter moon and bends to the far limb at full.
  if (fraction === 0.5) context.lineTo(0, -radius)
  else context.ellipse(0, 0, radius * Math.abs(1 - 2 * fraction), radius, 0, Math.PI / 2, -Math.PI / 2, fraction < 0.5)
  context.closePath()
  context.fill()
  context.restore()
}

function token(name: string) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() }
