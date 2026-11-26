import { expect, it } from 'vitest'
import { prerenderPath } from './prerender'

it('leaves instant URLs to the worker while keeping event and station pages', () => {
  expect(prerenderPath('/tides/us/wa/seattle/2026-11-27T07:39-08:00')).toBe(false)
  expect(prerenderPath('/tides/us/wa/seattle/2026-11-27T07%3A39-08%3A00/')).toBe(false)
  expect(prerenderPath('/tides/us/wa/seattle/')).toBe(true)
  expect(prerenderPath('/water-events/seattle-2026-11-27/')).toBe(true)
  expect(prerenderPath('/preview/react')).toBe(false)
})
