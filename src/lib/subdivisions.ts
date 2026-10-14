/**
 * The names of the subdivisions a browse page can be of, by ISO 3166-2 code.
 *
 * A table rather than the database's `region` field, because that field is
 * whatever the provider published: NOAA's tide rows say "WA" where its current
 * rows say "Washington", and a CHS row says "British Columbia" where its
 * neighbour says nothing. The code is the identity (see `subdivision` in
 * `catalogue.ts`), so the name hangs off the code.
 *
 * `Intl.DisplayNames` names countries but has no subdivisions, and the
 * database places subdivisions in the United States and Canada only, so the
 * table is those two and nothing else. `places.test.ts` fails on a subdivision
 * the table cannot name.
 */
const NAMES: Record<string, string> = {
  'US-AK': 'Alaska', 'US-AL': 'Alabama', 'US-AR': 'Arkansas', 'US-AS': 'American Samoa',
  'US-AZ': 'Arizona', 'US-CA': 'California', 'US-CO': 'Colorado', 'US-CT': 'Connecticut',
  'US-DC': 'District of Columbia', 'US-DE': 'Delaware', 'US-FL': 'Florida', 'US-GA': 'Georgia',
  'US-GU': 'Guam', 'US-HI': 'Hawaii', 'US-IA': 'Iowa', 'US-ID': 'Idaho', 'US-IL': 'Illinois',
  'US-IN': 'Indiana', 'US-KS': 'Kansas', 'US-KY': 'Kentucky', 'US-LA': 'Louisiana',
  'US-MA': 'Massachusetts', 'US-MD': 'Maryland', 'US-ME': 'Maine', 'US-MI': 'Michigan',
  'US-MN': 'Minnesota', 'US-MO': 'Missouri', 'US-MP': 'Northern Mariana Islands',
  'US-MS': 'Mississippi', 'US-MT': 'Montana', 'US-NC': 'North Carolina', 'US-ND': 'North Dakota',
  'US-NE': 'Nebraska', 'US-NH': 'New Hampshire', 'US-NJ': 'New Jersey', 'US-NM': 'New Mexico',
  'US-NV': 'Nevada', 'US-NY': 'New York', 'US-OH': 'Ohio', 'US-OK': 'Oklahoma', 'US-OR': 'Oregon',
  'US-PA': 'Pennsylvania', 'US-PR': 'Puerto Rico', 'US-RI': 'Rhode Island',
  'US-SC': 'South Carolina', 'US-SD': 'South Dakota', 'US-TN': 'Tennessee', 'US-TX': 'Texas',
  'US-UM': 'U.S. Minor Outlying Islands', 'US-UT': 'Utah', 'US-VA': 'Virginia',
  'US-VI': 'U.S. Virgin Islands', 'US-VT': 'Vermont', 'US-WA': 'Washington', 'US-WI': 'Wisconsin',
  'US-WV': 'West Virginia', 'US-WY': 'Wyoming',
  'CA-AB': 'Alberta', 'CA-BC': 'British Columbia', 'CA-MB': 'Manitoba', 'CA-NB': 'New Brunswick',
  'CA-NL': 'Newfoundland and Labrador', 'CA-NS': 'Nova Scotia', 'CA-NT': 'Northwest Territories',
  'CA-NU': 'Nunavut', 'CA-ON': 'Ontario', 'CA-PE': 'Prince Edward Island', 'CA-QC': 'Quebec',
  'CA-SK': 'Saskatchewan', 'CA-YT': 'Yukon',
}

/** "Washington" for `us`, `wa`; `undefined` for a code the table does not hold. */
export const subdivisionName = (country: string, code: string): string | undefined =>
  NAMES[`${country.toUpperCase()}-${code.toUpperCase()}`]
