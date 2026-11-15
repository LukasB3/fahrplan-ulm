import { AuthClient } from '@supabase/auth-js'
import { SUPABASE_KEY, SUPABASE_URL } from './config'
import { login, LOGIN_KEY } from './state'

// Logins are Supabase Auth sessions, kept in this browser's storage. There
// are no passwords: a mail carries a code and a link, and either one logs in.
// The library renews the short-lived access token by itself. This module is
// loaded only when someone logs in or is logged in.
const client = new AuthClient({
  url: `${SUPABASE_URL}/auth/v1`,
  headers: { apikey: SUPABASE_KEY },
  storageKey: LOGIN_KEY,
  // The link in the mail hands its token over itself (AccountSync).
  detectSessionInUrl: false,
})

// Whatever shows the login follows it: a code typed here, a logout, a login
// that ran out. The library forbids calling it from inside this callback, hence the timeout.
client.onAuthStateChange(() => setTimeout(login.touch))

export const currentLogin = async () => {
  const session = (await client.getSession()).data.session
  return session && { token: session.access_token, account: session.user.id }
}

// Asks the login service itself, which a stored login cannot answer.
export const accountExists = async () => !(await client.getUser()).error

export const requestLogin = async (email: string, captchaToken: string) => (await client.signInWithOtp({ email, options: { captchaToken } })).error
export const loginWithCode = async (email: string, code: string) => (await client.verifyOtp({ email, token: code, type: 'email' })).error
export const loginWithLink = async (tokenHash: string) => (await client.verifyOtp({ token_hash: tokenHash, type: 'email' })).error

// Ends the login in this browser only.
export const endLogin = async () => (await client.signOut({ scope: 'local' })).error

// For an account that is gone: nobody is left to tell, the browser just forgets the login.
export const dropLogin = async () => {
  if (!(await endLogin())) return
  try {
    localStorage.removeItem(LOGIN_KEY)
  } catch {
    // Without storage there was no login to forget.
  }
  login.touch()
}
