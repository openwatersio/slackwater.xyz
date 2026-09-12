import { useEffect, useRef } from 'react'

export interface MapPoint {
  name: string
  latitude: number
  longitude: number
  href: string
}

/**
 * The Nearby list, drawn on a chart.
 *
 * **Leaflet is never imported at module scope.** It touches `window` the
 * moment it is evaluated, so a static import throws during the prerender —
 * all 3,640 pages, not one. It arrives inside the effect, and not even then
 * until the box scrolls into view: a reader who never reaches the bottom of a
 * station page pays nothing, downloads no tiles, and tells openstreetmap.org
 * nothing.
 *
 * `aria-hidden` because the sibling Nearby list is the accessible version of
 * exactly this content — real links, in the served HTML, which is also what a
 * crawler indexes. Markers here are a second way to reach the same pages, so
 * announcing them would read every station name twice.
 */
export function NearbyMap({
  station,
  rows,
}: {
  station: { name: string; latitude: number; longitude: number }
  rows: MapPoint[]
}) {
  const box = useRef<HTMLDivElement>(null)
  // The identity of `station` and `rows`, not their addresses: this page
  // re-renders on a ticking clock, and depending on the objects would tear the
  // map down and rebuild it — refetching tiles — once a second.
  const key = JSON.stringify([station, rows])

  useEffect(() => {
    const el = box.current
    if (!el || !rows.length) return
    let map: import('leaflet').Map | undefined
    let gone = false

    const draw = async () => {
      const [L] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')])
      if (gone) return
      // Colour comes from the tokens, read off the element, rather than hexes
      // copied into a component that a light theme would then have to find.
      const token = (name: string) => getComputedStyle(el).getPropertyValue(name).trim() || 'currentColor'
      // The basemap is light, so the pins take the chart's ink rather than
      // the page's: foam vanishes on OSM's paper, chart-ink does not.
      const here = token('--color-sw-leaf')
      const other = token('--color-sw-flood')
      const ink = token('--color-sw-chart-ink')
      map = L.map(el, { scrollWheelZoom: false, keyboard: false, attributionControl: true })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 17,
      }).addTo(map)
      const dot = (p: { latitude: number; longitude: number }, radius: number, colour: string) =>
        L.circleMarker([p.latitude, p.longitude], {
          radius,
          color: ink,
          weight: 1.5,
          fillColor: colour,
          fillOpacity: 0.9,
        }).addTo(map!)
      for (const r of rows) {
        dot(r, 7, other)
          .bindTooltip(r.name)
          .on('click', () => location.assign(r.href))
      }
      dot(station, 10, here)
      map.fitBounds(
        L.latLngBounds([station, ...rows].map((p) => [p.latitude, p.longitude])),
        { padding: [24, 24] },
      )
    }

    const stop = () => {
      gone = true
      map?.remove()
    }
    // jsdom and any other environment without an observer gets the map
    // immediately — the laziness is an optimisation, not the behaviour.
    if (typeof IntersectionObserver === 'undefined') {
      void draw()
      return stop
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      void draw()
    })
    io.observe(el)
    return () => {
      io.disconnect()
      stop()
    }
  }, [key])

  if (!rows.length) return null
  return (
    <div
      ref={box}
      className="mt-4 h-64 w-full overflow-hidden rounded-lg bg-sw-card-fill"
      aria-hidden="true"
    />
  )
}
