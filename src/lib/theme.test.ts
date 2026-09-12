import { describe, expect, it } from 'vitest'
import { runInNewContext } from 'node:vm'
import {
  PREPAINT_THEME_SCRIPT,
  parseThemeMode,
  resolveAppearance,
  subjectFromMatches,
} from './theme'

describe('parseThemeMode', () => {
  it('defaults missing and invalid storage to night', () => {
    expect(parseThemeMode(null)).toBe('night')
    expect(parseThemeMode('sepia')).toBe('night')
  })

  it.each(['auto', 'light', 'night', 'location'] as const)('accepts %s', (mode) => {
    expect(parseThemeMode(mode)).toBe(mode)
  })
})

describe('resolveAppearance', () => {
  it('resolves explicit and system modes', () => {
    expect(resolveAppearance('light', true)).toBe('light')
    expect(resolveAppearance('night', false)).toBe('night')
    expect(resolveAppearance('auto', true)).toBe('night')
    expect(resolveAppearance('auto', false)).toBe('light')
  })

  it('uses solar altitude for location and defaults unavailable location to night', () => {
    expect(resolveAppearance('location', false, 0.01)).toBe('light')
    expect(resolveAppearance('location', false, -0.01)).toBe('night')
    expect(resolveAppearance('location', false)).toBe('night')
  })
})

it('takes station coordinates and an instant from active route data', () => {
  const instant = new Date('2026-09-12T03:15:00Z')
  expect(subjectFromMatches([{ loaderData: { station: { latitude: 48.5, longitude: -123.1 }, instant } }])).toEqual({
    observer: { latitude: 48.5, longitude: -123.1 },
    instant,
  })
})

it('shares the storage key and supported values with the pre-paint script', () => {
  expect(PREPAINT_THEME_SCRIPT).toContain('slackwater-theme')
  expect(PREPAINT_THEME_SCRIPT).toContain('prefers-color-scheme: dark')
  expect(PREPAINT_THEME_SCRIPT).toContain('data-appearance')
})

it('preserves the active Location appearance when a URL update reruns the pre-paint script', () => {
  const attributes = new Map<string, string>()
  const context = {
    document: { documentElement: {
      hasAttribute: (key: string) => attributes.has(key),
      setAttribute: (key: string, value: string) => attributes.set(key, value),
    } },
    localStorage: { getItem: () => 'location' },
  }
  runInNewContext(PREPAINT_THEME_SCRIPT, context)
  expect(attributes.get('data-appearance')).toBe('night')
  attributes.set('data-appearance', 'light')
  runInNewContext(PREPAINT_THEME_SCRIPT, context)
  expect(attributes.get('data-appearance')).toBe('light')
})
