import { t } from '@/lib/i18n'
import { AlertsScreen } from '@/screens/TabScreens'

export const metadata = { title: t('de').alerts.title }

export default function Page() {
  return <AlertsScreen locale="de" />
}
