import './react-preview.css'
import { useMemo } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { CurrentStation, SlackwaterProvider, TideStation } from '@slackwater/react'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { reactStation, reactStations } from '#/lib/catalogue-server'
import { createLocalDataSource, type SourceStation } from '#/lib/react-source'
import { ChsDay } from './ChsDay'

// Vite relocates optimized MapLibre modules, so their relative worker URL is invalid.
setWorkerUrl(workerUrl)

const examples = [
  { name: 'Eastport', kind: 'tide' as const, id: 'noaa/8410140' },
  { name: 'Seattle', kind: 'tide' as const, id: 'noaa/9447130' },
  { name: 'Deception Pass', kind: 'current' as const, id: 'noaa/PUG1701' },
  { name: 'Yokeko Point', kind: 'current' as const, id: 'noaa/PUG1629' },
  { name: 'Victoria', kind: 'tide' as const, id: 'ticon/victoria_bc-543a-can-uhslc_rq' },
  { name: 'Dodd Narrows', kind: 'current' as const, id: 'chs-dodd-narrows' },
  { name: 'Malibu Rapids', kind: 'current' as const, id: 'chs-malibu-rapids' },
]

export function ReactPreview({ item }: { item: SourceStation }) {
  const navigate = useNavigate({ from: '/preview/react' })
  const source = useMemo(
    () =>
      createLocalDataSource(
        {
          station: (data) => reactStation({ data }),
          list: (data) => reactStations({ data }),
        },
        `site:${__DATABASE_VERSION__}:commercial:v1`,
        [item],
      ),
    [item],
  )
  const Station = item.kind === 'tide' ? TideStation : CurrentStation
  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <nav aria-label="Preview stations" className="mb-6 flex flex-wrap gap-2">
        {examples.map((station) => (
          <Link
            key={station.id}
            to="/preview/react"
            search={{ kind: station.kind, id: station.id }}
            aria-current={item.station.id === station.id ? 'page' : undefined}
            className="rounded-full border border-sw-steel/40 px-3 py-2 text-sm hover:bg-white/10 aria-[current=page]:bg-white/10"
          >
            {station.name}
          </Link>
        ))}
      </nav>
      <ChsDay key={item.station.id} station={item.station} />
      {item.station.source === 'bundled' && (
        <>
          {item.station.chs && <h2 className="mb-4 text-lg text-sw-steel">Computed predictions</h2>}
          <SlackwaterProvider dataSource={source} units="feet">
            <Station
              key={`${item.kind}:${item.station.id}`}
              id={item.station.id}
              onStationSelect={(station) =>
                void navigate({ to: '/preview/react', search: { kind: station.kind, id: station.id } })
              }
            />
          </SlackwaterProvider>
        </>
      )}
    </main>
  )
}
