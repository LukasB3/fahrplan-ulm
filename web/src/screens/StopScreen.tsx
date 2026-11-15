import Link from 'next/link'
import { RelevantAlerts } from '@/features/alerts/RelevantAlerts'
import { DepartureBoard } from '@/features/departures/DepartureBoard'
import { FavouriteButton } from '@/features/departures/FavouriteButton'
import { StopRow } from '@/features/departures/StopRow'
import { Timetable } from '@/features/departures/Timetable'
import { lineStyles, meta, nearestStops, timetableOf } from '@/lib/data'
import type { Stop } from '@/lib/data-types'
import { t, type Locale } from '@/lib/i18n'
import { href, lineHref, stopHref } from '@/lib/routes'
import { SITE_ORIGIN } from '@/lib/seo'
import { JsonLd } from '@/shell/JsonLd'
import { LineBadge } from '@/shell/LineBadge'
import { ScreenHeader } from '@/shell/ScreenHeader'
import { groupHeading } from '@/shell/styles'

const NEARBY = 4

// The city everyone means is not repeated in every row.
export const listed = (locale: Locale, stop: Stop) => ({ code: stop.code, href: stopHref(locale, stop.slug), name: stop.name, town: stop.town === 'Ulm' ? null : stop.town, lines: stop.lines, lat: stop.lat, lon: stop.lon })

export async function StopScreen({ locale, stop }: { locale: Locale; stop: Stop }) {
  const { stop: copy, board, site, hubs, alerts, tabs } = t(locale)
  const tables = await timetableOf(stop)
  const validUntil = new Date(meta.validUntil).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const url = `${SITE_ORIGIN}${stopHref(locale, stop.slug)}`

  return (
    <>
      <ScreenHeader
        locale={locale}
        title={stop.name}
        back={{ href: href(locale, 'departures'), label: tabs.departures }}
        actions={<FavouriteButton stop={{ code: stop.code, dhid: stop.dhid, lines: stop.lines }} labels={{ add: copy.favourite, remove: copy.unfavourite }} />}
      />
      <main className="space-y-7 px-4">
        <div className="-mt-2 space-y-3">
          <p className="text-label-2">
            {copy.kind} · {stop.town}
          </p>
          <ul aria-label={copy.linesHeading} className="flex flex-wrap gap-x-1.5">
            {stop.lines.map((line) => (
              <li key={line}>
                <Link href={lineHref(locale, line)} className="pressable inline-flex py-1.5">
                  <LineBadge line={line} style={lineStyles[line]} />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <RelevantAlerts about={{ dhid: stop.dhid, lines: stop.lines }} href={href(locale, 'alerts')} heading={alerts.forStop} />

        <section>
          <h2 className={groupHeading}>{board.heading}</h2>
          <DepartureBoard
            stopId={stop.id}
            lineStyles={lineStyles}
            labels={{ now: board.now, minutes: board.minutes, platform: board.platform, track: board.track, planned: board.planned, none: board.none, failed: board.failed, stale: board.stale, loading: board.loading }}
            run={{ towards: board.towards, stops: board.runStops, failed: board.runFailed, close: board.runClose }}
          />
        </section>

        <section>
          <h2 className={groupHeading}>{copy.timetableHeading}</h2>
          <div className="overflow-hidden rounded-card bg-surface">
            {tables.map((table) => (
              <Timetable key={`${table.line} ${table.headsign}`} table={table} style={lineStyles[table.line]} labels={{ towards: copy.towards, hour: copy.hour, days: copy.days, firstLast: copy.firstLast }} />
            ))}
          </div>
          <p className="px-4 pt-2 text-[0.8125rem] text-label-2">{copy.validity(validUntil)}</p>
        </section>

        <section>
          <h2 className={groupHeading}>{copy.nearbyHeading}</h2>
          <ul className="overflow-hidden rounded-card bg-surface">
            {nearestStops(stop, NEARBY).map((near) => (
              <StopRow key={near.stop.code} stop={listed(locale, near.stop)} lineStyles={lineStyles} note={copy.metres(near.metres)} />
            ))}
          </ul>
        </section>
      </main>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': stop.lines.some((line) => lineStyles[line]?.tram) ? ['BusStop', 'TramStation'] : 'BusStop',
            name: `${copy.kind} ${stop.name}`,
            url,
            identifier: stop.dhid,
            address: { '@type': 'PostalAddress', addressLocality: stop.town, addressCountry: 'DE' },
            geo: { '@type': 'GeoCoordinates', latitude: stop.lat, longitude: stop.lon },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: site.name, item: `${SITE_ORIGIN}${href(locale, 'route')}` },
              { '@type': 'ListItem', position: 2, name: hubs.stopsTitle, item: `${SITE_ORIGIN}${href(locale, 'stops')}` },
              { '@type': 'ListItem', position: 3, name: stop.name, item: url },
            ],
          },
        ]}
      />
    </>
  )
}
