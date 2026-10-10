import { expect, it } from 'vitest'
import { tcdLink } from './links'

it('links a dated beta straight to its TCD asset', () => {
  expect(tcdLink('1.0.0-beta.20261009')).toEqual({
    url: 'https://github.com/openwatersio/slackwater-database/releases/download/v1.0.0-beta.20261009/slackwater-20261009.tcd',
    date: '20261009',
  })
})

it('falls back to the release list for a version without a date', () => {
  expect(tcdLink('1.0.0')).toEqual({
    url: 'https://github.com/openwatersio/slackwater-database/releases',
  })
})
