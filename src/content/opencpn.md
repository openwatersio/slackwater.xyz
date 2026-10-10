## How does Slackwater compare with the data OpenCPN ships?

<img src="/shots/opencpn/world.webp" alt="Slackwater tide and current stations on a world chart in OpenCPN, densest along the US and European coasts" width="1560" height="1021" loading="lazy">

Most of the tide data OpenCPN ships is years or decades old. Its US file is a January 2021 snapshot of NOAA's data. Its world file was compiled between 1995 and 2003, from sources as old as Royal Australian Navy observations that began in 1944. OpenCPN 5.14 adds a TICON-4 file from March 2026, without the [quality checks](#quality-controlled) below.

Slackwater is rebuilt from its sources for every release, and every station is checked before it ships.

### Fresher

NOAA's tide and current stations are refreshed every month. OpenCPN's 2021 file still lists 39 tide stations and 16 current stations that NOAA has since retired, most of them temporary survey sites in Alaska and on the Delaware River. Each Slackwater file is named for its release date, so you can tell how old your data is.

### Quality Controlled

For this release, Slackwater evaluated 8,372 candidate tide stations and left out 2,192. 909 duplicated a better station nearby. The rest failed one or more checks: 794 had tidal levels in the wrong order, 598 had constituents that aren't physically plausible, 567 were superseded by a newer record from the same gauge, and 94 had a tidal range under 2 cm. The [quality report](https://github.com/openwatersio/slackwater-database/blob/v1.0.0-beta.20261009/quality.json) lists every station and the reason.

### Chart datum

Heights are given against each country's chart datum, so they line up with the depths on your chart. Every station names its source.

### Where OpenCPN has more

Counts are unique station locations, so a NOAA current station published at three depths counts once. OpenCPN 5.14 turns on all three of its files; an install upgraded from 5.12 or earlier keeps its old two.

|                  | Slackwater                               | OpenCPN 5.14                                         | OpenCPN 5.12 and earlier                      |
| ---------------- | ---------------------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| Tide stations    | 6,031                                    | 7,159                                                | 5,770                                         |
| Current stations | 2,449                                    | 2,526                                                | 2,526                                         |
| US data          | NOAA<br><small>refreshed monthly</small> | NOAA via XTide<br><small>January 2021</small>        | NOAA via XTide<br><small>January 2021</small> |
| Rest of world    | TICON-4 and Kartverket                   | TICON-4 (March 2026) and harmonics from 1995 to 2003 | Harmonics compiled 1995 to 2003               |
| Chart datum      | Each country's own                       | MLLW in the US, LAT for TICON stations               | MLLW in the US, varies elsewhere              |

<small>Counted October 10, 2026, from `slackwater-20261009.tcd` and the files in OpenCPN's `tcdata` folder.</small>

Most of OpenCPN's extra tide stations come from its 1995 to 2003 world file: about 890 in Canada, 490 in Japan and 330 around Australia and Papua New Guinea. They carry no license information, and the newest of their sources is decades old. On currents the two are close; nearly every NOAA current station in OpenCPN's US file is in Slackwater too, and the difference in count is mostly extra depths.

### What Slackwater lacks

The real gap is Canadian currents. OpenCPN's `HARMONICS_NO_US.IDX` includes about 70 British Columbia passes (Seymour Narrows, Dodd Narrows, Nakwakto Rapids, Active Pass) and 17 points around the Bay of Fundy. Canada doesn't publish current data under an open license, so this file can't include them. The Slackwater app gets some of them from the Canadian Hydrographic Service on your phone instead. [Keep that file loaded](#install) if you sail there.

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
