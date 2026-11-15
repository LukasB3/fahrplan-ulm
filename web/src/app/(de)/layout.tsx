import '../globals.css'
import type { ReactNode } from 'react'
import { siteMetadata, siteViewport } from '@/lib/seo'
import { AppShell } from '@/shell/AppShell'

export const metadata = siteMetadata('de')
export const viewport = siteViewport

export default function Layout({ children }: { children: ReactNode }) {
  return <AppShell locale="de">{children}</AppShell>
}
