// IndexNow tells Bing, Yandex, Naver, Seznam and the other participating engines
// which URLs changed, instead of leaving it to their next sitemap crawl. One
// submission to api.indexnow.org is shared with all of them.
// https://www.indexnow.org/documentation

/** Public by design: engines verify it by fetching `/<key>.txt` from the site. */
export const INDEXNOW_KEY = '489429a9012a84308ef89926c8a35e40'
export const HOST = 'slackwater.xyz'
export const ENDPOINT = 'https://api.indexnow.org/indexnow'
/** The protocol's limit per request. */
export const BATCH = 10_000

/**
 * Station pages print the day's predictions, so their <lastmod> is the build
 * date and moves on every nightly deploy. Submitting that would send about
 * 9,300 URLs a day, which is what IndexNow answers with a 429; the sitemap
 * <lastmod> already says it. Only a station's arrival or departure is news.
 */
export const DAILY_SITEMAPS = new Set(['sitemap-tides.xml', 'sitemap-currents.xml'])

/** URL -> lastmod ('' when absent), across one site's sitemaps. */
export type Entries = Map<string, { lastmod: string; daily: boolean }>

/** The child sitemap URLs a <sitemapindex> lists. */
export function sitemapIndex(xml: string): string[] {
  return [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((m) => decode(m[1]))
}

/** Adds one child sitemap's <url> entries to `into`. */
export function addUrlset(into: Entries, file: string, xml: string): Entries {
  const daily = DAILY_SITEMAPS.has(file)
  for (const [, body] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = body.match(/<loc>([^<]+)<\/loc>/)?.[1]
    if (!loc) continue
    into.set(decode(loc), { lastmod: body.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? '', daily })
  }
  return into
}

/**
 * The URLs to submit after deploying `built` over `live`: every URL added or
 * removed, and every URL outside the daily sitemaps whose <lastmod> moved.
 * A removed URL is submitted too, so engines re-fetch it and find the 404 or
 * the redirect.
 */
export function changedUrls(live: Entries, built: Entries): string[] {
  // An empty live map is a failed fetch or parse, not an empty site; diffing
  // against it would submit every URL.
  if (live.size === 0) throw new Error('indexnow: the live sitemaps have no URLs')
  const changed = new Set<string>()
  for (const [url, now] of built) {
    const before = live.get(url)
    if (!before || (!now.daily && before.lastmod !== now.lastmod)) changed.add(url)
  }
  for (const url of live.keys()) if (!built.has(url)) changed.add(url)
  return [...changed].sort()
}

/** The request bodies for `urls`, at most BATCH each. */
export function payloads(urls: string[]) {
  const out = []
  for (let i = 0; i < urls.length; i += BATCH) {
    out.push({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
      urlList: urls.slice(i, i + BATCH),
    })
  }
  return out
}

const decode = (s: string) => s.trim().replace(/&amp;/g, '&')
