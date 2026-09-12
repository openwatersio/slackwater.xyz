/**
 * The stops of a curve's edge-fade mask, with the past held at 35%.
 *
 * The app draws what has already happened at 35% and what is still to come
 * at full strength, split at the absolute now. `now` is the fraction of the
 * window that is behind the reader — clamped, so a window entirely ahead
 * (tomorrow's strip) fades nothing and one entirely behind fades all of it.
 *
 * Luminance mask semantics: the values here are opacities of a WHITE stop —
 * see the note at the mask in `TideCurve`.
 */
export function fadeStops(now: number): { offset: number; opacity: number }[] {
  const at = Math.min(1, Math.max(0, now))
  const PAST = 0.35
  const edge = (offset: number) => (offset < at ? PAST : 1)
  return [
    { offset: 0, opacity: 0 },
    { offset: 0.06, opacity: edge(0.06) },
    { offset: at, opacity: PAST },
    { offset: at, opacity: 1 },
    { offset: 0.94, opacity: edge(0.94) },
    { offset: 1, opacity: 0 },
  ].sort((a, b) => a.offset - b.offset)
}
