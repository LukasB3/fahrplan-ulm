'use client'

import { useFavourites, useSeenAlerts } from '@/lib/store'
import { concerns, useAlerts } from './store'

// The number on the alerts tab: alerts that concern a favourite stop and
// have not been on screen yet. Without favourites nothing is fetched.
export function AlertBadge({ label }: { label: string }) {
  const favourites = useFavourites()
  const seen = useSeenAlerts()
  const alerts = useAlerts(favourites.length > 0) ?? []
  const unseen = alerts.filter((alert) => !seen.includes(alert.id) && favourites.some((favourite) => concerns(alert, favourite))).length
  if (!unseen) return null
  return (
    <span aria-label={label.replace('{n}', String(unseen))} className="absolute top-1.5 left-1/2 ml-1.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-late-solid px-1 text-[0.6875rem] leading-none font-bold text-white tabular-nums">
      {unseen}
    </span>
  )
}
