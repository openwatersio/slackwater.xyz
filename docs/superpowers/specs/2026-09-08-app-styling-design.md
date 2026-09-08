# The site takes the app's type and chrome

The site's colour tokens match `Palette.swift` hex for hex, but three things the app draws with never crossed over: the graph inks its curves are filled with, the rounded type every reading is set in, and the card treatment its surfaces carry. The landing page reads as an older design because of it.

This work brings those across, and rebuilds the hero's readout as the app's own lead card. It stops short of the two shared curve components: `TideCurve` and `CurrentCurve` feed 3,640 station pages and every OG card, so they change in a follow-up with its own review and its own preview.

`slackwater-ios` is the source of truth throughout. Where a value here disagrees with that repo, that repo wins.

## The graph inks

The app fills a current curve with `SN.graphLine` alone, and says why in `CurveDrawing.zeroFill`:

> The current fill, anchored at zero: clear at slack and intensifying outward, blue in both directions — the set arrows and the schedule pills carry flood against ebb; the fill only says how far from slack the water is.

The speed ramp is not gone from the app, it moved. It now colours the **stroke** (`CurveDrawing.tideRateStops`), where a fast run climbs yellow to red toward its fastest point and back. Filling with the ramp, which is what this site does today, is the older arrangement.

One ink comes across here — `--color-sw-graph-line`, `#38bdf8` (sky-400), which the app uses for every curve fill and for the tide line under the ramp floor. `CurveStyle.fillOpacity` is `0.5`, and comes with it.

The app's other two graph inks, `graphHigh` `#2dd4bf` (teal-400, rising and a high) and `graphLow` `#fbbf24` (amber-400, falling, a low, and the water below chart datum), arrive with the follow-up that consumes them. Shipping them here would put two tokens in the theme that nothing reads, and a token nothing reads has not earned its place.

## The rounded type

Every reading in the app is set in SF Rounded — `ReadoutType.lead` is `.system(size: 44, weight: .medium, design: .rounded)`, and the tile scales below it are `.rounded` too. The site has no rounded token at all.

`--font-rounded: ui-rounded, 'SF Pro Rounded', system-ui, sans-serif` resolves natively on Apple devices and falls back to the system sans everywhere else. No webfont is loaded, so the page still owes nothing to the network — the constraint `styles.css` already protects when it bans Fraunces and Geist.

Rounded is for readings, not for prose. Body text, headings and eyebrows stay on `--font-sans`, which is what the app does.

## The card treatment

`Theme.swift` gives every card the same surface: `SN.cardFill` behind it, a 24pt continuous corner, and a hairline `SN.cardStroke` over the top. `StationCardFace` adds `SN.shadow` at 24% opacity, 12pt radius, 10pt down.

| Token | Value |
|---|---|
| `--color-sw-card-fill` | `#ffffff0d` — white at 5%, `SN.cardFill` |
| `--color-sw-card-stroke` | `#88b8682a` — `--color-sw-leaf` at 16%, `SN.cardStroke` |
| `--color-sw-shadow` | `#001432`, carried at 24% opacity |

CSS has no continuous corner — a squircle is not a border radius — so 24px rounded is the closest honest approximation, and the shadow's SwiftUI radius doubles to a CSS blur.

Three surfaces on the landing page take it, and no others: the validation stat grid (`index.tsx:119`, the `<dl>` of deviations against NOAA), "The deal" section (`index.tsx:226`), and the hero's pill. The footer's top rule is a rule, not a card, and stays one. Prose sections stay prose; the app has no card behind a paragraph either.

The shadow is `SN.shadow` at 24%, 12pt radius, 10pt down. A SwiftUI shadow radius is about half a CSS blur, so that is `0 10px 24px`.

## The hero's readout is the app's lead card

`CurrentLead.swift` composes three lines, and the current hero readout matches none of them:

```
Ebbing  ↘ WNW        state word, then the set: arrow and 16-point name, tinted by phase
  3.1 kn             the value at 44pt rounded with monospaced digits, unit lighter beside it
   7:42am            the scrub time, caption size, monospaced digits
```

- **The set is the hero.** `CurrentLead.swift:97` says so by name, citing issue #59. The readout today drops it entirely, which the previous design said it would carry and did not. The arrow points at the set in degrees and the name is `compass16`: `points16[round(deg / 22.5) % 16]`.
- **The phase tint** is `SN.flood`, `SN.ebb` or `SN.go`, which the site already has as `--color-sw-flood`, `--color-sw-ebb` and `--color-sw-go`. Green stays slack and only slack.
- **At slack the glyph goes both ways** — the water does — rather than pointing at a set that means nothing.
- **The value** is `formatSpeed`, one decimal place, and its unit sits beside it at a lighter weight.
- **The time moves into the readout**, where the app puts it. The bottom caption keeps the station's name and "computed in this browser" and loses its clock.

The readout stays gated on `live`. A server render freezes at `SERVER_NOW`, so every line above is a claim about the present and none of it may reach prerendered HTML.

### The clock format diverges from the rest of the site

`chartTime` is `"h:mma"` lowercased through an `en_US_POSIX` formatter, so the app always reads `7:42am`. The site's `hhmm` is `en-CA` with `hour12: false`, so it always reads `07:42`, and the station pages use it throughout.

The readout takes the app's format, because the readout is the app's component and matching it is the point of this work. That leaves two time formats in the codebase, which is a real cost and is why it is written down here. Reverting is one function call.

## The strip's fill

`CurrentScrubStrip` adopts `zeroFill`: `graphLine` at `fillOpacity` at both extremes of the plot, clear at zero, and **symmetric about zero even when the plot is not**. The gradient spans the larger half either side — `max(zeroY - plotTop, plotBottom - zeroY)` — so a 3 kn flood against a 1 kn ebb intensifies at the same rate per pixel on both sides. Without that the weaker direction would look further from slack than it is.

The two-gradient, clip-per-lobe arrangement the strip carries today goes away with the speed ramp it was built for.

## Out of scope

- `TideCurve` and `CurrentCurve`, and therefore all 3,640 station pages and every OG card. They are the follow-up, and they need literal paint rather than tokens: `og-image.ts` rasterises them through resvg, which cannot resolve a CSS variable.
- Moving the speed ramp onto the stroke. It belongs with the curve components above.
- The tide fill's datum crossing, for the same reason.
- Anything below the card treatment on the landing page: copy, layout, the screenshots, the footer.
- The app's `graphHigh` and `graphLow` inks, which arrive with the curve components that use them.
- The lead's "Max flood" and "Max ebb" wording. The app names a max where the site says only Flooding or Ebbing; naming it needs the extremes from `findEvents`, which the readout no longer computes.

One behavioural divergence worth recording, because it follows from an earlier decision rather than this one. The site's `slack` is membership in a `slackWindows` window, chosen so green means water that actually reverses. The app also treats anything inside its slack threshold as slack. So in a lull that dips under the threshold and builds back the way it came, the site draws the set arrow and the app draws its both-ways glyph. The site's reading is the more informative one there — the water is not reversing, and a set is real information — but it is a difference, and it is not the app's.

Until the follow-up lands, the landing page's curve and a station page's curve disagree about how a current is drawn. That is the deliberate cost of splitting the work, and it is visible on the site.
