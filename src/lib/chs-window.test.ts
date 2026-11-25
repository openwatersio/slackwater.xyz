import { expect, it } from 'vitest'
import { mergeWindows } from './chs-window'

it('joins adjacent current windows in time order without duplicating their shared boundary', () => {
  const point = (hour: number) => ({ time: new Date(hour * 3600000), level: hour })
  const a = { kind: 'current' as const, samples: [point(1), point(2)], events: [] }
  const b = { kind: 'current' as const, samples: [point(0), point(1)], events: [] }
  expect(mergeWindows(a, b).samples.map((p) => p.level)).toEqual([0, 1, 2])
})

it('keeps published tide turns from both windows in chronological order', () => {
  const turn = (hour: number, high: boolean) => ({ time: new Date(hour * 3600000), level: hour, high })
  const first = { kind: 'tide' as const, samples: [turn(1, true)], turns: [turn(1, true)] }
  const second = { kind: 'tide' as const, samples: [turn(2, false)], turns: [turn(2, false)] }
  const merged = mergeWindows(second, first)
  expect(merged.kind).toBe('tide')
  if (merged.kind === 'tide') expect(merged.turns.map((t) => [t.level, t.high])).toEqual([[1, true], [2, false]])
})
