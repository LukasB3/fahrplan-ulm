import type { ReactNode } from 'react'
import { t, type Locale } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { TabBar } from './TabBar'

export function AppShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const { tabs } = t(locale)
  return (
    <html lang={locale}>
      <body>
        {children}
        <TabBar
          label={tabs.label}
          tabs={[
            { href: href(locale, 'route'), label: tabs.route, icon: 'route' },
            { href: href(locale, 'departures'), label: tabs.departures, icon: 'departures' },
            { href: href(locale, 'map'), label: tabs.map, icon: 'map' },
            { href: href(locale, 'alerts'), label: tabs.alerts, icon: 'alerts' },
          ]}
        />
      </body>
    </html>
  )
}
