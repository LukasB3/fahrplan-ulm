'use client'

import type { Departure, Departures } from '@api/types'
import { useEffect, useState } from 'react'
import { getJson } from '@/lib/api'
import type { LineStyle } from '@/lib/data-types'
import { LineBadge } from '@/shell/LineBadge'

export type BoardLabels = { now: string; minutes: string; platform: string; track: string; planned: string; none: string; failed: string; stale: string; loading: string }

type Props = { stopId: number; lineStyles: Record<string, LineStyle>; labels: BoardLabels; rows?: number }

const POLL_MS = 20_000
const clock = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })

function Row({ departure, now, lineStyles, labels }: { departure: Departure; now: number; lineStyles: Record<string, LineStyle>; labels: BoardLabels }) {
  const leaves = Date.parse(departure.expected ?? departure.planned)
  const minutes = Math.floor((leaves - now) / 60_000)
  const lateBy = departure.expected ? Math.round((leaves - Date.parse(departure.planned)) / 60_000) : 0
  const where = departure.platform && `${departure.mode === 'train' ? labels.track : labels.platform} ${departure.platform}`
  return (
    <li className="flex min-h-[3.75rem] items-center gap-3 border-t border-separator px-4 py-2 first:border-t-0">
      <span className="flex w-14 shrink-0 justify-start">
        <LineBadge line={departure.line} style={departure.mode === 'train' ? undefined : lineStyles[departure.line]} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{departure.destination}</span>
        <span className="block truncate text-[0.8125rem] text-label-2">
          {[where, departure.expected ? null : labels.planned].filter(Boolean).join(' · ')}
          {lateBy !== 0 && (
            <span className={lateBy > 0 ? 'text-late' : 'text-ok'}>
              {where ? ' · ' : ''}
              {lateBy > 0 ? '+' : '−'}
              {Math.abs(lateBy)} {labels.minutes}
            </span>
          )}
        </span>
      </span>
      {/* A departure without live data is grey: the time is the timetable's, not the vehicle's. */}
      <span className={`shrink-0 text-right tabular-nums ${departure.expected ? '' : 'text-label-2'}`}>
        {minutes < 1 ? (
          <span className="font-semibold">{labels.now}</span>
        ) : minutes < 60 ? (
          <>
            <span className="text-[1.375rem] leading-none font-semibold tracking-[-0.01em]">{minutes}</span> <span className="text-[0.8125rem] text-label-2">{labels.minutes}</span>
          </>
        ) : (
          <span className="font-semibold">{clock.format(leaves)}</span>
        )}
      </span>
    </li>
  )
}

// The live board of a stop. It asks again every 20 seconds while the page is
// on screen and counts down in between.
export function DepartureBoard({ stopId, lineStyles, labels, rows = 10 }: Props) {
  // `skew` is how far the phone's clock is off the server's.
  const [state, setState] = useState<{ board?: Departures; skew: number; failed: boolean }>({ skew: 0, failed: false })
  const [, setTick] = useState(0)

  useEffect(() => {
    let live = true
    let timer: number | undefined
    const load = async () => {
      try {
        const board = await getJson<Departures>(`/api/departures?stop=${stopId}&limit=${rows}`)
        if (live) setState({ board, skew: Date.parse(board.now) - Date.now(), failed: false })
      } catch {
        if (live) setState((before) => ({ ...before, failed: true }))
      }
    }
    const follow = () => {
      window.clearInterval(timer)
      if (document.visibilityState !== 'visible') return
      void load()
      timer = window.setInterval(() => void load(), POLL_MS)
    }
    follow()
    document.addEventListener('visibilitychange', follow)
    return () => {
      live = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', follow)
    }
  }, [stopId, rows])

  useEffect(() => {
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 10_000)
    return () => window.clearInterval(timer)
  }, [])

  const { board, skew, failed } = state
  const now = Date.now() + skew
  const upcoming = board?.departures.filter((departure) => Date.parse(departure.expected ?? departure.planned) > now - 60_000)

  if (!upcoming) {
    if (failed) return <p className="rounded-card bg-surface px-4 py-6 text-center text-label-2">{labels.failed}</p>
    // Placeholder rows of the board's height, so the page below does not jump when it arrives.
    return (
      <ol aria-busy aria-label={labels.loading} className="overflow-hidden rounded-card bg-surface">
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className="flex min-h-[3.75rem] items-center gap-3 border-t border-separator px-4 first:border-t-0">
            <span className="h-6 w-8 rounded-full bg-fill motion-safe:animate-pulse" />
            <span className="h-4 flex-1 rounded bg-fill motion-safe:animate-pulse" />
            <span className="h-5 w-10 rounded bg-fill motion-safe:animate-pulse" />
          </li>
        ))}
      </ol>
    )
  }

  return (
    <>
      {upcoming.length === 0 ? (
        <p className="rounded-card bg-surface px-4 py-6 text-center text-label-2">{labels.none}</p>
      ) : (
        <ol className="overflow-hidden rounded-card bg-surface">
          {upcoming.map((departure, index) => (
            <Row key={`${departure.line} ${departure.destination} ${departure.planned} ${index}`} departure={departure} now={now} lineStyles={lineStyles} labels={labels} />
          ))}
        </ol>
      )}
      {(failed || board?.stale) && <p className="px-4 pt-2 text-[0.8125rem] text-label-2">{failed ? labels.failed : labels.stale}</p>}
    </>
  )
}
