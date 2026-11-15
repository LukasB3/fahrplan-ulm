import Link from 'next/link'
import type { CSSProperties } from 'react'
import { RelevantAlerts } from '@/features/alerts/RelevantAlerts'
import { lineStyles, stopByCode } from '@/lib/data'
import type { DayType, Line } from '@/lib/data-types'
import { t, type Locale } from '@/lib/i18n'
import { href, lineHref, stopHref } from '@/lib/routes'
import { SITE_ORIGIN } from '@/lib/seo'
import { JsonLd } from '@/shell/JsonLd'
import { LineBadge } from '@/shell/LineBadge'
import { ScreenHeader } from '@/shell/ScreenHeader'
import { groupHeading } from '@/shell/styles'

const DAY_ORDER: DayType[] = ['mofr', 'moth', 'fr', 'sa', 'su']

export function LineScreen({ locale, line }: { locale: Locale; line: Line }) {
  const { line: copy, stop: stopCopy, site, hubs, alerts } = t(locale)
  const url = `${SITE_ORIGIN}${lineHref(locale, line.id)}`

  return (
    <>
      <ScreenHeader locale={locale} title={copy.heading(line.id)} back={{ href: href(locale, 'lines'), label: copy.back }} />
      <main className="space-y-7 px-4">
        <p className="-mt-2 flex items-center gap-2 text-label-2">
          <LineBadge line={line.id} style={lineStyles[line.id]} />
          <span>
            {copy.kinds[line.kind]} · {line.name}
          </span>
        </p>

        <RelevantAlerts about={{ line: line.id }} href={href(locale, 'alerts')} heading={alerts.forLine} />

        {line.directions.map((direction) => (
          <section key={direction.headsign}>
            <h2 className={groupHeading}>
              {copy.towards} {direction.headsign}
            </h2>
            <div className="space-y-4 rounded-card bg-surface p-4">
              <p className="text-label-2">{[copy.stops(direction.stops.length), direction.everyMinutes && copy.every(direction.everyMinutes)].filter(Boolean).join(' · ')}</p>

              <table className="w-full border-collapse text-[0.9375rem] tabular-nums">
                <caption className="pb-1 text-left text-[0.8125rem] font-semibold text-label-2">{copy.service}</caption>
                <tbody>
                  {DAY_ORDER.filter((day) => direction.days[day]).map((day) => (
                    <tr key={day} className="border-t border-separator">
                      <th scope="row" className="w-16 py-1.5 text-left font-semibold">
                        {stopCopy.days[day]}
                      </th>
                      <td className="py-1.5">{stopCopy.firstLast(direction.days[day]!.first, direction.days[day]!.last)}</td>
                      <td className="py-1.5 text-right text-label-2">{copy.trips(direction.days[day]!.trips)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* The run as a line with a dot per stop, in the line's colour. */}
              <ol style={{ '--line': line.color } as CSSProperties}>
                {direction.stops.map((code, index) => {
                  const stop = stopByCode(code)!
                  return (
                    <li
                      key={`${code} ${index}`}
                      className="relative pl-7 before:absolute before:top-0 before:bottom-0 before:left-[0.3125rem] before:w-0.5 before:bg-(--line) first:before:top-1/2 last:before:bottom-1/2 after:absolute after:top-1/2 after:left-0 after:size-3 after:-translate-y-1/2 after:rounded-full after:border-2 after:border-(--line) after:bg-surface"
                    >
                      <Link href={stopHref(locale, stop.slug)} prefetch={false} className="pressable flex min-h-11 items-center">
                        {stop.name}
                      </Link>
                    </li>
                  )
                })}
              </ol>
            </div>
          </section>
        ))}
      </main>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: site.name, item: `${SITE_ORIGIN}${href(locale, 'route')}` },
            { '@type': 'ListItem', position: 2, name: hubs.linesTitle, item: `${SITE_ORIGIN}${href(locale, 'lines')}` },
            { '@type': 'ListItem', position: 3, name: copy.heading(line.id), item: url },
          ],
        }}
      />
    </>
  )
}
