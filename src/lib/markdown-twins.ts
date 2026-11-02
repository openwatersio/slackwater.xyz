import opencpn from '../content/opencpn.md?raw'
import { chartTime } from './format'
import type { ComparePage } from './compare'
import type { HubKind } from './catalogue-server'
import { APP_STORE, TCD } from './links'
import { GUIDE_DAYS, longDay, span, type SlackGuide } from './slack-guide'

/**
 * The Markdown twins of pages whose HTML is not written in Markdown: each page
 * at `/<path>.md`, for agents that would otherwise parse the HTML.
 *
 * The comparison pages are Markdown already. The others repeat their page's
 * prose, and `markdown-twins.test.ts` fails when a page's headings and its
 * twin's drift apart. Station and browse pages have no twin; they stay HTML.
 */

export const markdownResponse = (body: string) =>
  new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })

/** A comparison page without its frontmatter, so it starts at its `#` heading. */
export const compareMarkdown = (page: ComparePage) => `${page.markdown.trim()}\n`

/** "October 9, 2026", the date of the database release the file comes from. */
const released = TCD.date
  ? new Date(`${TCD.date.slice(0, 4)}-${TCD.date.slice(4, 6)}-${TCD.date.slice(6)}T12:00:00Z`).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
  : undefined

export function opencpnMarkdown(): string {
  return `# Slackwater for OpenCPN

Global tide and current stations, curated for quality, in local chart datum, updated every month, as one free file for OpenCPN.

[Download the latest \`.tcd\` file](${TCD.url})${released ? `, updated ${released}` : ''}. [All releases](https://github.com/openwatersio/slackwater-database/releases).

## Install it in OpenCPN

1. Download the [latest \`.tcd\` file](${TCD.url}).
2. In OpenCPN, click the ⚙️ to open **Options** → **Charts** tab → **Tides & Currents**.
3. Click **Add Dataset…** and choose the Slackwater file.
4. In **Active Datasets**, select the following \`.tcd\` files and click **Remove Selected** ([why?](#why-remove-opencpn-s-other-tcd-files)):
   - \`harmonics-dwf-20210110-free.tcd\`
   - \`ticon-europe-global.tcd\` (OpenCPN 5.14)

   Keep \`HARMONICS_NO_US.IDX\` for British Columbia and Bay of Fundy current stations (see [What Slackwater lacks](#what-slackwater-lacks)). Where it overlaps Slackwater, OpenCPN shows the file listed first, so remove it and add it back from OpenCPN's \`tcdata\` folder to list it after Slackwater.
5. Click **Ok**.
6. Open the menu button (☰) in the lower-right corner of the chart and check **Show Tide stations** and **Show Currents**.
7. Right-click a station icon and choose **Show Tide Information** or **Show Current Information** to see its graph.

To update, download the newest file, add it, and remove the old one. The date in the file name is the date of the database release.

${opencpn.trim()}
`
}

export function stationsMarkdown({ tide, current }: { tide: HubKind; current: HubKind }): string {
  const kind = (heading: string, blurb: string, hub: HubKind, more: string) =>
    [
      `## [${heading}](${hub.href})`,
      '',
      blurb,
      '',
      ...hub.top.map((p) => `- [${p.name}](${p.href}): ${p.count.toLocaleString()} stations`),
      '',
      `[${more}](${hub.href})`,
    ].join('\n')
  return `# Stations

Every station Slackwater predicts, worldwide for tides and across the US and Canada for currents. Each country page lists its states, provinces and stations. Station pages are HTML; follow these links rather than guessing a station's URL.

${kind('Tide stations', `${tide.count.toLocaleString()} worldwide.`, tide, 'All countries')}

${kind('Current stations', `${current.count.toLocaleString()} across the US and Canada.`, current, 'All current stations')}

[What is slack water?](/learn/slack-water/) · [How the Moon makes two high tides](/learn/tides/)
`
}

export function slackWaterMarkdown(title: string, guide: SlackGuide): string {
  const { comparison: c, durations, slackKnots } = guide
  const tz = c.timezone
  const { callout } = c.day
  const gap = Math.abs(callout.extreme - callout.slack) / 60_000
  const pass = durations.find((d) => d.path === c.current.path)
  const from = longDay(guide.now, tz)
  const rows = durations.map(
    (d) =>
      `| [${d.name}](${d.path}) | ${d.peakKnots.toFixed(1)} kn | ${span(d.medianMinutes)} | ${span(d.shortest.minutes)} | ${span(d.longest.minutes)} |`,
  )
  const passNote = pass
    ? `\n\nEven at one station the window moves with the tide's range. At Deception Pass the shortest slack in that stretch, ${span(pass.shortest.minutes)} on ${longDay(pass.shortest.start, tz)}, sits between streams reaching ${pass.shortest.flankKnots.toFixed(1)} knots. The longest, ${span(pass.longest.minutes)} on ${longDay(pass.longest.start, tz)}, sits between streams reaching ${pass.longest.flankKnots.toFixed(1)} knots.${pass.shortest.flankKnots > pass.longest.flankKnots ? ' A bigger exchange means a faster stream and a shorter slack.' : ''}`
    : ''

  return `# ${title}

Slack water is the short stretch of time when a tidal current turns around. The flood, the current that carries the rising tide in, slows and stops, and the ebb, the current that carries the falling tide back out, begins. Or the other way round. For a while the water barely moves, and in a narrow pass that lull is when a boat can get through.

## Slack is the time the stream is weak enough to work with

The current is exactly zero for an instant. What matters on the water is the time around that instant, while the stream is too weak to set you onto the rocks or stop you making way.

There is no single speed that counts as slack. Workable water depends on the boat: a kayak and a trawler don't share a limit.

## Slack is not high or low tide

It's natural to assume the current stops at high and low tide. Along an open coast it roughly does. In a pass it often doesn't: the stream there runs on the difference in water level between the two ends, and it turns when that difference does, not when the tide peaks on either side.

[${c.tide.name}](${c.tide.path}) has a tide gauge ${c.distanceNm.toFixed(1)} nautical miles from [${c.current.name}](${c.current.path}). On ${longDay(c.day.start, tz)}, slack in the pass came at ${chartTime(new Date(callout.slack), tz)}, ${span(gap)} ${callout.slack < callout.extreme ? 'before' : 'after'} ${callout.high ? 'high' : 'low'} water at the gauge.

That day is not unusual. Over the ${GUIDE_DAYS} days from ${from}, ${c.fortnight.within30} of the ${c.fortnight.slacks} slacks in Deception Pass fall within half an hour of a high or low at the gauge. ${c.fortnight.overHour} are an hour or more from one, and the furthest is ${span(c.fortnight.maxMinutes)} away.

A tide table read as a slack table gets a pass wrong. Current stations publish their own slack times, so use the current station for the water you are crossing.

## How long slack lasts

It depends on the pass and on the size of the exchange. A narrow pass with a fast stream swings from flood to ebb with hardly a pause; a broad channel with a weaker stream can idle under the band for hours. These are the next ${GUIDE_DAYS} days at each station, counting slack as under ${slackKnots} knots:

| Station | Fastest stream | Typical slack | Shortest | Longest |
| --- | --- | --- | --- | --- |
${rows.join('\n')}${passNote}

## When to go

Each turn has two slacks on a current table: slack before flood, as the ebb dies, and slack before ebb, as the flood dies. Pick the one that leaves the next stream running your way. Arrive as the opposing stream eases, go through at the turn, and the new stream carries you on rather than building against you.

Plan around the window, not the minute. Predictions are not observations: wind, river runoff and air pressure can move slack by minutes or more. Be at the entrance when the window opens, not when it peaks, and know where you will wait if the stream turns early.

## Where to find slack water

Look up the current station for the water you are crossing, not the nearest tide port. The [Slackwater app](${APP_STORE}) predicts slack for current stations across the US and Canada.

---

Every number on this page is computed from the site's own predictions, from NOAA harmonic constituents, starting ${from}. Predictions are not observations, and conditions vary with weather and river flow. **Not for navigation.** See [how accurate the predictions are](/accuracy/) and [how the Moon makes the tide](/learn/tides/).
`
}
