import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n'
import { legalDe } from '@/messages/legal.de'
import { ScreenHeader } from '@/shell/ScreenHeader'

const legal = { de: legalDe }

function Sections({ sections }: { sections: { heading: string; text: string }[] }) {
  return sections.map((section) => (
    <section key={section.heading}>
      <h2 className="mt-6 text-[1.25rem] leading-tight font-semibold tracking-[-0.01em]">{section.heading}</h2>
      <p className="mt-2 text-label-2">{section.text}</p>
    </section>
  ))
}

const Page = ({ children }: { children: ReactNode }) => <main className="mx-auto max-w-[40rem] px-4 pb-4">{children}</main>

export function ImprintScreen({ locale }: { locale: Locale }) {
  const { imprint } = legal[locale]
  return (
    <>
      <ScreenHeader locale={locale} title={imprint.title} />
      <Page>
        <p className="text-label-2">{imprint.basis}</p>
        <address className="mt-2 not-italic">
          {imprint.address.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
        <h2 className="mt-6 text-[1.25rem] leading-tight font-semibold tracking-[-0.01em]">{imprint.contactHeading}</h2>
        <p className="mt-2">
          <a href={`mailto:${imprint.email}`} className="text-tint">
            {imprint.email}
          </a>
        </p>
        <Sections sections={imprint.sections} />
      </Page>
    </>
  )
}

export function PrivacyScreen({ locale }: { locale: Locale }) {
  const { privacy } = legal[locale]
  return (
    <>
      <ScreenHeader locale={locale} title={privacy.title} />
      <Page>
        <p className="text-label-2">{privacy.lead}</p>
        <Sections sections={privacy.sections} />
      </Page>
    </>
  )
}

export const legalTitles = (locale: Locale) => ({ imprint: legal[locale].imprint.title, privacy: legal[locale].privacy.title })
