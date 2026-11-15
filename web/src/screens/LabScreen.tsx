import { LabPanel } from '@/features/lab/LabPanel'
import { t, type Locale } from '@/lib/i18n'
import { ScreenHeader } from '@/shell/ScreenHeader'

// A page for trying the risky parts on a real phone before features are built on them.
export function LabScreen({ locale }: { locale: Locale }) {
  const { lab, account } = t(locale)
  return (
    <>
      <ScreenHeader locale={locale} title={lab.title} />
      <main className="space-y-6 px-4">
        <p className="text-label-2">{lab.lead}</p>
        <LabPanel labels={{ ...lab, close: account.close }} />
      </main>
    </>
  )
}
