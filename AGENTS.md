# AGENTS.md

Context for AI agents working in this repo. Read [README.md](README.md) for what the site is
and [CONTRIBUTING.md](CONTRIBUTING.md) for commands, layout, deploys, and gotchas — this file
is only the things that are easy to get wrong and expensive to get wrong.

This is a **public repo**. Everything you write here — code, comments, docs, commit messages,
PR bodies — is published. Roadmaps, sequencing, pricing, unreleased plans, and paths into
private repos stay out of it.

## This was a one-page site

One page, one job used to constrain almost every decision: turn a reader into an install, and
nothing got to exist unless it served that. It's now a landing page plus 3,630 prerendered
station pages at `/tides/<slug>` and `/currents/<slug>`. The constraint didn't relax — a second
page finally earned it. The station corpus is both the thing a reader shares a link to instead
of describing what the water's doing, and the indexable content the site had none of before. A
referral route and a web client still haven't earned their place, which is why neither exists.

- **Reach for less, more than ever.** A dependency, an abstraction, or a build step needs to
  earn its place on a site whose pitch is that it loads instantly. 3,630 pages multiply the cost
  of anything that doesn't.
- **Don't build the referral route or the web client** because you noticed they're missing.
  They're missing on purpose — the station corpus earning its place doesn't change the case for
  either of them.
- **The site claims correctness, station by station.** Every page that draws a curve runs a
  real prediction from `src/lib/predict.ts` against bundled constituents; the hero on `/` is one
  more instance of that, not a separate demo. The Canadian gates ship no curve and prerender
  none — the reader's own browser fetches DFO's published predictions, and nothing about them is
  ever re-served by us. See below. If you touch `predict.ts`,
  `src/lib/ramp.ts` or `src/lib/iwls.ts`, a test comes with it.
- **The corpus is 3,630 pages of 4,686 distinct waters, not all of them.** 23 Canadian (CHS)
  current gates build from published registry identity, with no prediction in the page — DFO's
  terms don't allow re-serving predictions for them. On 22 of them the visitor's own browser fetches
  DFO's numbers from `api-iwls.dfo-mpo.gc.ca` when the page loads, with a Cancel button while
  it is in flight; the 23rd, `chs-malibu-rapids`, is derived from a reference port and has no
  station to fetch. **Never proxy IWLS through the Worker**, for CORS or anything else — the
  moment we fetch, we are re-serving. **Never prerender the curve** — the served page carries
  no CHS prediction, which is what makes fetching on load a privacy question and not a
  licensing one. `src/content/privacy.md` describes the on-load request; it moves with any
  change to when or whether that request happens. This work does not build the Canadian tide ports:
  the registry already publishes curated identity for 10 of them (Victoria, Vancouver and
  eight more), unbuilt only because `loadCatalogue` has no tide analogue of `chsGates()` — for
  the rest, no identity is published at all. Plus `chs-arran-rapids`, excluded by name pending
  an owner decision. Tracked in issue #17 — don't write or imply full coverage;
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
- **Colour comes from the tokens in `src/styles.css`.** No literal hexes in components; a
  light theme is wanted eventually and hexes are how that gets expensive.
- **Colour is state, form is kind.** Green is slack and only slack. Never colour something by
  what it *is*.
- **The wordmark never breaks.** One word, capital S, lowercase w, `whitespace-nowrap`.
- **Don't hand-add DNS records** for the apex or `www` — the Worker custom domain manages them.
- **Don't add `devtools()` to `vite.config.ts`.** It breaks `vite dev` in a way that looks like
  something else entirely; see CONTRIBUTING.

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
