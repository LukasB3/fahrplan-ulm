'use client'

import type { Place, Places } from '@api/types'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { getJson } from '@/lib/api'
import { matchRank, plain } from '@/lib/search'
import { savePlace, useSavedPlaces } from '@/lib/store'
import { Icon, type IconName } from '@/shell/icons'
import type { PlannerLabels } from './Journeys'

const LOCAL_MATCHES = 5
const REMOTE_AFTER = 3
const REMOTE_DELAY_MS = 300

type Props = {
  // What was typed into the field above.
  query: string
  // All SWU stops, busiest first: found at once, without asking the server.
  stops: Place[]
  // Set while home or work is being chosen: the pick is saved under that name.
  saving: 'home' | 'work' | null
  onSaving: (as: 'home' | 'work') => void
  onPick: (place: Place) => void
  labels: PlannerLabels
}

const ICONS: Record<Place['kind'], IconName> = { stop: 'stop', address: 'pin', poi: 'pin', position: 'location' }

function Row({ icon, title, detail, onPick, action }: { icon: IconName; title: string; detail?: string | null; onPick: () => void; action?: ReactNode }) {
  return (
    <li className="flex items-center border-t border-separator first:border-t-0">
      <button type="button" onClick={onPick} className="pressable flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left">
        <Icon name={icon} className="size-5 shrink-0 text-label-2" />
        <span className="min-w-0 flex-1 truncate">
          {title}
          {detail && <span className="text-label-2"> · {detail}</span>}
        </span>
      </button>
      {action}
    </li>
  )
}

// The suggestions under a planner field: quick choices while nothing is
// typed, then stops from the phone at once and addresses from the server shortly after.
export function PlaceSearch({ query, stops, saving, onSaving, onPick, labels }: Props) {
  const saved = useSavedPlaces()
  const [located, setLocated] = useState<'locating' | 'failed'>()
  const [remote, setRemote] = useState<{ query: string; places: Place[] | 'failed' }>()

  const names = useMemo(() => stops.map((stop) => plain(stop.name)), [stops])
  const wanted = plain(query.trim())
  const local = wanted
    ? stops
        .map((stop, index) => ({ stop, rank: matchRank(names[index]!, wanted) }))
        .filter((match) => match.rank !== undefined)
        .sort((a, b) => a.rank! - b.rank!)
        .slice(0, LOCAL_MATCHES)
        .map(({ stop }) => stop)
    : []

  useEffect(() => {
    if (wanted.length < REMOTE_AFTER) return
    let live = true
    // Wait for a pause in typing; a search per letter would be wasted.
    const timer = window.setTimeout(() => {
      getJson<Places>(`/api/places?q=${encodeURIComponent(query.trim())}`)
        .then(({ places }) => live && setRemote({ query: wanted, places }))
        .catch(() => live && setRemote({ query: wanted, places: 'failed' }))
    }, REMOTE_DELAY_MS)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [query, wanted])

  const pick = (place: Place) => {
    if (saving) savePlace(saving, place)
    onPick(place)
  }

  const locate = () => {
    setLocated('locating')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => pick({ kind: 'position', stop: null, name: labels.myLocation, town: null, lat: coords.latitude, lon: coords.longitude }),
      () => setLocated('failed'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  if (!wanted) {
    const savedRow = (as: 'home' | 'work') => {
      const place = saved[as]
      const [name, set] = as === 'home' ? [labels.home, labels.setHome] : [labels.work, labels.setWork]
      return place ? (
        <Row
          key={as}
          icon={as}
          title={name}
          detail={place.name}
          onPick={() => onPick(place)}
          action={
            <button type="button" onClick={() => onSaving(as)} className="pressable flex min-h-11 shrink-0 items-center px-4 text-[0.9375rem] text-tint">
              {labels.change}
            </button>
          }
        />
      ) : (
        <Row key={as} icon={as} title={set} onPick={() => onSaving(as)} />
      )
    }
    return (
      <div className="space-y-2">
        <ul className="overflow-hidden rounded-card bg-surface">
          {!saving && <Row icon="location" title={located === 'locating' ? labels.locating : labels.myLocation} onPick={locate} />}
          {!saving && savedRow('home')}
          {!saving && savedRow('work')}
          {saved.recent.map((place) => (
            <Row key={`${place.kind} ${place.stop ?? place.name} ${place.town}`} icon="recent" title={place.name} detail={place.town === 'Ulm' ? null : place.town} onPick={() => pick(place)} />
          ))}
        </ul>
        {located === 'failed' && <p className="px-4 text-[0.8125rem] text-late">{labels.locationFailed}</p>}
      </div>
    )
  }

  const fromServer = remote?.query === wanted ? remote.places : undefined
  // A stop the phone already listed is not shown again.
  const others = Array.isArray(fromServer) ? fromServer.filter((place) => !(place.stop && local.some((stop) => stop.stop === place.stop))) : []
  const searching = wanted.length >= REMOTE_AFTER && fromServer === undefined

  return (
    <div className="space-y-2">
      {(local.length > 0 || others.length > 0) && (
        <ul className="overflow-hidden rounded-card bg-surface">
          {[...local, ...others].map((place) => (
            <Row key={`${place.kind} ${place.stop ?? `${place.name} ${place.lat}`}`} icon={ICONS[place.kind]} title={place.name} detail={place.town === 'Ulm' && place.kind === 'stop' ? null : place.town} onPick={() => pick(place)} />
          ))}
        </ul>
      )}
      <p className="px-4 text-[0.8125rem] text-label-2">{searching ? labels.searching : fromServer === 'failed' ? labels.placesFailed : local.length + others.length === 0 ? labels.noPlace : null}</p>
    </div>
  )
}
