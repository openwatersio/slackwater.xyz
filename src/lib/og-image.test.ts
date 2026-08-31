import { describe, expect, it } from 'vitest'
import { renderCard } from './og-image'
import type { Station } from './station'

const S: Station = {
  id: 'noaa/PUG1701', kind: 'current', slug: 'deception-pass', name: 'Deception Pass (Narrows)',
  latitude: 48.4, longitude: -122.64, timezone: 'America/Los_Angeles',
  source: 'bundled',
  offset: 0, floodDirection: 101.5, ebbDirection: 281.5,
  constituents: [{ name: 'M2', amplitude: 3.2, phase: 100 }],
}

describe('renderCard', () => {
  it('produces a real PNG of the right size', async () => {
    const png = await renderCard(S, new Date('2026-08-30T21:30:00Z'))
    expect(png.slice(0, 8)).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    // IHDR width and height, big-endian at bytes 16..24
    const view = new DataView(png.buffer, png.byteOffset)
    expect(view.getUint32(16)).toBe(1200)
    expect(view.getUint32(20)).toBe(630)
  })

  it('renders a different image for a different moment', async () => {
    const a = await renderCard(S, new Date('2026-08-30T00:00:00Z'))
    const b = await renderCard(S, new Date('2026-08-30T06:00:00Z'))
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).not.toBe(0)
  })

  it('is deterministic for one moment', async () => {
    const a = await renderCard(S, new Date('2026-08-30T00:00:00Z'))
    const b = await renderCard(S, new Date('2026-08-30T00:00:00Z'))
    expect(Buffer.compare(Buffer.from(a), Buffer.from(b))).toBe(0)
  })
})
