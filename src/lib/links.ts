import { version as DATABASE_VERSION } from '@slackwater/database/package.json'

export const APP_STORE_ID = '6813654837'

/** The site's own origin, for a link that has to stand on its own, like a printed page's. */
export const ORIGIN = 'https://slackwater.xyz'

/** The listing's minimum OS for iPhone and iPad, which install buttons state. */
export const MINIMUM_IOS = '26'
export const REQUIREMENT = `Requires iOS ${MINIMUM_IOS} or later.`

/** Joining this Google Group is how Android testers get Play test builds. */
export const ANDROID_TESTERS = 'https://groups.google.com/g/slackwater-android-testers'

// The six comparison pages repeat this URL in Markdown; keep them aligned.
export const APP_STORE = `https://apps.apple.com/app/slackwater-tides-current/id${APP_STORE_ID}`

/**
 * The XTide/OpenCPN harmonics file from the database release this site is
 * built against. 1.0 betas are GitHub prereleases, so `releases/latest`
 * resolves to the older 0.x line; the pinned version names the right one.
 * A beta's asset is named for the date that ends its version. A version
 * without that date links to the release list instead of guessing an asset
 * name, because this module loads on every station page and must not throw.
 * The list, not `releases/latest`, so a prerelease such as an rc isn't sent
 * to the 0.x line.
 */
export function tcdLink(version: string): { url: string; date?: string } {
  const date = version.match(/(\d{8})$/)?.[1]
  return date
    ? { url: `https://github.com/openwatersio/slackwater-database/releases/download/v${version}/slackwater-${date}.tcd`, date }
    : { url: 'https://github.com/openwatersio/slackwater-database/releases' }
}

export const TCD = tcdLink(DATABASE_VERSION)
