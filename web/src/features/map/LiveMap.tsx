'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import type { Departure, Vehicle, VehicleTrip } from '@api/types'
import { AttributionControl, type GeoJSONSource, getVersion, Map as MapLibre, Marker, setWorkerUrl } from 'maplibre-gl'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { type BoardLabels, DepartureBoard } from '@/features/departures/DepartureBoard'
import { minutesOff, RunStops, RunTitle, StopTimes } from '@/features/departures/Run'
import { getJson } from '@/lib/api'
import { locate, type LocateProblem } from '@/lib/geo'
import type { LineStyle } from '@/lib/data-types'
import type { Messages } from '@/lib/i18n'
import { Icon } from '@/shell/icons'
import { LineBadge } from '@/shell/LineBadge'
import { Sheet } from '@/shell/Sheet'
import { vehiclesNow } from './vehicles'

export type MapStop = { id: number; code: string; name: string; href: string; lat: number; lon: number; lines: string[] }

type Props = { stops: MapStop[]; lineStyles: Record<string, LineStyle>; labels: Messages['map']; boardLabels: BoardLabels }

const POLL_MS = 15_000
// After a question that failed, and while the positions are old, the next one comes sooner.
const RETRY_MS = 5_000
// Positions older than this are no longer where the vehicles are: the map says since when it has had no news.
const STALLED_MS = 60_000
const clock = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
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

// A stop is drawn as the German stop sign (Zeichen 224): a green H on yellow
// inside a green ring. Drawn here rather than loaded, so it is there with the map.
// A thin rim in the map's own ground keeps it apart from roads and other signs.
const SIGN_PX = 24
const SIGN_SCALE = 3
const stopSign = (dark: boolean): ImageData => {
  const size = SIGN_PX * SIGN_SCALE
  const context = document.createElement('canvas').getContext('2d')!
  context.canvas.width = context.canvas.height = size
  context.scale(SIGN_SCALE, SIGN_SCALE)
  const middle = SIGN_PX / 2
  const disc = (radius: number, color: string) => {
    context.beginPath()
    context.arc(middle, middle, radius, 0, 2 * Math.PI)
    context.fillStyle = color
    context.fill()
  }
  disc(middle, dark ? '#000000' : '#ffffff')
  disc(middle - 1, '#008351')
  disc(middle - 3.25, '#f9c300')
  // The H: two posts and a bar, as shapes rather than a letter, so no font decides its weight.
  context.fillStyle = '#008351'
  const [width, height, stroke] = [8.5, 10, 2.5]
  const left = middle - width / 2
  const top = middle - height / 2
  context.fillRect(left, top, stroke, height)
  context.fillRect(left + width - stroke, top, stroke, height)
  context.fillRect(left, middle - stroke / 2, width, stroke)
  return context.getImageData(0, 0, size, size)
}

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
    map.addImage('stop-sign', stopSign(dark), { pixelRatio: SIGN_SCALE })
    map.addLayer({
      id: 'stops',
      type: 'symbol',
      source: 'stops',
      minzoom: 12.5,
      layout: {
        'icon-image': 'stop-sign',
        // Small from afar, where only the spot matters; a readable sign once the streets are.
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12.5, 0.4, 15, 0.75, 17, 1],
        // Every stop is shown, wherever the map's own labels are.
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    })
    map.addLayer({
      id: 'stop-names',
      type: 'symbol',
      source: 'stops',
      minzoom: 15,
      layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-anchor': 'top', 'text-offset': [0, 1.1], ...(font ? { 'text-font': font } : {}) },
      paint: { 'text-color': dark ? '#f2f2f7' : '#1c1c1e', 'text-halo-color': dark ? '#000000' : '#ffffff', 'text-halo-width': 1.5 },
    })
  })

  // A finger is wider than a stop's sign: anything within reach of the tap counts.
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

export default function LiveMap({ stops, lineStyles, labels, boardLabels }: Props) {
  const place = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const [stop, setStop] = useState<MapStop>()
  // A departure tapped in the stop's sheet: the sheet then shows where it goes from there.
  const [departure, setDeparture] = useState<Departure>()
  const [vehicle, setVehicle] = useState<Vehicle>()
  const [trip, setTrip] = useState<VehicleTrip | 'failed'>()
  const [located, setLocated] = useState<'locating' | LocateProblem>()
  // What there is to say about the positions: none reported, old ones (since when), or not to be had.
  const [feed, setFeed] = useState<'none' | 'failed' | { since: string }>()
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
      setDeparture(undefined)
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
    // Counts the times the page came on screen: an answer that arrives for an earlier time is dropped.
    let watch = 0
    let watching = false
    let misses = 0

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

    // One question at a time; the answer decides when the next one is due.
    const poll = async (during: number) => {
      let next = POLL_MS
      try {
        const { vehicles, now, asOf } = await vehiclesNow()
        if (during !== watch) return
        misses = 0
        report(vehicles)
        const stalled = asOf !== null && Date.parse(now) - Date.parse(asOf) > STALLED_MS
        current.host.toggleAttribute('data-stalled', stalled)
        setFeed(asOf === null ? 'none' : stalled ? { since: clock.format(new Date(asOf)) } : undefined)
        if (stalled) next = RETRY_MS
      } catch {
        if (during !== watch) return
        // A missed report leaves the vehicles where they are. One miss is not worth a word.
        if (++misses > 1) {
          current.host.toggleAttribute('data-stalled', true)
          setFeed('failed')
        }
        next = RETRY_MS
      }
      timer = window.setTimeout(() => void poll(during), next)
    }

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
      const visible = document.visibilityState === 'visible'
      if (visible === watching) return
      watching = visible
      watch++
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
      if (!visible) return
      void poll(watch)
      if (!still) frame = requestAnimationFrame(slide)
    }
    follow()
    document.addEventListener('visibilitychange', follow)
    return () => {
      watch++
      window.clearTimeout(timer)
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

  const showMe = () => {
    setLocated('locating')
    locate().then(
      ({ lat, lon }) => {
        setLocated(undefined)
        if (!live) return
        const here: Position = [lon, lat]
        if (!live.here) {
          const dot = document.createElement('div')
          dot.className = 'here'
          live.here = new Marker({ element: dot }).setLngLat(here).addTo(live.map)
        } else live.here.setLngLat(here)
        live.map.easeTo({ center: here, zoom: Math.max(live.map.getZoom(), 15) })
      },
      (problem: LocateProblem) => setLocated(problem),
    )
  }

  // How late the tapped vehicle is: by its next stop once the stops are here, so the line above
  // them never says something else than they do; until then by what the vehicle itself reports.
  const lateBy = (trip && trip !== 'failed' ? minutesOff(trip.stops[0]) : undefined) ?? (vehicle ? Math.round(vehicle.delaySeconds / 60) : 0)
  const note = located && located !== 'locating' ? (located === 'denied' ? labels.locationDenied : labels.locationUnavailable) : feed === 'none' ? labels.noVehicles : feed === 'failed' ? labels.vehiclesFailed : feed ? labels.stalled.replace('{time}', feed.since) : undefined

  return (
    <>
      <div ref={place} />
      {failed && <p className="fixed inset-x-4 top-1/3 rounded-card bg-surface px-4 py-6 text-center text-label-2">{labels.failed}</p>}

      <button type="button" aria-label={labels.locate} aria-busy={located === 'locating'} onClick={showMe} className="map-control material pressable grid size-11 place-items-center rounded-full text-tint">
        <Icon name="location" className={located === 'locating' ? 'motion-safe:animate-pulse' : undefined} />
      </button>
      {note && (
        <p role="status" className="map-note material rounded-2xl px-4 py-2 text-[0.8125rem]">
          {note}
        </p>
      )}

      <Sheet
        open={stop !== undefined}
        onOpenChange={(open) => !open && setStop(undefined)}
        title={departure ? <RunTitle line={departure.line} style={departure.mode === 'train' ? undefined : lineStyles[departure.line]} towards={labels.towards} destination={departure.destination} /> : stop?.name}
        closeLabel={labels.close}
        passthrough
        low
      >
        {stop && (
          <>
            {/* The board stays while a departure is shown, so going back finds it as it was. */}
            <div hidden={departure !== undefined} className="space-y-3">
              <p className="flex flex-wrap gap-1">
                {stop.lines.map((line) => (
                  <LineBadge key={line} line={line} style={lineStyles[line]} small />
                ))}
              </p>
              <DepartureBoard stopId={stop.id} lineStyles={lineStyles} labels={boardLabels} rows={4} onOpen={setDeparture} />
              <Link href={stop.href} className="pressable flex min-h-11 items-center justify-between rounded-card bg-bg px-4 text-tint">
                {labels.stopPage}
                <Icon name="chevron" className="size-4" />
              </Link>
            </div>
            {departure && (
              <div className="space-y-2">
                <button type="button" onClick={() => setDeparture(undefined)} className="pressable -ml-1.5 flex min-h-11 max-w-full items-center pr-2 text-tint">
                  <Icon name="back" className="shrink-0" />
                  <span className="truncate">{stop.name}</span>
                </button>
                <RunStops stopId={stop.id} departure={departure} lineStyles={lineStyles} labels={{ stops: labels.nextStops, failed: labels.tripFailed, planned: labels.timesPlanned, live: labels.timesLive }} />
              </div>
            )}
          </>
        )}
      </Sheet>

      <Sheet
        open={vehicle !== undefined}
        onOpenChange={(open) => !open && setVehicle(undefined)}
        title={vehicle && <RunTitle line={vehicle.line} style={lineStyles[vehicle.line]} towards={labels.towards} destination={vehicle.destination} />}
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
                <StopTimes stops={trip?.stops} color={lineStyles[vehicle.line]?.color} labels={{ planned: labels.timesPlanned, live: labels.timesLive }} />
              </section>
            )}
          </div>
        )}
      </Sheet>
    </>
  )
}
