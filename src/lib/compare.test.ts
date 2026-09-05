import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { COMPARE_PAGES, COMPARE_PATHS } from './compare'

describe('compare pages', () => {
  it('parses every page with a path, title and description', () => {
    expect(COMPARE_PATHS.length).toBe(6)
    for (const p of Object.values(COMPARE_PAGES)) {
      expect(p.path).toMatch(/^\/(compare|alternatives)\/[a-z0-9-]+\/$/)
      expect(p.title).toContain('Slackwater')
      expect(p.description.length).toBeGreaterThan(40)
    }
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

  it('never prints a Slackwater price', () => {
    // Public repo rule from AGENTS.md: pricing stays out. Competitor prices are
    // public facts and appear; ours must not. Every dollar figure on a page has
    // to sit on a competitor's row or paragraph, so the cheap check is that
    // no line naming Slackwater also carries one.
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
})
