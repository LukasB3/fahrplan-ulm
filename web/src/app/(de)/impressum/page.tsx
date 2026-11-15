import { ImprintScreen, legalTitles } from '@/screens/LegalScreens'

export const metadata = { title: legalTitles('de').imprint }

export default function Page() {
  return <ImprintScreen locale="de" />
}
