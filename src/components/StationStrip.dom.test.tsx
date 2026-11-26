// @vitest-environment happy-dom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { StationStrip } from './StationStrip'
import { computedReadings } from '#/lib/readings'
import type { BundledStation } from '#/lib/station'

/** The package strip, stubbed: it reports `opening` once it mounts, as the real one reports where it opens. */
const strip = vi.hoisted(() => ({ opening: 0, onSelect: undefined as undefined | ((time: number) => void) }))
vi.mock('@slackwater/react', async (original) => {
  const real = await original<typeof import('@slackwater/react')>()
  function Stub({ onSelect }: { onSelect?: (time: number) => void }) {
    strip.onSelect = onSelect
    useEffect(() => onSelect?.(strip.opening), [onSelect])
    return null
  }
  return { ...real, TideScrubber: Stub, CurrentScrubber: Stub }
})

const seattle: BundledStation = {
  id: 'noaa/9447130', kind: 'tide', slug: 'seattle', name: 'Seattle',
  path: '/tides/us/wa/seattle/',
  latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles',
  source: 'bundled', chartDatum: 'MLLW',
  constituents: [{ name: 'M2', amplitude: 3.487, phase: 10.8 }, { name: 'K1', amplitude: 2.625, phase: 300 }],
}
const H = 3_600_000
const BUILT = Date.parse('2026-11-20T20:00:00Z')
const readings = computedReadings(seattle, new Date(BUILT - 96 * H), 276)

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

let root: Root | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
})

function mount(props: { now?: number; selected?: number; onReading: (time: number) => void; onMove?: (time: number) => void }) {
  if (!root) root = createRoot(document.createElement('div'))
  act(() => root!.render(<StationStrip station={seattle} readings={readings} {...props} />))
}

describe('StationStrip reports to the tiles', () => {
  it("nothing it opens on before the reader's clock, then that moment once the clock arrives", () => {
    const onReading = vi.fn()
    strip.opening = BUILT + 150 * H // clamped near the build window's end
    mount({ onReading })
    expect(onReading).not.toHaveBeenCalled()
    mount({ now: BUILT + 3 * 24 * H, onReading })
    expect(onReading.mock.calls).toEqual([[BUILT + 150 * H]])
    act(() => strip.onSelect!(BUILT + 160 * H))
    expect(onReading.mock.calls.at(-1)).toEqual([BUILT + 160 * H])
  })

  it('a shared moment from the start, since it is the reader’s choice and not a clamp', () => {
    const onReading = vi.fn()
    strip.opening = BUILT + 6 * H
    mount({ selected: BUILT + 6 * H, onReading })
    expect(onReading.mock.calls).toEqual([[BUILT + 6 * H]])
  })

  it('passes the opening to the tiles but not to the URL, which hears only moves', () => {
    const onReading = vi.fn()
    const onMove = vi.fn()
    strip.opening = BUILT
    mount({ now: BUILT, onReading, onMove })
    expect(onReading.mock.calls).toEqual([[BUILT]])
    expect(onMove).not.toHaveBeenCalled()
    act(() => strip.onSelect!(BUILT + H))
    expect(onMove.mock.calls).toEqual([[BUILT + H]])
  })
})
