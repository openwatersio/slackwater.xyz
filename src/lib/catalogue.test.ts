import { describe, expect, it } from 'vitest'
import tzLookup from 'tz-lookup'
import { cleanName } from '@openwaters/station-metadata'
import { loadCatalogue } from './catalogue'
import { predictSeries } from './predict'
import { nearby } from './nearby'

describe('loadCatalogue', () => {
  const all = loadCatalogue()

  it('yields every station whose data ships on npm, plus the CHS gates and ports', () => {
    expect(all.length).toBe(3640)
    expect(all.filter((s) => s.kind === 'tide').length).toBe(2775)
    expect(all.filter((s) => s.kind === 'current').length).toBe(865)
  })

  it('builds the ten CHS tide ports whose identity IS published, and no more', () => {
    // The registry publishes curated identity for exactly ten Canadian tide
    // ports. The other 1,048 exist only as slugs — identity for them needs an
    // operator run against IWLS and a release (#17), so a count creeping above
    // ten here means something started inventing identity from a slug table.
    const ports = all.filter((s) => s.kind === 'tide' && s.source === 'chs')
    expect(ports).toHaveLength(10)
    expect(ports.map((s) => s.slug).sort()).toEqual([
      'campbell-river', 'fulford-harbour', 'owen-bay', 'point-atkinson',
      'port-alberni', 'port-renfrew', 'sooke', 'tofino', 'vancouver', 'victoria',
    ])
    // Buildability is decided by id shape (`id.includes('/')`), not a `chs-`/`noaa-`
    // prefix: `noaa-boundary-pass` is registry-owned despite its name, and a prefix
    // test would let it through to a throw.
    expect(all.some((s) => s.id === 'noaa-boundary-pass')).toBe(false)
    // The id-shape invariant itself: every row in the catalogue either came
    // from `chsStations()` (a hand-built identity, no provider package
    // involved) or has a slashed id from a provider package. Nothing else is
    // buildable.
    expect(all.every((s) => s.source === 'chs' || s.id.includes('/'))).toBe(true)
  })

  it('gives a CHS port no constituents to be predicted from', () => {
    // The licensing rule as a property of the catalogue, not of a component:
    // if one of these ever arrived with constituents, every guard downstream
    // would let it through and the site would prerender a CHS curve.
    for (const s of all.filter((x) => x.source === 'chs')) {
      expect(s, s.id).not.toHaveProperty('constituents')
    }
  })

  it('builds the flagship gate', () => {
    expect(all.some((s) => s.slug === 'dodd-narrows' && s.kind === 'current')).toBe(true)
  })

  it('gives every station what it needs to be predicted and addressed', () => {
    for (const s of all) {
      expect(s.slug, s.id).toMatch(/^[a-z0-9-]+$/)
      expect(Number.isFinite(s.latitude), s.id).toBe(true)
      expect(s.name.trim(), s.id).not.toBe('')
    }
    for (const s of all.filter((s) => s.source === 'bundled')) {
      expect(s.constituents.length, s.id).toBeGreaterThan(0)
    }
  })

  it('keeps slugs unique within a kind and allows reuse across kinds', () => {
    for (const kind of ['tide', 'current'] as const) {
      const slugs = all.filter((s) => s.kind === kind).map((s) => s.slug)
      expect(new Set(slugs).size, kind).toBe(slugs.length)
    }
  })

  it('is deterministic', () => {
    expect(loadCatalogue().map((s) => s.id)).toEqual(all.map((s) => s.id))
  })

  it('resolves the hero station, which the homepage also renders', () => {
    const d = all.find((s) => s.id === 'noaa/PUG1701')
    expect(d?.name).toBe('Deception Pass (Narrows)')
    expect(d?.kind).toBe('current')
  })

  it('gives Deception Pass its real local zone, not UTC', () => {
    // The current bundle carries no timezone field at all - catalogue.ts must
    // derive one from coordinates. Asserting the zone itself, not merely that
    // one is present, is the point: a "has a timezone" check passes on 'UTC'.
    const d = all.find((s) => s.id === 'noaa/PUG1701')
    expect(d?.timezone).toBe('America/Los_Angeles')
  })

  it('never silently defaults a current station to UTC', () => {
    // Every current station's timezone must match what its own coordinates
    // resolve to. A station whose zone happens to genuinely be UTC would
    // still pass, since tzLookup itself would agree - the point is that a
    // UTC result can never come from a missing-data fallback instead.
    for (const s of all.filter((s) => s.kind === 'current')) {
      expect(s.timezone, s.id).toBe(tzLookup(s.latitude, s.longitude))
    }
  })
  it('cleans provider names instead of shouting them', () => {
    // NOAA publishes 86 of its tide stations all-caps ("ALBANY"); issue #31.
    const albany = all.find((s) => s.id === 'noaa/8518995')
    expect(albany?.name).toBe('Albany')
    const turkey = all.find((s) => s.id === 'noaa/8518962')
    expect(turkey?.name).toBe('Turkey Point, Hudson River')
    // Every name is a fixed point of the cleaner - the wiring contract, not a
    // re-test of cleanName itself, which station-metadata's own suite owns.
    for (const s of all) {
      expect(s.name, s.id).toBe(cleanName(s.name))
    }
  })

  it('gives a registry station its curated name, not the provider row name', () => {
    const bp = all.find((s) => s.kind === 'current' && s.slug === 'boundary-pass')
    expect(bp?.name).toBe('Boundary Pass')
    expect(bp?.region).toBe('Saturna & Patos Islands')
  })

  it('collapses a merged pair to one row', () => {
    // station-metadata 4.1.2 points both ids of a merged pair at one slug. Only
    // one half is buildable today, so this passes before the dedupe exists - it
    // is here as the tripwire for the CHS gates, where both halves build.
    const rows = all.filter((s) => s.kind === 'current' && s.slug === 'boundary-pass')
    expect(rows.length).toBe(1)
  })

  it('gives a CHS gate neighbours to link to', () => {
    const dodd = all.find((s) => s.slug === 'dodd-narrows' && s.kind === 'current')!
    const near = nearby(dodd, all, 6)
    expect(near.length).toBe(6)
    expect(near.every((s) => s.kind === 'current')).toBe(true)
    expect(near.some((s) => s.id.startsWith('chs-'))).toBe(true)
  })
})

/**
 * Heights are quoted against a datum or they are not heights. The constituent
 * sum comes out relative to MSL; the app shifts each station onto the datum its
 * own charts are drawn to, and the site has to say the same numbers.
 *
 * The offsets here are the app's own, read from `Slackwater/Resources/stations.json`
 * (generated by `tools/gen-tides.mjs`: `datums.MSL - datums[chart_datum]`). Pinning
 * its numbers rather than recomputing them is the point — an independent
 * implementation is the only thing that catches a rule that is wrong in the
 * same way in both places.
 */
describe('chart datum', () => {
  const all = loadCatalogue()
  const bundled = (id: string) => {
    const s = all.find((x) => x.id === id)
    if (!s || s.source !== 'bundled') throw new Error(`no bundled station ${id}`)
    return s
  }
  const FEET_PER_METRE = 3.28084

  it('shifts a station onto its own chart datum, in feet not metres', () => {
    // The app ships Seattle at datumOffset 2.024 m. The site speaks feet from the
    // catalogue boundary on, so the same shift has to arrive here as 6.64 ft — a
    // metre-shaped offset would lift the curve 3.28x too little and look plausible.
    const seattle = bundled('noaa/9447130')
    expect(seattle.chartDatum).toBe('MLLW')
    expect(seattle.offset).toBeCloseTo(2.024 * FEET_PER_METRE, 2)
  })

  it('uses each station its own datum, not MLLW everywhere', () => {
    // The corpus spans 8 chart datums and MLLW covers 1,418 of 2,765 bundled tide
    // stations. Shifting a Greenland or Canadian station by an MLLW offset —
    // or labelling it MLLW — is wrong for more than half the world.
    const aasiaat = bundled('ticon/aasiaat-aas-grl-gloss')
    expect(aasiaat.chartDatum).toBe('LAT')
    expect(aasiaat.offset).toBeCloseTo(1.572 * FEET_PER_METRE, 2)

    const albert = bundled('ticon/albert_harbour-5803-can-meds')
    expect(albert.chartDatum).toBe('LLWLT')
    expect(albert.offset).toBeCloseTo(1.023 * FEET_PER_METRE, 2)
  })

  it('leaves a station already quoted on MSL exactly where it was', () => {
    // 117 stations chart to MSL, so MSL - MSL = 0 and the curve must not move.
    const althagen = bundled('ticon/althagen-9650024-deu-wsv')
    expect(althagen.chartDatum).toBe('MSL')
    expect(althagen.offset).toBe(0)
  })

  it('shifts nothing when the provider ships no datums', () => {
    // Fort Wadsworth and Eugene Island ship `datums: {}`. The app labels both
    // STND and shifts neither; inventing an offset for them would be a guess
    // rendered to one decimal place and indistinguishable from a measurement.
    const fw = bundled('noaa/8519024')
    expect(fw.chartDatum).toBe('STND')
    expect(fw.offset).toBe(0)
  })

  it('names a datum for every tide station, so no page can label heights "undefined"', () => {
    for (const s of all) {
      if (s.kind !== 'tide' || s.source !== 'bundled') continue
      expect(typeof s.chartDatum === 'string' && s.chartDatum.length > 0, s.id).toBe(true)
    }
  })

  it('puts Seattle low water above the datum a chart would quote', () => {
    // The number a reader takes to the water, not a shape. Over this window the
    // MSL-relative curve ran -5.83 to 4.72 ft — a low almost six feet "below"
    // the water, which is true of mean sea level and false of any chart. On
    // MLLW the same water reads 0.81 to 11.36.
    //
    // A missing offset, a doubled one, or a sign flip all survive every
    // structural assertion in this file. None of them survive this one.
    const levels = predictSeries(bundled('noaa/9447130'), new Date('2026-09-01T00:00:00Z'), 24)
      .map((p) => p.level)
    expect(Math.min(...levels)).toBeCloseTo(0.81, 1)
    expect(Math.max(...levels)).toBeCloseTo(11.36, 1)
  })

  it('leaves currents alone, whose offset is mean flow and not a datum', () => {
    // Both fields are called `offset` and mean entirely different things. A
    // current shifted by a tide datum would read as a permanent one-way flow.
    const deception = bundled('noaa/PUG1701')
    expect(deception.chartDatum).toBeUndefined()
  })
})
