import { describe, expect, it } from 'vitest'
import { RAMP, rampColor, rampT, speedInk } from './ramp'

describe('speed ramp', () => {
  it('anchors to capability, not to the day', () => {
    expect(rampT(0)).toBe(0)
    expect(rampT(0.5)).toBe(0)          // slack threshold
    expect(rampT(3)).toBeCloseTo(1 / 3) // a paddler can't make way
    expect(rampT(6)).toBeCloseTo(2 / 3) // a small craft can't stem it
    expect(rampT(16)).toBeCloseTo(1)    // Sechelt Rapids
    expect(rampT(25)).toBe(1)           // clamps, never wraps
  })

  it('is symmetric in direction — the ramp is speed, the sign is direction', () => {
    expect(rampT(-4.8)).toBeCloseTo(rampT(4.8))
  })

  it('rises monotonically', () => {
    let prev = -1
    for (let k = 0; k <= 20; k += 0.25) {
      const t = rampT(k)
      expect(t).toBeGreaterThanOrEqual(prev)
      prev = t
    }
  })

  it('never contains green — green means slack', () => {
    for (const hex of RAMP) {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      expect(g > r + 20 && g > b + 20).toBe(false)
    }
  })

  it('colours by speed, so slack is dark and a rip is bright', () => {
    expect(rampColor(0)).toBe(RAMP[0].toLowerCase())
    expect(rampColor(16)).toBe(RAMP[5].toLowerCase())
    // A 6 kn gate must not read the same as a 1 kn drift.
    expect(rampColor(6)).not.toBe(rampColor(1))
    // Direction never changes the colour — that is the blue/amber axis's job.
    expect(rampColor(-4.8)).toBe(rampColor(4.8))
  })

  it('flips ink to dark only at the light end', () => {
    expect(speedInk(1)).toBe('#FCFCFC')
    expect(speedInk(15)).toBe('#00121F')
  })
})
