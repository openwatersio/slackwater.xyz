import { parseInstant } from '../routes/instant-url'

export function prerenderPath(path: string): boolean {
  if (path.startsWith('/preview/react')) return false
  try {
    const segment = path.split('/').filter(Boolean).at(-1) ?? ''
    return !parseInstant(decodeURIComponent(segment))
  } catch { return false }
}
