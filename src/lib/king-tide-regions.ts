// Imported by vite.config.ts and the Worker, so it must never import the catalogue.

export interface KingTideRegion {
  slug: string
  name: string
  /** The state's tide station directory. */
  directory: string
  /** First month of the season, and the month it ends before. */
  months: [from: number, to: number]
  /** How many king tide events a season lists. */
  events: number
  /** The starting years of the seasons published. Keep at least one. */
  seasons: number[]
  /** Why the season falls when it does here. */
  when: string
  official?: { name: string; url: string }
  /** [path, the name a searcher uses]. The first is the one the summary quotes. */
  stations: [path: string, name: string][]
}

/** The datum NOAA is asked for, which the pages name. */
export const NOAA_DATUM = 'MLLW'

export const KING_TIDE_REGIONS: KingTideRegion[] = [
  {
    slug: 'washington',
    name: 'Washington',
    directory: '/tides/us/wa/',
    months: [11, 3],
    events: 3,
    seasons: [2026],
    when: 'Washington’s king tides come from November through February. The outer coast often peaks two or three days before Puget Sound, so use the station nearest you.',
    official: {
      name: 'Washington Sea Grant’s king tides calendar',
      url: 'https://waseagrant.uw.edu/community-outreach/hazard-resilience-and-climate-adaptation/king-tides/calendar/',
    },
    stations: [
      ['/tides/us/wa/seattle/', 'Seattle'],
      ['/tides/us/wa/port-townsend/', 'Port Townsend'],
      ['/tides/us/wa/friday-harbor/', 'Friday Harbor'],
      ['/tides/us/wa/cherry-point/', 'Cherry Point, near Bellingham'],
      ['/tides/us/wa/port-angeles/', 'Port Angeles'],
      ['/tides/us/wa/neah-bay/', 'Neah Bay'],
      ['/tides/us/wa/la-push/', 'La Push'],
      ['/tides/us/wa/westport-point-chehalis/', 'Westport'],
      ['/tides/us/wa/toke-point/', 'Willapa Bay at Toke Point'],
    ],
  },
  {
    slug: 'oregon',
    name: 'Oregon',
    directory: '/tides/us/or/',
    months: [11, 3],
    events: 3,
    seasons: [2026],
    when: 'Oregon’s king tides come from November through February, usually in late morning or around midday. Winter swell on top of one can send waves much farther up beaches, rocks and jetties.',
    official: { name: 'the Oregon King Tides Project', url: 'https://www.oregonkingtides.net/' },
    stations: [
      ['/tides/us/or/southbeach/', 'Newport'],
      ['/tides/us/or/astoria/', 'Astoria'],
      ['/tides/us/or/garibaldi/', 'Garibaldi'],
      ['/tides/us/or/charleston/', 'Charleston and Coos Bay'],
      ['/tides/us/or/port-orford/', 'Port Orford'],
    ],
  },
  {
    slug: 'california',
    name: 'California',
    directory: '/tides/us/ca/',
    months: [11, 3],
    events: 3,
    seasons: [2026],
    when: 'California’s king tides are watched from November through February, when the highest tides come in the morning. Some summer evening tides run as high, and this list covers the winter season.',
    official: { name: 'the California King Tides Project', url: 'https://www.coastal.ca.gov/kingtides/' },
    stations: [
      ['/tides/us/ca/san-francisco-golden-gate/', 'San Francisco'],
      ['/tides/us/ca/la-jolla/', 'La Jolla'],
      ['/tides/us/ca/san-diego-broadway/', 'San Diego'],
      ['/tides/us/ca/los-angeles/', 'Los Angeles'],
      ['/tides/us/ca/santa-barbara/', 'Santa Barbara'],
      ['/tides/us/ca/port-san-luis/', 'Port San Luis'],
      ['/tides/us/ca/monterey/', 'Monterey'],
      ['/tides/us/ca/alameda/', 'Alameda'],
      ['/tides/us/ca/humboldt-bay-north-spit/', 'Humboldt Bay'],
      ['/tides/us/ca/crescent-city/', 'Crescent City'],
    ],
  },
  {
    slug: 'florida',
    name: 'Florida',
    directory: '/tides/us/fl/',
    months: [9, 12],
    events: 4,
    seasons: [2026, 2027],
    when: 'On Florida’s Atlantic coast and in the Keys, king tides peak from September through November, when the sea’s seasonal level is high, so the first date range can start in late August. The Gulf coast follows a different pattern and is not listed here.',
    stations: [
      ['/tides/us/fl/virginia-key/', 'Miami'],
      ['/tides/us/fl/key-west/', 'Key West'],
      ['/tides/us/fl/port-canaveral-trident-pier/', 'Port Canaveral'],
    ],
  },
]

export const KING_TIDES_PATH = '/king-tides/'
export const kingTidePath = (region: KingTideRegion) => `${KING_TIDES_PATH}${region.slug}/`
export const KING_TIDE_PATHS = [KING_TIDES_PATH, ...KING_TIDE_REGIONS.map(kingTidePath)]
