import { existsSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('publishes the support page and its Markdown source', () => {
  expect(existsSync('.output/public/support.md')).toBe(true)

  const page = readFileSync('.output/public/support/index.html', 'utf8')
  const markdown = readFileSync('.output/public/support.md', 'utf8')

  expect(page).toContain('href="/support.md"')
  expect(page).toContain('slackwater@openwaters.io')
  expect(markdown).toContain('# Support')
  expect(markdown).toContain('slackwater@openwaters.io')
})
