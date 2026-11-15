'use client'

import Link from 'next/link'
import { useAlerts, concerns } from './store'
import { Icon } from '@/shell/icons'

type Props = {
  // Either a stop, or a line by what is written on the vehicle.
  about: { dhid: string; lines: string[] } | { line: string }
  // Where all alerts are listed; each notice links to itself there.
  href: string
  heading: string
}

// The alerts that concern this stop or line, as short links to the full
// notices. Shows nothing while there are none.
export function RelevantAlerts({ about, href, heading }: Props) {
  const relevant = (useAlerts() ?? []).filter((alert) => ('line' in about ? alert.lines.includes(about.line) : concerns(alert, about)))
  if (!relevant.length) return null
  return (
    <section aria-label={heading} className="overflow-hidden rounded-card bg-surface">
      <ul>
        {relevant.map((alert) => (
          <li key={alert.id} className="border-t border-separator first:border-t-0">
            <Link href={`${href}#${alert.id}`} className="pressable flex min-h-11 items-center gap-3 px-4 py-2.5">
              <Icon name="alerts" active className="size-5 shrink-0 text-late" />
              <span className="min-w-0 flex-1 text-[0.9375rem]">{alert.title}</span>
              <Icon name="chevron" className="size-4 shrink-0 text-label-3" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
