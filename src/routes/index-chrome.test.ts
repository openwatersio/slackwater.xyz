import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')

describe('the landing page’s surfaces', () => {
  it('gives its two cards the app’s corner and hairline', () => {
    // The stat grid and "The deal" — the only two carded sections on the page.
    expect(source.match(/rounded-3xl/g)).toHaveLength(2)
    expect(source.match(/border-sw-card-stroke/g)).toHaveLength(2)
  })

  it('leaves no card on the old radius', () => {
    expect(source).not.toContain('rounded-lg')
  })

  it('gives both cards the app’s shadow', () => {
    expect(source.match(/shadow-card/g)).toHaveLength(2)
  })
})
