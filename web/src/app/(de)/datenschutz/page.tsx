import { PrivacyScreen, legalTitles } from '@/screens/LegalScreens'

export const metadata = { title: legalTitles('de').privacy }

export default function Page() {
  return <PrivacyScreen locale="de" />
}
