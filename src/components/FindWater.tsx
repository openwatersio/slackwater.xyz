import { useState } from 'react'
import { findStations } from '#/lib/discovery'
import type { Positioned } from '#/lib/nearby'
import type { StationIndex } from '#/lib/station-index'

export function FindWater() {
  const [index, setIndex] = useState<StationIndex>()
  const [location, setLocation] = useState<Positioned>()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [locationError, setLocationError] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    setOpen(true)
    if (index) return
    setLoading(true)
    try {
      const response = await fetch('/stations.json')
      if (!response.ok) throw new Error()
      const data: StationIndex = await response.json()
      if (!Array.isArray(data.stations) || !Array.isArray(data.attributions)) throw new Error()
      setIndex(data)
    } catch { setError('Station search is unavailable. Please try again.') }
    finally { setLoading(false) }
  }

  function locate() {
    setLocationError('')
    void load()
    if (!navigator.geolocation) { setLocationError('Location is unavailable. Search by station name instead.'); return }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setLocation({ latitude: coords.latitude, longitude: coords.longitude }); setLocationError('') },
      () => setLocationError('Could not find your location. Search by station name instead.'),
      { timeout: 10000, maximumAge: 300000 },
    )
  }
  const results = index && (location || query.trim()) ? findStations(index.stations, location, query) : undefined
  return (
    <section className="mt-8 rounded-xl border border-sw-steel/25 p-5 print:hidden" aria-labelledby="find-water-heading">
      <h2 id="find-water-heading" className="text-xl font-semibold text-sw-paper">Find tides and currents near you</h2>
      <p className="mt-2 text-sm text-sw-steel">Find a station for your own water. Location stays on your device.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={locate} className="rounded-md bg-sw-leaf px-4 py-2 font-medium text-sw-navy-deep">Use my location</button>
        <button type="button" onClick={() => { setError(''); void load() }} className="rounded-md border border-sw-steel/50 px-4 py-2 text-sw-paper">Search station names</button>
      </div>
      {open && <div className="mt-4">
        <label htmlFor="station-search" className="block text-sm text-sw-foam">Station name</label>
        <input id="station-search" value={query} onChange={(event) => { setQuery(event.target.value); setLocation(undefined) }} className="mt-1 w-full rounded-md border border-sw-steel/50 bg-sw-navy-deep px-3 py-2 text-sw-paper" />
        {loading && <p role="status" className="mt-2 text-sm text-sw-steel">Loading stations…</p>}
        {locationError && <p role="status" className="mt-2 text-sm text-sw-foam">{locationError}</p>}
        {error && <p role="status" className="mt-2 text-sm text-sw-foam">{error}</p>}
        {results && <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(['tide', 'current'] as const).map((kind) => <div key={kind}>
            <h3 className="font-semibold text-sw-paper">{kind === 'tide' ? 'Tide stations' : 'Current stations'}</h3>
            {results[kind].length === 0 ? <p className="mt-2 text-sm text-sw-steel">{location ? 'No stations found within 100 nautical miles. Search by name to look elsewhere.' : 'No stations found.'}</p> : <ul className="mt-2 space-y-2">
              {results[kind].map(({ station, distance }) => <li key={station.path} className="text-sm text-sw-steel">
                <a className="text-sw-paper underline underline-offset-4" href={station.path}>{station.name}</a> <span>({station.path.split('/').slice(2, -2).join(' / ').toUpperCase()})</span>
                {distance !== undefined && <> · {distance.toFixed(1)} nm</>}
                {!station.predictions && <> · predictions may not be available</>}
                <details className="mt-1"><summary>Source</summary><p>{index?.attributions[station.attribution]}</p></details>
              </li>)}
            </ul>}
          </div>)}
          <p className="sm:col-span-2 text-sm text-sw-steel">Station pages open at the current time. The nearest current station may not describe your crossing.</p>
        </div>}
      </div>}
    </section>
  )
}
