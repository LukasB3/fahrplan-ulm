'use client'

import { useSyncExternalStore } from 'react'
import { remembered } from '@/lib/store'

// Where the account library keeps the login in this browser. It is only read
// here, to know who is logged in without loading that library on every page.
export const LOGIN_KEY = 'fahrplan-ulm:login'

export const login = remembered<string | null>(LOGIN_KEY, null, (stored) => {
  const email = (stored as { user?: { email?: unknown } } | null)?.user?.email
  return typeof email === 'string' ? email : null
})

// The address of whoever is logged in, or null.
export const useLoginEmail = login.use

// The address a login mail went to. It is kept so the code can still be typed
// after a trip to the mail app, even if the page had to load again meanwhile.
const CODE_LASTS_MS = 3_600_000

export const loginMail = remembered<{ email: string; at: number } | null>('fahrplan-ulm:login-mail', null, (stored) => {
  const mail = stored as { email?: unknown; at?: unknown } | null
  return typeof mail?.email === 'string' && typeof mail.at === 'number' ? { email: mail.email, at: mail.at } : null
})

export const useLoginMail = () => {
  const mail = loginMail.use()
  return mail && Date.now() - mail.at < CODE_LASTS_MS ? mail.email : null
}

// The account sheet belongs to the button in the header, but the link in a
// login mail opens it too, to say how that went.
type SheetState = { open: boolean; linkFailed: boolean }
const closed: SheetState = { open: false, linkFailed: false }
let sheet = closed
const listeners = new Set<() => void>()

export const showAccount = (next: Partial<SheetState>) => {
  sheet = { ...sheet, ...next }
  for (const listener of listeners) listener()
}

export const useAccountSheet = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => sheet,
    () => closed,
  )
