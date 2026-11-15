import type { ReactNode } from 'react'
import { t, type Locale } from '@/lib/i18n'
import { departuresSection, href } from '@/lib/routes'
import { AccountSync } from '@/features/account/AccountSync'
import { AlertBadge } from '@/features/alerts/AlertBadge'
import { TabBar } from './TabBar'

export function AppShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const { tabs, alerts } = t(locale)
  return (
    <html lang={locale}>
      <body>
        {children}
        <AccountSync />
        <TabBar
          label={tabs.label}
          tabs={[
            { href: href(locale, 'route'), label: tabs.route, icon: 'route' },
            { href: href(locale, 'departures'), label: tabs.departures, icon: 'departures', section: departuresSection(locale) },
            { href: href(locale, 'map'), label: tabs.map, icon: 'map' },
            { href: href(locale, 'alerts'), label: tabs.alerts, icon: 'alerts', badge: <AlertBadge label={alerts.badge} /> },
          ]}
        />
      </body>
    </html>
  )
}
