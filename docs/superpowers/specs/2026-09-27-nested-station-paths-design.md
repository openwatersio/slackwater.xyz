# Nested station paths

Part of openwatersio/slackwater-database#174 ("Have slackwater.xyz read tides, currents, identity, and routes from the unified database") and #105.

## Goal

A station's URL carries the place it sits in, and every segment of that URL is a page: `/tides/us/pa/bridesburg/` sits under `/tides/us/pa/`, which sits under `/tides/us/`, which sits under `/tides/`. The breadcrumb, the URL, the sitemap and the structured data all describe one tree, and it is the tree the database locks.

Success:

- Every station page's canonical URL is the path the database publishes for its route.
- Every prefix of every station path is a page.
- A share link from Slackwater iOS, which mints `/<kind>/<slug>[/<instant>]`, still opens the station, in the app or on the web.

Out of scope: redirects for URLs the site published before this (the site has no users to break), which stations the site publishes (the `slugs.json` corpus decision), and nested-path parsing in the app.

## Constraints

- **The database owns the path.** `routePath()` (`packages/database/src/route-path.ts`) mints `/<tides|currents>/<country>/<subdivision>/<slug>/` from ISO 3166 codes, lowercased, with the subdivision only where the ISO 3166-2 code agrees with the country. `metadata/routes.lock.json` locks it. The site reads it as `StationRoute.path` and never computes one.
- **Slugs are globally unique per kind, and never two characters.** The path prefix is addressing, not identity: the last segment alone names the station, and a two-letter first segment is always a country.
- **Shipped app builds parse one slug segment.** `DeepLink.swift` accepts `/<kind>/<slug>` and `/<kind>/<slug>/<instant>` and returns nil for anything longer, so a nested URL the AASA claims would open the app to nothing.

## Database

`StationRoute` carries `path`, computed at read time from the route's first station's `country_code` and `region_code` with the same `routePath()` the route builder uses (openwatersio/slackwater-database#208). No schema change, so the Worker bundle does not grow. A test asserts every route's `path` equals the one in `routes.lock.json`, and the route builder rejects a slug of two characters or fewer.

## Site URLs

| Page | Path |
|---|---|
| Tide index | `/tides/` |
| Country | `/tides/us/` |
| Subdivision | `/tides/us/pa/` |
| Station | `/tides/us/pa/bridesburg/` or `/tides/jp/kushiro/` |
| Station at an instant | `/tides/us/pa/bridesburg/2026-09-27T10:00-04:00` |

Currents mirror it under `/currents/`. `/stations/` stays as the hub linking both indexes.

- `placeTree` builds the place pages from each station's `path`, so the URL and the browse hierarchy cannot disagree. There is no minimum station count for a page.
- Countries are named from their code with `Intl.DisplayNames` (`us` → "United States"); a subdivision is its code, titled with its country ("PA, United States").
- One splat route per kind (`tides.$.tsx`, `currents.$.tsx`, both through `routes/-directory.tsx`) resolves a path with the catalogue's `resolvePath`. `/tides/us/pa/` and `/tides/jp/kushiro/` have the same shape and only a lookup tells a place from a station. A last segment that parses as an instant is split off first; one that does not stays in the path and 404s.
- A single-segment path that is a station's slug 301s to that station's path, keeping any instant. That is the app's share link.

## iOS

The AASA excludes `/tides/`, `/tides/??`, and `/tides/??/*` (and the same for currents) ahead of its `/tides/*` and `/currents/*` claims. The app's own flat links stay claimed; browse pages and nested station pages open in Safari. The exclusions come out once the app parses nested paths and the builds without it have aged out.

## SEO surfaces

Canonical links, `og:url`, sitemaps, nearby links, and `BreadcrumbList` JSON-LD all read the station's `path`. The breadcrumb runs Slackwater → kind index → country → subdivision → station, every item a live page. OG image URLs stay at `/og/<kind>/<slug>.png`.

## Order

1. openwatersio/slackwater-database#208, then a beta release.
2. The site PR, which pins #208's preview build until that release exists and then pins the release.
3. A slackwater-ios issue for nested-path parsing.
