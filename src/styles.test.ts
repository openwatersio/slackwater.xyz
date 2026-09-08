import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

describe("the app's tokens", () => {
  it('carries the graph inks CurveDrawing fills and lines with', () => {
    expect(css).toContain('--color-sw-graph-line: #38bdf8')
    expect(css).toContain('--color-sw-graph-high: #2dd4bf')
    expect(css).toContain('--color-sw-graph-low: #fbbf24')
  })

  it('carries the card surface', () => {
    expect(css).toContain('--color-sw-card-fill: #ffffff0d')
    expect(css).toContain('--color-sw-shadow: #001432')
    // Derived from the leaf token, not a hand-rounded alpha byte.
    expect(css).toMatch(/--color-sw-card-stroke:\s*color-mix\(in srgb, var\(--color-sw-leaf\) 16%, transparent\)/)
    expect(css).toMatch(/--shadow-card:\s*0 10px 24px color-mix\(in srgb, var\(--color-sw-shadow\) 24%, transparent\)/)
  })

  it("sets readings in the app's rounded face without loading a webfont", () => {
    expect(css).toMatch(/--font-rounded:\s*ui-rounded/)
    expect(css).not.toMatch(/@font-face|fonts\.googleapis|fonts\.gstatic/)
  })
})
