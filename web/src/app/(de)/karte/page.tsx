import { t } from '@/lib/i18n'
import { MapScreen } from '@/screens/TabScreens'

export const metadata = { title: t('de').map.title }

export default function Page() {
  return <MapScreen locale="de" />
}
