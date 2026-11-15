'use client'

import Link from 'next/link'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import type { Messages } from '@/lib/i18n'
import { Icon } from '@/shell/icons'
import { Sheet } from '@/shell/Sheet'
import { button } from '@/shell/styles'
import { mountCaptcha } from './captcha'
import { loginMail, showAccount, useAccountSheet, useLoginEmail, useLoginMail } from './state'

type Labels = Messages['account']
type Props = { labels: Labels; imprintHref: string; privacyHref: string }

const field = 'mt-3 h-12 w-full rounded-xl bg-fill px-4 outline-none placeholder:text-label-3 focus-visible:ring-2 focus-visible:ring-tint'
const wide = 'mt-3 w-full disabled:opacity-50'
const problemText = 'mt-3 text-[0.9375rem] text-late'

// Step one: the address the login mail goes to.
function AskForMail({ labels, privacyHref }: { labels: Labels; privacyHref: string }) {
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()
  const box = useRef<HTMLDivElement>(null)
  const check = useRef<ReturnType<typeof mountCaptcha>>(undefined)

  // The check that a person is asking starts with the first tap into the
  // field, so it is usually through by the time the address is typed.
  const prepare = () => (check.current ??= mountCaptcha(box.current!))
  useEffect(() => () => check.current?.remove(), [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const email = address.trim()
    if (busy || !email) return
    setBusy(true)
    setProblem(undefined)
    const captcha = prepare()
    const token = await captcha.token().catch(() => null)
    if (token === null) {
      // The check did not load or could not run; the next attempt starts it afresh.
      captcha.remove()
      check.current = undefined
      setBusy(false)
      return setProblem(labels.captchaFailed)
    }
    const error = await import('./session').then(
      ({ requestLogin }) => requestLogin(email, token),
      () => ({ status: 0 }),
    )
    captcha.renew()
    setBusy(false)
    if (error) return setProblem(error.status === 429 ? labels.tooMany : error.status ? labels.sendFailed : labels.failed)
    loginMail.write({ email, at: Date.now() })
  }

  return (
    <form onSubmit={submit} className="mt-2">
      <p className="text-label-2">{labels.lead}</p>
      <input
        type="email"
        required
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        onFocus={prepare}
        placeholder={labels.emailPlaceholder}
        aria-label={labels.emailLabel}
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="send"
        className={field}
      />
      <div ref={box} className="[&.asks]:mt-3" />
      <button type="submit" disabled={busy} className={`${button.primary} ${wide}`}>
        {busy ? labels.busy : labels.send}
      </button>
      {problem ? (
        <p role="alert" className={problemText}>
          {problem}
        </p>
      ) : (
        <p className="mt-3 text-[0.8125rem] text-label-2">
          {labels.notice}{' '}
          <Link href={privacyHref} className="underline">
            {labels.noticeLink}
          </Link>
          .
        </p>
      )}
    </form>
  )
}

// Step two: the code from the mail. The link in the mail does the same, in whichever browser it opens.
function AskForCode({ email, labels }: { email: string; labels: Labels }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()
  const digits = code.replace(/\D/g, '')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || digits.length < 6) return
    setBusy(true)
    setProblem(undefined)
    const error = await import('./session').then(
      ({ loginWithCode }) => loginWithCode(email, digits),
      () => ({ status: 0 }),
    )
    setBusy(false)
    if (error) return setProblem(error.status ? labels.codeWrong : labels.failed)
    loginMail.write(null)
  }

  return (
    <form onSubmit={submit} className="mt-2">
      <p className="text-label-2 [overflow-wrap:anywhere]">{labels.sent.replace('{email}', email)}</p>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9 ]*"
        maxLength={12}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        aria-label={labels.codeLabel}
        placeholder={labels.codeLabel}
        autoComplete="one-time-code"
        enterKeyHint="done"
        className={`${field} text-center text-[1.375rem] font-semibold tracking-[0.2em] tabular-nums placeholder:text-[1.0625rem] placeholder:font-normal placeholder:tracking-normal`}
      />
      <button type="submit" disabled={busy || digits.length < 6} className={`${button.primary} ${wide}`}>
        {busy ? labels.busy : labels.logIn}
      </button>
      {problem && (
        <p role="alert" className={problemText}>
          {problem}
        </p>
      )}
      <button type="button" onClick={() => loginMail.write(null)} className="pressable mt-2 flex min-h-11 w-full items-center justify-center text-tint">
        {labels.again}
      </button>
    </form>
  )
}

// Logged in: who, and the two ways out.
function Account({ email, labels }: { email: string; labels: Labels }) {
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()

  const leave = async (how: 'logOut' | 'deleteAccount') => {
    if (busy) return
    setBusy(true)
    setProblem(undefined)
    const done = await import('./sync').then(
      (account) => account[how](),
      () => false,
    )
    setBusy(false)
    if (!done) setProblem(labels.failed)
  }

  if (deleting)
    return (
      <div className="mt-2">
        <p className="font-semibold">{labels.deleteQuestion}</p>
        <p className="mt-1 text-label-2">{labels.deleteText}</p>
        <button type="button" disabled={busy} onClick={() => void leave('deleteAccount')} className={`pressable inline-flex min-h-11 items-center justify-center rounded-full bg-late px-5 font-semibold text-white ${wide}`}>
          {busy ? labels.busy : labels.deleteConfirm}
        </button>
        <button type="button" disabled={busy} onClick={() => setDeleting(false)} className={`${button.secondary} ${wide}`}>
          {labels.cancel}
        </button>
        {problem && (
          <p role="alert" className={problemText}>
            {problem}
          </p>
        )}
      </div>
    )

  return (
    <div className="mt-2">
      <p className="font-semibold [overflow-wrap:anywhere]">{labels.loggedInAs.replace('{email}', email)}</p>
      <p className="mt-1 text-label-2">{labels.synced}</p>
      <ul className="mt-4 overflow-hidden rounded-card bg-bg">
        <li>
          <button type="button" disabled={busy} onClick={() => void leave('logOut')} className="pressable flex min-h-11 w-full items-center px-4 py-2.5 text-tint disabled:opacity-50">
            {busy ? labels.busy : labels.logOut}
          </button>
        </li>
        <li className="border-t border-separator">
          <button type="button" disabled={busy} onClick={() => setDeleting(true)} className="pressable flex min-h-11 w-full items-center px-4 py-2.5 text-late disabled:opacity-50">
            {labels.delete}
          </button>
        </li>
      </ul>
      {problem && (
        <p role="alert" className={problemText}>
          {problem}
        </p>
      )}
    </div>
  )
}

// The sheet behind the button top right: the account, and below it what this
// app is, with the legal pages.
export function AccountSheet({ labels, imprintHref, privacyHref }: Props) {
  const sheet = useAccountSheet()
  const loggedInAs = useLoginEmail()
  const mailedTo = useLoginMail()

  // A login that came another way, such as the mail's link in a second tab, ends the wait for a code.
  useEffect(() => {
    if (loggedInAs && mailedTo) loginMail.write(null)
  }, [loggedInAs, mailedTo])

  return (
    <Sheet
      open={sheet.open}
      onOpenChange={(open) => showAccount({ open, linkFailed: open && sheet.linkFailed })}
      title={labels.title}
      closeLabel={labels.close}
      fields
      trigger={
        <button type="button" aria-label={labels.open} className="pressable grid size-11 place-items-center text-tint">
          <Icon name="person" active={loggedInAs !== null} />
        </button>
      }
    >
      {sheet.linkFailed && !loggedInAs && (
        <p role="alert" className="mt-2 text-[0.9375rem] text-late">
          {labels.linkFailed}
        </p>
      )}
      {loggedInAs ? <Account email={loggedInAs} labels={labels} /> : mailedTo ? <AskForCode email={mailedTo} labels={labels} /> : <AskForMail labels={labels} privacyHref={privacyHref} />}

      <h2 className="mt-8 text-[0.8125rem] font-semibold tracking-[0.02em] text-label-2 uppercase">{labels.aboutHeading}</h2>
      <p className="mt-1.5 text-label-2">{labels.about}</p>
      <ul className="mt-4 overflow-hidden rounded-card bg-bg">
        {[
          { href: imprintHref, label: labels.imprint },
          { href: privacyHref, label: labels.privacy },
        ].map((link, index) => (
          <li key={link.href} className={index > 0 ? 'border-t border-separator' : undefined}>
            <Link href={link.href} className="pressable flex min-h-11 items-center justify-between px-4 py-2.5">
              {link.label}
              <Icon name="chevron" className="size-4 text-label-3" />
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
