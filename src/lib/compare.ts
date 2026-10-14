/**
 * The comparison pages: markdown in `src/content/compare/`, one file per page,
 * keyed by the path in its own frontmatter. The frontmatter is the single
 * source for the URL, title and description, so a page moves by editing one
 * line, and the copy stays reviewable as prose rather than JSX.
 *
 * Drafts and the competitor fact sheet live in slackwater-ios under
 * `docs/competitors/`; this directory is what ships.
 */
const files = import.meta.glob('../content/compare/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface ComparePage {
  path: string
  title: string
  description: string
  markdown: string
  /** The page's `#` heading. */
  heading: string
  /** The newest full date the prose states, as YYYY-MM-DD: when something on the page was last checked. */
  updated: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const PROSE_DATE = new RegExp(`\\b(${MONTHS.join('|')}) (\\d{1,2}), (\\d{4})\\b`, 'g')

/**
 * Read from the prose rather than kept in frontmatter so the structured data
 * cannot drift from the "checked October 9, 2026" lines a reader sees. A page
 * that states no date fails the build.
 */
export function newestProseDate(markdown: string): string | undefined {
  return [...markdown.matchAll(PROSE_DATE)]
    .map(([, month, day, year]) => `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}-${day.padStart(2, '0')}`)
    .reduce<string | undefined>((a, b) => (a && a > b ? a : b), undefined)
}

function parse(raw: string): ComparePage {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) throw new Error('compare page without frontmatter')
  const meta = Object.fromEntries(
    m[1].split('\n').map((line) => {
      const i = line.indexOf(':')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
  )
  const path = new URL(meta.url).pathname
  const heading = m[2].match(/^# (.+)$/m)?.[1]
  const updated = newestProseDate(m[2])
  if (!heading || !updated) throw new Error(`${path} needs a # heading and a dated "checked" line`)
  return { path, title: meta.title, description: meta.description, markdown: m[2], heading, updated }
}

export const COMPARE_PAGES: Record<string, ComparePage> = Object.fromEntries(
  Object.values(files).map(parse).map((p) => [p.path, p]),
)

export const COMPARE_PATHS = Object.keys(COMPARE_PAGES).sort()
