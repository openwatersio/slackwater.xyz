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
    ? CHS_PROVENANCE
    : station.reduction
      ? "reduced from NOAA's current table"
    : station.tideReduction
      ? 'NOAA reference highs and lows, adjusted by published offsets'
    : 'computed from harmonic constituents'
}

/**
 * The provenance of a curve the reader's browser fetched from DFO — on a CHS
 * page, and on a computed page once CHS's day has arrived on top of it.
 */
export const CHS_PROVENANCE = 'published by the Canadian Hydrographic Service'

/**
 * The line under a computed page's chart once CHS's day has replaced the
 * computed one: whose curve this is now, and whose the rest of the page still
 * is.
 *
 * Both halves name a source and neither names how the app answers here (#44).
 * The second half is the same provenance the computed curve carried before
 * the layer arrived, so the page never credits CHS for a number it computed.
 */
export function refinedCredit(station: BundledStation): string {
  const datum = station.kind === 'tide' ? ', on chart datum' : ''
  return (
    `Today's curve: predictions ${CHS_PROVENANCE}${datum}, fetched from DFO by your browser. ` +
    `Other days and the 7-day table are ${provenance(station)}.`
  )
}

/**
 * The line under the chart: which datum these heights are quoted against, and
 * where they came from. Mirrors the app's own footer ("MLLW datum · …").
 *
 * Returns undefined when the station carries no datum, so the page goes quiet
 * rather than announcing an "undefined datum". `catalogue.test.ts` asserts no
 * tide station is in that state; this is what happens if that ever stops
 * being true.
 *
 * A CHS port names no code, and that is not vagueness. DFO publishes its tide
 * predictions on chart datum and states no code for it — Victoria's own
 * metadata puts LLWLT at -0.09 m, nine centimetres BELOW the zero those
 * heights are quoted from, so borrowing the corpus's vocabulary and printing
 * "LLWLT datum" would be a precise claim and a wrong one. "Chart datum" is
 * what DFO itself prints above the same numbers.
 */
export function datumLine(station: Station): string | undefined {
  if (station.source === 'chs') return `Chart datum · ${provenance(station)}`
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
 * Above this ratio a page leads with the fact that its water is seasonal;
 * below it, the page says so quietly and lower down.
 *
 * 3 is where the corpus changes character. Above it the stations are rivers,
 * lagoons and lakes — the Neuse at Oriental, the St Johns at Piney Bluff, Indian
 * River Lagoon at Melbourne Causeway, Lake Ontario at Cobourg — and a tide table
 * is the wrong frame for all of them. Below it are Gulf and Chesapeake ports
 * with a real tide and a comparable annual signal, and Annapolis is the reason
 * the line is not at 1: it carries the database's label at 1.008, and telling a
 * reader the US Naval Academy gauge is "mostly seasonal" would be false in
 * effect while true in arithmetic.
 *
 * Of the 491 labelled pages, 159 are above this and 332 below.
 */
const SEASONAL_LEAD_RATIO = 3

/**
 * Round a ratio to a figure a reader can carry, because none of its precision
 * is meaningful to them: "about 160 times" says what 161.6 says, and a page
 * quoting two decimals of a constituent ratio is pretending to an accuracy the
 * statement does not have.
 */
function aboutTimes(ratio: number): string {
  // Round to a ten once there is a ten to round to, so the number reads as the
  // estimate "about" promises: 43.3 is "about 40 times", not "about 43 times",
  // which invites a reader to trust a figure that came out of a constituent fit.
  const rounded = ratio >= 10 ? Math.round(ratio / 10) * 10 : Math.round(ratio * 10) / 10
  return rounded.toLocaleString('en-US')
}

/** Where a seasonal note belongs on the page, and what it says. */
export interface SeasonalNote {
  /** `lead` goes under the heading, `aside` beside the datum note. */
  place: 'lead' | 'aside'
  text: string
}

/**
 * What a page says about water whose yearly swing rivals or exceeds its daily
 * one, or `undefined` for the 5,352 tide pages where that is not true.
 *
 * Two bands rather than one sentence, because one sentence cannot be honest
 * across a 160x range. At Cobourg the annual cycle IS the signal and a reader
 * planning anything from the high and low needs to know before reading them, so
 * it leads. At Annapolis the tide is real and the annual cycle merely comparable,
 * so the same prominence would be a false alarm — but saying nothing leaves a
 * reader wondering why the heights drift through the year, which is the thing
 * the database now knows and the page can explain.
 *
 * Neither band hides the numbers or adds a warning icon: the predictions are
 * correct, and this is a statement about what kind of water they describe.
 */
export function seasonalNote(station: Station): SeasonalNote | undefined {
  if (station.source !== 'bundled' || station.seasonal === undefined) return undefined
  return station.seasonal >= SEASONAL_LEAD_RATIO
    ? {
        place: 'lead',
        text:
          `Mostly seasonal — the yearly change in water level here is about ` +
          `${aboutTimes(station.seasonal)} times the daily tide.`,
      }
    : {
        place: 'aside',
        text:
          'Seasonal level change here is comparable to the daily tide, so heights drift through the year.',
      }
}

/**
 * Where the station is, as the query would say it: `BC, Canada`, `United
 * States`. Abbreviated subdivision because that is what a searcher types and
 * what fits a title; the country in full because the codes are not
 * self-explaining outside their own country. Falls back to the curated water
 * context so a station with no country still has a place.
 */
function place(station: Station): string | undefined {
  const parts = [station.state, station.country].filter(Boolean)
  return parts.length ? parts.join(', ') : station.region
}

/**
 * The place as a search snippet spends it: the subdivision alone when there is
 * one, because "WA" already says United States and the 15 characters are worth
 * more to the station name. The visible heading keeps the country.
 */
function searchPlace(station: Station): string | undefined {
  return station.state ?? place(station)
}

/** The concise visible heading; search phrasing stays in `pageTitle`. */
export function stationHeading(station: Station): string {
  const where = place(station)
  return where ? `${station.name} — ${where}` : station.name
}

/** About what Google shows of a title before cutting it. */
export const TITLE_LIMIT = 60

/** About what Google shows of a description before cutting it. */
export const DESCRIPTION_LIMIT = 155

/** The first candidate that fits, or the last, which is the shortest. */
function firstFitting(limit: number, candidates: string[]): string {
  return candidates.find((c) => c.length <= limit) ?? candidates[candidates.length - 1]
}

/**
 * The search `<title>`: station, then the words the query carries, then the
 * place. "Deception Pass (Narrows) slack water & currents — WA" is what a
 * reader searching "deception pass slack water" is looking for, in the order
 * they look.
 *
 * Within 60 characters, because past that Google cuts the end and the end was
 * the keyword. A long name gives up the place first, then the second keyword,
 * then all but one word of it: names run to 54 characters ("Saint Marks River
 * at San Marcosde Apalachee State Park"), so the ladder needs every rung.
 */
export function pageTitle(station: Station): string {
  const name = station.name
  const where = searchPlace(station)
  const [full, short, word] = station.kind === 'tide'
    ? ['tide times & tide chart', 'tide times', 'tides']
    : ['slack water & currents', 'slack water', 'currents']
  return firstFitting(TITLE_LIMIT, [
    ...(where ? [`${name} ${full} — ${where}`] : []),
    `${name} ${full}`,
    `${name} ${short}`,
    `${name} ${word}`,
    name,
  ])
}

/**
 * The line under the heading: the water, then the jurisdiction. The context
 * says which water; the subdivision and country say where in the world.
 */
export function placeLine(station: Station): string | undefined {
  const parts = [station.region, [station.state, station.country].filter(Boolean).join(', ')].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}

/**
 * The page's meta description — a whole sentence, because the subject changes
 * and not just the trailing clause.
 *
 * A bundled page carries two days and a week of table, so it may promise
 * them. A CHS page carries identity and nothing else, so it must promise
 * identity and nothing else: substituting only the provenance clause would
 * leave it advertising results the page does not contain, in the text a
 * shared unfurl shows.
 *
 * Within 155 characters, leading with what is on the page today. It carries no
 * date, so the snippet stays true whenever it is crawled. A long name drops
 * the place, as the title does.
 */
export function pageDescription(station: Station): string {
  if (station.source === 'chs') {
    const say = (name: string) =>
      `Station information for ${name}. Predictions based on Canadian Hydrographic Service data are in the Slackwater app.`
    return firstFitting(DESCRIPTION_LIMIT, [
      ...(station.region ? [say(`${station.name}, ${station.region}`)] : []),
      say(station.name),
    ])
  }
  const where = searchPlace(station)
  const say = (name: string) => station.kind === 'tide'
    ? `High and low tide times for ${name}, with a 7-day tide table and chart.`
    : `Slack water and maximum flood and ebb times for ${name}, with a 7-day current table and chart.`
  return firstFitting(DESCRIPTION_LIMIT, [
    ...(where ? [say(`${station.name}, ${where}`)] : []),
    say(station.name),
  ])
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
