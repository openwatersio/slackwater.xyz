import { describe, expect, it } from 'vitest'
import { loadCatalogue } from './catalogue'
import {
  DESCRIPTION_LIMIT, TITLE_LIMIT, datumLine, pageDescription, pageTitle, placeLine, provenance, refinedCredit, seasonalNote,
} from './copy'
import { PASS_GUIDES } from './passes'
import type { BundledStation, ChsStation } from './station'

const bundled = {
  id: 'noaa/x', kind: 'current', slug: 'x', name: 'Deception Pass', path: '/currents/us/wa/x/', source: 'bundled',
  latitude: 0, longitude: 0, timezone: 'UTC', constituents: [],
} satisfies BundledStation

const chs = {
  id: 'chs-dodd-narrows', kind: 'current', slug: 'dodd-narrows', name: 'Dodd Narrows',
  path: '/currents/ca/bc/dodd-narrows/',
  source: 'chs', region: 'Nanaimo',
  latitude: 49.1, longitude: -123.8, timezone: 'America/Vancouver',
} satisfies ChsStation

describe('provenance', () => {
  it('names harmonic constituents for a bundled station', () => {
    expect(provenance(bundled)).toBe('computed from harmonic constituents')
  })

  it('names the table reduction for a subordinate station', () => {
    expect(provenance({
      ...bundled,
      reduction: {
        referenceId: 'noaa/ref', referenceConstituents: [], referenceOffset: 0,
        slackBeforeFloodOffset: 0, slackBeforeEbbOffset: 0,
        floodTimeOffset: 0, ebbTimeOffset: 0,
        floodSpeedRatio: 1, ebbSpeedRatio: 1,
      },
    })).toBe("reduced from NOAA's current table")
  })

  it('names CHS as the publisher, which is only true once the curve is drawn', () => {
    // The identity panel may not say this (#44): nine of the 23 gates are
    // never fitted on device and nothing published says which nine, so any
    // sentence naming a mechanism is false for one group or the other. That
    // constraint does not reach here. What this clause describes is a curve
    // the reader's browser fetched from DFO, which is CHS's own published
    // prediction for every gate without exception.
    expect(provenance(chs)).toBe('published by the Canadian Hydrographic Service')
  })

  it('claims nothing about the app, on either branch', () => {
    // "Slackwater's on-device model" is app copy and false on a page showing
    // DFO's own numbers; "offline" is false for the online gates.
    for (const s of [bundled, chs]) {
      expect(provenance(s)).not.toMatch(/slackwater|offline|on-device|app/i)
    }
  })
})

describe('refinedCredit', () => {
  it('credits CHS for the curve on screen and the computed source for the rest', () => {
    expect(refinedCredit({ ...bundled, kind: 'tide', chs: { id: 'chs-victoria' } })).toBe(
      "Today's curve: predictions published by the Canadian Hydrographic Service, on chart datum, " +
        'fetched from DFO by your browser. Other days and the 7-day table are computed from harmonic constituents.',
    )
  })

  it('names no datum for a current, which has none', () => {
    expect(refinedCredit({ ...bundled, chs: { id: 'chs-dodd-narrows' } })).not.toMatch(/datum/)
  })

  it('claims nothing about how the app predicts this water (#44)', () => {
    for (const kind of ['tide', 'current'] as const) {
      expect(refinedCredit({ ...bundled, kind, chs: { id: 'chs-x' } })).not.toMatch(/slackwater|offline|on-device|\bapp\b/i)
    }
  })
})

describe('pageTitle', () => {
  it('leads with the station and the query words, then the subdivision', () => {
    const victoria = { ...bundled, kind: 'tide', name: 'Victoria', state: 'BC', country: 'Canada' } as const
    expect(pageTitle(victoria)).toBe('Victoria tide times & tide chart — BC')
    expect(pageTitle({ ...bundled, name: 'Deception Pass (Narrows)', state: 'WA', country: 'United States' })).toBe(
      'Deception Pass (Narrows) slack water & currents — WA',
    )
  })

  it('names the country where there is no subdivision', () => {
    expect(pageTitle({ ...bundled, country: 'Japan' })).toBe('Deception Pass slack water & currents — Japan')
  })

  it('falls back to the water context when there is no country', () => {
    expect(pageTitle({ ...bundled, region: 'Puget Sound' })).toBe(
      'Deception Pass slack water & currents — Puget Sound',
    )
    expect(pageTitle(bundled)).toBe('Deception Pass slack water & currents')
  })

  it('gives up the place, then the keyword, before the name', () => {
    const named = (name: string) => pageTitle({ ...bundled, name, state: 'MA', country: 'United States' })
    expect(named('Hell Gate, East River, off Mill Rock')).toBe('Hell Gate, East River, off Mill Rock slack water & currents')
    expect(named('Stellwagen Bank, 17 nm ESE of Eastern Point')).toBe(
      'Stellwagen Bank, 17 nm ESE of Eastern Point slack water',
    )
    expect(named('Stellwagen Basin, 13.8 nm SE of Eastern Point Light')).toBe(
      'Stellwagen Basin, 13.8 nm SE of Eastern Point Light currents',
    )
  })
})

describe('placeLine', () => {
  it('reads context, then subdivision and country', () => {
    expect(placeLine({ ...bundled, region: 'Inner Harbour', state: 'BC', country: 'Canada' })).toBe(
      'Inner Harbour · BC, Canada',
    )
    expect(placeLine({ ...chs, country: 'Canada' })).toBe('Nanaimo · Canada')
    expect(placeLine(bundled)).toBeUndefined()
  })
})

describe('pageDescription', () => {
  it('promises predictions only where the page has them', () => {
    expect(pageDescription(bundled)).toMatch(/slack water and maximum flood and ebb/i)
    expect(pageDescription(bundled)).toMatch(/7-day/)
  })

  it('leads with what is on the page and names the place', () => {
    expect(pageDescription({ ...bundled, kind: 'tide', name: 'Friday Harbor', state: 'WA', country: 'United States' })).toBe(
      'High and low tide times for Friday Harbor, WA, with a 7-day tide table and chart.',
    )
  })

  it('promises no predictions on an identity-only page', () => {
    // Exact, not a denylist: the previous version listed four retired phrases,
    // which let a new false claim through in different words.
    expect(pageDescription(chs)).toBe(
      'Station information for Dodd Narrows, Nanaimo. Predictions based on ' +
        'Canadian Hydrographic Service data are in the Slackwater app.',
    )
  })
})

describe('search snippets', () => {
  // The name is the only thing that varies, so the whole corpus is the worst
  // case. A database bump that brings a longer name fails here.
  const all = loadCatalogue()

  it('keeps every title whole in a search result', () => {
    const over = all.map(pageTitle).filter((t) => t.length > TITLE_LIMIT)
    expect(over).toEqual([])
  })

  it('keeps every description whole in a search result', () => {
    const over = all
      .map((s) => PASS_GUIDES.get(s.id)?.description ?? pageDescription(s))
      .filter((d) => d.length > DESCRIPTION_LIMIT)
    expect(over).toEqual([])
  })

  it('keeps a keyword in every bundled title', () => {
    const bare = all.filter((s) => pageTitle(s) === s.name).map((s) => s.name)
    expect(bare).toEqual([])
  })
})

describe('datumLine', () => {
  it('names a bundled station\'s own datum code', () => {
    expect(datumLine({ ...bundled, kind: 'tide', chartDatum: 'MLLW' })).toBe(
      'MLLW datum · computed from harmonic constituents',
    )
  })

  it('names chart datum for a CHS port, and no code', () => {
    // DFO publishes on chart datum and states no code for it. Victoria's own
    // metadata puts LLWLT at -0.09 m — nine centimetres BELOW the zero those
    // heights are quoted from — so borrowing the corpus's vocabulary here
    // would be a precise claim and a wrong one.
    expect(datumLine({ ...chs, kind: 'tide' })).toBe(
      'Chart datum · published by the Canadian Hydrographic Service',
    )
  })
})

describe('seasonalNote', () => {
  const tide = (seasonal?: number): BundledStation => ({
    id: 'noaa/x', kind: 'tide', slug: 'x', path: '/tides/x/', name: 'X',
    latitude: 0, longitude: 1, timezone: 'UTC', source: 'bundled',
    constituents: [{ name: 'M2', amplitude: 1, phase: 0 }],
    ...(seasonal !== undefined ? { seasonal } : {}),
  })

  it('says nothing where the database did not label the station', () => {
    // 5,355 of the 5,893 tide pages. Absence is the database's verdict, and the
    // site never decides it — that is why the field is optional rather than 0.
    expect(seasonalNote(tide())).toBeUndefined()
  })

  it('leads the page where the annual cycle is the signal', () => {
    // Cobourg on Lake Ontario: a reader planning from the high and the low has
    // to know before reading them, so it goes above the curve.
    const note = seasonalNote(tide(161.6))
    expect(note?.place).toBe('lead')
    expect(note?.text).toBe(
      'Mostly seasonal — the yearly change in water level here is about 160 times the daily tide.',
    )
  })

  it('stays quiet where the tide is real and the annual cycle merely comparable', () => {
    // Annapolis (US Naval Academy) carries the label at 1.008. Calling that
    // "mostly seasonal" would be false in effect while true in arithmetic, so
    // the note moves to the station facts and drops the ratio.
    const note = seasonalNote(tide(1.008))
    expect(note?.place).toBe('aside')
    expect(note?.text).toBe(
      'Seasonal level change here is comparable to the daily tide, so heights drift through the year.',
    )
  })

  it('rounds the ratio to a figure a reader can carry', () => {
    // None of the precision is meaningful, and two decimals of a constituent
    // ratio claims an accuracy the sentence does not have.
    const times = (r: number) => seasonalNote(tide(r))!.text.match(/about ([\d,.]+) times/)![1]
    expect(times(3.74)).toBe('3.7')
    expect(times(43.3)).toBe('40')
    expect(times(161.6)).toBe('160')
    // The floor of the loud band, where a decimal still carries information.
    expect(times(3)).toBe('3')
  })

  it('says nothing about a CHS station, which has no constituents to measure', () => {
    expect(
      seasonalNote({
        id: 'chs-victoria', kind: 'tide', slug: 'victoria', path: '/tides/ca/bc/victoria/',
        name: 'Victoria', latitude: 48, longitude: -123, timezone: 'America/Vancouver', source: 'chs',
      }),
    ).toBeUndefined()
  })
})
