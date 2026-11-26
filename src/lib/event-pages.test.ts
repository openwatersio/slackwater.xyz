import { existsSync, readFileSync } from 'node:fs'
import { instantPath } from '../routes/instant-url'
import { describe, expect, it } from 'vitest'
import { EVENTS, eventPath } from './water-events'

describe('shareable event pages', () => {
  it.each(EVENTS)('$id serves the same prediction in the page and preview', (event) => {
    const html = readFileSync(`.output/public${eventPath(event)}index.html`, 'utf8')
    expect(html).toContain(event.value)
    const descriptions = [...html.matchAll(/<meta[^>]*property="og:description"[^>]*>/g)].map((match) => match[0])
    expect(descriptions.some((tag) => tag.includes(event.value) && tag.includes(event.source))).toBe(true)
    expect(html).toContain(event.source)
    expect(html).toContain(`https://slackwater.xyz${eventPath(event)}`)
    const markdown = readFileSync(`.output/public${eventPath(event).slice(0, -1)}.md`, 'utf8')
    expect(markdown).toContain(instantPath(event.path, new Date(event.time), event.timeZone))
    const instant = instantPath(event.path, new Date(event.time), event.timeZone)
    expect(existsSync(`.output/public${instant}/index.html`)).toBe(false)
  })
})
