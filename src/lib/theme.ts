export const THEME_STORAGE_KEY = 'slackwater-theme'

export type ThemeMode = 'auto' | 'light' | 'night' | 'location'
export type Appearance = 'light' | 'night'
export interface Observer { latitude: number; longitude: number }
export interface ThemeSubject { observer?: Observer; instant?: Date }

const MODES: readonly ThemeMode[] = ['auto', 'light', 'night', 'location']

export function parseThemeMode(value: string | null): ThemeMode {
  return MODES.includes(value as ThemeMode) ? value as ThemeMode : 'night'
}

export function resolveAppearance(
  mode: ThemeMode,
  systemDark: boolean,
  sunAltitude?: number,
): Appearance {
  if (mode === 'light') return 'light'
  if (mode === 'night') return 'night'
  if (mode === 'auto') return systemDark ? 'night' : 'light'
  return (sunAltitude ?? -1) > 0 ? 'light' : 'night'
}

export function subjectFromMatches(matches: readonly { loaderData?: unknown }[]): ThemeSubject {
  for (const { loaderData } of [...matches].reverse()) {
    if (!loaderData || typeof loaderData !== 'object') continue
    const data = loaderData as Record<string, unknown>
    const station = data.station as Record<string, unknown> | undefined
    if (typeof station?.latitude !== 'number' || typeof station.longitude !== 'number') continue
    return {
      observer: { latitude: station.latitude, longitude: station.longitude },
      instant: data.instant instanceof Date ? data.instant : undefined,
    }
  }
  return {}
}

export const PREPAINT_THEME_SCRIPT = `(()=>{try{if(document.documentElement.hasAttribute('data-appearance'))return;const k='slackwater-theme',m=localStorage.getItem(k);let a='night';if(m==='light')a='light';else if(m==='auto')a=matchMedia('(prefers-color-scheme: dark)').matches?'night':'light';document.documentElement.setAttribute('data-appearance',a)}catch{}})()`
