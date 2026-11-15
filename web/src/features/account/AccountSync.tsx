'use client'

import { useEffect } from 'react'
import { unsent } from '@/lib/store'
import { showAccount, useLoginEmail } from './state'

const AGAIN_AFTER_MS = 60_000
let lastSync = 0

const sync = () => {
  lastSync = Date.now()
  void import('./sync').then((account) => account.sync())
}

// Keeps the device and the account alike while someone is logged in, and
// takes the login from the link in a login mail. Shows nothing, and loads
// the account code only when there is a login.
export function AccountSync() {
  const loggedIn = useLoginEmail() !== null
  const waiting = unsent.use().length > 0

  useEffect(() => {
    const tokenHash = new URLSearchParams(location.search).get('token_hash')
    if (!tokenHash) return
    // The link works once; it should not stay in the address bar or the history.
    history.replaceState(null, '', location.pathname)
    void import('./session').then(async ({ loginWithLink }) => showAccount({ open: true, linkFailed: (await loginWithLink(tokenHash)) !== null }))
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    sync()
    // Another device may have changed something while this page was away.
    const back = () => document.visibilityState === 'visible' && Date.now() - lastSync > AGAIN_AFTER_MS && sync()
    document.addEventListener('visibilitychange', back)
    window.addEventListener('online', sync)
    return () => {
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('online', sync)
    }
  }, [loggedIn])

  useEffect(() => {
    if (loggedIn && waiting) sync()
  }, [loggedIn, waiting])

  return null
}
