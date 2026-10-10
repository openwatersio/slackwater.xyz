import { existsSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { TCD } from './links'

it('publishes the support page and its Markdown source', () => {
  expect(existsSync('.output/public/support.md')).toBe(true)

  const page = readFileSync('.output/public/support/index.html', 'utf8')
  const markdown = readFileSync('.output/public/support.md', 'utf8')

  expect(page).toContain('href="/support.md"')
  expect(page).toContain('slackwater@openwaters.io')
  expect(markdown).toContain('# Support')
  expect(markdown).toContain('slackwater@openwaters.io')
})

it('publishes the accuracy receipt from its maintained Markdown source', () => {
  const page = readFileSync('.output/public/accuracy/index.html', 'utf8')
  const markdown = readFileSync('.output/public/accuracy.md', 'utf8')
  expect(page).toContain('href="/accuracy.md"')
  expect(markdown).toBe(readFileSync('src/content/accuracy.md', 'utf8'))
})

it('links the OpenCPN download to the database release the site is built against', async () => {
  const page = readFileSync('.output/public/opencpn/index.html', 'utf8')
  expect(page).toContain(`href="${TCD.url}"`)
})

it('counts the OpenCPN comparison from the database release the site is built against', async () => {
  // The station counts and quality figures in opencpn.md are written by hand
  // from one release. This can't check the figures themselves; it fails on a
  // database bump as a reminder to recount them and update the release refs.
  const { version } = await import('@slackwater/database/package.json')
  const markdown = readFileSync('src/content/opencpn.md', 'utf8')
  expect(markdown).toContain(TCD.date ? `slackwater-${TCD.date}.tcd` : `v${version}`)
  expect(markdown).toContain(`slackwater-database/blob/v${version}/quality.json`)
})
