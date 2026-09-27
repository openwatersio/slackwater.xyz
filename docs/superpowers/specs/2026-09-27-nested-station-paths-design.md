# Nested station paths

Part of openwatersio/slackwater-database#174 ("Have slackwater.xyz read tides, currents, identity, and routes from the unified database") and #105.

## Goal

A station's URL carries the place it sits in, and every segment of that URL is a page: `/tides/us/pa/bridesburg/` sits under `/tides/us/pa/`, which sits under `/tides/us/`, which sits under `/tides/`. The breadcrumb, the URL, the sitemap and the structured data all describe one tree, and it is the tree the database locks.

Success:

- Every station page's canonical URL is the path the database publishes for its route.
- Every URL this site has published for a station — flat, former, or a `/stations/…` browse page — still resolves, by 301 where it moved. Zero lost.
- A shared link from any shipped Slackwater iOS build still opens the station in the app, and no nested link opens the app to nothing.

Out of scope: which stations the site publishes (the `slugs.json` corpus decision), and nested-path parsing in the app.

## Constraints

- **The database owns the path.** `routePath()` in the database (`packages/stations/routes.ts`) mints `/<tides|currents>/<country>/<subdivision>/<slug>/` from ISO 3166 codes, lowercased, with the subdivision only where the ISO 3166-2 code agrees with the country. `metadata/routes.lock.json` locks it, and a path that moves becomes a `formerPaths` entry. The site takes that path as given; it never computes one.
- **Slugs are globally unique per kind.** The path prefix is addressing, not identity: the last segment alone names the station.
- **Shipped app builds parse one slug segment.** `DeepLink.swift` accepts `/<kind>/<slug>` and `/<kind>/<slug>/<instant>` and returns nil for anything longer. The AASA claims `/tides/*` and `/currents/*`, and `*` crosses `/`, so a nested URL claimed by the AASA opens the app and shows nothing. The app mints flat links and will keep doing so.
- **Cloudflare reads at most 2,000 static `_redirects` rules.** Flat to nested is about 11,000 sources with both trailing-slash spellings, so those redirects are served by the Worker, not the file.

## Database: publish the path

`StationRoute` gains `path: string`, the value `routePath()` already writes to the route lock.

- `schemas/database.fbs`: `path` appended to the `StationRoute` table, so older readers skip it.
- `builder.ts` writes it, `routes.ts` reads it, and the TS and Swift bindings are regenerated.
- `buildRoutes` emits it on each route.
- Validation fails on a slug of two characters or fewer, so a slug can never be read as a country segment.

A beta release carries it, and the site pins that release.

## Site URLs

| Page | Path |
|---|---|
| Tide index | `/tides/` |
| Country | `/tides/us/` |
| Subdivision | `/tides/us/pa/` |
| Station | `/tides/us/pa/bridesburg/` or `/tides/jp/kushiro/` |
| Station at an instant | `/tides/us/pa/bridesburg/2026-09-27T10:00-04:00` |

Currents mirror it under `/currents/`.

- The place tree is built from each station's route `path`, not from the station's name fields, so the URL and the browse hierarchy cannot disagree. Every prefix of every station path is a page; there is no minimum station count.
- Place names come from the codes: countries through `Intl.DisplayNames` (`us` → "United States"), subdivisions through the database's region name where every station under the code agrees on one, otherwise the code itself.
- `stationPath()` and `placePath()` remain the only places a URL is built. `stationPath()` returns the route's `path`.
- One splat route per kind (`/tides/$`, `/currents/$`) resolves its segments against a table built from the catalogue. `/tides/us/pa/` and `/tides/jp/kushiro/` have the same shape and only a lookup tells a place from a station. A last segment that parses as an instant is split off first.

## Redirects

- **Flat and former station URLs: 301 from the Worker.** `/tides/<slug>`, `/tides/<slug>/`, and `/tides/<slug>/<instant>` resolve through the current slug or any former slug or former path the database records, plus the one frozen entry in `redirects.ts` (`PUBLISHED`), to the station's current path, keeping the instant. These are no longer written to `_redirects`.
- **Browse pages: static rules in `_redirects`.** Every `/stations/tides/…` and `/stations/currents` page this site published maps to its new place page, in both trailing-slash spellings. About 150 rules.
- **Build guard.** The build fails if any URL in the published set (the current flat paths, every former path, every `/stations/…` page) does not resolve to a live page, or if a redirect source is itself a live page.

## iOS safety

The AASA keeps claiming flat station links and stops claiming everything else under `/tides/` and `/currents/`. Exclusions come before the `/tides/*` and `/currents/*` claims:

```
/tides/          exclude
/tides/??        exclude
/tides/??/*      exclude
```

with the same three for `/currents/`. Two-letter first segments are country codes and slugs are never two letters, so a flat `/tides/<slug>` link is still claimed and opens in the app on every shipped build. A nested link or a browse page opens in Safari.

The exclusions come out once the app parses nested paths (a separate slackwater-ios change) and the builds without it have aged out.

## SEO surfaces

These all read `stationPath()` and `placePath()`:

- canonical links and `og:url`
- sitemaps
- nearby links
- OG image URLs
- `BreadcrumbList` JSON-LD, with country → subdivision → station and every item a live URL

## Testing

- Route resolution: flat, nested, country-only, instant, former slug, former path, and the two-segment place-or-station case.
- Redirect coverage: every URL in the published set resolves. The set is today's flat station paths and `/stations/…` pages, frozen into a fixture from the current sitemaps and `_redirects`, plus every former path the database records.
- AASA: a flat link and a flat instant link are claimed; nested, country, subdivision and index paths are not.
- Prerender: page counts per kind match the catalogue plus the place tree.
- Smoke on `wrangler dev` before the PR: `curl -I` on a flat link, a flat instant link, a former slug, a `/stations/…` page, and a nested page.

## Order

1. Database PR, then a beta release.
2. Site PR on that release. Until the release exists, the branch builds against a local build of the database branch.
3. A slackwater-ios issue for nested-path parsing.
