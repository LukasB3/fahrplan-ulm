import type { Alert } from '@api/types'
import type { LineStyle } from '@/lib/data-types'
import { Icon } from '@/shell/icons'
import { LineBadge } from '@/shell/LineBadge'

export type AlertLabels = { since: string; from: string; until: string; fromTo: string }

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '')

// "8. Juli", with the year when it is not this one.
const day = (iso: string, now: number) =>
  new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', timeZone: 'Europe/Berlin', ...(new Date(iso).getUTCFullYear() === new Date(now).getUTCFullYear() ? {} : { year: 'numeric' }) }).format(new Date(iso))

const period = (alert: Alert, now: number, labels: AlertLabels) => {
  const started = alert.from === null || Date.parse(alert.from) <= now
  if (alert.to) return started ? fill(labels.until, { date: day(alert.to, now) }) : fill(labels.fromTo, { from: day(alert.from!, now), to: day(alert.to, now) })
  if (!alert.from) return null
  return fill(started ? labels.since : labels.from, { date: day(alert.from, now) })
}

type Props = { alert: Alert; now: number; lineStyles: Record<string, LineStyle>; labels: AlertLabels; fresh?: boolean }

// One notice: lines, headline and how long it applies; the full text opens on a tap.
export function AlertCard({ alert, now, lineStyles, labels, fresh = false }: Props) {
  const applies = period(alert, now, labels)
  return (
    <li id={alert.id} className="scroll-mt-16 overflow-hidden rounded-card bg-surface">
      <details className="group">
        <summary className="pressable flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1">
              {alert.lines.map((line) => (
                <LineBadge key={line} line={line} style={lineStyles[line]} small />
              ))}
              {fresh && <span aria-hidden className="ml-1 size-2 rounded-full bg-tint" />}
            </span>
            <span className="mt-1.5 block font-semibold">{alert.title}</span>
            {applies && <span className="mt-0.5 block text-[0.8125rem] text-label-2">{applies}</span>}
          </span>
          <Icon name="chevron" className="mt-1 size-4 shrink-0 rotate-90 text-label-3 transition-transform group-open:-rotate-90 motion-reduce:transition-none" />
        </summary>
        <div className="space-y-2 border-t border-separator px-4 py-3 text-[0.9375rem] text-label-2">
          {alert.text.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </details>
    </li>
  )
}
