import { t } from '@/lib/i18n'
import { notIndexed } from '@/lib/seo'
import { MapScreen } from '@/screens/TabScreens'

export const metadata = { title: t('de').map.title, robots: notIndexed }

export default function Page() {
  return <MapScreen locale="de" />
}
