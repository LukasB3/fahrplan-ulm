import { t } from '@/lib/i18n'
import { LabScreen } from '@/screens/LabScreen'

export const metadata = { title: t('de').lab.title }

export default function Page() {
  return <LabScreen locale="de" />
}
