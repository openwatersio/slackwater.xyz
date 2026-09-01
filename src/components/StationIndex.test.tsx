import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StationIndex } from './StationIndex'
import { loadCatalogue } from '#/lib/catalogue'
import type { StationRow } from '#/lib/catalogue-server'
import type { Kind } from '#/lib/station'

const toRow = (s: { slug: string; name: string; region?: string }): StationRow => ({
  slug: s.slug,
  name: s.name,
  ...(s.region ? { region: s.region } : {}),
})

const rowsFor = (kind: Kind) => loadCatalogue().filter((s) => s.kind === kind).map(toRow)

describe('StationIndex', () => {
  it('never buries more than half of one kind under a single Elsewhere-shaped heading', () => {
    // The regression this guards: 24 curated Canadian rows (23 CHS gates plus
    // `boundary-pass`) each carrying a region used to be enough to flip the
    // whole current index into "grouped", which sorted 24 one-station
    // headings ahead of an `Elsewhere` bucket holding the other 841 US
    // stations - the bulk of the corpus, buried under a heading that isn't a
    // place. Nothing asserted the index's shape, so it shipped silently.
    for (const kind of ['tide', 'current'] as const) {
      const html = renderToStaticMarkup(<StationIndex kind={kind} rows={rowsFor(kind)} />)
      const totalLinks = (html.match(/<li/g) ?? []).length
      const sections = html.split('<section')
      const elsewhere = sections.find((s) => s.includes('>Elsewhere<'))
      const elsewhereLinks = elsewhere ? (elsewhere.match(/<li/g) ?? []).length : 0
      expect(elsewhereLinks, kind).toBeLessThanOrEqual(totalLinks / 2)
    }
  })

  it('renders the current index flat, having almost no placeable regions', () => {
    const html = renderToStaticMarkup(<StationIndex kind="current" rows={rowsFor('current')} />)
    expect(html).not.toContain('<h2')
  })

  it('groups the tide index, which is overwhelmingly regioned', () => {
    const html = renderToStaticMarkup(<StationIndex kind="tide" rows={rowsFor('tide')} />)
    expect(html).toContain('<h2')
  })
})
