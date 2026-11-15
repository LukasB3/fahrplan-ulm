'use client'

import type { Departure, Run } from '@api/types'
import { useEffect, useState } from 'react'
import { getJson } from '@/lib/api'
import type { LineStyle } from '@/lib/data-types'
import { LineBadge } from '@/shell/LineBadge'
import { Sheet } from '@/shell/Sheet'

const POLL_MS = 30_000
const clock = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })

// A run as a sheet's title: its line and where it is going.
export function RunTitle({ line, style, towards, destination }: { line: string; style: LineStyle | undefined; towards: string; destination: string }) {
  return (
    <span className="flex items-center gap-2">
      <LineBadge line={line} style={style} />
      <span className="min-w-0 truncate">
        <span className="font-normal text-label-2">{towards} </span>
        {destination}
      </span>
    </span>
  )
}

type Call = { name: string; planned: string; expected: string | null }

// The stops of a run, each with the time the vehicle is there; a time that is
// late is shown as such. Without `stops` the list is still on its way. `here`
// sets the first stop apart: the one the run was opened at.
export function StopTimes({ stops, here = false }: { stops: Call[] | undefined; here?: boolean }) {
  return (
    <ol className="overflow-hidden rounded-card bg-bg">
      {(stops ?? []).map((stop, index) => {
        const late = stop.expected !== null && Date.parse(stop.expected) - Date.parse(stop.planned) >= 60_000
        return (
          <li key={`${stop.name} ${index}`} className={`flex min-h-10 items-center gap-3 border-t border-separator px-4 py-1.5 first:border-t-0 ${here && index === 0 ? 'font-semibold' : ''}`}>
            <span className={`w-12 shrink-0 tabular-nums ${late ? 'text-late' : ''}`}>{clock.format(new Date(stop.expected ?? stop.planned))}</span>
            <span className="min-w-0 flex-1 truncate">{stop.name}</span>
          </li>
        )
      })}
      {!stops && <li className="h-10 motion-safe:animate-pulse" />}
    </ol>
  )
}

export type RunLabels = { towards: string; stops: string; failed: string; close: string }

type Props = {
  stopId: number
  // The departure that was tapped. It stays while the sheet closes, so the sheet does not empty on its way out.
  departure: Departure | undefined
  open: boolean
  onClose: () => void
  lineStyles: Record<string, LineStyle>
  labels: RunLabels
}

// Where a departure goes from this stop on: every further stop with its time.
export function RunSheet({ stopId, departure, open, onClose, lineStyles, labels }: Props) {
  const [answer, setAnswer] = useState<{ to: Departure; run: Run | 'failed' }>()

  useEffect(() => {
    if (!departure || !open) return
    let live = true
    const query = new URLSearchParams({ stop: String(stopId), planned: departure.planned, line: departure.line, ...(departure.platformId ? { platform: departure.platformId } : {}) })
    const load = () =>
      getJson<Run>(`/api/run?${query}`).then(
        (run) => live && setAnswer({ to: departure, run }),
        // A failed refresh leaves the stops that are on screen.
        () => live && setAnswer((before) => (before?.to === departure && before.run !== 'failed' ? before : { to: departure, run: 'failed' })),
      )
    void load()
    const timer = window.setInterval(() => document.visibilityState === 'visible' && void load(), POLL_MS)
    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [stopId, departure, open])

  const run = answer && answer.to === departure ? answer.run : undefined
  // The first stop is this one: it shows the time of the row that was tapped, which is SWU's own for SWU's lines.
  const stops = run && run !== 'failed' && departure ? run.stops.map((stop, index) => (index === 0 ? { ...stop, planned: departure.planned, expected: departure.expected } : stop)) : undefined
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={departure && <RunTitle line={departure.line} style={departure.mode === 'train' ? undefined : lineStyles[departure.line]} towards={labels.towards} destination={departure.destination} />}
      closeLabel={labels.close}
    >
      {run === 'failed' ? (
        <p className="py-2 text-label-2">{labels.failed}</p>
      ) : (
        <section>
          <h3 className="pb-1 text-[0.8125rem] font-semibold text-label-2">{labels.stops}</h3>
          <StopTimes stops={stops} here />
        </section>
      )}
    </Sheet>
  )
}
