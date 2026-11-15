import Link from 'next/link'
import { StopRow } from '@/features/departures/StopRow'
import { lines, lineStyles, stops } from '@/lib/data'
import type { LineKind } from '@/lib/data-types'
import { t, type Locale } from '@/lib/i18n'
import { href, lineHref } from '@/lib/routes'
import { Icon } from '@/shell/icons'
import { LineBadge } from '@/shell/LineBadge'
import { ScreenHeader } from '@/shell/ScreenHeader'
import { groupHeading } from '@/shell/styles'
import { listed } from './StopScreen'

// "Ä" files under "A", as in a German index.
const initial = (name: string) => name[0]!.normalize('NFD')[0]!.toUpperCase()

export function StopsHubScreen({ locale }: { locale: Locale }) {
  const { hubs, tabs } = t(locale)
  const letters = [...new Set(stops.map((entry) => initial(entry.name)))]
  return (
    <>
      <ScreenHeader locale={locale} title={hubs.stopsHeading} crumb={hubs.stopsTitle} back={{ href: href(locale, 'departures'), label: tabs.departures }} />
      <main className="space-y-6 px-4">
        {letters.map((letter) => (
          <section key={letter}>
            <h2 className={groupHeading}>{letter}</h2>
            <ul className="overflow-hidden rounded-card bg-surface">
              {stops
                .filter((entry) => initial(entry.name) === letter)
                .map((entry) => (
                  // 236 links: fetching each page ahead would be wasted.
                  <StopRow key={entry.code} stop={listed(locale, entry)} lineStyles={lineStyles} prefetch={false} />
                ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  )
}

const KINDS: LineKind[] = ['tram', 'bus', 'night']

export function LinesHubScreen({ locale }: { locale: Locale }) {
  const { hubs, line: copy, tabs } = t(locale)
  return (
    <>
      <ScreenHeader locale={locale} title={hubs.linesHeading} crumb={hubs.linesTitle} back={{ href: href(locale, 'route'), label: tabs.route }} />
      <main className="space-y-6 px-4">
        {KINDS.map((kind) => (
          <section key={kind}>
            <h2 className={groupHeading}>{copy.kinds[kind]}</h2>
            <ul className="overflow-hidden rounded-card bg-surface">
              {lines
                .filter((line) => line.kind === kind)
                .map((line) => (
                  <li key={line.id} className="border-t border-separator first:border-t-0">
                    <Link href={lineHref(locale, line.id)} className="pressable flex min-h-[3.25rem] items-center gap-3 px-4 py-2">
                      <span className="flex w-12 shrink-0">
                        <LineBadge line={line.id} style={lineStyles[line.id]} />
                      </span>
                      <span className="min-w-0 flex-1">{line.name}</span>
                      <Icon name="chevron" className="size-4 shrink-0 text-label-3" />
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  )
}
