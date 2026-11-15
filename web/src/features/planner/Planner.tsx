'use client'

import type { AskNeed, AskResult, Place, TripRequest, Trips } from '@api/types'
import { useEffect, useRef, useState } from 'react'
import { postJson } from '@/lib/api'
import type { LineStyle } from '@/lib/data-types'
import { rememberPlace, useSavedPlaces } from '@/lib/store'
import { Icon } from '@/shell/icons'
import { AskBar } from './AskBar'
import { fill, Journeys, type PlannerLabels } from './Journeys'
import { PlaceSearch } from './PlaceSearch'
import { setPlanner, usePlanner } from './state'

const REFRESH_MS = 45_000

type Props = { stops: Place[]; lineStyles: Record<string, LineStyle>; labels: PlannerLabels; privacyHref: string }
type Role = 'from' | 'to'

// A moment as the value of a date-and-time field, which works in the phone's own clock.
const toField = (iso: string) => {
  const moment = new Date(iso)
  return new Date(moment.getTime() - moment.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function Planner({ stops, lineStyles, labels, privacyHref }: Props) {
  const { from, to, time } = usePlanner()
  const saved = useSavedPlaces()
  // What the last sentence left open, still to be settled, and what to say about it.
  const [unsettled, setUnsettled] = useState<AskNeed[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ role: Role; query: string; saving: 'home' | 'work' | null }>()
  const [result, setResult] = useState<{ key: string; trips?: Trips; skew: number; failed: boolean }>()
  const input = useRef<HTMLInputElement>(null)

  const key = from && to ? JSON.stringify([from, to, time]) : undefined

  useEffect(() => {
    if (!from || !to || !key) return
    let live = true
    let timer: number | undefined
    const request: TripRequest = { from, to, time }
    const load = async () => {
      try {
        const trips = await postJson<Trips>('/api/trips', request)
        if (live) setResult({ key, trips, skew: Date.parse(trips.now) - Date.now(), failed: false })
      } catch {
        // Keep showing what was found before; a failed refresh is no reason to empty the list.
        if (live) setResult((before) => (before?.key === key ? { ...before, failed: true } : { key, skew: 0, failed: true }))
      }
    }
    // "Now" moves on: ask again while the page is on screen. A chosen time stays as it is.
    const follow = () => {
      window.clearInterval(timer)
      if (document.visibilityState !== 'visible') return
      void load()
      if (time.at === null) timer = window.setInterval(() => void load(), REFRESH_MS)
    }
    follow()
    document.addEventListener('visibilitychange', follow)
    return () => {
      live = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', follow)
    }
    // `key` stands for from, to and time.
  }, [key])

  useEffect(() => {
    if (editing) input.current?.focus()
  }, [editing?.role, editing?.saving])

  // Settles what a sentence left open, one thing at a time: the position by
  // asking the phone, everything else by opening the field with what was said.
  const settle = ([need, ...rest]: AskNeed[]) => {
    setUnsettled(rest)
    if (!need) return
    if (need.why === 'position') {
      setNote(null)
      return navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          setPlanner({ [need.slot]: { kind: 'position', stop: null, name: labels.myLocation, town: null, lat: coords.latitude, lon: coords.longitude } })
          settle(rest)
        },
        () => {
          setNote(labels.askNeedPosition)
          setEditing({ role: need.slot, query: '', saving: null })
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
      )
    }
    const saving = need.why === 'home' || need.why === 'work' ? need.why : null
    setNote(need.why === 'home' ? labels.askNeedHome : need.why === 'work' ? labels.askNeedWork : need.why === 'missing' || !need.said ? labels.askNeedDestination : fill(labels.askNeedPlace, { said: need.said }))
    setEditing({ role: need.slot, query: saving ? '' : (need.said ?? ''), saving })
  }

  const understood = (result: AskResult) => {
    setEditing(undefined)
    if (result.status !== 'ok') return setNote(result.status === 'other' ? labels.askOther : result.status === 'limit' ? labels.askLimit : labels.askUnavailable)
    // The server knows the position only as numbers; here it gets its name.
    const named = (place: Place | null) => (place?.kind === 'position' ? { ...place, name: labels.myLocation } : place)
    setPlanner({ from: named(result.from), to: named(result.to), time: result.time })
    setNote(result.timeAssumed ? labels.askAssumed : null)
    settle(result.needs)
  }

  const pick = (role: Role, place: Place) => {
    rememberPlace(place)
    setPlanner({ [role]: place })
    setNote(null)
    if (unsettled.length) {
      setEditing(undefined)
      return settle(unsettled)
    }
    // Straight on to the other field while it is still empty.
    const other: Role = role === 'from' ? 'to' : 'from'
    setEditing((role === 'from' ? to : from) ? undefined : { role: other, query: '', saving: null })
  }

  const field = (role: Role) => {
    const place = role === 'from' ? from : to
    const [label, empty] = role === 'from' ? [labels.from, labels.fromEmpty] : [labels.to, labels.toEmpty]
    const active = editing?.role === role
    return (
      <div className="flex min-h-[3.25rem] items-center gap-3 pl-4">
        <span className="w-10 shrink-0 text-[0.9375rem] text-label-2">{label}</span>
        {active ? (
          <>
            <input
              ref={input}
              type="search"
              value={editing.query}
              onChange={(event) => setEditing({ ...editing, query: event.target.value })}
              placeholder={editing.saving === 'home' ? labels.homePlaceholder : editing.saving === 'work' ? labels.workPlaceholder : labels.searchPlaceholder}
              aria-label={label}
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-label-3 [&::-webkit-search-cancel-button]:hidden"
            />
            <button
              type="button"
              onClick={() => {
                setEditing(undefined)
                setUnsettled([])
                setNote(null)
              }}
              className="pressable flex min-h-11 shrink-0 items-center px-4 text-tint"
            >
              {labels.cancel}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setEditing({ role, query: '', saving: null })} className="pressable min-w-0 flex-1 truncate py-3 pr-14 text-left">
            {place ? (
              <>
                {place.name}
                {place.town && place.town !== 'Ulm' && <span className="text-label-2"> · {place.town}</span>}
              </>
            ) : (
              <span className="text-label-3">{empty}</span>
            )}
          </button>
        )}
      </div>
    )
  }

  const shown = result && result.key === key ? result : undefined

  return (
    <div className="space-y-4">
      <AskBar
        // A position already chosen as the start is passed along, so "von hier" needs no second question.
        context={() => ({ position: from?.kind === 'position' ? { lat: from.lat, lon: from.lon } : null, saved: { home: saved.home ?? null, work: saved.work ?? null } })}
        onResult={understood}
        note={note}
        privacyHref={privacyHref}
        labels={labels}
      />
      <div className="relative rounded-card bg-surface">
        {field('from')}
        <div className="mr-14 ml-4 border-t border-separator" />
        {field('to')}
        {!editing && (
          <button type="button" aria-label={labels.swap} onClick={() => setPlanner({ from: to, to: from })} className="pressable absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-tint">
            <Icon name="swap" />
          </button>
        )}
      </div>

      {editing ? (
        <PlaceSearch query={editing.query} stops={stops} saving={editing.saving} onSaving={(saving) => setEditing({ ...editing, query: '', saving })} onPick={(place) => pick(editing.role, place)} labels={labels} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label={labels.time} className="flex rounded-full bg-fill p-0.5">
              {(['depart', 'arrive'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={time.mode === mode}
                  onClick={() => setPlanner({ time: { ...time, mode } })}
                  className={`pressable min-h-9 rounded-full px-4 text-[0.9375rem] font-semibold ${time.mode === mode ? 'bg-surface shadow-sm' : 'text-label-2'}`}
                >
                  {mode === 'depart' ? labels.depart : labels.arrive}
                </button>
              ))}
            </div>
            {time.at === null ? (
              // The date field appears once a time other than now is wanted.
              <button type="button" onClick={() => setPlanner({ time: { ...time, at: new Date(Math.ceil(Date.now() / 300_000) * 300_000).toISOString() } })} className="pressable min-h-10 rounded-full bg-fill px-4 text-[0.9375rem] font-semibold text-tint">
                {labels.now}
              </button>
            ) : (
              <>
                <input
                  type="datetime-local"
                  aria-label={labels.time}
                  value={toField(time.at)}
                  onChange={(event) => setPlanner({ time: { ...time, at: event.target.value ? new Date(event.target.value).toISOString() : null } })}
                  className="min-h-10 rounded-full bg-fill px-3 text-[0.9375rem] tabular-nums"
                />
                <button type="button" onClick={() => setPlanner({ time: { ...time, at: null } })} className="pressable min-h-10 px-2 text-[0.9375rem] text-tint">
                  {labels.now}
                </button>
              </>
            )}
          </div>

          {!key ? (
            <p className="px-4 text-label-2">{labels.hint}</p>
          ) : shown?.trips ? (
            <>
              <Journeys trips={shown.trips} skew={shown.skew} from={from!} to={to!} onLater={(after) => setPlanner({ time: { mode: 'depart', at: new Date(after + 60_000).toISOString() } })} lineStyles={lineStyles} labels={labels} />
              {shown.failed && <p className="px-4 text-[0.8125rem] text-label-2">{labels.failed}</p>}
            </>
          ) : shown?.failed ? (
            <p className="rounded-card bg-surface px-4 py-6 text-center text-label-2">{labels.failed}</p>
          ) : (
            <ol aria-busy aria-label={labels.loading} className="space-y-3">
              {[0, 1, 2].map((index) => (
                <li key={index} className="h-[6.75rem] rounded-card bg-surface p-4">
                  <span className="block h-6 w-36 rounded bg-fill motion-safe:animate-pulse" />
                  <span className="mt-3 block h-5 w-24 rounded bg-fill motion-safe:animate-pulse" />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}
