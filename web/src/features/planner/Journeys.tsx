'use client'

import type { Journey, Leg, Place, Stopover, Trips } from '@api/types'
import { useState } from 'react'
import type { LineStyle } from '@/lib/data-types'
import type { Messages } from '@/lib/i18n'
import { Icon } from '@/shell/icons'
import { LineBadge } from '@/shell/LineBadge'
import { WalkMap } from './WalkMap'

export type PlannerLabels = Messages['planner']

const MINUTE = 60_000
const clock = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
const euros = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

export const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''))

const at = (stopover: Stopover) => Date.parse(stopover.expected ?? stopover.planned)
const minutesBetween = (from: number, to: number) => Math.max(0, Math.round((to - from) / MINUTE))
const lateBy = (stopover: Stopover) => (stopover.expected ? Math.round((Date.parse(stopover.expected) - Date.parse(stopover.planned)) / MINUTE) : 0)

const lasting = (minutes: number, labels: PlannerLabels) => (minutes < 60 ? `${minutes} ${labels.minutes}` : `${Math.floor(minutes / 60)} ${labels.hours} ${minutes % 60} ${labels.minutes}`)

type Shared = { lineStyles: Record<string, LineStyle>; labels: PlannerLabels }

function When({ stopover }: { stopover: Stopover }) {
  const late = lateBy(stopover)
  return (
    <span className="w-12 shrink-0 tabular-nums">
      <span className={late > 0 ? 'text-late' : undefined}>{clock.format(at(stopover))}</span>
    </span>
  )
}

function Where({ stopover, name, train, labels }: { stopover: Stopover; name: string; train: boolean; labels: PlannerLabels }) {
  const late = lateBy(stopover)
  return (
    <span className="min-w-0 flex-1">
      {name}
      <span className="text-label-2">
        {stopover.platform && ` · ${train ? labels.track : labels.platform} ${stopover.platform}`}
        {late > 0 && <span className="text-late"> · +{late} {labels.minutes}</span>}
        {!stopover.expected && ` · ${labels.planned}`}
      </span>
    </span>
  )
}

// One leg written out: a walk with its map, or a ride with where to get on and off.
function LegDetail({ leg, fromName, toName, showMap, lineStyles, labels }: { leg: Leg; fromName: string; toName: string; showMap: boolean } & Shared) {
  if (leg.kind === 'walk') {
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-3">
          <span className="flex w-12 shrink-0 justify-start text-label-2">
            <Icon name="walk" className="size-5" />
          </span>
          <span>
            {labels.walk}
            <span className="text-label-2">
              {' '}
              · {fill(labels.metres, { n: leg.metres })} · {lasting(minutesBetween(at(leg.from), at(leg.to)), labels)}
            </span>
          </span>
        </p>
        {showMap && <WalkMap path={leg.path} label={labels.mapLabel} credit={labels.mapCredit} />}
      </div>
    )
  }
  const train = leg.mode === 'train'
  const between = leg.stopsBetween === 0 ? labels.noStopsBetween : leg.stopsBetween === 1 ? labels.oneStopBetween : fill(labels.stopsBetween, { n: leg.stopsBetween })
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-3">
        <span className="flex w-12 shrink-0 justify-start">
          <LineBadge line={leg.line} style={train ? undefined : lineStyles[leg.line]} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-label-2">{labels.towards} </span>
          {leg.destination}
        </span>
      </p>
      <p className="flex gap-3">
        <When stopover={leg.from} />
        <Where stopover={leg.from} name={fromName} train={train} labels={labels} />
      </p>
      <p className="flex gap-3 text-[0.8125rem] text-label-2">
        <span className="w-12 shrink-0" />
        {between} · {lasting(minutesBetween(at(leg.from), at(leg.to)), labels)}
      </p>
      <p className="flex gap-3">
        <When stopover={leg.to} />
        <Where stopover={leg.to} name={toName} train={train} labels={labels} />
      </p>
    </div>
  )
}

type CardProps = { journey: Journey; now: number; from: Place; to: Place; open: boolean; onToggle: () => void } & Shared

function JourneyCard({ journey, now, from, to, open, onToggle, lineStyles, labels }: CardProps) {
  const { legs } = journey
  const [first, last] = [legs[0]!, legs.at(-1)!]
  const [leaves, arrives] = [at(first.from), at(last.to)]
  const untilLeaving = Math.floor((leaves - now) / MINUTE)
  const rides = legs.filter((leg) => leg.kind === 'ride')
  // The ends are called what the person chose, not what the planner makes of a position.
  const nameAt = (index: number, end: 'from' | 'to') =>
    index === 0 && end === 'from' && from.kind !== 'stop' ? from.name : index === legs.length - 1 && end === 'to' && to.kind !== 'stop' ? to.name : legs[index]![end].name

  return (
    <li className="overflow-hidden rounded-card bg-surface">
      <button type="button" aria-expanded={open} onClick={onToggle} className="pressable block w-full px-4 py-3 text-left">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[1.375rem] leading-tight font-semibold tracking-[-0.01em] tabular-nums">
            <span className={lateBy(first.from) > 0 ? 'text-late' : undefined}>{clock.format(leaves)}</span> – {clock.format(arrives)}
          </span>
          <span className="shrink-0 text-label-2 tabular-nums">{lasting(minutesBetween(leaves, arrives), labels)}</span>
        </span>

        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          {rides.length === 0 && (
            <span className="flex items-center gap-1 text-label-2">
              <Icon name="walk" className="size-[1.125rem]" />
              {labels.walkOnly}
            </span>
          )}
          {/* A journey on foot needs no chain of legs. */}
          {(rides.length ? legs : []).map((leg, index) => (
            <span key={index} className="flex items-center gap-1.5">
              {index > 0 && <Icon name="chevron" className="size-3 text-label-3" />}
              {leg.kind === 'walk' ? (
                <span className="flex items-center gap-0.5 text-[0.8125rem] text-label-2 tabular-nums">
                  <Icon name="walk" className="size-[1.125rem]" />
                  {minutesBetween(at(leg.from), at(leg.to))}
                </span>
              ) : (
                <LineBadge line={leg.line} style={leg.mode === 'train' ? undefined : lineStyles[leg.line]} />
              )}
            </span>
          ))}
        </span>

        <span className="mt-2 flex items-center justify-between gap-3 text-[0.9375rem]">
          <span className="min-w-0">
            <span className={untilLeaving < 10 ? 'font-semibold text-tint' : undefined}>
              {untilLeaving < 1 ? labels.leaveNow : untilLeaving < 60 ? fill(labels.leaveIn, { n: untilLeaving }) : fill(labels.leaveAt, { time: clock.format(leaves) })}
            </span>
            <span className="text-label-2">
              {rides.length > 0 && ` · ${journey.changes === 0 ? labels.direct : journey.changes === 1 ? labels.oneChange : fill(labels.changes, { n: journey.changes })}`}
              {journey.fare !== null && ` · ${fill(labels.fareFrom, { price: euros.format(journey.fare) })}`}
            </span>
          </span>
          <Icon name="chevron" className={`size-4 shrink-0 text-label-3 transition-transform motion-reduce:transition-none ${open ? '-rotate-90' : 'rotate-90'}`} />
        </span>
      </button>

      {/* The maps load only once a journey is opened: every tile is a request to the map service. */}
      {open && (
        <ol className="space-y-4 border-t border-separator px-4 py-4">
          {legs.map((leg, index) => {
            const next = legs[index + 1]
            const wait = next && leg.kind === 'ride' && next.kind === 'ride' ? minutesBetween(at(leg.to), at(next.from)) : undefined
            return (
              <li key={index} className="space-y-4">
                <LegDetail leg={leg} fromName={nameAt(index, 'from')} toName={nameAt(index, 'to')} showMap={index === 0 || index === legs.length - 1} lineStyles={lineStyles} labels={labels} />
                {wait !== undefined && (
                  <p className="flex gap-3 text-[0.8125rem] text-label-2">
                    <span className="w-12 shrink-0" />
                    {labels.changeHere} · {fill(labels.wait, { n: wait })}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </li>
  )
}

type Props = { trips: Trips; skew: number; from: Place; to: Place; onLater: (after: number) => void } & Shared

export function Journeys({ trips, skew, from, to, onLater, lineStyles, labels }: Props) {
  const [open, setOpen] = useState<number | null>(null)
  const now = Date.now() + skew
  if (!trips.journeys.length) return <p className="rounded-card bg-surface px-4 py-6 text-center text-label-2">{labels.none}</p>

  return (
    <div className="space-y-3">
      {trips.note === 'too_late' && <p className="px-4 text-[0.9375rem] text-late">{labels.tooLate}</p>}
      <ol className="space-y-3">
        {trips.journeys.map((journey, index) => (
          <JourneyCard key={`${at(journey.legs[0]!.from)} ${index}`} journey={journey} now={now} from={from} to={to} open={open === index} onToggle={() => setOpen(open === index ? null : index)} lineStyles={lineStyles} labels={labels} />
        ))}
      </ol>
      <button type="button" onClick={() => onLater(Math.max(...trips.journeys.map((journey) => at(journey.legs[0]!.from))))} className="pressable mx-auto flex min-h-11 items-center px-4 font-semibold text-tint">
        {labels.later}
      </button>
    </div>
  )
}
