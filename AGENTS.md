# AGENTS.md

Context for AI agents working in this repo. Read [README.md](README.md) for what the site is
and [CONTRIBUTING.md](CONTRIBUTING.md) for commands, layout, deploys, and gotchas — this file
is only the things that are easy to get wrong and expensive to get wrong.

This is a **public repo**. Everything you write here — code, comments, docs, commit messages,
PR bodies — is published. Roadmaps, sequencing, pricing, unreleased plans, and paths into
private repos stay out of it.

## This was a one-page site

One page, one job used to constrain almost every decision: turn a reader into an install, and
nothing got to exist unless it served that. It's now a landing page plus 3,607 prerendered
station pages at `/tides/<slug>` and `/currents/<slug>`. The constraint didn't relax — a second
page finally earned it. The station corpus is both the thing a reader shares a link to instead
of describing what the water's doing, and the indexable content the site had none of before. A
referral route and a web client still haven't earned their place, which is why neither exists.

- **Reach for less, more than ever.** A dependency, an abstraction, or a build step needs to
  earn its place on a site whose pitch is that it loads instantly. 3,607 pages multiply the cost
  of anything that doesn't.
- **Don't build the referral route or the web client** because you noticed they're missing.
  They're missing on purpose — the station corpus earning its place doesn't change the case for
  either of them.
- **The site claims correctness, station by station.** Every station page runs a real
  prediction from `src/lib/predict.ts` against bundled constituents; the hero on `/` is one more
  instance of that, not a separate demo. If you touch `predict.ts` or `src/lib/ramp.ts`, a test
  comes with it.
- **The corpus is 3,607 of 4,690 stations, not all of them.** The missing 1,082 are Canadian
  (CHS): no bundled constituents, predictions DFO's terms don't allow re-serving, and for 1,048
  of them no published identity anywhere to build a page from. Tracked in issue #17 — don't
  write or imply full coverage; `/currents/dodd-narrows` genuinely 404s today.

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
