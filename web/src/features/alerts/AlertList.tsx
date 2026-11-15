'use client'

import type { Alert } from '@api/types'
import { useEffect, useState } from 'react'
import type { LineStyle } from '@/lib/data-types'
import { markAlertsSeen, useFavourites, useSeenAlerts } from '@/lib/store'
import { groupHeading } from '@/shell/styles'
import { AlertCard, type AlertLabels } from './AlertCard'
import { concerns, useAlerts } from './store'

type Props = {
  // The alerts the page was built with; newer ones replace them once fetched.
  initial: Alert[]
  // The moment the page was built, so server and browser write the same dates.
  builtAt: number
  lineStyles: Record<string, LineStyle>
  labels: AlertLabels & { yours: string; all: string; none: string }
}

export function AlertList({ initial, builtAt, lineStyles, labels }: Props) {
  const alerts = useAlerts() ?? initial
  const favourites = useFavourites()
  const seen = useSeenAlerts()
  // What was new when the page was opened keeps its dot until the page is left.
  const [seenBefore] = useState(() => new Set(seen))
  const [now, setNow] = useState(builtAt)
  useEffect(() => setNow(Date.now()), [])

  // Having the list on screen is having seen it.
  useEffect(() => {
    if (alerts.length) markAlertsSeen(alerts.map((alert) => alert.id))
  }, [alerts])

  if (!alerts.length) return <p className="rounded-card bg-surface px-4 py-6 text-center text-label-2">{labels.none}</p>

  const yours = alerts.filter((alert) => favourites.some((favourite) => concerns(alert, favourite)))
  const others = alerts.filter((alert) => !yours.includes(alert))
  const cards = (list: Alert[], markFresh: boolean) =>
    list.map((alert) => <AlertCard key={alert.id} alert={alert} now={now} lineStyles={lineStyles} labels={labels} fresh={markFresh && seen.length > 0 && !seenBefore.has(alert.id)} />)

  return (
    <div className="space-y-6">
      {yours.length > 0 && (
        <section>
          <h2 className={groupHeading}>{labels.yours}</h2>
          <ul className="space-y-3">{cards(yours, true)}</ul>
        </section>
      )}
      <section>
        {yours.length > 0 && <h2 className={groupHeading}>{labels.all}</h2>}
        <ul className="space-y-3">{cards(others, false)}</ul>
      </section>
    </div>
  )
}
