// The quality figures /opencpn/ quotes, read from the installed
// @slackwater/database: every tide record the evaluation scored, and the
// rejected ones by the reason the database records for each, which is the
// first check it failed (docs/quality-evaluation.md in slackwater-database).
// Shared by tools/count-opencpn.mjs and the test that checks the page.
export async function qualityCounts() {
  const { allStations } = await import('@slackwater/database')
  const evaluated = allStations.filter((s) => s.kind === 'tide' && s.quality)
  const reasons = {}
  for (const s of evaluated) {
    if (s.quality.accepted) continue
    const reason = s.quality.reason ?? 'unknown'
    reasons[reason] = (reasons[reason] ?? 0) + 1
  }
  return {
    evaluated: evaluated.length,
    rejected: Object.values(reasons).reduce((a, b) => a + b, 0),
    reasons: Object.fromEntries(Object.entries(reasons).sort(([a, x], [b, y]) => y - x || a.localeCompare(b))),
  }
}
