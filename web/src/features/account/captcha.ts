import { TURNSTILE_SITE_KEY } from './config'

// Cloudflare Turnstile checks that a person asks for a login mail. Its script
// is loaded when someone starts to log in, not before.
type Turnstile = {
  render(container: HTMLElement, options: Record<string, unknown>): string
  reset(widget: string): void
  remove(widget: string): void
}

declare global {
  interface Window {
    turnstile?: Turnstile
    onTurnstileLoad?: () => void
  }
}

let loaded: Promise<Turnstile> | undefined
const turnstile = () =>
  (loaded ??= new Promise<Turnstile>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile)
    window.onTurnstileLoad = () => resolve(window.turnstile!)
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad'
    script.async = true
    script.onerror = () => {
      // A content blocker, or no connection. The next attempt loads it again.
      loaded = undefined
      script.remove()
      reject(new Error('the check did not load'))
    }
    document.head.append(script)
  }))

// Puts the check into `container`. It shows itself only when the visitor has
// to do something, and the container has the class `asks` for that time.
// `token()` gives the proof once the check has passed, and fails when the
// check cannot run.
export const mountCaptcha = (container: HTMLElement) => {
  let widget: string | undefined
  let removed = false
  let broken = false
  let token = ''
  let waiting: { resolve: (token: string) => void; reject: (problem: Error) => void }[] = []

  const passed = (next: string) => {
    token = next
    if (!next) return
    for (const one of waiting) one.resolve(next)
    waiting = []
  }
  const failed = () => {
    broken = true
    for (const one of waiting) one.reject(new Error('the check failed'))
    waiting = []
  }

  turnstile().then((api) => {
    if (removed) return
    widget = api.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      appearance: 'interaction-only',
      size: 'flexible',
      callback: passed,
      'expired-callback': () => passed(''),
      'error-callback': failed,
      'before-interactive-callback': () => container.classList.add('asks'),
      'after-interactive-callback': () => container.classList.remove('asks'),
    })
  }, failed)

  return {
    token: () => (broken ? Promise.reject(new Error('the check failed')) : token ? Promise.resolve(token) : new Promise<string>((resolve, reject) => waiting.push({ resolve, reject }))),
    // Each proof works once; this asks for the next.
    renew: () => {
      token = ''
      if (widget) window.turnstile?.reset(widget)
    },
    remove: () => {
      removed = true
      if (widget) window.turnstile?.remove(widget)
    },
  }
}
