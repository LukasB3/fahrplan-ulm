'use client'

import type { Departure, Run } from '@api/types'
import { type CSSProperties, useEffect, useState } from 'react'
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

// How many minutes off the timetable a vehicle is at a stop, by the minutes the
// clock shows: above zero late, below zero early. Nothing without live data.
export const minutesOff = (stop: Call | undefined) => (stop?.expected ? Math.floor(Date.parse(stop.expected) / 60_000) - Math.floor(Date.parse(stop.planned) / 60_000) : undefined)

export type TimesLabels = { planned: string; live: string }

const timeColumn = 'w-[2.875rem] shrink-0 tabular-nums'

// The stops of a run along its line, each with two times: the timetable's and,
// beside it, the one the vehicle is running to. A time that is not kept is
// struck out, and the live one says how: red when late, green when on time or
// early. A run without live data shows the timetable alone. Without `stops`
// the list is still on its way. `here` sets the first stop apart: the one the
// run was opened at.
export function StopTimes({ stops, here = false, color, labels }: { stops: Call[] | undefined; here?: boolean; color?: string; labels: TimesLabels }) {
  const live = stops?.some((stop) => stop.expected !== null) ?? false
  return (
    <div className="overflow-hidden rounded-card bg-bg px-4 py-1.5" style={color ? ({ '--rail': color } as CSSProperties) : undefined}>
      {live && (
        <p aria-hidden className="flex gap-2 pt-1 pb-0.5 text-[0.75rem] font-semibold text-label-2">
          <span className={timeColumn}>{labels.planned}</span>
          <span className={timeColumn}>{labels.live}</span>
        </p>
      )}
      <ol>
        {(stops ?? []).map((stop, index) => {
          const off = minutesOff(stop)
          return (
            <li key={`${stop.name} ${index}`} className={`flex min-h-10 items-center gap-2 ${here && index === 0 ? 'font-semibold' : ''}`}>
              <span className={`${timeColumn} ${live ? 'text-label-2' : ''} ${off ? 'line-through' : ''}`}>
                {live && <span className="sr-only">{labels.planned} </span>}
                {clock.format(new Date(stop.planned))}
              </span>
              {live && (
                <span className={`${timeColumn} ${off === undefined ? 'text-label-2' : off > 0 ? 'font-semibold text-late' : off < 0 ? 'font-semibold text-ok' : 'text-ok'}`}>
                  {stop.expected ? (
                    <>
                      <span className="sr-only">{labels.live} </span>
                      {clock.format(new Date(stop.expected))}
                    </>
                  ) : (
                    '–'
                  )}
                </span>
              )}
              <span className="rail" data-from={here ? '' : undefined} />
              <span className="min-w-0 flex-1 truncate py-1.5 pl-1">{stop.name}</span>
            </li>
          )
        })}
        {!stops && <li className="h-10 motion-safe:animate-pulse" />}
      </ol>
    </div>
  )
}

export type RunLabels = { towards: string; stops: string; failed: string; close: string } & TimesLabels

// Where a departure goes from this stop on: every further stop with its time,
// asked again every 30 seconds while `active`. Shown in its own sheet on a stop's
// page and inside the stop's sheet on the map.
export function RunStops({ stopId, departure, active = true, lineStyles, labels }: { stopId: number; departure: Departure | undefined; active?: boolean; lineStyles: Record<string, LineStyle>; labels: Omit<RunLabels, 'towards' | 'close'> }) {
  const [answer, setAnswer] = useState<{ to: Departure; run: Run | 'failed' }>()

  useEffect(() => {
    if (!departure || !active) return
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
  }, [stopId, departure, active])

  const run = answer && answer.to === departure ? answer.run : undefined
  // The first stop is this one: it shows the time of the row that was tapped, which is SWU's own for SWU's lines.
  const stops = run && run !== 'failed' && departure ? run.stops.map((stop, index) => (index === 0 ? { ...stop, planned: departure.planned, expected: departure.expected } : stop)) : undefined
  return run === 'failed' ? (
    <p className="py-2 text-label-2">{labels.failed}</p>
  ) : (
    <section>
      <h3 className="pb-1 text-[0.8125rem] font-semibold text-label-2">{labels.stops}</h3>
      <StopTimes stops={stops} here color={departure && departure.mode !== 'train' ? lineStyles[departure.line]?.color : undefined} labels={labels} />
    </section>
  )
}

type Props = {
  stopId: number
  // The departure that was tapped. It stays while the sheet closes, so the sheet does not empty on its way out.
  departure: Departure | undefined
  open: boolean
  onClose: () => void
  lineStyles: Record<string, LineStyle>
  labels: RunLabels
}

export function RunSheet({ stopId, departure, open, onClose, lineStyles, labels }: Props) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={departure && <RunTitle line={departure.line} style={departure.mode === 'train' ? undefined : lineStyles[departure.line]} towards={labels.towards} destination={departure.destination} />}
      closeLabel={labels.close}
    >
      <RunStops stopId={stopId} departure={departure} active={open} lineStyles={lineStyles} labels={labels} />
    </Sheet>
  )
}
