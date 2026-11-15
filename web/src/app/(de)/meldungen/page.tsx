import { t } from '@/lib/i18n'
import { notIndexed } from '@/lib/seo'
import { AlertsScreen } from '@/screens/TabScreens'

export const metadata = { title: t('de').alerts.title, robots: notIndexed }

export default function Page() {
  return <AlertsScreen locale="de" />
}
