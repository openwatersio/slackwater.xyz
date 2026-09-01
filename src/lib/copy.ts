import type { BundledStation, Station } from './station'

/**
 * Where this station's numbers come from, as a clause with no full stop.
 *
 * Typed `BundledStation`, not `Station`: this is only ever true of a page
 * that draws a curve, so a CHS station must not type-check here. A CHS
 * branch lived here once ("predicted by the Canadian Hydrographic Service"),
 * the exact authorship framing ruled false and replaced everywhere else with
 * "based on ... data" — this function was written first and never revisited.
 * The project that draws a CHS curve gets to write that sentence fresh,
 * against whatever the licensing posture is by then.
 */
export function provenance(_station: BundledStation): string {
  return 'computed from harmonic constituents'
}

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
