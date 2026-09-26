import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StationIndex } from './StationIndex'
import { loadCatalogue } from '#/lib/catalogue'
import type { StationRow } from '#/lib/catalogue-server'
import type { Kind } from '#/lib/station'

// A country page heads its rows by water where the provider named one and by
// jurisdiction otherwise, which is what `toAreaRow` builds in `catalogue-server`.
// Feeding the component `region` alone would test a row shape no page produces.
const toRow = (s: { slug: string; name: string; region?: string; area?: string }): StationRow => {
  const region = s.region ?? s.area
  return { slug: s.slug, name: s.name, ...(region ? { region } : {}) }
}

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

  it('heads the current index by jurisdiction, as the tide index is', () => {
    // A current row is placed the same way a tide row is, so the worldwide
    // list reads as states and provinces rather than 865 names in one column.
    const html = renderToStaticMarkup(<StationIndex kind="current" rows={rowsFor('current')} />)
    expect(html).toContain('>Washington<')
    expect(html).toContain('>Maine<')
  })

  it('groups a page the water names, and leaves one it does not flat', () => {
    // Two real pages rather than the whole corpus, because the threshold is
    // per page now. Japan's rows are 99% placed and read as prefectures;
    // Alaska's are 49%, and grouping those would put more stations under
    // `Elsewhere` than under every real heading combined.
    const inCountry = (country: string) =>
      loadCatalogue().filter((s) => s.kind === 'tide' && s.country === country)
    // Both are place pages, which always carry the crumb up — and that is
    // what keeps the tides explainer, with its own heading, off them.
    const up = { href: '/stations/tides/', label: 'Tide stations' }
    const japan = renderToStaticMarkup(<StationIndex kind="tide" up={up} rows={inCountry('Japan').map(toRow)} />)
    expect(japan).toContain('<h2')

    // A subdivision page heads by water alone — the jurisdiction is its title.
    const alaska = inCountry('United States')
      .filter((s) => s.state === 'AK')
      .map((s) => ({ slug: s.slug, name: s.name, ...(s.region ? { region: s.region } : {}) }))
    expect(alaska.length).toBeGreaterThan(100)
    expect(renderToStaticMarkup(<StationIndex kind="tide" up={up} rows={alaska} />)).not.toContain('<h2')
  })

  it('promotes the tides guide on the tide index only', () => {
    const tides = renderToStaticMarkup(<StationIndex kind="tide" rows={[]} />)
    const currents = renderToStaticMarkup(<StationIndex kind="current" rows={[]} />)

    expect(tides).toContain('Why does the Moon make two high tides?')
    expect(currents).not.toContain('Why does the Moon make two high tides?')
  })
})
