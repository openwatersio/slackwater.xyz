# Station pages on slackwater.xyz

**Status:** design, not built
**Relates to:** `openwatersio/slackwater-ios` #187 (share a station), and that
repo's `docs/superpowers/specs/2026-08-21-referral-program-design.md` §7, which
settled `slackwater.xyz` as the share host.

## Why this exists

There is no way to send someone a station. #187 covers the app half — a share
button and a link that survives leaving the app. This spec covers the half that
link lands on.

It grew past "a fallback page" during design. Two facts pushed it:

1. **The handoff target named in #187 is gone.** Open call 1 there recommends a
   thin page that hands the full curve to the PWA. But `slackwater.xyz`'s own
   README and `index.tsx` now call that PWA deprecated, `web.slackwater.xyz` is
   the decided home and has no DNS record, and the PWA is still serving 200.
   There is no live surface to hand off to.

2. **The chart is already here.** `slackwater.xyz` computes real predictions with
   `@neaps/tide-predictor` — validated to floating-point agreement with
   slackwater-engine — and server-renders a real curve in `CurrentCurve.tsx`.
   The "duplicate a chart renderer" cost open call 1 weighed does not exist.

So open call 1 is re-decided here: the page renders the curve itself.

There is a second reason, independent of sharing. An SEO audit of the site found
that it can rank for the word "slackwater" and essentially nothing else, and that
the highest-value content it could own is a page per station. **Those are the same
artifact.** One build produces the share landing surface, the indexable corpus,
and the only thing on this origin an AI assistant could plausibly cite. A landing
page cannot be cited; a page that answers "what is the current at Deception Pass"
can.

## What this is not

Not the web client. One station per URL, no picker, no search, no favourites, no
navigation between stations. The only ways in are a link someone sent you and a
search engine. `CurrentCurve`'s existing note — that the moment the hero wants a
second station it has become the web client — is respected: this is not one page
that browses stations, it is many pages that each show one.

Not paid. Slackwater is account-free from the entitlement down; nothing here
introduces a user, a session, or a server that holds one.

## Decisions

| Decision | Choice |
|---|---|
| What the not-installed page renders | The real curve, live and scrubbable |
| Corpus | Every bundled station (~2,300), not a curated subset |
| URL | `/tides/<slug>` and `/currents/<slug>`, instant appended |
| Rendering | Canonical pages prerendered; instant URLs served from the same asset |
| OG image | One per station, generated at build |
| Plan | Cloudflare Workers Free |

## URL design

```
/tides/friday-harbor
/currents/dodd-narrows
/currents/dodd-narrows/2026-08-30T14:30-07:00
```

The kind sits in the path rather than #187's `/s/<slug>` because these pages are
the SEO corpus and `/s/` discards the keyword — "dodd narrows current" is the
query. It also gives two sitemaps and split reporting in Search Console, and tide
and current pages render genuinely different data (height versus signed velocity
and set), so they are different templates and the path is honest about that.

The instant format is #187's: an absolute instant written in the station's own
UTC offset, so it survives the receiver being in another zone. A bare
`/<kind>/<slug>` with no instant remains valid and means "now".

### Consequence for the slug vocabulary

`station-metadata` must **disambiguate within kind, not across kinds**. The NOAA
ladder's rung 2 appends `-current` to separate a current station from a tide
station sharing a name; with the kind already in the path that yields
`/currents/point-wilson-current`. Since the path carries the kind, the suffix is
redundant.

This moves slugs the PWA has already published. That is what `formerSlugs` and
`slugs.lock.json` are for, and the catalogue is being regenerated anyway, so this
is the cheapest moment it will ever be.

## What each page renders

**`/<kind>/<slug>`** — the station's character rather than a live reading: name,
position, what the water does there, typical range or peak flood and ebb rates,
the events for a day. Nothing claims to be current, so nothing goes stale in a
prerendered page. Hydration then makes it live and scrubbable.

This is also the better search result. A timestamped snapshot is a worse landing
page for a query than an overview of the station.

**`/<kind>/<slug>/<instant>`** — the same document, scrubbed client-side to the
shared moment.

## Rendering and serving

Canonical pages are prerendered at build, as the site's three pages already are.
Each page inlines its own station's harmonic constituents — roughly 2-3KB, the
size of the existing `hero-station.json` — so there are no per-station JSON
assets to fetch and no second round trip.

Instant URLs cannot be prerendered: the space is unbounded. They are also not
server-rendered, because the free plan gives 10ms of CPU per invocation and React
SSR plus a prediction does not reliably fit. Instead the Worker maps
`/<kind>/<slug>/<instant>` to the canonical page's asset and returns it — roughly
1ms of CPU, an asset fetch and a response — and client JS reads the instant from
`location` and scrubs to it.

The moment survives the tap. It does not survive into the unfurl, because
scrapers do not run JS. That is the one accepted loss, and it is revisited under
Deferred below.

## OG images

One PNG per station, generated at build, referenced by both the canonical page
and its instant URLs.

The pipeline reuses what exists rather than adding a layout engine:
`CurrentCurve` already server-renders a complete SVG — `path`, `text`, `line`,
`circle`, `linearGradient`. Only SVG-to-PNG is missing. No satori: there is no
JSX-to-SVG step to perform.

Two properties of the existing chart make this work, and both should be preserved
deliberately rather than by luck:

- **Paint is in SVG attributes, not Tailwind classes.** A rasteriser cannot
  resolve CSS classes; a class-styled chart would render unstyled. This is
  currently in tension with AGENTS.md's no-literal-hexes rule, and the OG path is
  the reason to keep the exception.
- **Fonts must be explicit.** The chart's `text` elements inherit system fonts,
  which a rasteriser cannot resolve. The OG variant sets an explicit family and
  embeds a subset.

The OG chart is a separate variant of the component at 1200x630, not the 460x210
viewBox — a chart legible at one size is not legible at the other.

**Write the rasteriser as plain TypeScript with no Node-only dependencies.** It
runs at build today. On a paid plan it runs unchanged in the Worker, and
moment-specific cards become a config change rather than a rewrite. That seam is
the point; do not let a Node-only image library close it.

## Indexation

The risk worth naming: `/<kind>/<slug>/<instant>` is an infinite URL space, and
every shared link is a near-duplicate of its parent. Left alone this is a crawl
trap built on purpose.

- Instant URLs carry `<link rel="canonical">` to the bare `/<kind>/<slug>`.
  Unfurls are unaffected: OG tags are read from the fetched URL regardless of
  canonical.
- Sitemaps split by kind, referenced from the existing index. `public/sitemap.xml`
  goes from 3 hand-written URLs to ~2,300 generated ones — its own comment
  predicted this.
- Canonical URLs must be the ones that return 200. Workers Assets 307s
  `/support` to `/support/`; whichever way trailing slashes resolve for these
  routes, the canonical matches it. A canonical pointing at a redirect is a
  conflicting signal.

## Apple App Site Association

`/.well-known/apple-app-site-association` is served from this Worker with
`application/json` and no extension, covering both the station paths and the
referral programme's `/r/<CODE>`. Neither the file nor the
`com.apple.developer.associated-domains` entitlement exists in either repo today.

Building it once here is what makes #187's app half a path pattern in a JSON file
rather than a second round of entitlement plumbing.

## Repo identity

Three documents become false and are rewritten in the same change:

- `AGENTS.md` — "This is a landing page. One page, one job" and "don't build the
  referral route, the web client, or a second page ... they're missing on
  purpose". The constraint changes; the reasoning behind it should be replaced,
  not deleted, so the next reader knows it was reconsidered rather than forgotten.
  The same file's "roadmaps, sequencing ... unreleased plans stay out of it" is
  relaxed by the existence of this document, deliberately: specs live with the
  code they describe. The public-repo warning it sits in still stands — nothing
  here names a private path, a price, or a date.
- `README.md` — the three-surfaces table. The apex absorbs what
  `web.slackwater.xyz` was reserved for.
- `src/routes/index.tsx` — the `WEB_CLIENT` comment naming `web.slackwater.xyz`
  as the decided home.

`web.slackwater.xyz` and the deprecated PWA should be formally retired here, or
the org will have three documented homes for one thing.

## Free-plan budget

| Limit | Free | This design |
|---|---|---|
| CPU per invocation | 10 ms | ~1ms; asset lookup only, no SSR, no rasterising |
| Script size | 3 MB | Unchanged; no WASM in the Worker |
| Asset files | 20,000 | ~4,600 (~2,300 pages + ~2,300 PNGs) |
| Requests/day | 100,000 | Only instant URLs invoke the Worker |

Static assets are served without invoking the Worker, but whether those requests
count toward the 100,000/day limit is **not documented**. Worth confirming before
launch: a 2,300-page corpus crawled by search engines and AI crawlers is a very
different traffic profile from a three-page site, and the ceiling is a hard stop
rather than a bill.

## Testing

The repo's rule is that the site claims correctness and a claim comes with a test.

- Slug to station resolution across every station kind
- URL build and parse round-trip, including the instant and its offset
- Prerender coverage: every station in the vocabulary produces a page
- Canonical correctness: every canonical URL returns 200, not a redirect
- The OG generator produces a decodable PNG of the expected dimensions

## Risks

- **Build time.** 43s today. Prerendering ~2,300 pages and rasterising ~2,300
  PNGs will be minutes. Acceptable, but it changes the deploy feel and the CI
  budget.
- **Total asset size.** Cloudflare documents per-file size and file count but no
  total. ~2,300 pages at ~30KB plus ~2,300 PNGs is on the order of 150MB. Verify
  empirically on first deploy. Indexed-colour PNGs of a flat-ground chart should
  compress hard and are the first lever if it bites.
- **Blocked on the slug vocabulary.** See Dependencies.

## Dependencies

**Blocked by** slug generation in `station-metadata`: slugs for all station kinds,
`slugs.lock.json` extended past the curated 37 to the full catalogue,
`check-slugs` green in CI, and the within-kind disambiguation this spec requires.
The machinery exists; the coverage does not.

**Unblocks** #187's app half, by supplying the AASA file, the entitlement host,
and a URL format the app can build and parse.

## Deferred

**Moment-specific OG cards.** The unfurl shows the station, not the hour. Lifting
this needs runtime rasterising, which needs more than 10ms of CPU, which means
Workers Paid. The rasteriser is written to make that a configuration change.

**Sharing an image directly from the app.** iOS can attach a rendered PNG
alongside the URL in the share sheet, which sidesteps OG entirely for Messages
while doing nothing for Slack or the web. That belongs to #187, not here.
