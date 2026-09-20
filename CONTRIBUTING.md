# Working on slackwater.xyz

How this site gets built and shipped. It is the source of truth for people and coding agents working in this repository. The repo is public because a marketing site has nothing to hide, but outside contributions are not being sought. Bug reports about the live site are welcome.

Everything written here, including code, comments, documentation, commits, and pull requests, is public. Keep roadmaps, pricing, unreleased plans, and paths into private repositories out of it.

Short, because it is meant to be followed rather than consulted. What the site is and why it
looks the way it does is in [README.md](README.md).

## Getting started

The tested toolchain is Node 24 and pnpm 11. `mise install` reads those versions from `mise.toml`.

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
| `src/content/` | Support and privacy Markdown, rendered as pages and served raw from their `.md` URLs. |
| `src/styles.css` | Colour tokens. Components reference these, never a literal hex. |
| `src/data/` | Bundled harmonic constituents for Deception Pass, the fixture `currents.test.ts` checks `predict.ts` against. |
| `wrangler.jsonc` | Worker *source* config. Not the deployable one — see the gotchas. |

## Testing

CI runs these commands in order:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
```

The build comes before typechecking and tests because it generates `src/routeTree.gen.ts` and the prerendered artifacts that four integration suites inspect. Prediction changes arrive with a focused test; errors there can look plausible and matter on the water.

Presentation is checked by looking at it. There is no snapshot suite: 5,657 pages come from
three templates, so a representative tide page, a representative current page, and a
representative CHS identity-only page (`/currents/dodd-narrows`) is the check, and a diff
across thousands of near-identical generated pages would be noise, not signal.

Anything touching a Worker route, including the analytics proxy, `/privacy.md`, or `/support.md`, must be checked against a real Worker because those routes do not resolve under `pnpm dev`:

```bash
pnpm build && pnpm preview
```

Look at any visible change before reporting it complete.

## Project rules

- Keep dependencies, abstractions, and build steps to the minimum. Their cost is multiplied across 5,657 station pages.
- Every rendered curve comes from `src/lib/predict.ts` and bundled constituents. The landing page only shows the app's screenshots. Changes to `predict.ts`, `src/lib/ramp.ts`, or `src/lib/iwls.ts` require a test.
- `catalogue.ts` excludes NOAA subordinate current stations until reference-station reductions are implemented in issue #80. Without that reduction, they render blank bodies.
- The 33 CHS pages ship identity without a prerendered prediction. The visitor's browser fetches 32 station predictions directly from DFO; `chs-malibu-rapids` is derived and has no station to fetch. Never proxy or re-serve IWLS predictions, and never prerender them. `src/lib/iwls.ts` converts DFO metres on chart datum to feet; CHS pages name chart datum without borrowing another datum code. The site covers 10 of 1,058 Canadian tide ports and must not imply complete coverage. Issue #17 tracks the missing identities and `chs-arran-rapids`.
- Never claim a feature the app does not ship. The app has one external TestFlight group; its URL lives in `src/lib/links.ts`, and the six pages under `src/content/compare` repeat it in prose.
- `src/content/privacy.md` names what the site collects. Any analytics, embed, font CDN, third-party script, or change to the IWLS request timing updates that policy in the same commit.
- Components use colour tokens from `src/styles.css`. Green means slack, and colour expresses state rather than kind. Keep the Slackwater wordmark on one line with `whitespace-nowrap`.
- The Worker custom domain owns apex and `www` DNS. Do not add those records by hand.
- Do not add `devtools()` from `@tanstack/devtools-vite`; it breaks `vite dev` with an unavailable SSR environment and a transport timeout.
- `slackwater-ios` is the source of truth for ported visuals. Match the Swift palette, geometry, and crop after reading the complete draw function and its `Theme.swift` constants. Resolve genuine inconsistencies in the app first.
- The app's sky projection depends on both crops: fit each body's rise-to-set span to the width and fit the app's 0–62° altitude range to the band height at the call site. Keep `skyPoint` aligned with `Slackwater/Theme.swift`; the 300° projection in `openwaters.io` has a different purpose.
- pnpm 11 blocks very recent releases. `pnpm add` records required exceptions in `pnpm-workspace.yaml`; commit those with a fresh `@openwaters/*` dependency bump. Dependabot uses a three-day cooldown for the same reason.

## Branch and PR

**No direct pushes to `main`.** Work on a branch, land through a pull request.

```sh
git switch -c <area>/<short-description>
git push -u origin HEAD
gh pr create --fill
```

A repository ruleset on `main` enforces this: direct pushes are rejected, and so are
force-pushes and branch deletion. No approval is required, so you can merge your own PR —
the rule is that the change travels through one, not that someone else signs it off.
Unresolved review comments block the merge.

**Every PR gets a preview.** `.github/workflows/preview.yml` builds the branch and uploads it
as a Worker *version* — no production traffic is routed to it — then comments the URL on the
PR. The alias is `pr-<number>`, so the link is stable across force-pushes and stays correct
as the branch moves. Reviewing on a phone is the point.

Preview traffic is reported to Plausible as `slackwater.xyz`, because `data-domain` is a
constant. A handful of your own pageviews per PR; if that ever matters, derive the domain
from the request host in `__root.tsx`.

A PR that changes anything visible should show it — a screenshot, or before and after side by
side:

```md
| Before | After |
|---|---|
| ![Before](uploaded-image-url) | ![After](uploaded-image-url) |
```

## Deploying

**Merging to `main` publishes the site.** `.github/workflows/deploy.yml` runs the tests, builds,
and publishes with the `CLOUDFLARE_API_TOKEN` repo secret. It is the whole release process —
no version number and no changelog: every merge deploys immediately, so the git log already is
the changelog, and a separate one would just repeat it a commit behind. The only other
environment is the per-PR preview above, which never serves the apex.

That workflow exists because the manual step got skipped. `/privacy` and the Plausible script
were both merged and neither reached the apex, which went on serving an older build; nothing
failed and nothing said so.

`pnpm deploy` still publishes from a laptop, for a rollback or when the token is being
rotated. `workflow_dispatch` on the Deploy workflow does the same thing from Actions.

Publishing needs a Cloudflare API token with **Workers Scripts → Edit** and **Workers KV →
Edit**, or `wrangler login`.

Do **not** hand-add the apex or `www` DNS records. A Worker custom domain declared in
`wrangler.jsonc` creates and manages them itself, as proxied `AAAA -> 100::`.

Before merging a release:

- Review specs and plans touched by the release, including unfinished work carried from earlier releases.
- Preserve lasting guidance here and delete completed implementation specs and plans. Keep unfinished plans and link remaining work to issues.
- Have a human review documentation updates and deletions in the pull request.

After a deploy, check <https://slackwater.xyz>, `/support`, `/support.md`, `/privacy`, and `/privacy.md`.

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
  all three were ruled out one at a time. The site isn't too simple to want router devtools
  anymore — there are parameterised routes and a server boundary now — the plugin is just
  broken until the timeout above is fixed.

- **`ERROR [nitro] Preview server exited with code 143` at the end of a build is normal.**
  Nitro spins up a preview server to prerender against and SIGTERMs it when done. The build
  exits 0 — check that, not the log.

- **`/js/script.js` 404s under `pnpm dev`.** Vite's dev middleware claims `.js` URLs before
  nitro's route rules see them, so the analytics proxy only resolves in a real Worker:
  `pnpm build && npx wrangler dev -c .output/server/wrangler.json`. Nothing is lost in dev —
  the Plausible script ignores localhost regardless.

- **`npx vite preview` serves pages with no CSS or JS.** `vite.config.ts` overrides nitro's
  preview command to mount an empty assets directory: the prerender crawl runs against that
  same server, and `wrangler dev` restarts on every write into the directory it serves assets
  from — which is the directory the crawl is filling. That cost one deploy and one PR run
  (issue #48). Use `pnpm preview`, which runs `wrangler dev` against the generated config and
  serves the real assets.

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

`AGENTS.md` and `CLAUDE.md` point here so every harness follows the same instructions. An agent may open a pull request, push to its branch, and respond to review, but it never merges its own pull request.
