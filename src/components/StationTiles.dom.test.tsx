// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fortnightWindow } from '@slackwater/react'
import { StationTiles, useMomentStore, type MomentStore } from './StationTiles'
import { loadCatalogue } from '#/lib/catalogue'
import * as predict from '#/lib/predict'
import { computedReadings } from '#/lib/readings'
import type { BundledStation } from '#/lib/station'

// Every month of turns the tiles compute passes through here, so a test can
// see when one is computed and around which moment.
vi.mock('#/lib/predict', async (original) => {
  const real = await original<typeof import('#/lib/predict')>()
  return { ...real, tideExtremes: vi.fn(real.tideExtremes) }
})
const tideExtremes = vi.mocked(predict.tideExtremes)
/** The starts of the month-long windows computed so far, as the ranking asks for them. */
const months = () => tideExtremes.mock.calls.filter(([, , hours]) => hours > 24 * 25).map(([, start]) => start.getTime())

const seattle = (loadCatalogue() as BundledStation[]).find((s) => s.id === 'noaa/9447130')!
const tz = seattle.timezone
const H = 3_600_000
const DAY = 24 * H
// A perigean spring afternoon, whose swing ranks in its month's top tenth.
const SPRING = Date.parse('2026-11-24T23:30:00Z')
const readings = computedReadings(seattle, new Date(SPRING - 96 * H), 276)
/** Twenty days before the spring, so the spring lies outside the month ranked around it. */
const EARLIER = SPRING - 20 * DAY
/** Turns from before `EARLIER` to past the spring, so the tile has a swing to read at each. */
const wide = computedReadings(seattle, new Date(EARLIER - 2 * DAY), 25 * 24)

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})
beforeEach(() => {
  vi.useFakeTimers()
  tideExtremes.mockClear()
})

let root: Root | undefined
let host: HTMLElement
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  vi.useRealTimers()
})

let store: MomentStore
function Harness({ initial, strip }: { initial?: number; strip: typeof readings }) {
  store = useMomentStore(initial)
  return <StationTiles station={seattle} readings={strip} moment={store} initial={initial} />
}
function mount(initial?: number, strip = readings) {
  host = document.createElement('div')
  root = createRoot(host)
  act(() => root!.render(<Harness initial={initial} strip={strip} />))
}
const range = () => host.querySelector('.sw-card')!.textContent ?? ''
const at = (time: number) => act(() => store.set(time))
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const windowStart = (time: number) => Date.parse(fortnightWindow(time, tz).start)

describe('StationTiles in the browser', () => {
  it('reads unranked at once, and ranks the month only once the strip has rested a second', () => {
    mount()
    expect(range()).toMatch(/^Range—/)
    at(SPRING)
    expect(range()).toMatch(/(low to high|high to low)/)
    expect(months()).toEqual([])
    wait(999)
    expect(months()).toEqual([])
    wait(1)
    expect(months()).toEqual([windowStart(SPRING)])
    expect(range()).toMatch(/beyond normal here|the fortnight's biggest/)
  })

  it('waits while the strip keeps moving', () => {
    mount()
    for (let i = 0; i < 5; i++) {
      at(SPRING + i * H)
      wait(600)
    }
    expect(months()).toEqual([])
    wait(1000)
    // Around the first moment, not the last one passed through.
    expect(months()).toEqual([windowStart(SPRING)])
  })

  it('holds the month while the moment stays inside it', () => {
    mount()
    at(SPRING)
    wait(1000)
    at(SPRING + 3 * DAY)
    wait(2000)
    at(SPRING - 10 * DAY)
    wait(2000)
    expect(months()).toEqual([windowStart(SPRING)])
  })

  it('starts again around the first moment outside it, and forgets one the strip came back from', () => {
    mount()
    at(SPRING)
    wait(1000)
    // Out, then back inside before the timer: nothing to re-rank.
    at(SPRING + 20 * DAY)
    wait(300)
    at(SPRING + DAY)
    wait(2000)
    expect(months()).toEqual([windowStart(SPRING)])
    // Out to one moment, then on to another outside both months: the first is kept.
    at(SPRING + 40 * DAY)
    wait(300)
    at(SPRING + 41 * DAY)
    wait(1000)
    expect(months()).toEqual([windowStart(SPRING), windowStart(SPRING + 40 * DAY)])
  })

  it('reads unranked, not against the month it left, until the new month is ranked', () => {
    mount(undefined, wide)
    at(EARLIER)
    wait(1000)
    // On to the perigean spring, outside that month, as after Now from a
    // link weeks back: against the earlier month it would stand out.
    at(SPRING)
    expect(range()).toMatch(/(low to high|high to low)/)
    wait(1000)
    expect(months()).toEqual([windowStart(EARLIER), windowStart(SPRING)])
    expect(range()).toMatch(/beyond normal here|the fortnight's biggest/)
  })

  it("re-ranks the same month, unranked meanwhile, when the strip's turns change as CHS's day lands", () => {
    mount()
    at(SPRING)
    wait(1000)
    expect(months()).toEqual([windowStart(SPRING)])
    expect(range()).toMatch(/beyond normal here|the fortnight's biggest/)
    // The strip's highs raised a foot, as a merged port's CHS day can raise them.
    const raised = readings.kind === 'tide'
      ? { ...readings, extremes: readings.extremes.map((e) => (e.high ? { ...e, level: e.level + 1 } : e)) }
      : readings
    act(() => root!.render(<Harness strip={raised} />))
    expect(range()).toMatch(/(low to high|high to low)/)
    wait(1000)
    expect(months()).toEqual([windowStart(SPRING), windowStart(SPRING)])
    expect(range()).toMatch(/beyond normal here|the fortnight's biggest/)
  })

  it("ranks a shared link's moment after hydration, never in the render", () => {
    mount(SPRING)
    expect(range()).toMatch(/(low to high|high to low)/)
    expect(months()).toEqual([])
    wait(1000)
    expect(months()).toEqual([windowStart(SPRING)])
  })
})
