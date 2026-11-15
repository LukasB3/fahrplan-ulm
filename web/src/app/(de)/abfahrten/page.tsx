import { t } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { pageMetadata } from '@/lib/seo'
import { DeparturesScreen } from '@/screens/TabScreens'

const { departures } = t('de')
export const metadata = pageMetadata(href('de', 'departures'), departures.title, departures.description)

export default function Page() {
  return <DeparturesScreen locale="de" />
}
