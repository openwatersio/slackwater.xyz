---
url: https://slackwater.xyz/compare/slackwater-vs-dairiki/
title: Slackwater vs Dairiki.org — XTide current tables, or NOAA and CHS predictions
description: Dairiki.org publishes free XTide tide and current tables for Washington and BC. How its slack times compare with NOAA's and CHS's, and when to use each.
verified: 2026-10-19
---

# Slackwater vs Dairiki.org

**Short version.** Dairiki.org is a free website that publishes XTide tide and current predictions for the
Pacific Northwest: a daily plot and a monthly table you can print, for 76 tide stations and 38 current stations from BC to California.
Slackwater is a free iPhone and Apple Watch app that predicts slack and max flood and ebb
on the phone, offline, from NOAA's and the Canadian Hydrographic Service's numbers.

The difference that matters at a pass is the timing. In October 2026, Dairiki's slack at
Deception Pass was a median 31 minutes from NOAA's prediction for the same station, and
its Sechelt Rapids slacks were more than 15 minutes from CHS's about one time in eight.

Slackwater features checked October 9, 2026; Dairiki.org's pages and station lists checked October 19, 2026.

## At a glance

| | Dairiki.org | Slackwater |
|---|---|---|
| What it is | Website of XTide tide and current tables | Tide and current app |
| Price | Free, donations welcome | Free core; optional Premium |
| Currents | Turn (slack) and max times with speed, daily plot | Slack time and duration, max flood/ebb with speed and set, a curve you slide through |
| How far ahead | Any month | Any date |
| Stations | 76 tide, 38 current: Washington, BC, Oregon, California | Tides worldwide; currents in the US and Canada |
| Source of the numbers | XTide's harmonic constants; the site does not say which file | NOAA constituents, CHS; named per station |
| Offline | No; a printed table works | Bundled predictions offline; Canadian setup, some passes online-only |
| Platforms | Any browser | iPhone, iPad and Apple Watch |
| Made by | Jeff Dairiki, with David Flater's XTide | Open Waters |

## Side by side

There is no Dairiki screenshot here; [open its Deception Pass page](https://www.dairiki.org/tides/daily.php/dec)
beside this one. Here is Slackwater at the same pass:

![Slackwater: Deception Pass at 3:46 PM, slack at 0.0 knots, ebb in 8 minutes, with the next 7.2 knot maximum ebb at 6:30 PM](/shots/compare/slackwater-deception-slack.webp)

Deception Pass at slack: 0.0 knots, ebb in 8 minutes, with the next 7.2 knot maximum ebb
at 6:30 PM. The green parts of the curve show the slack windows.

## Where the numbers come from

Both start from harmonic constants, the same kind of math, and XTide is open source, as
is Slackwater. Dairiki.org runs [XTide](https://flaterco.com/xtide/), David Flater's free tide predictor,
and publishes what it computes. It does not say which XTide harmonics file it runs. XTide's
free harmonics file holds NOAA's US data, so where its BC current stations come from is
not stated anywhere we could find.

Slackwater's US current stations use NOAA's published constituents. Its Canadian stations
come from Canadian Hydrographic Service predictions, checked against CHS's own published
numbers. Each station page names its source.

## How far apart the slack times are

We matched Dairiki's October 2026 tables against the agencies' own slack predictions on
October 17 and 19, 2026. The full method and numbers are on [How we check predictions](/accuracy/).

| Station | Compared with | Slacks within 10 minutes | Median difference |
|---|---|---|---|
| Deception Pass | NOAA PUG1701 | 20 of 120 | 31 minutes |
| Rosario Strait | NOAA PUG1702 | 4 of 93 | 34 minutes |
| San Juan Channel | NOAA PUG1703 | 21 of 112 | 22 minutes |
| Admiralty Inlet | NOAA PUG1616 | 46 of 107 | 12 minutes |
| The Narrows, Tacoma | NOAA PUG1524 | 65 of 120 | 9 minutes |
| Sechelt Rapids | CHS 07845 | 83 of 116 | 7 minutes |

At Sechelt the big misses sit beside weak runs, under 3 knots. At Deception Pass they do
not: on slacks between runs of 4 knots or more, 62 of 88 are more than 15 minutes from
NOAA's, and the largest is 73 minutes. Dairiki's slack there is early on some days and late on others, so no fixed correction fixes it.

This compares predictions with predictions, not with the water. NOAA's and CHS's are the
official ones for these stations.

## Format

Dairiki is good at what a web page is good at. A month of turns and maxima on one page,
easy to print and keep at the helm, on any computer or phone with a browser. The daily
plot shows the curve, sunrise and sunset, and the nominal flood and ebb directions.

Slackwater answers "when can I get through?" directly. Pick the station and the readout
is the state now, the next slack and how long it lasts, and max flood and ebb with speed
and set, over a curve you slide through the week. The reference port's tide is on the same
screen. Home screen widgets and a standalone Apple Watch app are free.

## Offline

Dairiki needs a connection, unless you printed the month before leaving. Slackwater
computes bundled predictions on the phone for any date. Most Canadian stations build an offline model after a download; some Canadian passes require a connection and are labeled in the app.

## What Dairiki.org has that Slackwater does not

A printable month on one page, from any browser, on any platform. Oregon and California
tide stations alongside Washington and BC on one short list. Nothing to install, and a
disclaimer that says plainly what it is.

## Who should pick which

**Dairiki.org** for a printed month of tides at the chart table, or a quick look from a
computer.

**Slackwater** to time a pass in Washington or BC against the agencies' own numbers, and to
take with you past the end of the signal.

**Both** is reasonable. Cross-checking two sources before a tight pass is good practice;
where they disagree by half an hour, go with NOAA's or CHS's numbers, and watch the water.

Predictions are not observations. Weather, river flow and local conditions change the
water. Neither one is for navigation; Dairiki.org says the same of itself.

**[Download Slackwater on the App Store](https://apps.apple.com/app/slackwater-tides-current/id6813654837)** · Free, no account. Requires iOS 26 or later.

See also: [the best tide and current apps for iPhone](/compare/best-tide-and-current-apps-iphone/)
· [Slackwater vs AyeTides](/compare/slackwater-vs-ayetides/)
· [Slackwater vs OceanConnect](/compare/slackwater-vs-oceanconnect/)
