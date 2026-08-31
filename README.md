# slackwater.xyz

The landing page for **Slackwater** — offline tide and current predictions. Tides worldwide,
currents across the US and Canada.

**Live at <https://slackwater.xyz>**

## What this is

The marketing site — and, now, a page per station. It explains the app, points people at the
beta, and prerenders a real computed curve at `/tides/<slug>` and `/currents/<slug>` for 3,607
stations: the share-landing surface for anyone sent a link, and indexable content the site
previously had none of.

The hero is not a screenshot. It computes a real current prediction for Deception Pass
(Narrows) in your browser from bundled NOAA harmonic constituents, the same way every station
page computes its own. A page whose argument is "correct, and it works with no signal" ought to
demonstrate that rather than assert it.

3,607, not the full catalogue. The missing 1,082 are Canadian (CHS) stations: no bundled
constituents, predictions DFO's terms don't allow re-serving, and 1,048 of them have no
published identity anywhere to build a page from. Tracked in [issue
#17](https://github.com/openwatersio/slackwater.xyz/issues/17); those stations 404 rather than
claim a curve nobody can compute.

## The two surfaces

Slackwater is two separate things, and confusing them is the easiest mistake to make here.

| | Where | What it is |
|---|---|---|
| **This site** | `slackwater.xyz` — this repo | Explains the app, drives installs, and serves a real prediction for every station it has data for. |
| **iOS app** | [`openwatersio/slackwater-ios`](https://github.com/openwatersio/slackwater-ios) | The product. The only surface that can be paid. |

A third surface, `web.slackwater.xyz`, was reserved early as a demo for people who wouldn't
install an app but just wanted an answer now — it never got a DNS record. The station pages
turned out to be that surface: instant, indexable, computing the same curve in the browser the
hero always did. There is no web client, and no plan to build one.

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

Every page **matches the app in look and data, not in depth** — the hero and the station pages
render the same computed curve the app does, but none of them are the app.

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
pnpm install
pnpm dev        # http://localhost:5174
```

Layout, testing, deploys, and the handful of gotchas that will otherwise cost you an hour are
in [CONTRIBUTING.md](CONTRIBUTING.md). If you are an AI agent working in this repo, read
[AGENTS.md](AGENTS.md) first.

This repo is public because a marketing site has nothing to hide, not because it is looking for
contributors. Read it, borrow from it; there is no licence, so all rights are reserved.
