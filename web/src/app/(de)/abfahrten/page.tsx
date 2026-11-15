import { t } from '@/lib/i18n'
import { DeparturesScreen } from '@/screens/TabScreens'

export const metadata = { title: t('de').departures.title }

export default function Page() {
  return <DeparturesScreen locale="de" />
}
