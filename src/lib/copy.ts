import type { BundledStation, Station } from './station'

/**
 * Where this station's numbers come from, as a clause with no full stop.
 *
 * Reached only from a drawn curve — the two curve components' spoken
 * descriptions, and `pageDescription` on the bundled branch. That is what
 * makes the CHS clause sayable at all, and it is why this now takes a
 * `Station`: it was typed `BundledStation` while a CHS page had no curve to
 * describe.
 *
 * "Published by", not "based on". Everywhere else on a CHS page the site says
 * "based on Canadian Hydrographic Service data", because the identity panel
 * cannot name a mechanism (#44) and the app fits 14 of the 23 gates itself.
 * Here the reader's browser has just fetched DFO's own published prediction
 * and it is on the screen, so the stronger, more specific claim is the true
 * one. Do NOT let this wording drift back into the panel, which describes
 * something else.
 */
export function provenance(station: Station): string {
  return station.source === 'chs'
    ? 'published by the Canadian Hydrographic Service'
    : 'computed from harmonic constituents'
}

/**
 * The line under the chart: which datum these heights are quoted against, and
 * where they came from. Mirrors the app's own footer ("MLLW datum · …").
 *
 * Returns undefined when the station carries no datum, so the page goes quiet
 * rather than announcing an "undefined datum". `catalogue.test.ts` asserts no
 * tide station is in that state; this is what happens if that ever stops
 * being true.
 */
export function datumLine(station: BundledStation): string | undefined {
  return station.chartDatum ? `${station.chartDatum} datum · ${provenance(station)}` : undefined
}

/**
 * What a datum means for someone who came here from a shared link rather than
 * from a chart table. The app keeps this behind a "Station details" disclosure;
 * this page has one reader arriving cold and nowhere to hide it.
 */
export const DATUM_NOTE =
  'Heights are measured above chart datum. A negative height means there is that much less water than the charted depth shows.'

/**
 * The page's meta description — a whole sentence, because the subject changes
 * and not just the trailing clause.
 *
 * A bundled page carries a curve, so it may promise slack water and maxima. A
 * CHS page carries identity and nothing else, so it must promise identity and
 * nothing else: substituting only the provenance clause would leave it
 * advertising results the page does not contain, in the text a shared unfurl
 * shows.
 */
export function pageDescription(station: Station): string {
  if (station.source === 'chs') {
    const where = station.region ? `${station.name}, ${station.region}` : station.name
    return `Station information for ${where}. Predictions are based on Canadian ` +
      `Hydrographic Service data and are available in the Slackwater app.`
  }
  return station.kind === 'tide'
    ? `Tide heights and the next high and low for ${station.name}, ${provenance(station)}.`
    : `Slack water and maximum flood and ebb for ${station.name}, ${provenance(station)}.`
}

/**
 * `og:image:alt` for one station's card, where it must say something other
 * than the site default.
 *
 * `__root.tsx` sets a site-wide default describing "a tide curve crossing
 * the datum line, with the slack marker on the crossing" — true of every
 * bundled card, so those pages keep it and this returns `undefined`. A CHS
 * card has no curve at all (see `identityCard` in `og-image.ts`), so that
 * description is false for it and needs its own, naming only what the card
 * shows: the station, not a chart.
 */
export function ogImageAlt(station: Station): string | undefined {
  if (station.source !== 'chs') return undefined
  return `${station.name}: a Slackwater station card naming the water, with no chart.`
}
