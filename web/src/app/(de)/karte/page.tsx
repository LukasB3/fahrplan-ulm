import { t } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { pageMetadata } from '@/lib/seo'
import { MapScreen } from '@/screens/TabScreens'

const { map } = t('de')
export const metadata = pageMetadata(href('de', 'map'), map.title, map.description)

export default function Page() {
  return <MapScreen locale="de" />
}
