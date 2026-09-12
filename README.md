# slackwater.xyz

The landing page for **Slackwater** — offline tide and current predictions. Tides worldwide,
currents across the US and Canada.

**Live at <https://slackwater.xyz>**

## What this is

The marketing site — and, now, a page per station. It explains the app, points people at the
beta, and prerenders a page at `/tides/<slug>` and `/currents/<slug>` for 5,657 stations — a
real computed curve for 5,624 of them, and identity only for 33 Canadian ones: the
share-landing surface for anyone sent a link, and indexable content the site previously had
none of.

The landing page is the app's own screenshots around one call to action — real output from
`slackwater-ios`'s screenshot walk, not mockups. Every station page computes a real prediction
in your browser from bundled NOAA harmonic constituents, the same way the app does. A site whose
argument is "correct, and it works with no signal" demonstrates that on every station rather than
asserting it.

5,657 pages, not the full catalogue: 5,624 get a computed curve, and 33 Canadian (CHS)
stations — 23 current gates and 10 tide ports — get identity only. DFO's terms don't allow
re-serving predictions, so nothing about those 33 is prerendered; the reader's own browser
fetches DFO's published numbers and draws them. This work builds 10 of the 1,058 Canadian
tide ports, the ten whose identity the registry publishes (Victoria, Vancouver and eight
more); identity for the other 1,048 is published nowhere yet. Plus `chs-arran-rapids`,
excluded pending an owner decision. Tracked in [issue
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
turned out to be that surface: instant, indexable, computing the same curve in the browser that
the app computes on the phone. There is no web client, and no plan to build one.

## How it's built

**TanStack Start** (React + Vite, nitro), prerendered and deployed as a **Cloudflare Worker**
on the apex as a Worker custom domain. A Worker rather than a static host, because the page is
not the only thing this origin serves.

TanStack rather than Astro is deliberate: `openwaters.io` is Astro, but the direction of travel
is TanStack, and `sailingnaturali/web` already runs this stack.

Visits are counted with Plausible, proxied through the Worker so the script and its event endpoint are same-origin. Analytics use no cookies or persistent identifier and store nothing on your device. The [privacy policy](https://slackwater.xyz/privacy) says exactly what is collected.

## Design rules

Every page **matches the app in look and data, not in depth** — the station pages render the
same computed curve the app does, and the landing page shows the app itself, but none of them
are the app.

- **Four appearance modes: Auto, Light, Night, and Location.** Night is the default; Light uses a sea-glass palette. Auto follows the system appearance. Location follows the sun and moon at the station's published coordinates on station pages, using the selected time for a shared or scrubbed tide chart and the live clock otherwise. Other pages ask for browser location when Location is chosen. Colours use the shared dark/light tokens in `src/styles.css`.
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
