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
  return { path, title: meta.title, description: meta.description, markdown: m[2] }
}

export const COMPARE_PAGES: Record<string, ComparePage> = Object.fromEntries(
  Object.values(files).map(parse).map((p) => [p.path, p]),
)

export const COMPARE_PATHS = Object.keys(COMPARE_PAGES).sort()
