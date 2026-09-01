// Type-level assertions. This file is never executed - `tsc --noEmit` is the
// whole test. It exists because the union's only job is to make one specific
// mistake impossible, and nothing else in the suite can observe that.
import { predictSeries } from './predict'
import type { ChsStation } from './station'

const stub: ChsStation = {
  id: 'chs-dodd-narrows', kind: 'current', slug: 'dodd-narrows', name: 'Dodd Narrows',
  source: 'chs', latitude: 49.1, longitude: -123.8, timezone: 'America/Vancouver',
}

// @ts-expect-error - a station with no constituents must not reach prediction.
predictSeries(stub, new Date(), 24)
