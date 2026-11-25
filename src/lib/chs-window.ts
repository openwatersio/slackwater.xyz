import type { Published } from './readings'

function joined<T extends { time: Date }>(a: T[], b: T[]): T[] {
  return [...new Map([...a, ...b].map((item) => [item.time.getTime(), item])).values()]
    .sort((x, y) => x.time.getTime() - y.time.getTime())
}

export function mergeWindows(a: Published, b: Published): Published {
  if (a.kind === 'tide' && b.kind === 'tide')
    return { kind: 'tide', samples: joined(a.samples, b.samples), turns: joined(a.turns, b.turns) }
  if (a.kind === 'current' && b.kind === 'current')
    return { kind: 'current', samples: joined(a.samples, b.samples), events: joined(a.events, b.events) }
  throw new Error('Cannot join tide and current predictions.')
}
