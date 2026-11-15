import { t } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { pageMetadata } from '@/lib/seo'
import { AlertsScreen } from '@/screens/TabScreens'

const { alerts } = t('de')
export const metadata = pageMetadata(href('de', 'alerts'), alerts.title, alerts.description)

// The alerts are part of the page, so it is rebuilt as they change.
export const revalidate = 600

export default function Page() {
  return <AlertsScreen locale="de" />
}
