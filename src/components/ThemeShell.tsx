import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { sunAltAz } from '@openwaters/almanac'
import { SiteSky } from './SiteSky'
import { locationSky, stylizedSky, transitionSky, type SkyFrame } from '#/lib/site-sky'
import {
  THEME_STORAGE_KEY,
  parseThemeMode,
  resolveAppearance,
  subjectFromMatches,
  type Appearance,
  type Observer,
  type ThemeMode,
  type ThemeSubject,
} from '#/lib/theme'

type PublishThemeSubject = (subject?: ThemeSubject) => void

const ThemeSubjectContext = createContext<PublishThemeSubject>(() => {})
const modes = ['auto', 'light', 'night', 'location'] as const
const themeColour: Record<Appearance, string> = { light: '#eef6f3', night: '#00121f' }

export function locationAppearance(observer: Observer, at: Date): Appearance {
  try {
    return resolveAppearance('location', false, sunAltAz(at, {
      latitudeDeg: observer.latitude,
      longitudeDeg: observer.longitude,
    }).altDeg)
  } catch {
    return resolveAppearance('location', false)
  }
}

export function useThemeSubject() {
  return useContext(ThemeSubjectContext)
}

export function ThemeShell({
  matches,
  children,
}: {
  matches: readonly { loaderData?: unknown }[]
  children: ReactNode
}) {
  const routeSubject = useMemo(() => subjectFromMatches(matches), [matches])
  const [publishedSubject, publishSubject] = useState<ThemeSubject>()
  const [browserObserver, setBrowserObserver] = useState<Observer>()
  const [mode, setMode] = useState<ThemeMode>('night')
  const [systemDark, setSystemDark] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [error, setError] = useState<string>()
  const locationRequest = useRef(0)
  const locating = useRef(false)
  const subject = publishedSubject ?? routeSubject
  const observer = subject.observer ?? browserObserver
  const initialObserver = useRef(routeSubject.observer).current

  const store = useCallback((value: ThemeMode) => {
    try { localStorage.setItem(THEME_STORAGE_KEY, value) } catch { /* preference stays in memory */ }
  }, [])

  const clearStoredLocation = useCallback(() => {
    try { localStorage.removeItem(THEME_STORAGE_KEY) } catch { /* unavailable storage already behaves as unsaved */ }
  }, [])

  const requestLocation = useCallback((saved: boolean) => {
    if (locating.current) return
    locating.current = true
    const request = ++locationRequest.current
    const fail = () => {
      if (request !== locationRequest.current) return
      locating.current = false
      setError('Location is unavailable.')
      if (saved) {
        clearStoredLocation()
        setMode('night')
      }
    }
    if (!navigator.geolocation) {
      fail()
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (request !== locationRequest.current) return
        locating.current = false
        setBrowserObserver({ latitude: coords.latitude, longitude: coords.longitude })
        setMode('location')
        setError(undefined)
        store('location')
      },
      fail,
    )
  }, [clearStoredLocation, store])

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    update()
    media.addEventListener('change', update)

    let stored: string | null = null
    try { stored = localStorage.getItem(THEME_STORAGE_KEY) } catch { /* Night is the safe default */ }
    const saved = parseThemeMode(stored)
    if (stored !== null && saved === 'night' && stored !== 'night') clearStoredLocation()
    if (saved === 'location' && !initialObserver) requestLocation(true)
    else setMode(saved)
    setHydrated(true)

    return () => media.removeEventListener('change', update)
  }, [clearStoredLocation, initialObserver, requestLocation])

  useEffect(() => {
    if (subject.observer && locating.current) {
      locationRequest.current += 1
      locating.current = false
    } else if (mode === 'location' && !observer) {
      requestLocation(true)
    }
  }, [mode, observer, requestLocation, subject.observer])

  useEffect(() => {
    if (mode !== 'location' || !observer || subject.instant) return
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [mode, observer, subject.instant])

  const at = subject.instant ?? clock
  const target = useMemo(
    () => mode === 'location' && observer
      ? locationSky(observer, at)
      : stylizedSky(resolveAppearance(mode, systemDark)),
    [at, mode, observer?.latitude, observer?.longitude, systemDark],
  )
  const appearance = mode === 'location' && observer
    ? locationAppearance(observer, at)
    : resolveAppearance(mode, systemDark)
  const [frame, setFrame] = useState<SkyFrame>(() => stylizedSky('night'))
  const frameRef = useRef(frame)

  useEffect(() => {
    if (!hydrated) return
    document.documentElement.dataset.appearance = appearance
    document.documentElement.style.colorScheme = appearance
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', themeColour[appearance])
  }, [appearance, hydrated])

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      frameRef.current = target
      setFrame(target)
      return
    }
    const from = frameRef.current
    let started: number | undefined
    let animation = 0
    const draw = (time: number) => {
      started ??= time
      const progress = Math.min(1, (time - started) / 700)
      const next = transitionSky(from, target, progress)
      frameRef.current = next
      setFrame(next)
      if (progress < 1) animation = requestAnimationFrame(draw)
    }
    animation = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animation)
  }, [target])

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const next = parseThemeMode(event.currentTarget.value)
    setError(undefined)
    if (next === 'location' && !observer) {
      requestLocation(false)
      return
    }
    locationRequest.current += 1
    locating.current = false
    setMode(next)
    store(next)
  }

  const title = (value: ThemeMode | Appearance) => value[0].toUpperCase() + value.slice(1)
  const label = mode === appearance ? title(mode) : `${title(mode)} (${title(appearance)})`

  return (
    <ThemeSubjectContext.Provider value={publishSubject}>
      <SiteSky frame={frame} />
      <div className="relative z-10">{children}</div>
      <div className="fixed right-4 top-4 z-20">
        <button
          type="button"
          popoverTarget="theme-modes"
          aria-label={`Theme: ${label}`}
          className="grid size-11 place-items-center rounded-full border border-sw-steel/40 bg-sw-page/80 text-xl text-sw-foam shadow-lg backdrop-blur focus-visible:ring-2 focus-visible:ring-sw-foam"
        >
          <span aria-hidden="true">{appearance === 'light' ? '☀︎' : '☾'}</span>
        </button>
        <div id="theme-modes" popover="auto" className="m-0 ml-auto mr-4 mt-16 rounded-lg border border-sw-steel/40 bg-sw-page p-4 text-sw-foam shadow-xl">
          <fieldset>
            <legend className="mb-2 font-medium">Appearance</legend>
            {modes.map((value) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 py-1">
                <input type="radio" name="theme" value={value} checked={mode === value} onChange={choose} />
                {value === 'auto' ? 'Auto (system)' : title(value)}
              </label>
            ))}
            {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
          </fieldset>
        </div>
      </div>
    </ThemeSubjectContext.Provider>
  )
}
