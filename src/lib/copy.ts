import type { Station } from './station'

/**
 * Where this station's numbers come from, as a clause with no full stop.
 *
 * A claim, not wording. `TideCurve` has said since it was written that
 * "computed from harmonic constituents" has to be true on every rendering
 * path, and a Canadian page adds one where it is not: nothing is computed
 * there, and the licensing posture forbids us publishing a prediction at all.
 */
export function provenance(station: Station): string {
  return station.source === 'bundled'
    ? 'computed from harmonic constituents'
    : 'predicted by the Canadian Hydrographic Service'
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
