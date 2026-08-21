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

## Status

Repo created 2026-08-21. Not scaffolded yet.
