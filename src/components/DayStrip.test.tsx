import { beforeAll, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DayStrip } from './DayStrip'
import { dayStart } from '#/lib/format'
import { fetchPortTides } from '#/lib/iwls'
import portFixture from '#/lib/__fixtures__/iwls-ports.json' with { type: 'json' }
import type { BundledStation, ChsStation } from '#/lib/station'

const SEATTLE: BundledStation = {
  id: 'noaa/9447130', kind: 'tide', slug: 'seattle', name: 'SEATTLE (Madison St.), Elliott Bay',
  latitude: 47.6, longitude: -122.34, timezone: 'America/Los_Angeles',
  source: 'bundled', chartDatum: 'MLLW',
  constituents: [{ name: 'M2', amplitude: 3.487, phase: 10.8 }, { name: 'K1', amplitude: 2.625, phase: 300 }],
}

const DECEPTION: BundledStation = {
  id: 'noaa/PUG1701', kind: 'current', slug: 'deception-pass-narrows', name: 'Deception Pass (Narrows)',
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
