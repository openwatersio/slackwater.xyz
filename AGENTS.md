# AGENTS.md

Context for AI agents working in this repo. Read [README.md](README.md) for what the site is
and [CONTRIBUTING.md](CONTRIBUTING.md) for commands, layout, deploys, and gotchas — this file
is only the things that are easy to get wrong and expensive to get wrong.

This is a **public repo**. Everything you write here — code, comments, docs, commit messages,
PR bodies — is published. Roadmaps, sequencing, pricing, unreleased plans, and paths into
private repos stay out of it.

## This is a landing page

One page, one job: turn a reader into an install. That constrains almost every decision.

- **Reach for less.** A dependency, an abstraction, or a build step needs to earn its place on
  a page whose pitch is that it loads instantly.
- **Don't build the referral route, the web client, or a second page** because you noticed
  they're missing. They're missing on purpose.
- **The site claims correctness.** The hero runs real predictions from `src/lib/currents.ts`.
  If you touch that or `src/lib/ramp.ts`, a test comes with it.

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
