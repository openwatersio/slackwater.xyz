import { version as DATABASE_VERSION } from '@slackwater/database/package.json'

/**
 * The public beta link — the app's one external TestFlight group, "Beta".
 *
 * There is a single group, so every tester gets the same link and this is it.
 * Shared by the homepage hero and every station page, so the link that reaches
 * the public is defined once rather than copied to a second file that can drift
 * onto a stale one. The six pages under `src/content/compare` spell it out in
 * their own prose and have to be changed with it.
 */
export const TESTFLIGHT: string | null = 'https://testflight.apple.com/join/5gwh791N'

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
