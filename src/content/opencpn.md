## How does Slackwater compare with the data OpenCPN ships?

<img src="/shots/opencpn/world.webp" alt="Slackwater tide and current stations on a world chart in OpenCPN, densest along the US and European coasts" width="1560" height="1021" loading="lazy">

Most of the tide data OpenCPN ships is years or decades old. Its US file is a January 2021 snapshot of NOAA's data. Its world file was compiled between 1995 and 2003, from sources as old as Royal Australian Navy observations that began in 1944. OpenCPN 5.14 adds a TICON-4 file from March 2026, without the [quality checks](#quality-controlled) below.

Slackwater is rebuilt from its sources for every release, and every station is checked before it ships.

### Fresher

NOAA's tide and current stations are refreshed every month. As of October 17, 2026, OpenCPN's 2021 file still lists 89 tide stations and 52 current stations that NOAA no longer publishes predictions for. The largest groups are 25 tide stations in Alaska and 38 current stations in New Jersey and Delaware. Each Slackwater file is named for its release date, so you can tell how old your data is.

### Quality Controlled

For this release, Slackwater evaluated 8,428 candidate tide stations and left out 2,231. 1,082 duplicated a better station nearby, and 746 relayed a gauge whose operator publishes its own record. The rest failed a check: 281 had tidal levels in the wrong order, 94 had a tidal range under 2 cm, 17 ran on a clock offset from their neighbors, 9 had constituents that aren't physically plausible, and 2 had a yearly term out of line with nearby gauges. [How stations are evaluated](https://github.com/openwatersio/slackwater-database/blob/v1.0.0-beta.20261017/docs/quality-evaluation.md) explains each check, and every station's file in [`stations/`](https://github.com/openwatersio/slackwater-database/tree/v1.0.0-beta.20261017/stations) records its result.

### Chart datum

Heights are given against each country's chart datum, so they line up with the depths on your chart. Every station names its source.

### Where OpenCPN has more

Counts are unique station locations to the nearest 0.01°, so a NOAA current station published at three depths counts once. OpenCPN 5.14 turns on all three of its files; an install upgraded from 5.12 or earlier keeps its old two.

|                  | Slackwater                               | OpenCPN 5.14                                         | OpenCPN 5.12 and earlier                      |
| ---------------- | ---------------------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| Tide stations    | 6,051                                    | 7,160                                                | 5,771                                         |
| Current stations | 2,449                                    | 2,526                                                | 2,526                                         |
| US data          | NOAA<br><small>refreshed monthly</small> | NOAA via XTide<br><small>January 2021</small>        | NOAA via XTide<br><small>January 2021</small> |
| Rest of world    | TICON-4 and Kartverket                   | TICON-4 (March 2026) and harmonics from 1995 to 2003 | Harmonics compiled 1995 to 2003               |
| Chart datum      | Each country's own                       | MLLW in the US, LAT for TICON stations               | MLLW in the US, varies elsewhere              |

<small>Counted October 17, 2026, from `slackwater-20261017.tcd`, the files in OpenCPN 5.14.2's `tcdata` folder, and NOAA's lists of the stations it publishes predictions for.</small>

OpenCPN 5.14 has 2,371 tide locations with no Slackwater tide station within 1 km, and 2,122 of them come from its 1995 to 2003 world file: 997 in Canada, 603 in Japan and 332 around Australia and Papua New Guinea. They carry no license information, and the newest of their sources is decades old. On currents the two are close: Slackwater carries 2,471 of the 2,528 NOAA current stations in OpenCPN's US file, and NOAA no longer publishes 49 of the other 57.

### What Slackwater lacks

The real gap is Canadian currents. OpenCPN's `HARMONICS_NO_US.IDX` includes 72 current points in British Columbia (Seymour Narrows, Dodd Narrows, Nakwakto Rapids, Active Pass) and 18 around the Bay of Fundy and its approaches. Canada doesn't publish current data under an open license, so this file can't include them. The Slackwater app gets some of them from the Canadian Hydrographic Service on your phone instead. [Keep that file loaded](#install) if you sail there.

## FAQ

### Is it free?

Yes. The station data is licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), apart from a few stations under CC BY-NC 4.0 whose sources don't allow commercial use. The [database's license section](https://github.com/openwatersio/slackwater-database#license) has the details and the attribution text.

### Where does the data come from?

US tides and currents come from [NOAA](https://tidesandcurrents.noaa.gov). Tides elsewhere come from TICON-4, built from the GESLA-4 archive of tide gauge records, and from Kartverket in Norway. The [database's sources](https://github.com/openwatersio/slackwater-database#sources) list them in full.

### Why remove OpenCPN's other `.tcd` files?

OpenCPN doesn't merge duplicate stations. When two files have a tide station in the same place, it shows whichever file is listed first, which may be the 2021 data. Current stations draw twice, on top of each other. With more than one `.tcd` file loaded, the tide window can also show the wrong reference station name; the predictions themselves are unaffected.

### What about the TICON file OpenCPN includes?

`ticon-europe-global.tcd` is an earlier snapshot of the same open data that goes into Slackwater. It lists 228 station names more than once, which Slackwater merges, and it gives every station's heights against LAT. Slackwater uses [each country's chart datum](#chart-datum). In the Baltic, Brazil, Italy, Chile and China, chart datum isn't LAT. OpenCPN adds the predicted tide to charted depths, so the datum should match your chart. [Remove the bundled file](#install) when you add Slackwater.

### What units does it use?

Heights are stored in meters and current speeds in knots. OpenCPN converts heights to the units set in its options.

### Does it work with XTide?

Yes. Point XTide at the file with `export HFILE_PATH=/path/to/slackwater-YYYYMMDD.tcd`. The [TCD notes](https://github.com/openwatersio/slackwater-database/blob/main/packages/tcd/README.md) have more examples.

### How accurate is it?

The predictions are astronomical: they don't include weather, river flow or storm surge. [How we check predictions](/accuracy/) describes the tests against NOAA's own predictions. **Not for navigation.**

### Is this the same data as the Slackwater app?

Yes. The same station database drives [the iPhone app](/) and the station pages on this site. The app also covers Canadian stations from the Canadian Hydrographic Service, which can't be included in this file.
