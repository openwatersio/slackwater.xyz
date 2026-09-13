# Day, night, system, and location modes

Slackwater opens in Night mode. A reader can choose Auto, Light, Night, or Your location from a single celestial control available on every page. The choice applies to every route.

The sun and moon carry the interaction. A switch between day and night sends the current body in a high arc across the viewport while the other enters from the opposite horizon. The page ground changes with the crossing. Auto on a station page makes the sky literal for the place and moment the page describes.

## The control

A circular orbital button sits at the top right of the viewport. Its sun or moon glyph shows the resolved appearance. The button opens a native popover containing four labelled radio choices:

- **Auto (station location)** follows the station's published coordinates and selected time on tide and current station pages; **Auto (system)** follows `prefers-color-scheme` elsewhere.
- **Light** always shows the daylight appearance.
- **Night** always shows the night appearance.
- **Your location** resolves day or night from the sun at the visitor's current position and time on every page.

The words remain in the popover; the orbital button is compact without making the choices cryptic. Its accessible name includes the selected mode and resolved appearance. The popover supports normal keyboard navigation, Escape, outside dismissal, and visible focus without custom menu mechanics.

The `slackwater-theme` preference stores exactly one of `auto`, `light`, `night`, or `location`. No saved value means Night. Light, Night, and Auto are applied before first paint so a returning reader does not see the wrong appearance during hydration.

## Location and time

Auto uses a tide or current station's published latitude and longitude without browser permission. Its sky uses the station page's displayed moment. On other pages, Auto follows the system appearance. Your location requests browser coordinates on every page, including station pages, and uses the live clock rather than the station's selected moment.

Browser coordinates are used in memory, never stored or sent to Slackwater. A successful choice stores only `location` as the preference, so a later visit requests fresh coordinates. If the request is denied or fails while choosing Your location, the page keeps the previous mode and does not save `location`. If a saved `location` preference cannot reacquire coordinates on a later visit, the page resolves to Night and clears that unavailable preference.

A canonical station page uses the live clock. An instant station URL begins with the parsed instant returned by its route loader, then follows the station page's selected moment when the reader scrubs the tide curve and the URL is replaced in place. The sky therefore describes the same station and moment as its curve, readout, and shareable URL.

Almanac's solar altitude decides the appearance: the sun above the horizon is Light; the sun below it is Night. The moon is drawn at night only when Almanac places it above the horizon, and its illuminated fraction and orientation come from Almanac.

Live Auto station pages and Your location pages update the body's position and resolved appearance from a minute clock. Auto on instant station pages remains fixed until the selected URL time changes. The root reads the initial station and optional instant from TanStack's active route matches. `StationPage` then publishes the exact moment it displays through the theme context, including client-side tide scrubbing that updates the URL without rerunning a loader. Auto listens for system colour-scheme changes on non-station pages. Every resolved day/night change uses the same transition as a manual choice.

A saved Your location preference renders the Night ground without a placeholder body while browser coordinates are pending. After hydration, every page requests fresh browser coordinates; browsers with an existing grant can answer without another prompt. Failure clears the unavailable preference and leaves Night.

## Colour

Night keeps Slackwater's navy palette and gives the theme-sensitive utility replacements fixed values: `sw-surface: #ffffff0d`, `sw-rule: #ffffff1a`, and `sw-shadow: #00143299`. Light uses the approved sea-glass direction with these shared-token overrides:

| Token | Light value | Contrast against `sw-page` |
|---|---:|---:|
| `sw-page` | `#eef6f3` | — |
| `sw-paper` | `#082437` | 14.50:1 |
| `sw-foam` | `#153f4f` | 10.30:1 |
| `sw-steel` | `#3f6573` | 5.76:1 |
| `sw-leaf` / `sw-go` | `#4b732f` | 5.04:1 |
| `sw-flood` | `#276f9d` | 4.97:1 |
| `sw-ebb` | `#9b5900` | 5.00:1 |
| `sw-amber` | `#b33c2c` | 5.31:1 |
| `sw-surface` | `#ffffffb3` | decorative |
| `sw-rule` | `#08243724` | decorative |
| `sw-shadow` | `#6f8c952e` | decorative |

State colours keep their meaning. Green remains slack, blue and amber remain the signed current axis, and warning keeps its distinct red-leaning amber. Only luminance changes between appearances.

All theme-sensitive colour comes from the shared tokens in `src/styles.css`. `html[data-appearance="light"]` overrides those tokens and sets `color-scheme: light`; Night sets `color-scheme: dark`. Theme-sensitive `white/*` utilities become named surface, border, or ink tokens. Prediction colours and server-rendered social cards remain deterministic and do not inherit a visitor's browser preference.

The document's `theme-color` meta value follows the resolved page ground so browser chrome agrees with the site.

## Celestial layer and motion

One absolutely positioned, pointer-transparent canvas spans the first viewport at the top of the document and scrolls away with it. The body owns the page ground; the canvas sits above that ground and below a positioned content wrapper, with the fixed orbital control above both. It draws the sun and moon, with Almanac supplying their positions for Auto on station pages and for Your location, but no star catalogue, weather, clouds, or additional scenery. The sky never changes document layout.

One high arc determines every body position: `y = 0.016 × (2x − 1)² + 0.008x` in normalized viewport coordinates. Manual Light and Night, and Auto on non-station pages, park the active sun or full moon at `x = 0.72` on that arc, in the upper right. Location-based modes use the relevant observer and time to project each body's rise-to-set span from the eastern right edge to the western left edge, then place it on the same arc. Almanac's altitude determines visibility and paint, not a separate vertical path. The top edge clips part of the disc, keeping artwork clear of page content without moving the layout. A body below the horizon is outside the frame.

The canvas background interpolates through five solar-altitude anchors: daylight at `10°` (`#2f7fd4` → `#bde3fb`), horizon at `0°` (`#2b4a7a` → `#f8a15f`), civil twilight at `−6°` (`#17264a` → `#8d4a63`), nautical twilight at `−12°` (`#0b1430` → `#2a2a52`), and night at `−18°` (`#04060f` → `#0b1023`). The gradient fades into the page ground rather than replacing it.

The approved transition is **Passing orbits**, about 700 milliseconds:

1. The outgoing body follows the shared arc to the left setting edge.
2. The incoming body follows that arc from the right rising edge at the same time.
3. The page ground crosses through twilight anchor colours while both bodies may briefly share the sky.
4. The animation settles at the target body's representative or Almanac-derived position.

Literal sky state overrides the generic handoff: a moonless night receives no fabricated moon, and daylight draws no moon even when one is also above the horizon. The available body exits or enters while the gradient completes the transition alone. Same-body mode switches and minute-scale position updates move along the shared arc without a separate detour.

A new choice cancels the active transition and starts from the currently rendered state. This avoids queued animations and abrupt jumps during quick clicks. `prefers-reduced-motion: reduce` skips the travel and colour interpolation and applies the final state immediately.

## Implementation shape

A root-level theme component owns the saved mode, resolved appearance, route observer and route time. It reads optional `station` and `instant` values from TanStack's active matches for the initial render, and provides one context setter that `StationPage` uses to keep the subject synchronized with its displayed time. Station routes do not duplicate theme resolution; they only publish their existing station and selected moment. Non-station routes contribute no observer and use browser location only for Your location mode.

Pure functions resolve:

- selected mode plus system preference into an appearance;
- observer plus time into Almanac body state;
- station loader data into an optional observer and fixed instant;
- transition progress into body placement and background paint.

The React component handles browser effects: storage, `matchMedia`, geolocation, the minute clock, meta colour, and the short animation frame loop. One canvas draws the celestial layer behind the document. No theme package, animation dependency, geolocation service, or global state library is added.

## Privacy, accessibility, and failure states

The privacy page names the saved mode and the optional browser geolocation request. It states that coordinates stay in the browser and are neither stored nor sent to Slackwater. Station coordinates are public page content and require no permission.

The sky is `aria-hidden`. The control remains operable and understandable with the drawing absent. Light and Night meet WCAG AA contrast for text, links, focus rings, controls, and state labels. The page remains usable before hydration: Night renders as the baseline, content is present, and the mode control becomes interactive when JavaScript is ready.

Almanac or canvas failure leaves the resolved colour theme intact and omits the decorative body. Geolocation failure follows the mode rules above and announces the failure beside Your location without a blocking dialog.

## Verification

Pure tests cover first-visit Night, saved modes, system changes, Auto station versus Your location precedence, instant-route time, sunrise and sunset boundaries, literal moon visibility, denied geolocation, high-arc travel, and transition endpoints. Component markup tests cover the labelled four-choice control and decorative sky semantics.

The existing suite, typecheck, and production build remain green. Visual checks cover the landing page, a canonical tide station, a canonical current station, an instant station URL, and a page without station coordinates in Light and Night at phone and desktop widths. Reduced motion, keyboard operation, contrast, pre-paint theme selection, and dynamic browser theme colour are checked directly.

## Out of scope

- Stored coordinates or named saved places.
- Weather, clouds, stars, or a general-purpose sky renderer.
- User-authored locations.
- Theme-specific social cards or prerendered variants.
- Changing the app's own appearance settings.
