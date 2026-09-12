import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')

const themedSources = [
  './routes/index.tsx',
  './routes/privacy.tsx',
  './routes/support.tsx',
  './components/ComparePage.tsx',
  './components/Shot.tsx',
  './components/StationPage.tsx',
  // DayStrip text and its bg-white/10 pill sit inside the always-dark curve overlay.
  './components/DayStrip.tsx',
]

describe('site appearances', () => {
  it('defines the approved sea-glass tokens', () => {
    expect(css).toContain('html[data-appearance="light"]')
    for (const value of ['#eef6f3', '#082437', '#153f4f', '#3f6573', '#4b732f']) {
      expect(css).toContain(value)
    }
    expect(css).toContain('color-scheme: light')
  })

  it('keeps Night as the document default', () => {
    expect(css).toMatch(/html\s*{[^}]*color-scheme:\s*dark/s)
  })

  it('uses appearance tokens for themed borders, rings, and surfaces', () => {
    for (const path of themedSources) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8')
      const literals = source.match(/(?:border|ring|bg)-white(?:\/\d+)?/g) ?? []
      expect({ path, literals }).toEqual({
        path,
        literals: path === './components/DayStrip.tsx' ? ['bg-white/10'] : [],
      })
    }
  })
})
