import { beforeAll, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DayStrip } from './DayStrip'
import { chartTime, dayStart } from '#/lib/format'
import { fetchPortTides, gateEvents, signedSamples } from '#/lib/iwls'
import { predictSeries, slackWindows } from '#/lib/predict'
import gateFixture from '#/lib/__fixtures__/iwls.json' with { type: 'json' }
import portFixture from '#/lib/__fixtures__/iwls-ports.json' with { type: 'json' }
import type { BundledStation, ChsStation } from '#/lib/station'

const SEATTLE: BundledStation = {
  id: 'noaa/9447130', kind: 'tide', slug: 'seattle', name: 'SEATTLE (Madison St.), Elliott Bay',
  path: '/tides/us/wa/seattle/',
  latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles',
  source: 'bundled', chartDatum: 'MLLW',
  constituents: [{ name: 'M2', amplitude: 3.487, phase: 10.8 }, { name: 'K1', amplitude: 2.625, phase: 300 }],
}

const DECEPTION: BundledStation = {
  id: 'noaa/PUG1701', kind: 'current', slug: 'deception-pass-narrows', name: 'Deception Pass (Narrows)',
  path: '/currents/us/wa/deception-pass-narrows/',
  latitude: 48.4, longitude: -122.64, timezone: 'America/Los_Angeles',
  source: 'bundled', floodDirection: 90, ebbDirection: 270,
  constituents: [{ name: 'M2', amplitude: 4.2, phase: 40 }, { name: 'K1', amplitude: 1.1, phase: 200 }],
}

const NOW = new Date('2026-09-11T20:00:00Z') // 13:00 Pacific
const TODAY = dayStart(NOW, SEATTLE.timezone)

describe('DayStrip', () => {
  const html = renderToStaticMarkup(
    <DayStrip station={SEATTLE} start={TODAY} hours={24} now={NOW} live={false} />,
  )

  it('draws the day from the curve component', () => {
    expect(html).toMatch(/<path[^>]+d="M[\d.,\-L\s]+"/)
  })

  it('marks sunrise and sunset at the station', () => {
    expect(html).toMatch(/↑\s?\d{1,2}:\d{2}[ap]m/)
    expect(html).toMatch(/↓\s?\d{1,2}:\d{2}[ap]m/)
  })

  it('makes no claim about now unless the clock is live', () => {
    expect(html).not.toMatch(/in \d+[hm]\b/)
    expect(html).not.toMatch(/Rising|Falling/)
  })

  it('reads the water now, only on a live page whose day this is', () => {
    const live = renderToStaticMarkup(
      <DayStrip station={SEATTLE} start={TODAY} hours={24} now={NOW} live />,
    )
    expect(live).toMatch(/Rising|Falling/)
    expect(live).toMatch(/\d+\.\d ft/)
    expect(live).toMatch(/(High|Low) at \d{1,2}:\d{2}[ap]m/)

    const tomorrow = renderToStaticMarkup(
      <DayStrip station={SEATTLE} start={dayStart(NOW, SEATTLE.timezone, 1)} hours={24} now={NOW} live />,
    )
    expect(tomorrow).not.toMatch(/Rising|Falling/)
  })

  it('reads a shared selected tide without calling it now', () => {
    const selected = renderToStaticMarkup(
      <DayStrip
        station={SEATTLE}
        start={TODAY}
        hours={24}
        now={new Date('2026-09-12T00:00:00Z')}
        selectedAt={NOW}
        live={false}
        onSelect={() => {}}
        onCommit={() => {}}
      />,
    )
    expect(selected).toMatch(/Rising|Falling/)
    expect(selected).toContain('1:00pm')
    expect(selected).not.toMatch(/>Now<\/text>/)
    expect(selected).toContain('viewBox="0 0 390 320"')
    expect(selected).toContain('viewBox="0 0 1000 320"')
  })

  it('reads a current the way the app does', () => {
    const live = renderToStaticMarkup(
      <DayStrip station={DECEPTION} start={dayStart(NOW, DECEPTION.timezone)} hours={24} now={NOW} live />,
    )
    expect(live).toMatch(/Flooding|Ebbing|Slack/)
    expect(live).toMatch(/\d\.\d kn/)
    expect(live).toMatch(/(Slack|Max flood|Max ebb) in \d+(h \d+)?m/)
    expect(live).toMatch(/transform:rotate\((90|270)deg\)/)
  })

  it('reads a selected current without calling its next event a live countdown', () => {
    const selected = renderToStaticMarkup(
      <DayStrip station={DECEPTION} start={TODAY} hours={24}
        now={new Date('2026-09-12T22:00:00Z')} selectedAt={NOW} live
        onSelect={() => {}} onCommit={() => {}} />,
    )
    expect(selected).toContain('aria-label="Selected current time"')
    expect(selected).toContain('1:00pm')
    expect(selected).toMatch(/(Slack|Max flood|Max ebb) at \d{1,2}:\d{2}[ap]m/)
    expect(selected).not.toMatch(/(Slack|Max flood|Max ebb) in \d/)
    expect(selected).toContain('viewBox="0 0 390 320"')
    expect(selected).toContain('viewBox="0 0 1000 320"')
  })

  it('names the end of an active slack window as the next water change', () => {
    const window = slackWindows(predictSeries(DECEPTION, TODAY, 24))[0]
    const inside = new Date((window.start.getTime() + window.end.getTime()) / 2)
    const selected = renderToStaticMarkup(
      <DayStrip station={DECEPTION} start={TODAY} hours={24} now={NOW} selectedAt={inside} live={false} />,
    )
    expect(selected).toMatch(new RegExp(`(Flood|Ebb) at ${chartTime(window.end, DECEPTION.timezone)}`))
  })

  it('does not label the build clock as actual now on a shared current page', () => {
    const server = renderToStaticMarkup(
      <DayStrip station={DECEPTION} start={TODAY} hours={24}
        now={new Date('2026-09-11T22:00:00Z')} selectedAt={NOW} live={false} />,
    )
    expect(server).not.toContain('data-marker="actual-now"')
  })
})

describe('DayStrip for a Canadian port', () => {
  const VICTORIA: ChsStation = {
    id: 'chs-victoria', kind: 'tide', slug: 'victoria', name: 'Victoria',
    path: '/tides/ca/bc/victoria/',
    latitude: 48.424, longitude: -123.371, timezone: 'America/Vancouver',
    source: 'chs', region: 'Inner Harbour',
  }
  const port = portFixture.ports['Victoria Harbour']
  const fetcher: typeof fetch = async (input) => {
    const url = String(input)
    const body = url.includes('/stations?')
      ? portFixture.stations
      : url.includes('wlp-hilo')
        ? port['wlp-hilo']
        : port.wlp
    return { ok: true, json: async () => body } as Response
  }

  let html = ''
  beforeAll(async () => {
    const start = new Date('2026-09-01T00:00:00Z')
    const day = await fetchPortTides(VICTORIA, start, 24, fetcher)
    html = renderToStaticMarkup(
      <DayStrip station={VICTORIA} start={start} hours={24} now={new Date('2026-09-01T06:00:00Z')} live
        fetched={{ kind: 'tide', ...day }} />,
    )
  })

  it('names chart datum, and no code it would be wrong about', () => {
    // Victoria's own LLWLT is -0.09 m, nine centimetres below the zero these
    // heights are quoted from, so borrowing the corpus's datum vocabulary
    // would be a precise claim and a false one.
    expect(html).toContain('Chart datum · published by the Canadian Hydrographic Service')
    expect(html).not.toMatch(/LLWLT|MLLW|LAT datum/)
  })

  it('reads nothing "now" — the numbers are DFO\'s, and there is no predictor to ask', () => {
    expect(html).not.toMatch(/Rising|Falling/)
  })
})

describe('DayStrip for a computed port with a CHS layer', () => {
  // A merged port: the provider's constituents draw the curve the page ships
  // with, and CHS's published day replaces it once the reader's browser has it.
  // The constituents are deliberately unlike Victoria's real tide, so a label
  // that matches DFO's numbers can only have come from DFO.
  const MERGED: BundledStation = {
    id: 'ticon/victoria_bc-543a-can-uhslc_rq', kind: 'tide', slug: 'victoria', name: 'Victoria',
    path: '/tides/ca/bc/victoria/',
    latitude: 48.424, longitude: -123.371, timezone: 'America/Vancouver',
    source: 'bundled', chartDatum: 'LAT',
    constituents: [{ name: 'M2', amplitude: 1, phase: 0 }],
    chs: { id: 'chs-victoria' },
  }
  const port = portFixture.ports['Victoria Harbour']
  const fetcher: typeof fetch = async (input) => {
    const url = String(input)
    const body = url.includes('/stations?')
      ? portFixture.stations
      : url.includes('wlp-hilo')
        ? port['wlp-hilo']
        : port.wlp
    return { ok: true, json: async () => body } as Response
  }
  const start = new Date('2026-09-01T00:00:00Z')
  const now = new Date('2026-09-01T06:00:00Z')
  let layered = ''
  let other = ''
  const computed = renderToStaticMarkup(
    <DayStrip station={MERGED} start={start} hours={24} now={now} live />,
  )
  beforeAll(async () => {
    const day = await fetchPortTides(MERGED, start, 24, fetcher)
    const refined = { kind: 'tide' as const, start, hours: 24, ...day }
    layered = renderToStaticMarkup(
      <DayStrip station={MERGED} start={start} hours={24} now={now} live refined={refined} />,
    )
    // The layer is one day. On any other day the strip is the computed one.
    other = renderToStaticMarkup(
      <DayStrip station={MERGED} start={new Date('2026-09-02T00:00:00Z')} hours={24} now={now} live refined={refined} />,
    )
  })

  it('draws the computed curve and claims nothing about CHS before the layer arrives', () => {
    expect(computed).toContain('<svg')
    expect(computed).not.toMatch(/Canadian Hydrographic Service|your browser/)
  })

  it("labels every one of DFO's published turns once it arrives", () => {
    // 2.544, 1.065, 2.021 and 1.688 m — in feet.
    for (const ft of ['8.3 ft', '3.5 ft', '6.6 ft', '5.5 ft']) expect(layered).toContain(ft)
  })

  it('credits CHS for the curve it now draws, and the computed source for the rest', () => {
    expect(layered).toContain('published by the Canadian Hydrographic Service, on chart datum, fetched from DFO by your browser')
    expect(layered).toContain('computed from harmonic constituents')
    expect(layered).not.toMatch(/offline|on-device|slackwater/i)
  })

  it("reads the water now from DFO's curve, not the computed one", () => {
    // 06:00 UTC falls between the 00:49 high and the 07:29 low.
    expect(layered).toContain('Falling')
    expect(layered).toContain('Low at 12:29am')
  })

  it('leaves another day computed', () => {
    expect(other).toContain('<svg')
    expect(other).not.toMatch(/Canadian Hydrographic Service/)
  })
})

describe('DayStrip for a computed gate with a CHS layer', () => {
  // No current pair is merged today, but the rule is the same for a gate: the
  // computed curve ships, and DFO's published day replaces it in the browser.
  const MERGED: BundledStation = {
    id: 'noaa/x', kind: 'current', slug: 'dodd-narrows', name: 'Dodd Narrows',
    path: '/currents/ca/bc/dodd-narrows/',
    latitude: 49.135, longitude: -123.817, timezone: 'America/Vancouver',
    source: 'bundled', floodDirection: 355, ebbDirection: 155,
    constituents: [{ name: 'M2', amplitude: 1, phase: 0 }],
    chs: { id: 'chs-dodd-narrows' },
  }
  const gate = gateFixture.gates['Dodd Narrows']
  const start = new Date('2026-09-01T00:00:00Z')
  const refined = {
    kind: 'current' as const, start, hours: 24,
    samples: signedSamples(gate.wcsp1, gate.wcdp1, gate.floodDirection),
    events: gateEvents(gate['wcp1-events']),
  }
  const html = renderToStaticMarkup(
    <DayStrip station={MERGED} start={start} hours={24} now={new Date('2026-09-01T06:00:00Z')} live refined={refined} />,
  )

  it("prints DFO's published peaks rather than the computed ones", () => {
    expect(html).toContain('7.1 kn')
    expect(html).toContain('7.0 kn')
  })

  it('credits CHS once, under the chart', () => {
    expect(html.match(/fetched from DFO by your browser/g)).toHaveLength(1)
    expect(html).toMatch(/Flooding|Ebbing|Slack/)
  })
})
