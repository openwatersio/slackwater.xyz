import { describe, expect, it } from 'vitest'
import { loadCatalogue } from './catalogue'
import { PASS_GUIDES, parseGuide } from './passes'

const text = (html: string) => html.replace(/<[^>]+>/g, '')

describe('pass guides', () => {
  it('covers the passes boaters plan around', () => {
    // #182: the five with the most search intent and nothing on the page.
    for (const id of [
      'chs-seymour-narrows',
      'chs-dodd-narrows',
      'chs-active-pass',
      'chs-sechelt-rapids',
      'chs-gillard-passage',
    ]) {
      expect(PASS_GUIDES.has(id), id).toBe(true)
    }
  })

  it('belongs only to CHS current stations the site publishes', () => {
    const chs = new Set(loadCatalogue().filter((s) => s.source === 'chs' && s.kind === 'current').map((s) => s.id))
    expect([...PASS_GUIDES.keys()].filter((id) => !chs.has(id))).toEqual([])
  })

  it('describes the pass in a description a search result shows whole', () => {
    for (const [id, g] of PASS_GUIDES) {
      expect(g.description, id).not.toMatch(/^Station information/)
      expect(g.description.length, id).toBeLessThanOrEqual(160)
    }
  })

  it('cites a source for every answer and lists its sources', () => {
    for (const [id, g] of PASS_GUIDES) {
      expect(g.faq.length, id).toBeGreaterThanOrEqual(3)
      for (const q of g.faq) expect(q.html, `${id}: ${q.question}`).toMatch(/<a href="https?:\/\//)
      expect(g.sources, id).toMatch(/<h2>Sources<\/h2>/)
      // An unresolved reference link renders as its literal brackets.
      for (const html of [g.html, g.sources, ...g.faq.map((q) => q.html)]) expect(html, id).not.toMatch(/\]\[/)
    }
  })

  it('quotes no prediction and names no prediction method', () => {
    // DFO's terms forbid re-serving its predictions (#44): a clock time is the
    // shape of one. And the app predicts some gates on device and fetches
    // others, so any sentence naming a mechanism is false for one group.
    for (const [id, g] of PASS_GUIDES) {
      const all = text([g.html, g.sources, ...g.faq.map((q) => q.question + q.html)].join(' '))
      expect(all, id).not.toMatch(/\b\d{1,2}:\d{2}\b/)
      expect(all, id).not.toMatch(/offline|on[- ]device|fitted|harmonic/i)
    }
  })

  it('splits a guide into body, questions and sources', () => {
    const { station, guide } = parseGuide(
      [
        '---',
        'station: chs-x',
        'description: A pass.',
        '---',
        'Intro, per [SD][sd].',
        '',
        '## Questions',
        '',
        '### How fast?',
        '',
        'Fast ([SD][sd]).',
        '',
        '### When?',
        '',
        'At slack.',
        '',
        '## Sources',
        '',
        '1. [SD][sd]',
        '',
        '[sd]: https://example.com/sd.pdf',
        '',
      ].join('\n'),
    )
    expect(station).toBe('chs-x')
    expect(guide.html).toBe('<p>Intro, per <a href="https://example.com/sd.pdf">SD</a>.</p>')
    expect(guide.faq.map((q) => q.question)).toEqual(['How fast?', 'When?'])
    expect(guide.faq[0].html).toBe('<p>Fast (<a href="https://example.com/sd.pdf">SD</a>).</p>')
    expect(guide.sources).toMatch(/^<h2>Sources<\/h2>/)
  })
})
