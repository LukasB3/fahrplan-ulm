'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import type { Vehicle, Vehicles, VehicleTrip } from '@api/types'
import { AttributionControl, type GeoJSONSource, getVersion, Map as MapLibre, Marker, setWorkerUrl } from 'maplibre-gl'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { type BoardLabels, DepartureBoard } from '@/features/departures/DepartureBoard'
import { getJson } from '@/lib/api'
import type { LineStyle } from '@/lib/data-types'
import type { Messages } from '@/lib/i18n'
import { Icon } from '@/shell/icons'
import { LineBadge } from '@/shell/LineBadge'
import { Sheet } from '@/shell/Sheet'

export type MapStop = { id: number; code: string; name: string; href: string; lat: number; lon: number; lines: string[] }

type Props = { stops: MapStop[]; lineStyles: Record<string, LineStyle>; labels: Messages['map']; boardLabels: BoardLabels }

const POLL_MS = 15_000
const FRAME_MS = 66
// A vehicle that moved further than this between two reports was not driving there: it is set down, not slid.
const JUMP_DEGREES = 0.006
const ULM: [number, number] = [9.9916, 48.3984]
const REGION: [[number, number], [number, number]] = [
  [9.6, 48.2],
  [10.4, 48.6],
]
const TOUCH_REACH = 14
// From this many minutes behind, a vehicle says so on the map. Below that it would be noise.
const LATE_FROM = 2

type Position = [lon: number, lat: number]
type Moving = { marker: Marker; badge: HTMLElement; delay: HTMLElement; from: Position; to: Position; shown: Position; since: number }

// The map lives outside the page: built on the first visit and kept when the
// tab is left, so coming back costs neither a new set of tiles nor a new
// drawing context. The page that is on screen plugs its handlers in.
type Live = {
  map: MapLibre
  host: HTMLDivElement
  vehicles: Map<number, Moving>
  here?: Marker
  onStop: (code: string) => void
  onVehicle: (id: number) => void
}
let live: Live | undefined

const createMap = (place: HTMLElement, stops: MapStop[]): Live => {
  // The library reads tiles in a worker that it ships as a file of its own.
  // The bundler does not carry that file along, so the build copies it into
  // `public` (see the `map-worker` script) and the library is told where it is.
  setWorkerUrl(`/map-worker.mjs?v=${getVersion()}`)
  const dark = matchMedia('(prefers-color-scheme: dark)').matches
  // The library makes its own element `position: relative`, so the element
  // that fills the screen has to be another one around it.
  const host = document.createElement('div')
  host.className = 'map-host'
  const canvas = document.createElement('div')
  host.append(canvas)
  place.append(host)
  const map = new MapLibre({
    container: canvas,
    style: `https://tiles.stadiamaps.com/styles/${dark ? 'alidade_smooth_dark' : 'alidade_smooth'}.json`,
    center: ULM,
    zoom: 13.2,
    minZoom: 10,
    maxZoom: 18,
    maxBounds: REGION,
    // North stays up: a transit map is read, not flown.
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    attributionControl: false,
  })
  // The credits go bottom left: the corner on the right belongs to the location button.
  map.addControl(new AttributionControl({ compact: true }), 'bottom-left')
  map.touchZoomRotate.disableRotation()
  const created: Live = { map, host, vehicles: new Map(), onStop: () => {}, onVehicle: () => {} }

  map.on('load', () => {
    // Lettering in the face the map's own labels use.
    const font = map.getStyle().layers.flatMap((layer) => (layer.type === 'symbol' && Array.isArray(layer.layout?.['text-font']) ? [layer.layout['text-font'] as string[]] : []))[0]
    map.addSource('track', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'track', type: 'line', source: 'track', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['coalesce', ['get', 'color'], '#0068d9'], 'line-width': 4, 'line-opacity': 0.75 } })
    map.addSource('stops', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: stops.map((stop) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [stop.lon, stop.lat] }, properties: { code: stop.code, name: stop.name } })) },
    })
    map.addLayer({
      id: 'stops',
      type: 'circle',
      source: 'stops',
      minzoom: 12.5,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12.5, 2.5, 16, 6],
        'circle-color': dark ? '#1c1c1e' : '#ffffff',
        'circle-stroke-color': dark ? '#d1d1d6' : '#48484a',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12.5, 1, 16, 2],
      },
    })
    map.addLayer({
      id: 'stop-names',
      type: 'symbol',
      source: 'stops',
      minzoom: 15,
      layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 0.8], ...(font ? { 'text-font': font } : {}) },
      paint: { 'text-color': dark ? '#f2f2f7' : '#1c1c1e', 'text-halo-color': dark ? '#000000' : '#ffffff', 'text-halo-width': 1.5 },
    })
  })

  // A finger is wider than a stop's dot: anything within reach of the tap counts.
  map.on('click', ({ point }) => {
    if (!map.getLayer('stops')) return
    const [hit] = map.queryRenderedFeatures(
      [
        [point.x - TOUCH_REACH, point.y - TOUCH_REACH],
        [point.x + TOUCH_REACH, point.y + TOUCH_REACH],
      ],
      { layers: ['stops'] },
    )
    if (hit) created.onStop(String(hit.properties.code))
  })
  return created
}

const showTrack = (trip: VehicleTrip | undefined, color: string | undefined) => {
  const source = live?.map.getSource<GeoJSONSource>('track')
  void source?.setData({
    type: 'FeatureCollection',
    features: trip?.track.length ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: trip.track.map(([lat, lon]) => [lon, lat]) }, properties: color ? { color } : {} }] : [],
  })
}

const clock = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })

export default function LiveMap({ stops, lineStyles, labels, boardLabels }: Props) {
  const place = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [stop, setStop] = useState<MapStop>()
  const [vehicle, setVehicle] = useState<Vehicle>()
  const [trip, setTrip] = useState<VehicleTrip | 'failed'>()
  const [located, setLocated] = useState<'failed'>()
  const selected = useRef<number | undefined>(undefined)
  // The latest report of every vehicle, for the sheet of the one that is tapped.
  const reported = useRef(new Map<number, Vehicle>())

  // The map: built once, plugged in while this page is on screen.
  useEffect(() => {
    if (!place.current) return
    try {
      if (live) {
        place.current.append(live.host)
        live.map.resize()
      } else live = createMap(place.current, stops)
    } catch {
      return setFailed(true)
    }
    const current = live
    // What was tapped moves into the part of the map the sheet leaves free.
    const bringIntoView = (position: Position) => current.map.easeTo({ center: position, offset: [0, -current.host.clientHeight * 0.27], duration: 500 })
    current.onStop = (code) => {
      const tapped = stops.find((candidate) => candidate.code === code)
      setVehicle(undefined)
      setStop(tapped)
      if (tapped) bringIntoView([tapped.lon, tapped.lat])
    }
    current.onVehicle = (id) => {
      const tapped = reported.current.get(id)
      setStop(undefined)
      setVehicle(tapped)
      if (tapped) bringIntoView([tapped.lon, tapped.lat])
    }
    return () => {
      current.onStop = () => {}
      current.onVehicle = () => {}
      current.host.remove()
    }
  }, [stops])

  // The vehicles: asked for every 15 seconds while the page is on screen, and
  // slid from where they were shown to where they now are.
  useEffect(() => {
    const current = live
    if (!current) return
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let timer: number | undefined
    let drawn = 0

    const moveTo = (moving: Moving, position: Position) => {
      moving.shown = position
      moving.marker.setLngLat(position)
    }

    const report = (vehicles: Vehicle[]) => {
      const now = performance.now()
      reported.current = new Map(vehicles.map((one) => [one.id, one]))
      for (const [id, gone] of current.vehicles) {
        if (reported.current.has(id)) continue
        gone.marker.remove()
        current.vehicles.delete(id)
      }
      for (const one of vehicles) {
        const to: Position = [one.lon, one.lat]
        let moving = current.vehicles.get(one.id)
        if (!moving) {
          const badge = document.createElement('button')
          badge.type = 'button'
          badge.className = 'vehicle'
          const delay = document.createElement('b')
          badge.append(document.createElement('i'), delay)
          badge.addEventListener('click', (event) => {
            event.stopPropagation()
            current.onVehicle(one.id)
          })
          // The map places a marker by transforming its element, so the badge,
          // which grows when tapped, sits inside one: scaling the marker itself
          // would scale its place on the map along with it.
          const pin = document.createElement('div')
          pin.append(badge)
          moving = { marker: new Marker({ element: pin }).setLngLat(to).addTo(current.map), badge, delay, from: to, to, shown: to, since: now }
          current.vehicles.set(one.id, moving)
        }
        const far = Math.abs(to[0] - moving.shown[0]) + Math.abs(to[1] - moving.shown[1]) > JUMP_DEGREES
        moving.from = still || far ? to : moving.shown
        moving.to = to
        moving.since = now
        if (still || far) moveTo(moving, to)

        // A vehicle changes line and direction at the end of its trip.
        const style = one.mode === 'train' ? undefined : lineStyles[one.line]
        const { badge } = moving
        if (badge.firstChild?.nodeType === Node.TEXT_NODE) badge.firstChild.textContent = one.line
        else badge.prepend(one.line)
        badge.toggleAttribute('data-tram', one.mode === 'tram')
        badge.toggleAttribute('data-selected', selected.current === one.id)
        badge.style.setProperty('--vehicle-color', style?.color ?? '')
        badge.style.setProperty('--vehicle-text', style?.textColor ?? '')
        badge.style.setProperty('--bearing', `${one.bearing}deg`)
        const late = Math.round(one.delaySeconds / 60)
        moving.delay.textContent = late >= LATE_FROM ? `+${late}` : ''
        badge.setAttribute('aria-label', `${one.line} ${labels.towards} ${one.destination}${late >= LATE_FROM ? `, ${labels.late.replace('{n}', String(late))}` : ''}`)
      }
      // The sheet of the tapped vehicle follows it.
      setVehicle((shown) => (shown ? reported.current.get(shown.id) : shown))
    }

    const poll = () =>
      getJson<Vehicles>('/api/vehicles')
        .then(({ vehicles }) => report(vehicles))
        // A missed report leaves the vehicles where they are until the next one.
        .catch(() => {})

    const slide = (now: number) => {
      frame = requestAnimationFrame(slide)
      if (now - drawn < FRAME_MS) return
      drawn = now
      for (const moving of current.vehicles.values()) {
        if (moving.shown === moving.to) continue
        const done = Math.min(1, (now - moving.since) / POLL_MS)
        moveTo(moving, done === 1 ? moving.to : [moving.from[0] + (moving.to[0] - moving.from[0]) * done, moving.from[1] + (moving.to[1] - moving.from[1]) * done])
      }
    }

    // Nothing is fetched or drawn while the page is not looked at.
    const follow = () => {
      window.clearInterval(timer)
      cancelAnimationFrame(frame)
      if (document.visibilityState !== 'visible') return
      void poll()
      timer = window.setInterval(() => void poll(), POLL_MS)
      if (!still) frame = requestAnimationFrame(slide)
    }
    follow()
    document.addEventListener('visibilitychange', follow)
    return () => {
      window.clearInterval(timer)
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', follow)
    }
  }, [lineStyles, labels.towards, labels.late])

  // The tapped vehicle: marked on the map, with its remaining stops and its way.
  const vehicleId = vehicle?.id
  useEffect(() => {
    selected.current = vehicleId
    for (const [id, moving] of live?.vehicles ?? []) {
      moving.badge.toggleAttribute('data-selected', id === vehicleId)
      // The tapped one lies on top of its neighbours.
      moving.marker.getElement().style.zIndex = id === vehicleId ? '1' : ''
    }
    setTrip(undefined)
    if (vehicleId === undefined) return showTrack(undefined, undefined)
    let shown = true
    const load = () =>
      getJson<VehicleTrip>(`/api/vehicles/${vehicleId}`)
        .then((answer) => {
          if (!shown) return
          setTrip(answer)
          showTrack(answer, lineStyles[answer.line]?.color)
        })
        .catch(() => shown && setTrip((before) => before ?? 'failed'))
    void load()
    const timer = window.setInterval(() => void load(), POLL_MS)
    return () => {
      shown = false
      window.clearInterval(timer)
    }
  }, [vehicleId, lineStyles])

  const locate = () =>
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!live) return
        setLocated(undefined)
        const here: Position = [coords.longitude, coords.latitude]
        if (!live.here) {
          const dot = document.createElement('div')
          dot.className = 'here'
          live.here = new Marker({ element: dot }).setLngLat(here).addTo(live.map)
        } else live.here.setLngLat(here)
        live.map.easeTo({ center: here, zoom: Math.max(live.map.getZoom(), 15) })
      },
      () => setLocated('failed'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    )

  const lateBy = vehicle ? Math.round(vehicle.delaySeconds / 60) : 0

  return (
    <>
      <div ref={place} />
      {failed && <p className="fixed inset-x-4 top-1/3 rounded-card bg-surface px-4 py-6 text-center text-label-2">{labels.failed}</p>}

      <button type="button" aria-label={labels.locate} onClick={locate} className="map-control material pressable grid size-11 place-items-center rounded-full text-tint">
        <Icon name="location" />
      </button>
      {located === 'failed' && <p className="map-note material rounded-full px-4 py-2 text-[0.8125rem]">{labels.locateFailed}</p>}

      <Sheet open={stop !== undefined} onOpenChange={(open) => !open && setStop(undefined)} title={stop?.name} closeLabel={labels.close} passthrough low>
        {stop && (
          <div className="space-y-3">
            <p className="flex flex-wrap gap-1">
              {stop.lines.map((line) => (
                <LineBadge key={line} line={line} style={lineStyles[line]} small />
              ))}
            </p>
            <DepartureBoard stopId={stop.id} lineStyles={lineStyles} labels={boardLabels} rows={4} />
            <Link href={stop.href} className="pressable flex min-h-11 items-center justify-between rounded-card bg-bg px-4 text-tint">
              {labels.stopPage}
              <Icon name="chevron" className="size-4" />
            </Link>
          </div>
        )}
      </Sheet>

      <Sheet
        open={vehicle !== undefined}
        onOpenChange={(open) => !open && setVehicle(undefined)}
        title={
          vehicle && (
            <span className="flex items-center gap-2">
              <LineBadge line={vehicle.line} style={lineStyles[vehicle.line]} />
              <span className="min-w-0 truncate">
                <span className="font-normal text-label-2">{labels.towards} </span>
                {vehicle.destination}
              </span>
            </span>
          )
        }
        closeLabel={labels.close}
        passthrough
        low
      >
        {vehicle && (
          <div className="space-y-3">
            <p className={lateBy > 0 ? 'text-late' : 'text-ok'}>{lateBy > 0 ? labels.late.replace('{n}', String(lateBy)) : lateBy < 0 ? labels.early.replace('{n}', String(-lateBy)) : labels.onTime}</p>
            {trip === 'failed' ? (
              <p className="text-label-2">{labels.tripFailed}</p>
            ) : trip && trip.stops.length === 0 ? (
              <p className="text-label-2">{labels.tripOver}</p>
            ) : (
              <section>
                <h3 className="pb-1 text-[0.8125rem] font-semibold text-label-2">{labels.nextStops}</h3>
                <ol className="overflow-hidden rounded-card bg-bg">
                  {(trip?.stops ?? []).map((next, index) => (
                    <li key={`${next.code} ${index}`} className="flex min-h-10 items-center gap-3 border-t border-separator px-4 py-1.5 first:border-t-0">
                      <span className="w-12 shrink-0 tabular-nums">{clock.format(new Date(next.expected ?? next.planned))}</span>
                      <span className="min-w-0 flex-1 truncate">{next.name}</span>
                    </li>
                  ))}
                  {!trip && <li className="h-10 motion-safe:animate-pulse" />}
                </ol>
              </section>
            )}
          </div>
        )}
      </Sheet>
    </>
  )
}
