// The Supabase project that holds the accounts, and the Turnstile widget that
// guards its login mails. All three are public: every visitor's browser gets them.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://wzlshjwymqnnjhoameoa.supabase.co'
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_n6c4c0xC-1UTsLHPBsqQQw_26TZFZjF'
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '0x4AAAAAAGB_WVQLr-LMVMLd'
