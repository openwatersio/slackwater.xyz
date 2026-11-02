# How we check predictions

Slackwater's prediction engine is tested against publishing agencies' own predictions. The examples below are historical checks at two NOAA stations. They compare astronomical predictions with other predictions, not with measured water conditions or a navigation standard.

Weather, river flow and local conditions can change the water. These samples cover specific stations and dates; their results are not a guarantee for every station or date. **Not for navigation.**

## Friday Harbor tides

The tide validation report, dated July 12, 2026, compares 12 high and low tides for July 15–17, 2026 at Friday Harbor, Washington (NOAA station 9449880).

| Measure | Largest absolute difference from NOAA |
| --- | --- |
| High or low tide time | 7.9 minutes |
| Tide height | 3.5 cm |

The fixture uses NOAA's high/low predictions in metric units, relative to MLLW, with times in GMT. The test computes the engine's highs and lows over the fixture window, matches each NOAA event to the nearest computed event of the same kind, and measures timing and height differences.

Inspect the [validation report](https://github.com/openwatersio/slackwater/blob/6021524a3f2c5f609cd41af645ebea4a0e135bf8/swift/docs/validation/phase0-report.md), [test method](https://github.com/openwatersio/slackwater/blob/6021524a3f2c5f609cd41af645ebea4a0e135bf8/swift/Tests/SlackwaterKitTests/RealWorldTests.swift), and [saved NOAA fixture](https://github.com/openwatersio/slackwater/blob/6021524a3f2c5f609cd41af645ebea4a0e135bf8/fixtures/realworld-friday-harbor.json).

## Bellingham Channel currents

The current validation report, dated July 18, 2026, compares 11 maximum flood and ebb events for June 1–3, 2026 at Bellingham Channel, Washington (NOAA station PUG1741).

| Measure | Largest absolute difference from NOAA |
| --- | --- |
| Maximum flood or ebb time | 9.7 minutes |
| Maximum flood or ebb speed | 0.055 knots |

The test predicts the current using NOAA harmonic constituents and matches each maximum to the nearest computed event of the same kind. The six slack events in the fixture are excluded from this check. **These numbers do not measure slack-water timing accuracy.**

Inspect the [validation report](https://github.com/openwatersio/slackwater/blob/6021524a3f2c5f609cd41af645ebea4a0e135bf8/swift/docs/validation/currents-report.md), [test method and slack exclusion](https://github.com/openwatersio/slackwater/blob/6021524a3f2c5f609cd41af645ebea4a0e135bf8/swift/Tests/SlackwaterKitTests/CurrentsRealWorldTests.swift), and [saved NOAA fixture](https://github.com/openwatersio/slackwater/blob/6021524a3f2c5f609cd41af645ebea4a0e135bf8/fixtures/currents-golden-harmonic.json).

The report's broader strict tolerance applies to currents of at least 0.75 knots. At weaker, nearly flat extrema, timing can differ by tens of minutes and flood/ebb classification can become ambiguous. Those weak-current results are reported separately rather than required to pass the strict tolerance.

## Canadian stations use a different method

Most supported Canadian stations build an on-device model from Canadian Hydrographic Service predictions after a download. Some passes require an online prediction request. Fitting a model to agency predictions is different from using published NOAA harmonic constituents.

The [Canadian fitting project's validation report](https://github.com/openwatersio/chs-constituents/blob/main/docs/validation/ts-port.md) describes a historical out-of-sample comparison and reports median extremum errors, with slack timing measured separately. Its sample windows and metrics differ from the NOAA examples above. Those historical results do not establish an error bound for today's app or every Canadian pass.

The fitting project's [source-limit explanation](https://github.com/openwatersio/chs-constituents#accuracy) notes that CHS's continuous current series is sampled every 15 minutes. At complex narrows, extrema from that series can differ from CHS's precise event series by 15–30 minutes. Fitting the continuous series inherits that source limit; a close fit does not remove it.

## Free harmonic constants at a fast BC rapid

Published harmonic constants work well at most stations. A narrow, fast rapid is harder. On October 17, 2026 we compared two sets of October 2026 predictions for [Sechelt Rapids](/currents/ca/bc/sechelt-rapids/) (Skookumchuck Narrows), which runs to 16½ knots on large tides: the monthly current table on [Dairiki.org](https://www.dairiki.org/tides/monthly.php/scl), which is produced by [XTide](https://flaterco.com/xtide/) from its free harmonic constants, and the Canadian Hydrographic Service's slack predictions for the same station (IWLS station 07845, `wcp1-events`).

| Measure | Result |
| --- | --- |
| CHS slacks in October | 116 |
| Within 10 minutes of XTide's turn | 83 |
| More than 15 minutes apart | 15, about one in eight |
| 30 minutes or more apart | 6 |
| Largest difference | 97 minutes |

Each CHS slack was matched to the nearest turn in the XTide table, with both in Pacific Daylight Time. The two sources do not list the same number of turns: XTide has 120 in the month and CHS 116.

The six differences of 30 minutes or more all fall beside a weak run, under 3 knots at its CHS maximum. The largest is the start of a 0.4-knot flood. Where the current runs at 4 knots or more on both sides of the slack, 5 of 85 slacks differ by more than 15 minutes and none by more than 22.

This compares two sets of predictions with each other, not either with measured water. It covers one station and one month.

## XTide's Washington current stations against NOAA

On October 19, 2026 we ran the same comparison for five Washington current stations in Dairiki.org's list, matching each NOAA slack for October 2026 to the nearest turn in Dairiki's monthly table. Each NOAA station is the one at Dairiki's position, at the depth NOAA's own predictions default to. Slackwater's predictions for these stations come from NOAA's published constituents.

| Station | Slacks | Within 10 min | 30 min or more | Median |
| --- | --- | --- | --- | --- |
| [Deception Pass](/currents/us/wa/deception-pass-narrows/), PUG1701 | 120 | 20 | 66 | 31 min |
| Rosario Strait, PUG1702 | 93 | 4 | 50 | 34 min |
| San Juan Channel, PUG1703 | 112 | 21 | 37 | 22 min |
| Admiralty Inlet, PUG1616 | 107 | 46 | 17 | 12 min |
| The Narrows, north end, PUG1524 | 120 | 65 | 6 | 9 min |

At every one of the five, the largest difference is more than an hour, from 72 minutes at Admiralty Inlet to 114 at San Juan Channel.

At Deception Pass, unlike Sechelt, the differences do not come from weak runs. Where the current runs at 4 knots or more on both sides of the slack, 62 of 88 slacks differ by more than 15 minutes. The difference is not a fixed offset either. Dairiki's slack comes as much as 73 minutes before NOAA's at the start and end of the month and as much as 69 minutes after it around October 22. NOAA's other two depths at Deception Pass give the same median within two minutes, so the depth chosen does not explain it. Dairiki.org does not say which harmonics file it uses.

As at Sechelt, this compares predictions with predictions. NOAA's are the official ones for these stations.

## Dates and reproducibility

The NOAA links point to a fixed engine revision so the reports, test methods and fixtures can be inspected together. The figures are the results recorded in the July 2026 reports, not a daily validation feed or a new run against current agency data. Running the tests against those fixtures checks agreement with the saved historical predictions. The Sechelt Rapids comparison is a single run on October 17, 2026, and the Washington comparison a single run on October 19, 2026. All three sources still publish October 2026, and the [comparison script](https://github.com/openwatersio/slackwater/blob/82fc78e07e05fe865d2f99567fef58b0284af316/benchmarks/xtide-slack.ts) repeats both.

If a reading looks wrong, [contact support](/support/) with the station, date, time and your app version. You can also inspect the [app source](https://github.com/openwatersio/slackwater-ios) and the [station database's sources](https://github.com/openwatersio/slackwater-database#sources).
