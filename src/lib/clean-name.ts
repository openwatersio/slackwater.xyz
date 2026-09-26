/**
 * A provider's station name, said the way a chart says it.
 *
 * Two edits. Abbreviations NOAA writes into names are spelled out ("Minim
 * Creek Ent.", "Savage I.", "Mangrove Pt."), and a distance is restated in
 * nautical miles whatever unit it arrived in, because NOAA mixes them within
 * one dataset ("Cattle Point, 1.2 nm SE of" beside "Browns Point, 1.6 miles
 * North of").
 *
 * Casing is left alone unless the whole name shouts. The database already
 * de-shouts almost every provider name, and a mixed-case name that still holds
 * a capitalised word holds an initialism — "GPS Buoy", "J.F.K.", "NOAA Lab",
 * "MARAD" — that title-casing turns into nonsense. Only a name with no
 * lowercase letter at all ("CBBT", "LAWMA") is a name nobody cased.
 */

/** Abbreviations worth spelling out. Deliberately short — only the noisy ones. */
const EXPAND: [RegExp, string][] = [
  [/\bNAS\b/g, 'Naval Air Station'],
  [/\bSt\. Park\b/gi, 'State Park'],
  [/\bent\./gi, 'Entrance'],
  [/\bI\.(?=$|,)/g, 'Island'],
  [/\bIs\./gi, 'Islands'],
  [/\bPt\./gi, 'Point'],
  [/\bCk\./gi, 'Creek'],
]

/** 1 statute mile = 1.609344 km; 1 nautical mile = 1.852 km. */
const NM_PER_MILE = 1.609344 / 1.852

/**
 * A distance and its unit, in any of the spellings NOAA uses: "7.6 mi.",
 * "0.8mile", "1.0 n.mi.", "0.4 nmi.", "0.3 nautical mile", "3nm.". The
 * leading number is required — it is what separates a measurement from a
 * place called Six Mile Reef or Miles Point.
 */
const DISTANCE = /(\d+(?:\.\d+)?)\s*(n\.?\s?mi\.?|nautical\s+miles?|nm\.?|mi\.|miles?)(?![a-z])/gi

/** Words that stay lowercase inside a name, but not at the start. */
const MINOR = new Set(['of', 'the', 'at', 'on', 'in', 'and', 'de', 'la', 'el'])

/**
 * Tokens that stay capitalised when a shouting name is calmed: compass
 * bearings ("SSE of" is not "Sse of") and the caps abbreviations NOAA writes
 * into names. A trailing USPS state code stays too.
 */
const KEEP = new Set([
  'NNE', 'NE', 'ENE', 'ESE', 'SE', 'SSE', 'SSW', 'SW', 'WSW', 'WNW', 'NW', 'NNW',
  'US', 'BC', 'USCG', 'LB', 'ICW', 'ICWW', 'RR', 'NM',
])
const STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'AS', 'GU', 'MP', 'PR', 'VI',
])

function titleCaseWord(word: string, first: boolean): string {
  const bare = word.replace(/[^A-Za-z]/g, '')
  if (KEEP.has(bare.toUpperCase())) return word
  const lower = word.toLowerCase()
  if (!first && MINOR.has(lower)) return lower
  // Hyphens, slashes, and apostrophes each start a new capital: "spee-bi-dah", "o'brien".
  return lower.replace(/(^|[-/('’])([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase())
}

function calm(name: string): string {
  const words = name.split(' ')
  return words
    .map((word, i) => (i === words.length - 1 && STATES.has(word) ? word : titleCaseWord(word, i === 0)))
    .join(' ')
}

export function cleanName(raw: string): string {
  // Decided on the provider's spelling: the "nm" written below is lowercase
  // and must not read as a name somebody cased.
  const shouting = !/[a-z]/.test(raw)
  let name = raw.trim().replace(/\s+/g, ' ')
  for (const [pattern, replacement] of EXPAND) name = name.replace(pattern, replacement)
  // A converted distance gets one decimal, the precision NOAA itself writes;
  // one already nautical is re-emitted verbatim rather than round-tripped.
  name = name.replace(DISTANCE, (_, value: string, unit: string) =>
    unit[0]!.toLowerCase() === 'n' ? `${value} nm` : `${(Number(value) * NM_PER_MILE).toFixed(1)} nm`,
  )
  return shouting ? calm(name) : name
}
