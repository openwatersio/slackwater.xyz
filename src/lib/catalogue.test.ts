import { describe, expect, it } from 'vitest'
import { loadCatalogue } from './catalogue'
import { predictSeries } from './predict'
import { nearby } from './nearby'

/** The ten provinces and three territories, as ISO 3166-2 spells their codes. */
const CANADA = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'])

describe('loadCatalogue', () => {
  const all = loadCatalogue()

  it('yields every station whose data ships on npm, plus the CHS gates and ports', () => {
    expect(all.length).toBe(5657)
    expect(all.filter((s) => s.kind === 'tide').length).toBe(4792)
    expect(all.filter((s) => s.kind === 'current').length).toBe(865)
  })

  it('skips the subordinate current stations it cannot predict', () => {
    // NOAA's subordinate stations are a reduction against a reference station,
    // not constituents, and `predict.ts` sums constituents. Built anyway they
    // prerender to a head with no body. The slug table names 1,692 of them; a
    // count above zero here means blank pages shipped (#80).
    const blank = all.filter((s) => s.source === 'bundled' && !s.constituents?.length)
    expect(blank).toHaveLength(0)
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
    // Asserting the zone itself, not merely that one is present, is the
    // point: a "has a timezone" check passes on 'UTC'.
    const d = all.find((s) => s.id === 'noaa/PUG1701')
    expect(d?.timezone).toBe('America/Los_Angeles')
  })

  it('takes a current station\'s zone from the database, not from its coordinates', () => {
    // The database publishes the zone NOAA files each station under. A
    // coordinate lookup disagrees on 27 of them, and is wrong where it does:
    // it puts Wrangell Narrows, Alaska, in Vancouver's zone and Discovery
    // Island, a US station off Victoria, in Canada's.
    const byId = new Map(all.map((s) => [s.id, s]))
    expect(byId.get('noaa/SEA0103')?.timezone).toBe('America/Sitka')
    expect(byId.get('noaa/PUG1636')?.timezone).toBe('America/Los_Angeles')
    for (const s of all.filter((s) => s.kind === 'current' && s.source === 'bundled')) {
      expect(s.timezone, s.id).not.toBe('UTC')
    }
  })
  it('cleans provider names instead of shouting them', () => {
    // NOAA publishes 86 of its tide stations all-caps ("ALBANY"); issue #31.
    const albany = all.find((s) => s.id === 'noaa/8518995')
    expect(albany?.name).toBe('Albany')
    // The database splits a provider's comma-joined name into the place and
    // the water it is in, so the qualifier is on the region rather than lost.
    const turkey = all.find((s) => s.id === 'noaa/8518962')
    expect(turkey?.name).toBe('Turkey Point')
    expect(turkey?.region).toBe('Hudson River')
  })

  it('applies station-metadata corrections to provider stations', () => {
    const madHorseCreek = all.find((s) => s.id === 'noaa/8537535')
    expect(madHorseCreek?.name).toBe('1 nm above entrance, Mad Horse Creek')
  })

  it('gives a registry station its curated name, not the provider row name', () => {
    const bp = all.find((s) => s.kind === 'current' && s.slug === 'boundary-pass')
    expect(bp?.name).toBe('Boundary Pass')
    expect(bp?.region).toBe('Saturna & Patos Islands')
  })

  it('places a station in a country, and in its subdivision', () => {
    // `state` is an ISO 3166-2 subdivision the database vouched for, which it
    // publishes for the United States and Canada and nowhere else.
    const seattle = all.find((s) => s.kind === 'tide' && s.slug === 'seattle')
    expect(seattle?.country).toBe('United States')
    expect(seattle?.state).toBe('WA')

    // Well inland on Lake Ontario, deliberately. A station within sight of the
    // border is a poor witness for "the database places this correctly": Jim
    // Creek stood here until the database stopped reading a gauge's country
    // off the agency that publishes it, and moved it from BC to Washington,
    // which is where it is.
    const canadian = all.find((s) => s.kind === 'tide' && s.slug === 'burlington-hamilton-on')
    expect(canadian?.country).toBe('Canada')
    expect(canadian?.state).toBe('ON')

    // A few Canadian rows carry a stray US code ("MI" on the Ontario side of
    // the Detroit River). The code has to agree with the row's own country, so
    // a contradicting one is no state — and the USPS fallback that fills in
    // where the gazetteer stayed silent never applies outside the US.
    const strays = all.filter(
      (s) => s.country === 'Canada' && s.state !== undefined && !CANADA.has(s.state),
    )
    expect(strays.map((s) => `${s.id}:${s.state}`)).toEqual([])

    // A current row is placed the same way a tide row is.
    const pass = all.find((s) => s.kind === 'current' && s.id === 'noaa/PUG1701')
    expect(pass?.country).toBe('United States')

    // A curated CHS record is in the database too, so its province is read
    // rather than inferred from which side of the Rockies it falls on — which
    // is how the one in Nova Scotia used to get no province at all.
    const victoria = all.find((s) => s.id === 'chs-victoria')
    expect(victoria?.state).toBe('BC')
    const brasdor = all.find((s) => s.id === 'chs-great-bras-dor')
    expect(brasdor?.state).toBe('NS')

    // CHS identity comes from the registry, which publishes no country field.
    const chs = all.find((s) => s.source === 'chs')
    expect(chs?.country).toBe('Canada')
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
