# slackwater.xyz

The landing page for **Slackwater** — offline tide and current predictions. Tides worldwide,
currents across the US and Canada.

**Live at <https://slackwater.xyz>**

## What this is

The marketing site — and, now, a page per station. It explains the app, points people at the
App Store, and prerenders a page under its country and subdivision (`/tides/us/pa/bridesburg/`, `/currents/ca/bc/dodd-narrows/`) for 8,450 stations — a
real computed curve for 8,427 of them, and identity only for 23 Canadian current gates: the
share-landing surface for anyone sent a link, and indexable content the site previously had
none of.

The landing page is the app's own screenshots around one call to action — real output from
`slackwater-ios`'s screenshot walk, not mockups. Every station page computes a real prediction
in your browser from bundled harmonic constituents or NOAA's subordinate current tables, the same way the app does. A site whose
argument is "correct, and it works with no signal" demonstrates that on every station rather than
asserting it.

The corpus is every station the station database routes, less two groups it withholds: 674
rows whose GESLA provider forbids commercial use and the 1,796 the database's own quality pass
rejects. A rejected station's address still answers — a 301 to the nearest place page above it,
because some of them were pages here before the site read the whole corpus.

8,450 pages: 8,427 get a computed curve, and the 23 Canadian (CHS) current gates get
identity only. DFO's terms don't allow re-serving predictions, so no CHS prediction is
prerendered anywhere; the reader's own browser fetches DFO's published numbers and draws
them. Where the database merges a CHS record with a provider row that has harmonic
constituents, as it does for all 10 Canadian tide ports the site builds (Victoria, Vancouver
and eight more), the page ships that row's computed curve under the CHS record's name and
position, and the browser then swaps today's chart for CHS's published day as the refined
data. The ports are named in `CHS_TIDE_PORTS` in `src/lib/registry.ts`. The database publishes identity for the other 1,047 too; whether the
site publishes them is [issue #207](https://github.com/openwatersio/slackwater.xyz/issues/207),
and until then they 404. Plus `chs-arran-rapids`, excluded by owner decision to match the app, which refuses to name it ([#45](https://github.com/openwatersio/slackwater.xyz/issues/45)).

## The two surfaces

Slackwater is two separate things, and confusing them is the easiest mistake to make here.

| | Where | What it is |
|---|---|---|
| **This site** | `slackwater.xyz` — this repo | Explains the app, drives installs, and serves a real prediction for every station it has data for. |
| **iOS app** | [`openwatersio/slackwater-ios`](https://github.com/openwatersio/slackwater-ios) | The product. The only surface that can be paid. |

## How it's built

**TanStack Start** (React + Vite, nitro), prerendered and deployed as a **Cloudflare Worker**
on the apex as a Worker custom domain. A Worker rather than a static host, because the page is
not the only thing this origin serves.

TanStack rather than Astro is deliberate: `openwaters.io` is Astro, but the direction of travel
is TanStack, and `sailingnaturali/web` already runs this stack.

Visits are counted with Plausible, proxied through the Worker so the script and its event
endpoint are same-origin. No cookies, no persistent identifier, nothing stored on your device
— the [privacy policy](https://slackwater.xyz/privacy) says exactly what is collected.

## Design rules

Every page **matches the app in look and data, not in depth** — the station pages render the
same computed curve the app does, and the landing page shows the app itself, but none of them
are the app.

- **Dark only**, because the app is. A light theme is wanted eventually, so colour goes through
  the tokens in `src/styles.css` and never a literal hex in a component.
- **System font.** A page selling "no spinner, nothing to load" should not block on a webfont.
- **Colour is state, form is kind.** Green is slack and only slack; direction is a single
  signed blue/amber axis; steel means unknown. Nothing is ever coloured by what it *is*.
- **The speed ramp is anchored to capability, not quantiles** — 0.5 kn slack, 3 kn a paddler
  can't make way against, 6 kn a small displacement craft can't stem, 16 kn Sechelt Rapids.
  That the colour says something specific about whether you can go is the whole point of it.
- **The wordmark never breaks.** One word, capital S, lowercase w, `whitespace-nowrap`.

## Development

```bash
npm install
npm run dev    # http://localhost:5174
```

Layout, testing, deploys, and the handful of gotchas that will otherwise cost you an hour are
in [CONTRIBUTING.md](CONTRIBUTING.md). If you are an AI agent working in this repo, read
[AGENTS.md](AGENTS.md) first.

Every merge to `main` runs the checks and deploys the site. The same workflow rebuilds nightly so dates in prerendered pages stay current.

This repo is public because a marketing site has nothing to hide, not because it is looking for
contributors. Read it, borrow from it; there is no licence, so all rights are reserved.
