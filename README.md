# slackwater.xyz

The landing page for **Slackwater** — offline tide and current predictions for the Salish Sea
and beyond. Not the app, and not the web client: this page exists to **drive installs**.

## What this is for

Conversion. It sells the app's features and explains its positioning, and its primary call to
action is the App Store link. Written for one app today, structured for several later.

Full brief: `slackwater/docs/superpowers/specs/2026-07-12-tide-app-design.md` §5d (private).
Pitch order, above the fold: **offline-first** · **accurate where others aren't** (CHS and
currents) · **free for public-domain data**. Plus the live accuracy receipt from the nightly
verification job, and the Deal — free-forever, no ads, no tracking — verbatim.

## The three surfaces, and why they're different things

| | Where | What it is |
|---|---|---|
| **Landing page** | `slackwater.xyz` (this repo) | Sells the app. Drives installs. |
| **iOS app** | App Store — `openwatersio/slackwater-ios` | The product. The only surface that can be paid. |
| **Web client** | `web.slackwater.xyz` | A demo. Show-don't-tell for people who won't install an app or just want an answer now. |

The web client is a demo **structurally**, not as a matter of restraint: charging on the web
requires accounts, and Slackwater is account-free from the entitlement down — the entitlement
is a device flag, the referral gate is a Keychain item, no server holds a user. It matches iOS
in look and data, not in depth.

## Design decisions

Settled 2026-08-21. The page **matches the app in look and data, not in depth** — the same
rule the web client runs under, and the reason both exist.

- **Dark only**, because the app is (`.preferredColorScheme(.dark)`). A light theme is wanted
  eventually, so keep colour use going through the tokens in `src/styles.css` rather than
  literal hexes in components.
- **System font.** Fraunces and Geist were retired from the app and are banned there by test.
  A page selling "no spinner, nothing to load" should not block on a webfont.
- **Colour is state, form is kind.** Green is slack and only slack; direction is one signed
  blue/amber axis; steel means unknown. Never colour anything by what it *is*.
- **The speed ramp is the hero visual.** It ships today, and it is anchored to capability
  rather than quantiles — 0.5 kn slack, 3 kn a paddler can't make way, 6 kn a small
  displacement craft can't stem it, 16 kn Sechelt Rapids. That the colour means something
  specific about whether you can go is a claim almost nobody else can make.
- **The particle field is coming but is not shipped** (`MapHeader.swift`: "no particle
  field"). It must not appear here until it exists in the app.
- **The hero is live**, computed in the browser — show, don't tell. One station.
- **Primary CTA is TestFlight for now**, until there is a public App Store listing.
- **Pitch order**, from `slackwater/docs/gtm.md`: correctness · offline · from sailors.
- **The open-source pillar is held.** `gtm.md` flags the line as unconfirmed and
  `slackwater-ios` is private; claiming GPL on the page before the repo is public is a
  credibility risk, not a marketing win. Revisit when it opens.
- **The wordmark never breaks.** One word, capital S, lowercase w, `whitespace-nowrap`.

## Stack

**TanStack Start** (React + Vite, nitro), deployed as a **Cloudflare Worker** via nitro's
Cloudflare preset, on the `slackwater.xyz` apex as a Worker custom domain.

- TanStack over Astro deliberately. `openwaters.io` is Astro; the direction of travel here is
  TanStack, and `sailingnaturali/web` already runs this stack.
- A Worker rather than a static host, because the page is not the only thing served from it.

## `/r/<CODE>` — referral counting

The referral program hands out share links of the form `https://slackwater.xyz/r/<CODE>`. This
Worker counts the open, then redirects to the App Store. Counts live in a KV namespace bound
to this same Worker.

Link opens are **display only** — they are one `curl` away from being farmed, so they never
unlock a reward. The authoritative count is redemptions reported by the iOS app. Design:
`slackwater-ios/docs/superpowers/specs/2026-08-21-referral-program-design.md` §7 (private).

## Deploying

Publishing needs a Cloudflare token with **Workers Scripts → Edit** and **Workers KV → Edit**.
The workspace's `CLOUDFLARE_API_TOKEN` is Zone Read + DNS Edit only — widen it on the account
API-tokens page or use `wrangler login`. See `infrastructure/dns.md` § slackwater.xyz.

Do **not** hand-add the apex or `www` DNS records: a Worker custom domain declared in
`wrangler.jsonc` creates and manages them.

## Local development

```bash
pnpm install
pnpm dev        # http://localhost:5174
pnpm build      # prerender + Worker bundle in .output/
pnpm deploy     # build, then wrangler deploy with nitro's generated config
```

Two things that will otherwise cost you an hour:

- **Don't add `devtools()` from `@tanstack/devtools-vite` back to `vite.config.ts`.** It
  breaks `vite dev` with `Vite environment "ssr" is unavailable` and a 60s
  `getBuiltins` transport timeout — every request 500s, while `pnpm build` stays perfectly
  green, because the plugin only runs in dev. It is not the nitro beta, the Vite version, or
  the presence of wrangler; all three were ruled out one at a time. A landing page has no use
  for router devtools.

- **`ERROR [nitro] Preview server exited with code 143` at the end of a build is normal.**
  Nitro spins up a preview server to prerender against and SIGTERMs it when done. The build
  exits 0; check that, not the log.
- **`wrangler.jsonc` at the root is the *source*, not the deployable config.** Nitro reads it
  and emits `.output/server/wrangler.json` with `main` and `assets` rewritten to the right
  relative paths. Deploy with that file — `pnpm deploy` already does.

`unstorage@2` alpha (via nitro) imports `destr` without declaring it, which breaks the vite
config under pnpm's strict `node_modules`. Declared on its behalf via `packageExtensions` in
`pnpm-workspace.yaml` rather than hoisting everything.

## Status

Scaffolded 2026-08-21: TanStack Start builds, prerenders, and produces a Worker bundle. The
home page is a placeholder, not a first draft — design pending.

The hero's predictions run for real: `src/lib/currents.ts` computes signed velocity for
Deception Pass (Narrows) from bundled NOAA constituents, with `pnpm test` covering it.

**Live at <https://slackwater.xyz>** (and `www`, and
<https://slackwater-xyz.clarkbw.workers.dev>). Attached 2026-08-21; Cloudflare created both
DNS records itself as proxied `AAAA -> 100::`, which is what a Worker custom domain does —
nothing was hand-added, and nothing should be.

GOTCHA, cost ten minutes: a fresh custom domain can look dead from *this* machine while being
perfectly live. Tailscale MagicDNS (`100.100.100.100`) caches the NXDOMAIN from before the
registry published, so `curl` reports "Could not resolve host" long after the site is up.
Check with `curl --resolve slackwater.xyz:443:<edge-ip>` or `dig @1.1.1.1` before believing a
deploy failed; fix with `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder`.

**`/r/<CODE>` is not built yet, on purpose.** The referral program is gated behind the premium
tier shipping and the seller-entity agreement, and the route needs a KV binding that doesn't
exist. Building it now would be a guess with no way to test it.
