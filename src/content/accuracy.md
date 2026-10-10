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

## Dates and reproducibility

The NOAA links point to a fixed engine revision so the reports, test methods and fixtures can be inspected together. The figures are the results recorded in the July 2026 reports, not a daily validation feed or a new run against current agency data. Running the tests against those fixtures checks agreement with the saved historical predictions.

If a reading looks wrong, [contact support](/support/) with the station, date, time and your app version. You can also inspect the [app source](https://github.com/openwatersio/slackwater-ios) and the [station database's sources](https://github.com/openwatersio/slackwater-database#sources).
