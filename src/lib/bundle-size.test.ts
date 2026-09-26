import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'

const ASSETS = '.output/public/assets'

describe('client bundle', () => {
  const js = () => readdirSync(ASSETS).filter((f) => f.endsWith('.js'))

  it('ships no station catalogue', () => {
    if (!existsSync(ASSETS)) return expect.fail('run `pnpm build` first')
    for (const f of js()) {
      const src = readFileSync(`${ASSETS}/${f}`, 'utf8')
      // Two stations that must never both appear in one client chunk: their
      // presence together means the catalogue was bundled rather than the one
      // station a page needs.
      const both = src.includes('Deception Pass (Narrows)') && src.includes('SEATTLE (Madison St.)')
      expect(both, `${f} contains more than one station`).toBe(false)
    }
  })

  it('keeps any single chunk under a megabyte', () => {
    for (const f of js()) {
      expect(statSync(`${ASSETS}/${f}`).size, f).toBeLessThan(1_000_000)
    }
  })

  it('keeps the whole client payload small enough that a leak cannot hide', () => {
    // A two-name check misses leakage that was split across chunks or
    // transformed. Total size is the blunt instrument that does not.
    const total = js().reduce((n, f) => n + statSync(`${ASSETS}/${f}`).size, 0)
    expect(total).toBeLessThan(1_500_000)
  })

  it('has no client chunk reaching the catalogue module', () => {
    // The import graph, not the rendered strings: this catches a leak whose
    // station names were minified, split or otherwise made unsearchable.
    for (const f of js()) {
      const src = readFileSync(`${ASSETS}/${f}`, 'utf8')
      expect(src.includes('@slackwater/database'), f).toBe(false)
      expect(src.includes('station-metadata/data'), f).toBe(false)
    }
  })
})

describe('the nearby map', () => {
  // The two pages the rest of the suite reads, one of each kind.
  const PAGES = ['currents/deception-pass-narrows', 'tides/seattle']
  const page = (p: string) => readFileSync(`.output/public/${p}/index.html`, 'utf8')

  it('keeps leaflet out of every chunk a station page preloads', () => {
    // Leaflet is imported inside an effect, behind an IntersectionObserver, so
    // it must land in its own chunk that the page never asks for up front. A
    // static import — or a helper that reaches it from module scope — folds it
    // into the route chunk, which would both cost every reader the download
    // and break the prerender outright, since Leaflet touches `window` when it
    // is evaluated.
    for (const p of PAGES) {
      const preloaded = [...page(p).matchAll(/<link[^>]*\brel="modulepreload"[^>]*>/g)]
        .map((m) => m[0].match(/href="([^"]+)"/)?.[1])
        .filter((href): href is string => !!href)
      // Without this the loop below can pass by matching nothing at all.
      expect(preloaded.length, `${p} preloads no modules`).toBeGreaterThan(0)
      for (const href of preloaded) {
        // A chunk may NAME the leaflet chunk — that is the dynamic import
        // doing its job — but must not CONTAIN it. Strip the file references
        // and anything left that says leaflet is leaflet's own code.
        const src = readFileSync(`.output/public${href}`, 'utf8').replace(/leaflet-[\w-]+\.(?:js|css)/g, '')
        expect(src.includes('leaflet'), `${href}, preloaded by ${p}`).toBe(false)
      }
    }
  })

  it('asks openstreetmap.org for nothing until a reader scrolls to the map', () => {
    // The served HTML naming a tile URL would have every crawler, unfurl
    // scraper and reader who never reaches the bottom of the page fetching
    // tiles — and would make the sentence in `src/content/privacy.md`, which
    // says the request happens when the map scrolls into view, false.
    for (const p of PAGES) {
      expect(page(p), p).not.toContain('tile.openstreetmap.org')
    }
  })
})
