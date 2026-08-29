# Working on slackwater.xyz

How this site gets built and shipped. It is the working doc for whoever maintains it, not an
invitation — the repo is public because a one-page marketing site has nothing to hide, and
outside contributions aren't being sought. Bug reports about the live site are welcome.

Short, because it is meant to be followed rather than consulted. What the site is and why it
looks the way it does is in [README.md](README.md).

## Getting started

Node 22+ and pnpm 10+.

```bash
pnpm install
pnpm dev        # http://localhost:5174
pnpm test       # vitest, the prediction maths
pnpm build      # prerender + Worker bundle in .output/
pnpm deploy     # build, then wrangler deploy with nitro's generated config
```

## Layout

| Path | What lives there |
|---|---|
| `src/routes/` | File-based routes. `__root.tsx` is the document shell and `<head>`. |
| `src/lib/` | Prediction maths — `currents.ts` (harmonic synthesis) and `ramp.ts` (speed → colour). Both tested. |
| `src/components/` | Presentational React. No data fetching. |
| `src/content/privacy.md` | The privacy policy, rendered at `/privacy` and served raw at `/privacy.md`. |
| `src/styles.css` | Colour tokens. Components reference these, never a literal hex. |
| `src/data/` | Bundled harmonic constituents for the hero station. |
| `wrangler.jsonc` | Worker *source* config. Not the deployable one — see the gotchas. |

## Testing

`pnpm test` covers `src/lib` — the harmonic synthesis and the speed ramp. That is the part
where being wrong is invisible in a screenshot and embarrassing on the water, so a change to
either arrives with a test.

Presentation is checked by looking at it. There is no snapshot suite and a landing page does
not want one.

## Branch and PR

**No direct pushes to `main`.** Work on a branch, land through a pull request.

```sh
git switch -c <area>/<short-description>
git push -u origin HEAD
gh pr create --fill
```

Nothing on GitHub's side enforces this, so it holds by agreement.

A PR that changes anything visible should show it — a screenshot, or before and after side by
side:

```md
| Before | After |
|---|---|
| ![Before](uploaded-image-url) | ![After](uploaded-image-url) |
```

## Deploying

`pnpm deploy` builds and publishes. It is the whole release process — there is no staging
environment, no version number, and no changelog: the site is one page and the deploy is the
release.

Publishing needs a Cloudflare API token with **Workers Scripts → Edit** and **Workers KV →
Edit**, or `wrangler login`.

Do **not** hand-add the apex or `www` DNS records. A Worker custom domain declared in
`wrangler.jsonc` creates and manages them itself, as proxied `AAAA -> 100::`.

After a deploy, check <https://slackwater.xyz> and `/privacy`.

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
  timeout — every request 500s, while `pnpm build` stays perfectly green, because the plugin
  only runs in dev. It is not the nitro beta, the Vite version, or the presence of wrangler;
  all three were ruled out one at a time. A landing page has no use for router devtools.

- **`ERROR [nitro] Preview server exited with code 143` at the end of a build is normal.**
  Nitro spins up a preview server to prerender against and SIGTERMs it when done. The build
  exits 0 — check that, not the log.

- **`/js/script.js` 404s under `pnpm dev`.** Vite's dev middleware claims `.js` URLs before
  nitro's route rules see them, so the analytics proxy only resolves in a real Worker:
  `pnpm build && npx wrangler dev -c .output/server/wrangler.json`. Nothing is lost in dev —
  the Plausible script ignores localhost regardless.

- **`wrangler.jsonc` at the root is the *source*, not the deployable config.** Nitro reads it
  and emits `.output/server/wrangler.json` with `main` and `assets` rewritten to the right
  relative paths. Deploy with that one; `pnpm deploy` already does.

- **A fresh custom domain can look dead from your machine while being perfectly live.** A
  resolver that cached the NXDOMAIN from before the record published will keep serving it —
  on a Tailscale tailnet, MagicDNS at `100.100.100.100` does exactly this, so `curl` reports
  "Could not resolve host" long after the site is up. Check with `dig @1.1.1.1` or
  `curl --resolve slackwater.xyz:443:<edge-ip>` before believing a deploy failed. On macOS,
  `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder`.

- **`unstorage@2` alpha (via nitro) imports `destr` without declaring it**, which breaks the
  vite config under pnpm's strict `node_modules`. It is declared on unstorage's behalf via
  `packageExtensions` in `pnpm-workspace.yaml` rather than hoisting everything.

## Agents

Claude Code and other agents work here under the same rules, plus the ones in
[AGENTS.md](AGENTS.md). **An agent never merges its own PR** — it may open one, push to its
branch, and respond to review; the merge is a human decision.
