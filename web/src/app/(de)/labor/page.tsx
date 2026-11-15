import { t } from '@/lib/i18n'
import { notIndexed } from '@/lib/seo'
import { LabScreen } from '@/screens/LabScreen'

export const metadata = { title: t('de').lab.title, robots: notIndexed }

export default function Page() {
  return <LabScreen locale="de" />
}
