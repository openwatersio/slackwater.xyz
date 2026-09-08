import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Sky } from './Sky'
import { skyDays, skyState } from '#/lib/sky-state'

const LAT = 48.40618896484375
const LON = -122.64
const days = skyDays(LAT, LON, new Date('2026-09-08T00:00:00Z'), new Date('2026-09-10T00:00:00Z'))
const night = skyState({ time: new Date('2026-09-08T09:38:01Z'), latitude: LAT, longitude: LON, days })

describe('Sky', () => {
  const html = renderToStaticMarkup(<Sky state={night} width={400} height={300} seconds={0} />)

  it('server-renders the gradient, so a reader without JavaScript gets a sky', () => {
    expect(html).toContain('#04060f')
    expect(html).toContain('linear-gradient')
  })

  it('is decorative, and says so', () => {
    expect(html).toContain('aria-hidden="true"')
  })

  it('leaves the bodies to the canvas rather than inventing DOM for them', () => {
    expect(html).toContain('<canvas')
    expect(html).not.toContain('<circle')
  })

  it('takes the box it was told to draw in, so the horizon lands where the caller put it', () => {
    expect(html).toMatch(/height:\s*300px/)
  })
})
