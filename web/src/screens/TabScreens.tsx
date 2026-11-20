import Link from 'next/link'
import { preconnect } from 'react-dom'
import { AlertList } from '@/features/alerts/AlertList'
import { StopSearch } from '@/features/departures/StopSearch'
import { MapLoader } from '@/features/map/MapLoader'
import { Planner } from '@/features/planner/Planner'
import { busiestStops, lines, lineStyles, stops } from '@/lib/data'
import { t, type Locale } from '@/lib/i18n'
import { href, lineHref, stopHref } from '@/lib/routes'
import { fetchAlerts } from '@/lib/server-api'
import { SITE_ORIGIN } from '@/lib/seo'
import { Icon } from '@/shell/icons'
import { InfoButton } from '@/shell/InfoButton'
import { JsonLd } from '@/shell/JsonLd'
import { LineBadge } from '@/shell/LineBadge'
import { ScreenHeader } from '@/shell/ScreenHeader'
import { Visit } from '@/shell/Visit'
import { groupHeading } from '@/shell/styles'
import { listed } from './StopScreen'

function MoreLink({ to, label, className }: { to: string; label: string; className: string }) {
  return (
    <Link href={to} className={`pressable flex min-h-11 items-center justify-between px-4 py-2.5 ${className}`}>
      {label}
      <Icon name="chevron" className="size-4 text-label-3" />
    </Link>
  )
}

export function RouteScreen({ locale }: { locale: Locale }) {
  const { route, site, planner, tabs } = t(locale)
  return (
    <>
      <ScreenHeader locale={locale} title={route.title} root crumb={tabs.route} />
      <main className="space-y-7 px-4">
        <Planner stops={busiestStops(stops.length).map((stop) => ({ kind: 'stop', stop: stop.dhid, name: stop.name, town: stop.town, lat: stop.lat, lon: stop.lon }))} lineStyles={lineStyles} labels={planner} privacyHref={href(locale, 'privacy')} />

        <section>
          <h2 className={groupHeading}>{route.lines}</h2>
          <div className="overflow-hidden rounded-card bg-surface">
            <ul className="flex flex-wrap gap-x-2 p-4">
              {lines.map((line) => (
                <li key={line.id}>
                  <Link href={lineHref(locale, line.id)} prefetch={false} className="pressable inline-flex py-1.5">
                    <LineBadge line={line.id} style={lineStyles[line.id]} />
                  </Link>
                </li>
              ))}
            </ul>
            <MoreLink to={href(locale, 'lines')} label={route.allLines} className="border-t border-separator" />
          </div>
        </section>

        {/* What the site is, in a sentence: for a first visit and for search engines, below what people came to use. */}
        <p className="px-4 text-[0.8125rem] text-label-2">{route.lead}</p>
      </main>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: SITE_ORIGIN, inLanguage: locale, description: site.description }} />
    </>
  )
}

export function DeparturesScreen({ locale }: { locale: Locale }) {
  const { departures } = t(locale)
  return (
    <>
      <ScreenHeader locale={locale} title={departures.title} root />
      <main className="space-y-6 px-4">
        <StopSearch
          stops={busiestStops(stops.length).map((stop) => listed(locale, stop))}
          lineStyles={lineStyles}
          labels={{
            searchLabel: departures.searchLabel,
            searchPlaceholder: departures.searchPlaceholder,
            clear: departures.clear,
            noMatch: departures.noMatch,
            favourites: departures.favourites,
            nearby: departures.nearby,
            nearbyStart: departures.nearbyStart,
            nearbyNone: departures.nearbyNone,
            locating: departures.locating,
            locationDenied: departures.locationDenied,
            locationUnavailable: departures.locationUnavailable,
            popular: departures.popular,
            metres: 'm',
          }}
        />
        <MoreLink to={href(locale, 'stops')} label={departures.allStops} className="rounded-card bg-surface" />
      </main>
    </>
  )
}

export function MapScreen({ locale }: { locale: Locale }) {
  const { map, board, tabs } = t(locale)
  // The map's style, tiles and lettering come from there; the connection can open while the map's code loads.
  preconnect('https://tiles.stadiamaps.com', { crossOrigin: 'anonymous' })
  return (
    <main>
      <Visit label={tabs.map} root />
      {/* The map is the page; its heading is there for screen readers and search engines. */}
      <h1 className="sr-only">{map.heading}</h1>
      <MapLoader
        stops={stops.map((stop) => ({ id: stop.id, code: stop.code, name: stop.name, href: stopHref(locale, stop.slug), lat: stop.lat, lon: stop.lon, lines: stop.lines }))}
        lineStyles={lineStyles}
        labels={map}
        boardLabels={{ now: board.now, minutes: board.minutes, platform: board.platform, track: board.track, none: board.none, failed: board.failed, stale: board.stale, loading: board.loading }}
      />
      <div className="map-info material">
        <InfoButton locale={locale} />
      </div>
    </main>
  )
}

export async function AlertsScreen({ locale }: { locale: Locale }) {
  const { alerts: copy } = t(locale)
  const { alerts, now } = await fetchAlerts()
  return (
    <>
      <ScreenHeader locale={locale} title={copy.title} root />
      <main className="space-y-4 px-4">
        <p className="-mt-2 text-label-2">{copy.heading}</p>
        <AlertList
          initial={alerts}
          builtAt={Date.parse(now)}
          lineStyles={lineStyles}
          labels={{ since: copy.since, from: copy.from, until: copy.until, fromTo: copy.fromTo, yours: copy.yours, all: copy.all, none: copy.none }}
        />
        <p className="px-4 text-[0.8125rem] text-label-2">{copy.source}</p>
      </main>
    </>
  )
}
