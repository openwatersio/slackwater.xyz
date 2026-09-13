# AGENTS.md

Context for AI agents working in this repo. Read [README.md](README.md) for what the site is
and [CONTRIBUTING.md](CONTRIBUTING.md) for commands, layout, deploys, and gotchas — this file
is only the things that are easy to get wrong and expensive to get wrong.

This is a **public repo**. Everything you write here — code, comments, docs, commit messages,
PR bodies — is published. Roadmaps, sequencing, pricing, unreleased plans, and paths into
private repos stay out of it.

## This was a one-page site

One page, one job used to constrain almost every decision: turn a reader into an install, and
nothing got to exist unless it served that. It's now a landing page plus 5,657 prerendered
station pages at `/tides/<slug>` and `/currents/<slug>`. The constraint didn't relax — a second
page finally earned it. The station corpus is both the thing a reader shares a link to instead
of describing what the water's doing, and the indexable content the site had none of before. A
referral route and a web client still haven't earned their place, which is why neither exists.

- **Reach for less, more than ever.** A dependency, an abstraction, or a build step needs to
  earn its place on a site whose pitch is that it loads instantly. 5,657 pages multiply the cost
  of anything that doesn't.
- **Don't build the referral route or the web client** because you noticed they're missing.
  They're missing on purpose — the station corpus earning its place doesn't change the case for
  either of them.
- **The site claims correctness, station by station.** Every page that draws a curve runs a
  real prediction from `src/lib/predict.ts` against bundled constituents. The landing page draws
  none: it is the app's screenshots, and claims only what they show. The Canadian stations ship no curve and prerender
  none — the reader's own browser fetches DFO's published predictions, and nothing about them is
  ever re-served by us. See below. If you touch `predict.ts`,
  `src/lib/ramp.ts` or `src/lib/iwls.ts`, a test comes with it.
- **A station the site cannot predict does not get a page.** NOAA publishes 1,705 subordinate
  current stations — no constituents of their own, just time offsets and flood/ebb speed ratios
  reduced against a reference station — and `@openwaters/noaa-current-stations` ships every one
  of them. `predict.ts` sums constituents, so a subordinate station prerenders to a head with no
  body: 3.7 KB where a real page is 20 KB. `catalogue.ts` skips them by name of that fact, and
  the skip stays until the reduction exists (#80). Deleting it because 1,692 currents look
  missing puts 1,692 blank pages back on the site.
- **The corpus is 5,657 pages of 8,097 distinct waters, not all of them.** 33 Canadian (CHS)
  stations build from published registry identity, with no prediction in the page — DFO's terms
  don't allow re-serving predictions for them. That is 23 current gates and 10 tide ports. On
  32 of them the visitor's own browser fetches DFO's numbers from `api-iwls.dfo-mpo.gc.ca` when
  the page loads, with a Cancel button while it is in flight; the 33rd, `chs-malibu-rapids`, is
  derived from a reference port and has no station to fetch. **Never proxy IWLS through the
  Worker**, for CORS or anything else — the moment we fetch, we are re-serving. **Never
  prerender the curve** — the served page carries no CHS prediction, which is what makes
  fetching on load a privacy question and not a licensing one. `src/content/privacy.md`
  describes the on-load request; it moves with any change to when or whether that request
  happens. **DFO publishes metres on chart datum**; `src/lib/iwls.ts` converts to feet at that
  boundary, the way `catalogue.ts` does at its own, and a CHS page names "Chart datum" and no
  code — Victoria's own LLWLT is 9 cm below the zero its heights are quoted from, so a borrowed
  code would be a precise wrong claim. This work builds 10 of the 1,058 Canadian tide ports —
  the ten the registry publishes identity for. For the other 1,048 no identity is published at
  all, which is an operator run against IWLS and a release, not a change here. Plus
  `chs-arran-rapids`, excluded by name pending an owner decision. Tracked in issue #17 — don't write or imply full coverage;
  `/currents/dodd-narrows` now resolves.

## Hard rules

- **Never claim a feature the app doesn't have.** The particle field is one to watch: it is
  designed but not shipped in the app, so it must not appear here until it is.
- **Never publish a private TestFlight link.** The link in `src/routes/index.tsx` is the public
  beta group, minted for this page. The Friends & Family link is handed out personally, and
  publishing it turns a curated group into an open door.
- **`src/content/privacy.md` is a promise, not boilerplate.** It names what the site collects.
  Anything that changes what is measured — analytics, an embed, a font CDN, a third-party
  script — updates that file in the same commit, or it makes the policy false.
- **Colour comes from the shared dark/light tokens in `src/styles.css`.** No literal hexes in components or theme-sensitive literal colour utilities; every surface supports both palettes.
- **Colour is state, form is kind.** Green is slack and only slack. Never colour something by
  what it *is*.
- **The wordmark never breaks.** One word, capital S, lowercase w, `whitespace-nowrap`.
- **Don't hand-add DNS records** for the apex or `www` — the Worker custom domain manages them.
- **Don't add `devtools()` to `vite.config.ts`.** It breaks `vite dev` in a way that looks like
  something else entirely; see CONTRIBUTING.
- **The app is the source of truth for anything ported from it.** A chart or sky visual from slackwater-ios matches the Swift exactly — palette, geometry, where a fill starts — even where the app is inconsistent with itself. A web view that reads differently from the one on a boater's phone is worse than one that inherits the app's open questions. Read the whole draw function and the `Theme.swift` constants it uses, not just the diff an issue names. A comment here claiming app provenance, like the ones in `src/styles.css` and `src/lib/ramp.ts`, is a claim to check against the Swift, not a citation: one has carried a six-stop palette the app has no stop for. When the two genuinely can't both be right, ask. Divergence is the app's to resolve first, and the web follows.
- **Porting `skyPoint` means porting both of its crops.** The app's sky projection holds together on two crops, not better arithmetic. Each body's rise→set span is fitted to the width, which keeps the wrap seam off-frame. Altitude runs at a fixed `skyAltitudeScale` that tops out near 62° in the app's band, so the zenith is never drawn. Drop the ceiling on a taller band and the zenith lands partway up the frame, and every test here still passes, because nothing in this repo's test environment has layout. Fit the app's 0–62° range to the band height at the call site and keep `skyPoint` verbatim. Port from `Slackwater/Theme.swift`, never from openwaters.io's `website/src/components/sky/projection.ts`: that page is a deliberate 300° conformal horizon band with a different job.
- **pnpm 11 won't install a release younger than about a day.** `pnpm add` of one gets past its own gate by writing a `minimumReleaseAgeExclude` entry into `pnpm-workspace.yaml`. Without that entry a fresh `@openwaters/*` release doesn't install: depending on the range, `pnpm install` either fails or quietly resolves the version before it. Consuming a just-published release by hand means running `pnpm add` locally and committing the pin with the bump. Dependabot can't write that file, which is why `.github/dependabot.yml` gives it a three-day `cooldown`; don't shorten it to get a release sooner.

## Verifying your work

`pnpm test` and `pnpm build` are the floor. Anything touching the Worker's own routes — the
analytics proxy, `/privacy.md` — does not resolve under `pnpm dev` and has to be checked
against a real Worker:

```bash
pnpm build && npx wrangler dev -c .output/server/wrangler.json
```

Don't report a visual change as done without looking at it.

## PRs

Branch, push, open a PR — never push to `main`. **Never merge your own PR.** Show a screenshot
for anything visible.
