import { describe, expect, it } from 'vitest'
import { stationPath } from './station'

describe('stationPath', () => {
  it('builds both kinds, trailing slash included', () => {
    expect(stationPath('tide', 'seattle')).toBe('/tides/seattle/')
    expect(stationPath('current', 'dodd-narrows')).toBe('/currents/dodd-narrows/')
  })
})
