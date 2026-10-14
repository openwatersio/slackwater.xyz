// SERVER ONLY: imported by `catalogue-server.ts`, so a guide reaches its page
// through loader data and never through the client bundle.
import { marked } from 'marked'

/**
 * The pass guides: markdown in `src/content/passes/`, one file per CHS gate,
 * keyed by the station id in its own frontmatter.
 *
 * They exist because a CHS page cannot carry its predictions (#44), which left
 * the passes with the most search intent serving a name and nothing else. A
 * guide explains the water — published peak rates, how slack behaves, how
 * people plan the transit — and cites a source for every claim. It never
 * quotes a DFO prediction, and it never says how the app predicts the gate.
 *
 * The copy is prose in a data file rather than JSX so it can be reviewed, and
 * grow, one pass at a time.
 */
const files = import.meta.glob('../content/passes/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface PassGuide {
  /** The page's meta description, replacing the identity-only one. */
  description: string
  /** Every section before the questions, rendered. */
  html: string
  /** The questions, rendered on the page and emitted as `FAQPage`. */
  faq: { question: string; html: string }[]
  /** Every section after the questions — the sources — rendered. */
  sources: string
}

/** The heading that starts the questions. Each `###` under it is one question. */
const QUESTIONS = '## Questions'

export function parseGuide(raw: string): { station: string; guide: PassGuide } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) throw new Error('pass guide without frontmatter')
  const meta = Object.fromEntries(
    m[1].split('\n').map((line) => {
      const i = line.indexOf(':')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
  )
  if (!meta.station || !meta.description) throw new Error('pass guide needs a station and a description')
  // Sources are cited as reference links defined once at the foot of the file.
  // Each part below is rendered on its own, so each needs the definitions.
  const refs = m[2].match(/^\[[^\]]+\]: \S+$/gm)?.join('\n') ?? ''
  const render = (markdown: string) => marked.parse(`${markdown}\n\n${refs}`, { async: false }).trim()
  const [body, rest] = m[2].split(`\n${QUESTIONS}\n`)
  if (rest === undefined) throw new Error(`${meta.station}: pass guide without "${QUESTIONS}"`)
  // The questions run to the next `##`, which is the sources.
  const end = rest.search(/^## /m)
  const faq = (end === -1 ? rest : rest.slice(0, end))
    .split(/^### /m)
    .slice(1)
    .map((block) => {
      const nl = block.indexOf('\n')
      return { question: block.slice(0, nl).trim(), html: render(block.slice(nl + 1)) }
    })
  return {
    station: meta.station,
    guide: {
      description: meta.description,
      html: render(body),
      faq,
      sources: end === -1 ? '' : render(rest.slice(end)),
    },
  }
}

/** Every guide, by CHS station id. */
export const PASS_GUIDES: ReadonlyMap<string, PassGuide> = new Map(
  Object.values(files).map(parseGuide).map(({ station, guide }) => [station, guide]),
)
