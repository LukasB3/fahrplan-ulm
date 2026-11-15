'use client'

import type { Health } from '@api/types'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { getJson } from '@/lib/api'
import type { Messages } from '@/lib/i18n'
import { listen, speechSupported } from '@/lib/speech'
import { Icon } from '@/shell/icons'
import { Sheet } from '@/shell/Sheet'
import { button, groupHeading } from '@/shell/styles'

type Labels = Messages['lab'] & { close: string }

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className={groupHeading}>{heading}</h2>
      <div className="space-y-3 rounded-card bg-surface p-4">{children}</div>
    </section>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <p className="flex justify-between gap-4">
    <span className="text-label-2">{label}</span>
    <span className="text-right tabular-nums">{value}</span>
  </p>
)

function Device({ labels }: { labels: Labels }) {
  const probe = useRef<HTMLDivElement>(null)
  const [device, setDevice] = useState<{ installed: boolean; insets: string; agent: string }>()
  useEffect(() => {
    const style = probe.current ? getComputedStyle(probe.current) : undefined
    const installed = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
    setDevice({ installed, insets: `${style?.paddingTop ?? '?'} / ${style?.paddingBottom ?? '?'}`, agent: navigator.userAgent })
  }, [])
  return (
    <Group heading={labels.device}>
      <div ref={probe} aria-hidden className="hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" />
      <Row label={labels.installed} value={device ? (device.installed ? labels.yes : labels.no) : '…'} />
      <Row label={labels.safeArea} value={device?.insets ?? '…'} />
      <p className="text-[0.8125rem] break-words text-label-2">{device?.agent}</p>
    </Group>
  )
}

function Sheets({ labels }: { labels: Labels }) {
  return (
    <Group heading={labels.sheet}>
      <div className="flex flex-wrap gap-3">
        {[false, true].map((passthrough) => (
          <Sheet
            key={String(passthrough)}
            title={labels.sheetTitle}
            closeLabel={labels.close}
            passthrough={passthrough}
            trigger={
              <button type="button" className={passthrough ? button.secondary : button.primary}>
                {passthrough ? labels.sheetPassthrough : labels.sheetModal}
              </button>
            }
          >
            <p className="mt-2 pb-24 text-label-2">{labels.sheetText}</p>
          </Sheet>
        ))}
      </div>
    </Group>
  )
}

function Speech({ labels }: { labels: Labels }) {
  const [supported, setSupported] = useState<boolean>()
  const [heard, setHeard] = useState('')
  const [error, setError] = useState<string>()
  const [listening, setListening] = useState<{ stop(): void }>()
  useEffect(() => setSupported(speechSupported()), [])

  const start = () => {
    setHeard('')
    setError(undefined)
    setListening(
      listen('de-DE', {
        text: setHeard,
        end: (problem) => {
          setError(problem)
          setListening(undefined)
        },
      }),
    )
  }

  return (
    <Group heading={labels.speech}>
      <Row label={labels.speechSupported} value={supported === undefined ? '…' : supported ? labels.yes : labels.no} />
      {supported && (
        <>
          <button type="button" className={listening ? button.secondary : button.primary} onClick={listening ? () => listening.stop() : start}>
            <Icon name="mic" active={listening !== undefined} />
            {listening ? labels.speechStop : labels.speechStart}
          </button>
          <p className={heard ? '' : 'text-label-2'}>{heard || labels.speechHint}</p>
        </>
      )}
      {error && (
        <p className="text-late">
          {labels.failed}: {error}
        </p>
      )}
    </Group>
  )
}

function Location({ labels }: { labels: Labels }) {
  const [result, setResult] = useState<string>()
  const [failed, setFailed] = useState(false)
  const ask = () => {
    setResult('…')
    setFailed(false)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setResult(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} · ${labels.locationAccuracy} ${Math.round(coords.accuracy)} m`),
      (problem) => {
        setFailed(true)
        setResult(`${labels.failed}: ${problem.message || problem.code}`)
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    )
  }
  return (
    <Group heading={labels.location}>
      <button type="button" className={button.primary} onClick={ask}>
        <Icon name="location" />
        {labels.locationStart}
      </button>
      {result && <p className={failed ? 'text-late' : 'tabular-nums'}>{result}</p>}
    </Group>
  )
}

function Server({ labels }: { labels: Labels }) {
  const [result, setResult] = useState<string>()
  const [failed, setFailed] = useState(false)
  const ask = async () => {
    setResult('…')
    setFailed(false)
    try {
      const health = await getJson<Health>('/api/health')
      setResult(`${labels.apiOk} ${new Date(health.now).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin' })}`)
    } catch (problem) {
      setFailed(true)
      setResult(`${labels.failed}: ${problem instanceof Error ? problem.message : String(problem)}`)
    }
  }
  return (
    <Group heading={labels.api}>
      <button type="button" className={button.primary} onClick={() => void ask()}>
        {labels.apiStart}
      </button>
      {result && <p className={failed ? 'text-late' : ''}>{result}</p>}
    </Group>
  )
}

export function LabPanel({ labels }: { labels: Labels }) {
  return (
    <div className="space-y-6">
      <Device labels={labels} />
      <Sheets labels={labels} />
      <Speech labels={labels} />
      <Location labels={labels} />
      <Server labels={labels} />
    </div>
  )
}
