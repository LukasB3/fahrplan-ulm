import type { NextConfig } from 'next'

const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN ?? 'https://api.fahrplan-ulm.de'

// Prebuilt pages carry Next's inline bootstrap scripts, and a nonce would
// need every page rendered per request. So inline scripts are allowed and
// everything else is pinned to this site and its API.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${apiOrigin}`,
  "font-src 'self'",
  "worker-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), microphone=(self), camera=()' },
  // The development server needs eval for hot reloading.
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Content-Security-Policy', value: contentSecurityPolicy }] : []),
]

const config: NextConfig = {
  // Each language has its own root layout, so no single layout can hold the 404 page.
  experimental: { globalNotFound: true },
  headers: async () => [{ source: '/(.*)', headers: securityHeaders }],
}

export default config
