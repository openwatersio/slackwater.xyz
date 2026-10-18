import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { COMPARE_PAGES, COMPARE_PATHS, newestProseDate } from './compare'
import { APP_STORE, MINIMUM_IOS, REQUIREMENT } from './links'

describe('compare pages', () => {
  it('parses every page with a path, title and description', () => {
    expect(COMPARE_PATHS.length).toBe(7)
    for (const p of Object.values(COMPARE_PAGES)) {
      expect(p.path).toMatch(/^\/(compare|alternatives)\/[a-z0-9-]+\/$/)
      expect(p.title).toContain('Slackwater')
      expect(p.description.length).toBeGreaterThan(40)
    }
  })

  it('dates every page by the newest date its prose states', () => {
    expect(COMPARE_PAGES['/alternatives/tide-guide/'].updated).toBe('2026-10-12')
    expect(COMPARE_PAGES['/compare/slackwater-vs-ayetides/'].updated).toBe('2026-10-14')
    for (const p of Object.values(COMPARE_PAGES)) expect(p.heading, p.path).not.toMatch(/Slackwater$|—/)
  })

  it('reads full dates only, and the newest of them', () => {
    expect(newestProseDate('Launched April 2026. Checked September 4, 2026; then October 9, 2026.')).toBe('2026-10-09')
    expect(newestProseDate('Checked June 3, 2026 and May 31, 2026.')).toBe('2026-06-03')
    expect(newestProseDate('Launched April 2026.')).toBeUndefined()
  })

  it('references only screenshots that exist, and links only to pages that exist', () => {
    // A markdown page can name any image or sibling page and render fine; the
    // reader gets a broken image or a 404. This is the only thing that checks.
    for (const p of Object.values(COMPARE_PAGES)) {
      for (const [, src] of p.markdown.matchAll(/\]\((\/shots\/compare\/[^)]+)\)/g)) {
        expect(existsSync(`public${src}`), `${p.path} → ${src}`).toBe(true)
      }
      for (const [, href] of p.markdown.matchAll(/\]\((\/(?:compare|alternatives)\/[^)]+)\)/g)) {
        expect(COMPARE_PAGES[href], `${p.path} → ${href}`).toBeDefined()
      }
    }
  })

  it('leaves Slackwater prices to the maintained pricing page', () => {
    // Keep current Slackwater prices in /pricing/ rather than duplicating them across comparisons.
    for (const p of Object.values(COMPARE_PAGES)) {
      for (const line of p.markdown.split('\n')) {
        if (/\$\d/.test(line) && /^\| (Price|Slackwater)/.test(line)) {
          const cells = line.split('|').map((c) => c.trim())
          const ours = cells[cells.length - 2]
          expect(ours, `${p.path}: ${line}`).not.toMatch(/\$\d/)
        }
      }
    }
  })

  it('closes with the requirement the install buttons state', () => {
    // Markdown can't import MINIMUM_IOS, so a bump in links.ts fails here
    // until every page is edited. Competitor iOS versions stay off the pages
    // so that every "iOS N" is Slackwater's.
    for (const p of Object.values(COMPARE_PAGES)) {
      expect(p.markdown, p.path).toContain(`**[Download Slackwater on the App Store](${APP_STORE})** · Free, no account. ${REQUIREMENT}`)
      for (const [, v] of p.markdown.matchAll(/\biOS (\d+)/g)) expect(v, p.path).toBe(MINIMUM_IOS)
    }
  })

  it('does not hard-code Slackwater tide station counts', () => {
    for (const p of Object.values(COMPARE_PAGES)) {
      expect(p.markdown, p.path).not.toMatch(
        /Slackwater ships [\d,]+ tide stations|\| Tides \|.*\| [\d,]+ stations worldwide \|/,
      )
    }
  })
})
