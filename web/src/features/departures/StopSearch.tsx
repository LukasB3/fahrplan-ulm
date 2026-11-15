'use client'

import { type ReactNode, useMemo, useState } from 'react'
import type { LineStyle } from '@/lib/data-types'
import { metresBetween } from '@/lib/geo'
import { matchRank, plain } from '@/lib/search'
import { useFavourites } from '@/lib/store'
import { Icon } from '@/shell/icons'
import { button, groupHeading } from '@/shell/styles'
import { type ListedStop, StopRow } from './StopRow'

export type SearchLabels = {
  searchLabel: string
  searchPlaceholder: string
  clear: string
  noMatch: string
  favourites: string
  nearby: string
  nearbyStart: string
  nearbyFailed: string
  nearbyNone: string
  popular: string
  metres: string
}

type Props = {
  // All stops, busiest first.
  stops: ListedStop[]
  lineStyles: Record<string, LineStyle>
  labels: SearchLabels
}

const POPULAR = 8
const NEARBY = 5
const NEARBY_RADIUS_M = 2_000
const MATCHES = 20

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className={groupHeading}>{heading}</h2>
      <ul className="overflow-hidden rounded-card bg-surface">{children}</ul>
    </section>
  )
}

export function StopSearch({ stops, lineStyles, labels }: Props) {
  const [query, setQuery] = useState('')
  const [nearby, setNearby] = useState<'failed' | { stop: ListedStop; metres: number }[]>()
  const favourites = useFavourites()

  const names = useMemo(() => stops.map((stop) => plain(stop.name)), [stops])
  const wanted = plain(query.trim())
  const matches = wanted
    ? stops
        .map((stop, index) => ({ stop, rank: matchRank(names[index]!, wanted) }))
        .filter((match) => match.rank !== undefined)
        .sort((a, b) => a.rank! - b.rank!)
        .slice(0, MATCHES)
    : undefined
  const favouriteStops = favourites.flatMap((code) => stops.find((stop) => stop.code === code) ?? [])

  const locate = () =>
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here = { lat: coords.latitude, lon: coords.longitude }
        setNearby(
          stops
            .map((stop) => ({ stop, metres: metresBetween(here, stop) }))
            .filter((near) => near.metres <= NEARBY_RADIUS_M)
            .sort((a, b) => a.metres - b.metres)
            .slice(0, NEARBY),
        )
      },
      () => setNearby('failed'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )

  return (
    <div className="space-y-6">
      <label className="flex h-11 items-center gap-2 rounded-xl bg-fill px-3">
        <Icon name="search" className="size-5 shrink-0 text-label-2" />
        <span className="sr-only">{labels.searchLabel}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.searchPlaceholder}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-3 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" aria-label={labels.clear} onClick={() => setQuery('')} className="pressable -mr-2 grid size-11 place-items-center text-label-3">
            <Icon name="clear" className="size-5" />
          </button>
        )}
      </label>

      {matches ? (
        matches.length ? (
          <ul className="overflow-hidden rounded-card bg-surface">
            {matches.map(({ stop }) => (
              <StopRow key={stop.code} stop={stop} lineStyles={lineStyles} />
            ))}
          </ul>
        ) : (
          <p className="px-4 text-center text-label-2">{labels.noMatch}</p>
        )
      ) : (
        <>
          {favouriteStops.length > 0 && (
            <Group heading={labels.favourites}>
              {favouriteStops.map((stop) => (
                <StopRow key={stop.code} stop={stop} lineStyles={lineStyles} />
              ))}
            </Group>
          )}

          {Array.isArray(nearby) && nearby.length > 0 ? (
            <Group heading={labels.nearby}>
              {nearby.map(({ stop, metres }) => (
                <StopRow key={stop.code} stop={stop} lineStyles={lineStyles} note={`${Math.round(metres / 10) * 10} ${labels.metres}`} />
              ))}
            </Group>
          ) : (
            <div>
              <button type="button" onClick={locate} className={`${button.secondary} w-full`}>
                <Icon name="location" className="size-5" />
                {labels.nearbyStart}
              </button>
              {nearby && <p className="px-4 pt-2 text-[0.8125rem] text-label-2">{nearby === 'failed' ? labels.nearbyFailed : labels.nearbyNone}</p>}
            </div>
          )}

          <Group heading={labels.popular}>
            {stops.slice(0, POPULAR).map((stop) => (
              <StopRow key={stop.code} stop={stop} lineStyles={lineStyles} />
            ))}
          </Group>
        </>
      )}
    </div>
  )
}
