# Working on slackwater.xyz

How this site gets built and shipped. It is the source of truth for people and coding agents working in this repository. The repo is public because a marketing site has nothing to hide, but outside contributions are not being sought. Bug reports about the live site are welcome.

Every change follows the org-wide [rigor rules](https://github.com/openwatersio/.github/blob/main/docs/agents/rigor.md). The first of them: when something fails or looks wrong, find the cause and fix it there instead of working around it.

Everything written here, including code, comments, documentation, commits, and pull requests, is public. Keep roadmaps, unpublished pricing, unreleased plans, and paths into private repositories out of it.

Short, because it is meant to be followed rather than consulted. What the site is and why it
looks the way it does is in [README.md](README.md).

## Getting started

The tested toolchain is Node 24 and its bundled npm 11. `mise install` reads those versions from `mise.toml`.

```bash
npm install
npm run dev     # http://localhost:5174
npm test        # vitest, the prediction maths
npm run build   # prerender + Worker bundle in .output/
npm run deploy  # build, then wrangler deploy with nitro's generated config
```

## Layout

| Path | What lives there |
|---|---|
| `src/routes/` | File-based routes. `__root.tsx` is the document shell and `<head>`. |
| `src/lib/` | Prediction maths — `currents.ts` (harmonic synthesis) and `ramp.ts` (speed → colour). Both tested. |
| `src/components/` | Presentational React. No data fetching. |
| `src/content/` | Markdown rendered as pages: support, privacy, accuracy, the comparisons and OpenCPN. `passes/` holds the CHS pass guides, one per station id. |
| `src/styles.css` | Colour tokens. Components reference these, never a literal hex. |
| `src/data/` | Bundled harmonic constituents for Deception Pass, the fixture `currents.test.ts` checks `predict.ts` against, and NOAA's saved high-tide predictions for the king tide pages. |
| `wrangler.jsonc` | Worker *source* config. Not the deployable one — see the gotchas. |

## Shared station preview

`/preview/react?kind=current&id=noaa%2FPUG1629` is a development-only comparison route. It uses the exact npm beta of `@slackwater/react` pinned in `package.json`. `react-source.ts` supplies the shared pages, cards, and map queries with predictions from `predict.ts`; it needs no local API server. `reactStation` and `reactStations` in `catalogue-server.ts` load their implementation dynamically, keeping catalogue scans and database decoding out of client bundles and Worker startup. Lookups and listings use the site's commercially licensed, quality-filtered catalogue and retain source credits. Exact accepted current bins of published stations use their own constituents, mean flow, and directions without adding duplicate rows to lists. Coordinate predictions choose the nearest bundled tide station; explicit CHS IDs retain their browser-only availability.

In the preview, CHS predictions stay in a separate browser-only day panel (`ChsDay`) with cancellation. `chs-day.ts` delegates to the existing IWLS fetchers, and the panel uses the shared `TideScrubber` and `CurrentScrubber` in `bounded` mode. The finite sample window supplies no multi-week summary and is never extrapolated. Tide heights stay in feet above chart datum; CHS current samples retain the published magnitude and Set beside their signed curve value. The current scrubber uses the site’s `SLACK_KNOTS` threshold. The local data source refuses CHS prediction requests, including during server prefetch. The development preview and MapLibre code are excluded from production client bundles. The preview route is excluded from prerender discovery and returns 404 in production; its server functions reject production requests.

## Station strips

Production station pages draw their day chart with the same `TideScrubber` and `CurrentScrubber`, inside the site's own page: heading, breadcrumbs, guides, app link, the 7-day table, Station facts and the Leaflet nearby map stay the site's. `StationStrip` feeds them `src/lib/readings.ts`, which maps `predict.ts` output, and CHS's published days, into the package's shapes for the strip and the preview's data source alike. A bundled station's strip covers 96 hours before to 180 hours after the station-local start of the day it opens on, the window the package's station page loads. A CHS-only station's bounded strip starts with a day, then fetches adjacent windows in the background and near the edges.

- The server render passes no `now`, so prerendered HTML draws no now dot, no Today and no Now pill; the strip gets the reader's clock once `useLiveNow` is live. An instant page passes its moment as `selected`, which the server render and the browser both open on. Both renders pass the same `locale`, `STRIP_LOCALE`, so they format alike.
- The URL and the 7-day table follow the strip once it rests: an instant path, and a table starting on that day, away from now; the station's own path and today's table at now. The update is debounced because Safari throttles `history.replaceState`. Now on a shared moment the strip's window can't reach moves the window to today; on a CHS-only page it loads the station's own page, whose request for today's day starts when it loads, as `src/content/privacy.md` says.
- `StationTiles` draws the package's `SummaryTiles` under the strip, as the app does: Range or Next max beside the Moon and the Sun, read at the strip's moment. `StationStrip` reports every moment, the one it opens on included, to a `MomentStore` that only the tiles read, so a drag doesn't re-render the page.
  - The server render of a station's own page has no moment, so the tiles read "—" at the size they keep. A computed station's instant page reads its moment in the HTML too. Moon and Sun read "—" for a moment before 1950 or from 2101 on, outside what Almanac computes, and the curves draw no daylight bands there; Range and Next max still read. A CHS-only page's tiles appear only once the browser has DFO's day. That day starts 6 hours before the moment, and Range needs a turn on each side of it, so at a mainly diurnal BC port Range often reads "—" until `useChsWindows` loads the day before, or for good if that load is cancelled or fails. Asking DFO for more at the start would change the request `src/content/privacy.md` describes.
  - Range and Next max name the turns the strip draws, CHS's included on a merged port. A computed station ranks them against the fifteen days either side of the first moment the tiles read (`rankedAround`): the moment a shared link names, or the reader's own once the page is live. `StationStrip` reports moments to the tiles only once it has the reader's clock or a shared moment, since before that it may open clamped to a window built around the build's clock; the last moment it read is passed on when the clock arrives. The month is held while the moment stays inside it and starts again when it leaves, after Now from a far shared link or on a page left open for weeks.
  - A tide's month and its week of bars are `predict.ts`'s turns with the strip's own in their place over the hours the strip covers (`splicedExtremes`), so a merged port's Range is measured, ranked and barred against the same turns the strip and the 7-day table give, CHS's and the seam's eased ones included. The splice goes by the strip's hours, not its turns, so within them a computed twin the seam dropped never returns. Past the strip's end, which can fall partway through CHS's day on a shared link a week back, the month holds computed turns where the strip would hold CHS's. A current's month leaves out its lulls, which the ranking doesn't read.
  - The ranking runs in the browser only, once the strip's moment has held still for a second (about when its opening glide settles), and so does a re-rank when the strip's readings change, because a month of turns is too much work for every shared link the Worker renders, and for the strip's opening glide or a drag. Until then, and while a new month or a re-rank waits, the number reads unranked rather than against a month it has left or turns the strip no longer draws, so a shared link's served HTML may say "low to high" where the browser then says "beyond normal here".
  - The Range tile's week of bars starts on the day the page opened on, a shared link's or the reader's own, and follows the moment by the package's `useOutlookWeek` rule. With no moment, a station's own prerendered page, it holds its place and is hidden from assistive technology, so the served page describes no week and does no extra work; a shared link's server render computes its nine days.
  - The Moon tile's caption ("Spring tide", "Neap tide", "Perigean spring tide") is the package's, from the Moon's phase and distance alone, as in the app. It names the Moon's pull, not the station's water: at a mainly diurnal station it can read "Spring tide" beside a small Range. The rule against lunar phase for king tides is about dating the water; this caption is kept for parity with the app, which decides it for both (openwatersio/slackwater-ios#953).
  - A CHS-only station gets the tiles unranked and without the week's bars, however many of DFO's days the strip has loaded, since the site computes no month for it. A merged current would rank against computed maxima only; `catalogue.test.ts` fails if a current is ever merged, so none is. The tiles never print: a computed page prints its 7-day table, and a CHS-only page its strip.
- A merged Canadian port splices CHS's day into the strip for the hours DFO actually sent. `seamFor` in `src/lib/readings.ts` is the one rule the strip and the 7-day table both join it by, so the two list the same turns. The seam comes from DFO's hours alone, never from the week or window on screen; the week only chooses which rows to show.
  - Inside those hours every sample and turn is DFO's, exactly as published.
  - A computed turn within 75 minutes of a DFO turn of the same kind is the same turn, and is dropped.
  - A computed turn just inside DFO's hours, within 75 minutes of either end (midnight, not DFO's last sample at 23:45), stays when DFO lists no twin for it. DFO is asked for midnight to midnight, so a computed 00:03 high whose twin fell at 23:57 the day before would otherwise be lost from both sources. It is labelled at its own computed height, as the table prints it. A computed lull inside DFO's hours never stays, because DFO publishes none.
  - The strip's computed curve is eased onto DFO's over twelve hours either side, so it draws no step. The ease spends only the room the computed curve leaves under the strip's 0.6 m an hour fast-water line (`SEAM_FAST_MPH`, `easeFor`), so it never marks fast water neither model predicts. Its computed turns there sit on the eased curve.
  - A day is not joined at all when its step at either edge is over 3.5 ft, or when the twelve hours beside it have too little room under the line to take the step: the strip and the table stay computed for that day, with no CHS rows and no CHS credit, exactly as before DFO answered. A step that large means the computed curve does not describe that water; too little room means the computed water there runs fast most of the day. The decision is each day's, so a port whose computed row is corrected joins again on its own. The browser's request to DFO is unchanged. An end with no computed height to meet is joined but not eased. `catalogue.test.ts` fails if a merged tide port ever lacks a datum shift, or if a current station is ever merged, whose slack rule is unmeasured.
  - The numbers come from DFO's days for every merged tide port from 20 November to 4 December 2026, one late-November spring-neap cycle (2,955 port-days), measured as the comments on `SEAM_TWIN_MS`, `SEAM_RAMP_MS`, `SEAM_FAST_MPH` and `SEAM_STEP_LIMIT_FT` describe. The rivers' freshet and the perigean springs of other months were not in that sample.
  - `node tools/measure-chs-seam.mjs [dir] [first-day] [days]` repeats the measurement for any window. It records DFO's `wlp` (at FIFTEEN_MINUTES) and `wlp-hilo` for every merged port, as the site's `fetchPortTides` asks for them but with one range per port across the whole window rather than one per day, matching DFO stations within 3.2 km where the site uses 3 km so a station just at the site's limit is recorded too. It uses plain HTTP, paced under IWLS's 30 requests a minute, and takes about a quarter of an hour. It then replays each station-local day through `fetchRefinement` in `src/lib/chs-seam.measure.test.ts` and prints the step percentiles, the twin-gap percentiles, the closest same-kind DFO turns, the ports past the step limit, the days not joined and why, the count of fast-water marks the ease makes (which must stay zero), and every port and day it skipped. It fails on a partial run: a port with no recorded answer, or a recorded day the replay can't read. It keeps the responses in `dir` for a re-run.
  - `catalogue.test.ts` pins a fingerprint of the merged ports' ids, constituents and datum offsets and fails CI when a database release changes them. Re-run the tool then, and update the constants, their comments, the numbers the credit (`copy.ts`) and `src/content/privacy.md` give, this section, and the fingerprint. `copy.test.ts` fails if the credit or the privacy policy names numbers other than the constants.
  - The credit under the strip follows one rule (`joinInView`, then `refinedCredit`): it credits CHS only for DFO's points inside the strip's window. It names their day, "Today's curve" while that is the reader's own station-local day and a date after, and their hours when the window or DFO's answer shows only part of the day. It mentions the table's rows only when the table shows rows marked CHS, names a computed turn kept beside midnight as computed when it is in view, and says the curve is eased only on a side that was eased and is in view: "either side of" its day, "before" or "after". With no DFO point in view there is no CHS credit; an eased stretch in view gets a line of its own.
  - DFO's points are read in time order and points with no readable time or height are left out, in `fetchPortTides` and again in `seamFor`.
  - The table prints every computed turn at its own computed height, unmarked, so its credit stays true. Beside the seam a strip label can therefore differ from the table's row for the same turn by up to the step being eased.
  - Currents are not eased, because a shifted speed would move its slacks off zero.
- `src/styles.css` scans the package with `@source`, so its utilities sort with the site's own in one sheet; a second utilities sheet linked after it would override the site's `sm:` and `print:` rules. `station-strip.css` carries only the package's theme variables and plain classes, and `directoryHead` links it on station pages only, not on the place pages that share their route.
- The package's unused station-page map, and MapLibre with it, drops out of the client bundle on its own, since the package marks its lazy import pure. `bundle-size.test.ts` fails if a MapLibre chunk ever ships.
- The strip and tile components import `@slackwater/react`'s own `@slackwater/engine` (see the engine rule below) and `@openwaters/almanac`, the same copy as the site's own pin, which `src/lib/daylight.ts` uses for the curves' daylight bands, so bumping that pin moves the Moon and Sun tiles too. The station page's code is in the entry chunk every page loads, so they ship there.

## Water events

`src/lib/water-events.ts` lists curated events. Adding an entry publishes it. Verify the source, station, value, direction, local time, attribution and share page before committing it; set `verified` and `expires` for each entry. Set expiry no later than the predicted peak; the homepage stops listing an event at its peak. Expired entries remain accessible as historical share links but leave the homepage. When a king-tide season is retired, retain its event pages; the source-data test checks historical events only while their season is still bundled. Refresh the list as new events are verified.

## King tide pages

`/king-tides/` and a page per state are built from the stations and seasons in `src/lib/king-tide-regions.ts`. No dates are typed by hand. A page lists each of its state's `seasons` by date and reads no clock: no "next", "now" or "passed", which a prerendered page can't keep true.

- The heights and times are NOAA's predictions, saved in `src/data/noaa-king-tides.json`, not this site's. It is the one place the site prints another publisher's predictions. Slackwater's engine disagrees with NOAA by up to 0.4 ft on some West Coast highs ([slackwater-database#428](https://github.com/openwatersio/slackwater-database/issues/428)), which is enough to rank the wrong spring tide highest, and these pages are read against NOAA's. Switch them to `predict.ts` once the engine agrees. NOAA's predictions are public domain; the pages credit NOAA and say the dates are Slackwater's choice, since NOAA's terms forbid presenting modified data as official.
- A king tide is ranked on high-water level. Range and lunar phase both pick the wrong dates on some coasts (South Florida's highest water is in fall, its widest range in winter), so use neither.
- Windows count tidal days. Civil days lose a night high as it crosses midnight, which Key West's do.
- Seasons don't roll over by themselves. Each year, before a state's season, add its starting year to `seasons`, and drop any that is over and no longer wanted, keeping at least one. Then run `node tools/fetch-noaa-king-tides.mjs` and `npm test`. The tool refuses unreadable answers, answers that stop short of the season, and answers where two highs or two lows run together. It cannot see a high and the low beside it both missing. The test checks that each season came from the station its page links to.
- A new state adds an entry to `KING_TIDE_REGIONS`. Its route, twin, sitemap entry and directory link follow from that. Run the fetch tool, add the state's name to `llms.txt` and the agent view, which the test checks, and commit the rebuilt `public/_redirects`.
- A `@slackwater/database` bump can move a listed station's path or NOAA row. The test and the build both fail when it does; re-run the fetch tool and fix the paths in `king-tide-regions.ts`.

## Testing

CI runs these commands in order:

```bash
npm ci
npm run build
npm run typecheck
npm test
npm run test:agents
```

The build comes before typechecking and tests because it generates `src/routeTree.gen.ts` and the prerendered artifacts that six integration suites inspect. Prediction changes arrive with a focused test; errors there can look plausible and matter on the water.

Tests run in Node. A test of what a component does after it mounts, its effects, timers and store subscriptions, which a server render never runs, names `// @vitest-environment happy-dom` on its first line and mounts with `react-dom/client` inside `act`, as `StationTiles.dom.test.tsx` does.

Presentation is checked by looking at it. There is no snapshot suite: 9,528 pages come from
three templates, so a representative tide page, a representative current page, and a
representative CHS identity-only page (`/currents/dodd-narrows`) is the check, plus a merged
Canadian port (`/tides/ca/bc/victoria/`) with the CHS layer loaded in a browser, and a diff
across thousands of near-identical generated pages would be noise, not signal.

Anything touching a Worker route, including the analytics proxy, `/privacy.md`, or `/support.md`, must be checked against a real Worker because those routes do not resolve under `npm run dev`:

```bash
npm run build && npm run preview
```

Every page except station and browse pages has a Markdown twin at its path plus `.md` (`/learn/tides/` is `/learn/tides.md`), and answers `Accept: text/markdown` at its own URL. `MARKDOWN_TWINS` in `src/lib/agent-mode.ts` lists them, and `/?mode=agent` serves the same list as JSON with the site's endpoints and limits. A page written in JSX repeats its prose in its twin (`src/lib/markdown-twins.ts`, `src/content/learn-tides.md`); `markdown-twins.test.ts` fails when their sections drift apart. A new page with a twin also needs its path in `run_worker_first` in `wrangler.jsonc` and in the prerendered `pages` in `vite.config.ts`.

`npm run test:agents` starts the built Worker with file watching disabled, checks document negotiation, Markdown alternates, missing-page recovery, discovery files and links, then stops it. Pass a base URL to check a running preview: `npm run test:agents -- https://preview.example.com`.

Look at any visible change before reporting it complete.

## Project rules

- Keep dependencies, abstractions, and build steps to the minimum. Their cost is multiplied across 9,528 station pages.
- Every rendered curve comes from `src/lib/predict.ts` and bundled constituents. The landing page only shows the app's screenshots. Changes to `predict.ts`, `src/lib/ramp.ts`, or `src/lib/iwls.ts` require a test.
- NOAA subordinate current stations reduce an exact reference station and bin through their published time offsets and speed ratios. A row with its own constituents remains harmonic regardless of NOAA's type label.
- The 24 CHS gate pages and the 859 Canadian tide ports with no predictable provider row ship identity without a prerendered prediction. The visitor's browser fetches each one's day directly from DFO, except `chs-malibu-rapids`, which is derived and has no station to fetch. A route the database merges with a provider row that has constituents, which today is 198 of the 1,057 Canadian tide ports, prerenders that row's computed curve under the CHS record's name and position, and the browser then draws CHS's published day in place of the computed water and table rows for the hours DFO sent, the reader's own day, as the refined data (`src/lib/refine.ts`), marking those rows CHS; `seamFor` joins it to the computed days either side. A failed or slow fetch leaves the computed curve and rows. Copy on those pages names no app mechanism either (#44). Never proxy or re-serve IWLS predictions, and never prerender them. `src/lib/iwls.ts` converts DFO metres on chart datum to feet; CHS pages name chart datum without borrowing another datum code. The site publishes every Canadian tide port the database gives a record and a route.
- A pass guide in `src/content/passes/` cites a published source for every claim, such as the CHS Sailing Directions. It never quotes a DFO prediction and never says how the app predicts the gate (#44). `src/lib/passes.test.ts` checks the shape of both rules, not the facts, so review the sources.
- Never claim a feature the app does not ship. The app's App Store URL lives in `src/lib/links.ts`, and the eight pages under `src/content/compare` repeat it in prose.
- `src/content/privacy.md` names what the site collects. Any analytics, embed, font CDN, third-party script, or change to the IWLS request timing updates that policy in the same commit.
- Components use colour tokens from `src/styles.css`. Green means slack, and colour expresses state rather than kind. Keep the Slackwater wordmark on one line with `whitespace-nowrap`.
- The Worker custom domain owns apex and `www` DNS. Do not add those records by hand.
- Do not add `devtools()` from `@tanstack/devtools-vite`; it breaks `vite dev` with an unavailable SSR environment and a transport timeout.
- `slackwater-ios` is the source of truth for ported visuals. Match the Swift palette, geometry, and crop after reading the complete draw function and its `Theme.swift` constants. Resolve genuine inconsistencies in the app first.
- The app's sky projection depends on both crops: fit each body's rise-to-set span to the width and fit the app's 0–62° altitude range to the band height at the call site. Keep `skyPoint` aligned with `Slackwater/Theme.swift`; the 300° projection in `openwaters.io` has a different purpose.
- `@slackwater/database` moves with slackwater-ios: bump both to the same release in the same pass, so the site and the app name, place, and credit every station alike. slackwater-database's [CONTRIBUTING](https://github.com/openwatersio/slackwater-database/blob/main/CONTRIBUTING.md#releases) owns the rule. After a bump, `node tools/count-opencpn.mjs` recounts the figures `/opencpn/` quotes into `src/content/opencpn-counts.json`; update `src/content/opencpn.md` to match, which `content-routes.test.ts` checks.
- `@slackwater/engine` is pinned exactly and moves with `@slackwater/database`: take the engine release the database's release notes name. A database built for another engine predicts some constituents at the wrong phase; engine 1.0.0-beta.12 turned M3, S3, and M7 by 180°, which only a database built for it matches. `@slackwater/react` may need a newer engine than the site's; npm then installs that engine under the package. The strips use it for readings over the curve the site's own engine computed, never to predict a station.
- `.npmrc` sets `min-release-age=1`, so npm won't resolve a release less than a day old. To take a fresh `@openwaters/*` or `@slackwater/*` release the day it ships, pass `--min-release-age=0` to that one `npm install`; the lockfile keeps the version afterwards. Dependabot uses a three-day cooldown for the same reason.
- Install scripts run only for packages listed in `allowScripts` in `package.json`, and `strict-allow-scripts` in `.npmrc` fails the install on any other package that has one. Read what a new script does before approving it with `npm approve-scripts --no-allow-scripts-pin <pkg>`, or skip it with `npm deny-scripts <pkg>`.

## Branch and PR

**No direct pushes to `main`.** Work on a branch, land through a pull request.

```sh
git switch -c <area>/<short-description>
git push -u origin HEAD
gh pr create --fill
```

A repository ruleset on `main` enforces this: direct pushes are rejected, and so are
force-pushes and branch deletion. No approval is required, so you can merge your own PR —
the rule is that the change travels through one, not that someone else signs it off.
Unresolved review comments block the merge.

**Every PR gets a preview.** `.github/workflows/preview.yml` builds the branch and uploads it
as a Worker *version* — no production traffic is routed to it — then comments the URL on the
PR. The alias is `pr-<number>`, so the link is stable across force-pushes and stays correct
as the branch moves. Reviewing on a phone is the point.

Preview traffic is reported to Plausible as `slackwater.xyz`, because `data-domain` is a
constant. A handful of your own pageviews per PR; if that ever matters, derive the domain
from the request host in `__root.tsx`.

A PR that changes anything visible should show it — a screenshot, or before and after side by
side:

```md
| Before | After |
|---|---|
| ![Before](uploaded-image-url) | ![After](uploaded-image-url) |
```

## Deploying

**Merging to `main` publishes the site.** `.github/workflows/deploy.yml` runs the tests, builds,
and publishes with the `CLOUDFLARE_API_TOKEN` repo secret. It is the whole release process —
no version number and no changelog: every merge deploys immediately, so the git log already is
the changelog, and a separate one would just repeat it a commit behind. The only other
environment is the per-PR preview above, which never serves the apex.

The token never shares a runner with the site's dependencies or anything they write. Deploy and Preview each build and test in a job with no secret, which hands `.output/` on as a one-day artifact. The job holding the token then:

- checks out only reviewed files from the same commit: `tools/deploy`, `src/lib/deploy-config.ts`, `wrangler.jsonc` and `mise.toml`;
- installs wrangler from `tools/deploy`'s own lockfile, under the same `.npmrc` age floor and script allowlist as the site, before the token is on the runner;
- refuses a built `.output/server/wrangler.json` that isn't `wrangler.jsonc` plus exactly what Nitro adds (`tools/deploy/check-config.mjs`). A `build` command there would run beside the token, and another name, route or binding would point the token at another Worker, hostname or store.

A Nitro upgrade that changes the generated config fails `deploy-config.test.ts` after a build, and the deploy refuses it too, until `NITRO_ADDS` in `src/lib/deploy-config.ts` is updated in review. Wrangler appears twice: `package.json` for local previews and the agent checks, `tools/deploy` for publishing; Dependabot bumps both, and `lockfile.yml` checks both lockfiles. Preview's test job installs the publishing wrangler too and dry-runs a deploy of the build with it, with no token, so a bump of it is exercised on its own PR, which skips the upload. The publish jobs use no npm cache, since the build job could write one. The artifact includes hidden files, so none the site needs is dropped; only the prerender server's `.output/server/.wrangler` stays behind. The split keeps the token from being read or aimed elsewhere; a compromised build can still change the site it publishes. Re-running only the publish job after the artifact expires fails: re-run the whole workflow.

That workflow exists because the manual step got skipped. `/privacy` and the Plausible script
were both merged and neither reached the apex, which went on serving an older build; nothing
failed and nothing said so.

The workflow also reports changed URLs to [IndexNow](https://www.indexnow.org/documentation), which shares them with Bing and the other participating engines. Before `wrangler deploy`, `node tools/indexnow.mjs plan` compares the live sitemaps with the build's. It lists URLs that were added or removed, and pages outside the station sitemaps whose `<lastmod>` changed. After the deploy, `submit` sends that list. A station's `<lastmod>` is always the build date, so a station is only submitted when it arrives or leaves. A nightly rebuild therefore normally submits nothing. Neither step can fail the deploy, so a failed submission shows only in the job log. The key in `src/lib/indexnow.ts` is public by design: engines verify it by fetching `public/<key>.txt`, and `npm run test:agents` checks that the file is served. Bing Webmaster Tools' IndexNow report shows what was received. `npm run deploy` does not submit.

The build also writes `public/stations.json`, gitignored like the sitemaps. It lists the same station pages with their database ID, kind, name and position (rounded to four decimal places), and `predictions`, false for a station Slackwater can't predict, and links the database's licence section, as the OpenCPN dataset does. Each station also points into a deduplicated `attributions` list. The database's rule for redistributing a station is to display its attribution, so a consumer that shows a station's name shows its notice too, and a station without one fails the build. Another site can use it to link a place to the stations near it. Open Waters AIS's Worker reads it to link each vessel page to its nearest station pages, which gives crawlers paths into the station sitemaps, and passes the nearest predicted tide station's ID to `@slackwater/react`'s `<TideConditions>` widget, which asks the Open Waters tides API for its predictions. An ID goes with the API endpoint or component for its station's kind. Cloudflare serves it as a plain asset with no CORS headers. The station finder reads it in the browser on the same origin; a browser on another origin can't fetch it. CHS-only pages are listed like any other station page, with `predictions: false`: their pages load CHS's own day in the browser, and a derived gate's page has none, but neither has constants Slackwater computes from. Because the file is gitignored, a laptop `npm run deploy` from a commit before it would ship whatever copy a newer build left in `public/`; delete `public/stations.json` before deploying an older commit. A consumer should treat a missing or malformed index as no stations, and a station without an `id` as one it can link but not draw. `buildStationIndex` in `src/lib/station-index.ts` builds it from the catalogue the sitemaps read, `station-index.test.ts` checks that both list the same pages, and `npm run test:agents` checks that the served file lists the served sitemaps' station pages, each with its notice, ID and `predictions` flag.

Because the deploy only sends changes, a page that was already live when IndexNow was wired up is never sent. To send every page once, run `node tools/indexnow.mjs all urls.txt`, then `node tools/indexnow.mjs submit urls.txt`. Do this once, for example after a new engine joins IndexNow or after a move to new URLs, not on a schedule: about 9,500 URLs a day is what IndexNow answers with a 429.

`npm run deploy` still publishes from a laptop, for a rollback or when the token is being
rotated. `workflow_dispatch` on the Deploy workflow does the same thing from Actions.

Publishing needs a Cloudflare API token with **Workers Scripts → Edit** and **Workers KV →
Edit**, or `wrangler login`.

Do **not** hand-add the apex or `www` DNS records. A Worker custom domain declared in
`wrangler.jsonc` creates and manages them itself, as proxied `AAAA -> 100::`.

Before merging a release:

- Review specs and plans touched by the release, including unfinished work carried from earlier releases.
- Preserve lasting guidance here and delete completed implementation specs and plans. Keep unfinished plans and link remaining work to issues.
- Have a human review documentation updates and deletions in the pull request.

After a deploy, check <https://slackwater.xyz>, `/support`, `/support.md`, `/privacy`, and `/privacy.md`.

## Analytics

Plausible, served first-party. Two nitro route rules in `vite.config.ts` proxy
`/js/script.js` → `plausible.io/js/script.outbound-links.js` and `/api/event` →
`plausible.io/api/event`; the snippet in `src/routes/__root.tsx` points at those paths with
`data-api`. Blockers list `plausible.io` by domain, so a third-party snippet quietly loses a
share of visitors and a same-origin one does not.

Cookies are stripped on the way out. Everything else passes through, including the
`X-Forwarded-For` that Cloudflare sets — Plausible derives its daily visitor hash from that
header, so do not filter it.

The `outbound-links` script variant records clicks on links leaving the site as an
`Outbound Link: Click` goal, with no extra code.

**`src/content/privacy.md` names the provider and lists exactly what is collected.** Anything
that changes what the site measures changes that file in the same commit.

## Things that will otherwise cost you an hour

- **Don't add `devtools()` from `@tanstack/devtools-vite` to `vite.config.ts`.** It breaks
  `vite dev` with `Vite environment "ssr" is unavailable` and a 60s `getBuiltins` transport
  timeout — every request 500s, while `npm run build` stays perfectly green, because the plugin
  only runs in dev. It is not the nitro beta, the Vite version, or the presence of wrangler;
  all three were ruled out one at a time. The site isn't too simple to want router devtools
  anymore — there are parameterised routes and a server boundary now — the plugin is just
  broken until the timeout above is fixed.

- **`ERROR [nitro] Preview server exited with code 143` at the end of a build is normal.**
  Nitro spins up a preview server to prerender against and SIGTERMs it when done. The build
  exits 0 — check that, not the log.

- **`/js/script.js` 404s under `npm run dev`.** Vite's dev middleware claims `.js` URLs before
  nitro's route rules see them, so the analytics proxy only resolves in a real Worker:
  `npm run build && npx wrangler dev -c .output/server/wrangler.json`. Nothing is lost in dev —
  the Plausible script ignores localhost regardless.

- **`npx vite preview` serves pages with no CSS or JS.** `vite.config.ts` overrides nitro's
  preview command to mount an empty assets directory: the prerender crawl runs against that
  same server, and `wrangler dev` restarts on every write into the directory it serves assets
  from — which is the directory the crawl is filling. That cost one deploy and one PR run
  (issue #48). Use `npm run preview`, which runs `wrangler dev` against the generated config and
  serves the real assets.

- **`wrangler.jsonc` at the root is the *source*, not the deployable config.** Nitro reads it
  and emits `.output/server/wrangler.json` with `main` and `assets` rewritten to the right
  relative paths. Deploy with that one; `npm run deploy` already does.

- **A fresh custom domain can look dead from your machine while being perfectly live.** A
  resolver that cached the NXDOMAIN from before the record published will keep serving it —
  on a Tailscale tailnet, MagicDNS at `100.100.100.100` does exactly this, so `curl` reports
  "Could not resolve host" long after the site is up. Check with `dig @1.1.1.1` or
  `curl --resolve slackwater.xyz:443:<edge-ip>` before believing a deploy failed. On macOS,
  `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder`.

- **`unstorage@2` alpha (via nitro) imports `destr` without declaring it**, so the vite config
  fails to load wherever `destr` isn't hoisted. `destr` is a direct dependency so the import
  resolves however npm lays out `node_modules`.

## Agent-readable pages

The homepage, About, Contact, Pricing, Support, Privacy and Accuracy support `Accept: text/markdown`, advertise their `.md` alternate, and vary both representations on `Accept`. Other pages retain HTML. `src/content/pricing.md` cites the US App Store listing and its verification date; check that live listing when changing prices. `src/content/home.md` describes the same product as the homepage; update both when features, compatibility or offline limits change. `/llms.txt` provides use cases and points to the relevant product and policy pages.

`src/worker.ts` wraps Nitro's Cloudflare preset before its asset shortcut. The negotiated document paths in `wrangler.jsonc` must run the Worker first; otherwise Cloudflare serves HTML assets without negotiation. Keep the preset alias in `vite.config.ts` compatible when upgrading Nitro. Missing HTML pages retain their 404 status and offer recovery links; clients requesting Markdown receive the recovery text as Markdown.

## Agents

`AGENTS.md` and `CLAUDE.md` point here so every harness follows the same instructions. An agent may open a pull request, push to its branch, and respond to review, but it never merges its own pull request.
