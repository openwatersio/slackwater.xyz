import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'

const ASSETS = '.output/public/assets'

describe('client bundle', () => {
  const js = () => readdirSync(ASSETS).filter((f) => f.endsWith('.js'))

  it('ships no station catalogue', () => {
    if (!existsSync(ASSETS)) return expect.fail('run `pnpm build` first')
    for (const f of js()) {
      const src = readFileSync(`${ASSETS}/${f}`, 'utf8')
      // Two stations that must never both appear in one client chunk: their
      // presence together means the catalogue was bundled rather than the one
      // station a page needs.
      const both = src.includes('Deception Pass (Narrows)') && src.includes('SEATTLE (Madison St.)')
      expect(both, `${f} contains more than one station`).toBe(false)
    }
  })

  it('keeps any single chunk under a megabyte', () => {
    for (const f of js()) {
      expect(statSync(`${ASSETS}/${f}`).size, f).toBeLessThan(1_000_000)
    }
  })

  it('keeps the whole client payload small enough that a leak cannot hide', () => {
    // A two-name check misses leakage that was split across chunks or
    // transformed. Total size is the blunt instrument that does not.
    const total = js().reduce((n, f) => n + statSync(`${ASSETS}/${f}`).size, 0)
    expect(total).toBeLessThan(1_500_000)
  })

  it('has no client chunk reaching the catalogue module', () => {
    // The import graph, not the rendered strings: this catches a leak whose
    // station names were minified, split or otherwise made unsearchable.
    for (const f of js()) {
      const src = readFileSync(`${ASSETS}/${f}`, 'utf8')
      expect(src.includes('tide-database'), f).toBe(false)
      expect(src.includes('noaa-current-stations'), f).toBe(false)
      expect(src.includes('station-metadata/data'), f).toBe(false)
    }
  })
})
