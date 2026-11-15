import Link from 'next/link'
import { t, type Locale } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { ComingSoon } from '@/shell/ComingSoon'
import { Icon } from '@/shell/icons'
import { ScreenHeader } from '@/shell/ScreenHeader'

export function RouteScreen({ locale }: { locale: Locale }) {
  const { route, lab } = t(locale)
  return (
    <>
      <ScreenHeader locale={locale} title={route.title} />
      <main className="space-y-4 px-4">
        <p className="text-label-2">{route.lead}</p>
        <ComingSoon icon="route" title={route.soonTitle} text={route.soonText} />
        <Link href={href(locale, 'lab')} className="pressable flex min-h-11 items-center justify-between rounded-card bg-surface px-4 py-3">
          {lab.link}
          <Icon name="chevron" className="size-4 text-label-3" />
        </Link>
      </main>
    </>
  )
}

export function DeparturesScreen({ locale }: { locale: Locale }) {
  const { departures } = t(locale)
  return (
    <>
      <ScreenHeader locale={locale} title={departures.title} />
      <main className="px-4">
        <ComingSoon icon="departures" title={departures.soonTitle} text={departures.soonText} />
      </main>
    </>
  )
}

export function MapScreen({ locale }: { locale: Locale }) {
  const { map } = t(locale)
  return (
    <>
      <ScreenHeader locale={locale} title={map.title} />
      <main className="px-4">
        <ComingSoon icon="map" title={map.soonTitle} text={map.soonText} />
      </main>
    </>
  )
}

export function AlertsScreen({ locale }: { locale: Locale }) {
  const { alerts } = t(locale)
  return (
    <>
      <ScreenHeader locale={locale} title={alerts.title} />
      <main className="px-4">
        <ComingSoon icon="alerts" title={alerts.soonTitle} text={alerts.soonText} />
      </main>
    </>
  )
}
