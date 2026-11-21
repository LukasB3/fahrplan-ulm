import Link from 'next/link'
import { t, type Locale } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { askSectionId, legalDe, type Block, type LegalDoc, type Paragraph } from '@/messages/legal.de'
import { ScreenHeader } from '@/shell/ScreenHeader'

const legal = { de: legalDe }

const heading = 'text-[1.25rem] leading-tight font-semibold tracking-[-0.01em]'
// A link inside running text is underlined: colour alone does not set it apart from grey text.
const link = 'text-tint underline underline-offset-2'

function Text({ locale, value }: { locale: Locale; value: Paragraph }) {
  if (typeof value === 'string') return value
  return value.map((part, index) => {
    if (typeof part === 'string') return part
    if ('route' in part)
      return (
        <Link key={index} href={`${href(locale, part.route)}${part.hash ? `#${part.hash}` : ''}`} className={link}>
          {part.text}
        </Link>
      )
    return (
      <a key={index} href={part.href} className={link}>
        {part.text}
      </a>
    )
  })
}

function Body({ locale, block }: { locale: Locale; block: Block }) {
  if (typeof block === 'object' && !Array.isArray(block))
    return (
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-label-2">
        {block.list.map((item, index) => (
          <li key={index}>
            <Text locale={locale} value={item} />
          </li>
        ))}
      </ul>
    )
  return (
    <p className="mt-2 whitespace-pre-line text-label-2">
      <Text locale={locale} value={block} />
    </p>
  )
}

// Both legal pages: sections that can be linked to by their id. A section
// reached that way stops below the bar, which stays at the top of the page.
function Document({ locale, doc }: { locale: Locale; doc: LegalDoc }) {
  const { tabs } = t(locale)
  return (
    <>
      <ScreenHeader locale={locale} title={doc.title} back={{ href: href(locale, 'route'), label: tabs.route }} />
      <main className="mx-auto max-w-[40rem] px-4 pb-4">
        {doc.sections.map((section, index) => (
          <section key={section.id} id={section.id} className="scroll-mt-[calc(env(safe-area-inset-top)+3.5rem)]">
            <h2 className={index === 0 ? heading : `mt-6 ${heading}`}>{section.heading}</h2>
            {section.body.map((block, at) => (
              <Body key={at} locale={locale} block={block} />
            ))}
          </section>
        ))}
        <p className="mt-8 text-[0.8125rem] text-label-2">{doc.updated}</p>
      </main>
    </>
  )
}

export const ImprintScreen = ({ locale }: { locale: Locale }) => <Document locale={locale} doc={legal[locale].imprint} />
export const PrivacyScreen = ({ locale }: { locale: Locale }) => <Document locale={locale} doc={legal[locale].privacy} />

export const legalTitles = (locale: Locale) => ({ imprint: legal[locale].imprint.title, privacy: legal[locale].privacy.title })
// The sentence field links to the section about it.
export const askPrivacyHref = (locale: Locale) => `${href(locale, 'privacy')}#${askSectionId}`
