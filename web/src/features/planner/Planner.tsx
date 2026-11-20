'use client'

import type { AskNeed, AskResult, Journey, Place, TripRequest, Trips } from '@api/types'
import { useEffect, useRef, useState } from 'react'
import { postJson } from '@/lib/api'
import { locate, type LocateProblem } from '@/lib/geo'
import type { LineStyle } from '@/lib/data-types'
import { forgetHomeAndWork, rememberPlace } from '@/lib/store'
import { Icon } from '@/shell/icons'
import { AskBar } from './AskBar'
import { arrivesAt, fill, Journeys, leavesAt, type More, onFoot, type PlannerLabels, sameJourney } from './Journeys'
import { PlaceSearch } from './PlaceSearch'
import { setPlanner, usePlanner } from './state'

const REFRESH_MS = 45_000
const MINUTE = 60_000

// Journeys fetched on top of the first answer, for the search they belong to (`key`).
// `none` says where asking for more has brought nothing new.
type Extra = { key: string; earlier: Journey[]; later: Journey[]; loading: 'earlier' | 'later' | null; none: { earlier: boolean; later: boolean }; failed: boolean }
const noExtra = (key: string): Extra => ({ key, earlier: [], later: [], loading: null, none: { earlier: false, later: false }, failed: false })

type Props = { stops: Place[]; lineStyles: Record<string, LineStyle>; labels: PlannerLabels; privacyHref: string }
type Role = 'from' | 'to'

// A moment as the value of a date-and-time field, which works in the phone's own clock.
const toField = (iso: string) => {
  const moment = new Date(iso)
  return new Date(moment.getTime() - moment.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function Planner({ stops, lineStyles, labels, privacyHref }: Props) {
  const { from, to, time } = usePlanner()
  // What the last sentence left open, still to be settled, and what to say about it: `note` belongs
  // to the form (a question about a field, how a time was taken), `askNote` to the sentence itself.
  const [unsettled, setUnsettled] = useState<AskNeed[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [askNote, setAskNote] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ role: Role; query: string }>()
  const [result, setResult] = useState<{ key: string; trips?: Trips; skew: number; failed: boolean }>()
  const [extra, setExtra] = useState<Extra>()
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
  }, [editing?.role])

  useEffect(forgetHomeAndWork, [])

  // Settles what a sentence left open, one thing at a time: the position by
  // asking the phone, everything else by opening the field with what was said.
  const settle = ([need, ...rest]: AskNeed[]) => {
    setUnsettled(rest)
    if (!need) return
    if (need.why === 'position') {
      setNote(null)
      return void locate().then(
        (here) => {
          setPlanner({ [need.slot]: { kind: 'position', stop: null, name: labels.myLocation, town: null, ...here } })
          settle(rest)
        },
        (problem: LocateProblem) => {
          setNote(problem === 'denied' ? labels.locationDenied : labels.locationUnavailable)
          setEditing({ role: need.slot, query: '' })
        },
      )
    }
    // "Zuhause" and "Arbeit" are no places to search for: the field opens empty.
    const own = need.why === 'home' || need.why === 'work'
    setNote(need.why === 'home' ? labels.askNeedHome : need.why === 'work' ? labels.askNeedWork : need.why === 'missing' || !need.said ? labels.askNeedDestination : fill(labels.askNeedPlace, { said: need.said }))
    setEditing({ role: need.slot, query: own ? '' : (need.said ?? '') })
  }

  const understood = (result: AskResult) => {
    setEditing(undefined)
    setNote(null)
    if (result.status !== 'ok') return setAskNote(result.status === 'other' ? labels.askOther : result.status === 'limit' ? labels.askLimit : labels.askUnavailable)
    setAskNote(null)
    // The sentence field is the last thing in the planner; what it filled in is at the top.
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
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
    setEditing((role === 'from' ? to : from) ? undefined : { role: other, query: '' })
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
              placeholder={labels.searchPlaceholder}
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
          <button type="button" onClick={() => setEditing({ role, query: '' })} className="pressable min-w-0 flex-1 truncate py-3 pr-14 text-left">
            {place ? (
              <>
                {place.name}
                {place.town && place.town !== 'Ulm' && <span className="text-label-2"> · {place.town}</span>}
              </>
            ) : (
              <span className="text-label-2">{empty}</span>
            )}
          </button>
        )}
      </div>
    )
  }

  const shown = result && result.key === key ? result : undefined

  // The first answer stays; earlier and later journeys are added at its ends. A list that leaves
  // (the usual one) runs forward in time; one that arrives by a time starts with the latest to
  // take and runs backward, so there the later ones go on top.
  const more = extra && extra.key === key ? extra : key ? noExtra(key) : undefined
  const forward = time.mode === 'depart' || shown?.trips?.note === 'too_late'
  const first = shown?.trips?.journeys ?? []
  const known = new Set(first.map(sameJourney))
  const added = (found: Journey[]) => found.filter((journey) => !known.has(sameJourney(journey))).sort((a, b) => (forward ? leavesAt(a) - leavesAt(b) : leavesAt(b) - leavesAt(a)))
  const [earlier, later] = [added(more?.earlier ?? []), added(more?.later ?? [])]
  const listed = forward ? [...earlier, ...first, ...later] : [...later, ...first, ...earlier]

  const loadMore = async (direction: 'earlier' | 'later') => {
    if (!from || !to || !key || !more || more.loading) return
    // Walking is possible at any time; it does not say where the list ends.
    const rides = listed.some((journey) => !onFoot(journey)) ? listed.filter((journey) => !onFoot(journey)) : listed
    const request: TripRequest =
      direction === 'later'
        ? { from, to, time: { mode: 'depart', at: new Date(Math.max(...rides.map(leavesAt)) + MINUTE).toISOString() } }
        : // Earlier than a list that starts now is what has left already: the server lists that only when asked to.
          { from, to, time: { mode: 'arrive', at: new Date(Math.min(...rides.map(arrivesAt)) - MINUTE).toISOString() }, past: true }
    setExtra({ ...more, loading: direction, failed: false })
    try {
      const trips = await postJson<Trips>('/api/trips', request)
      const have = new Set(listed.map(sameJourney))
      // "Too late" means nothing gets there by then that has not left already: there is nothing earlier.
      const fresh = direction === 'earlier' && trips.note === 'too_late' ? [] : trips.journeys.filter((journey) => !onFoot(journey) && !have.has(sameJourney(journey)))
      // Unless the search has changed in the meantime: then this answer belongs to nothing on screen.
      setExtra((before) => (before?.key === key ? { ...before, loading: null, [direction]: [...before[direction], ...fresh], none: { ...before.none, [direction]: fresh.length === 0 } } : before))
    } catch {
      setExtra((before) => (before?.key === key ? { ...before, loading: null, failed: true } : before))
    }
  }

  const moreAt = (direction: 'earlier' | 'later'): More | undefined => {
    if (!more) return undefined
    if (more.none[direction]) return { none: direction === 'earlier' ? labels.noEarlier : labels.noLater }
    return { label: direction === 'earlier' ? labels.earlier : labels.later, busy: more.loading === direction, onMore: () => void loadMore(direction) }
  }

  return (
    <div className="space-y-4">
      {/* What to do, before the fields it is about. It stays while a place is searched, so the fields do not jump. */}
      {!key && <p className="px-4 text-label-2">{labels.hint}</p>}
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
        <>
          {/* What a sentence left open is asked here, next to the field that answers it. */}
          {note && (
            <p role="status" className="px-4 text-[0.9375rem]">
              {note}
            </p>
          )}
          <PlaceSearch query={editing.query} stops={stops} onPick={(place) => pick(editing.role, place)} labels={labels} />
        </>
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
          {note && (
            <p role="status" className="px-4 text-[0.9375rem]">
              {note}
            </p>
          )}
        </>
      )}

      {!editing && key && (
        <>
          {shown?.trips ? (
            <>
              <Journeys journeys={listed} note={shown.trips.note} skew={shown.skew} from={from!} to={to!} before={moreAt(forward ? 'earlier' : 'later')} after={moreAt(forward ? 'later' : 'earlier')} lineStyles={lineStyles} labels={labels} />
              {(shown.failed || more?.failed) && <p className="px-4 text-[0.8125rem] text-label-2">{labels.failed}</p>}
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

      {/* The form and what it found come first. The sentence, the other way to fill the form, is always the last thing in the planner, set apart as a part of its own. */}
      <AskBar
        // A position already chosen as the start is passed along, so "von hier" needs no second question.
        context={() => ({ position: from?.kind === 'position' ? { lat: from.lat, lon: from.lon } : null })}
        onResult={understood}
        note={askNote}
        privacyHref={privacyHref}
        labels={labels}
      />
    </div>
  )
}
