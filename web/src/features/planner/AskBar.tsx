'use client'

import type { AskRequest, AskResult } from '@api/types'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { postJson } from '@/lib/api'
import { listen, speechSupported } from '@/lib/speech'
import { Icon } from '@/shell/icons'
import type { PlannerLabels } from './Journeys'

type Props = {
  // What the server needs besides the sentence: a known position and the saved places.
  context: () => Pick<AskRequest, 'position' | 'saved'>
  onResult: (result: AskResult) => void
  // What to tell the person about the last request, if anything.
  note: string | null
  privacyHref: string
  labels: PlannerLabels
}

// The journey in one sentence, typed or spoken: "in 30 Minuten zum Hauptbahnhof".
export function AskBar({ context, onResult, note, privacyHref, labels }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [canSpeak, setCanSpeak] = useState(false)
  const [listening, setListening] = useState<{ stop(): void }>()
  const [speechFailed, setSpeechFailed] = useState(false)
  // What was heard last, for the moment the recognition ends.
  const heard = useRef('')

  useEffect(() => setCanSpeak(speechSupported()), [])

  const send = async (sentence: string) => {
    const wanted = sentence.trim()
    if (!wanted || busy) return
    setBusy(true)
    try {
      onResult(await postJson<AskResult>('/api/ask', { text: wanted.slice(0, 300), ...context() }))
    } catch {
      onResult({ status: 'unavailable' })
    } finally {
      setBusy(false)
    }
  }

  const speak = () => {
    if (listening) return listening.stop()
    setSpeechFailed(false)
    heard.current = ''
    setText('')
    setListening(
      listen('de-DE', {
        text: (sofar) => {
          heard.current = sofar
          setText(sofar)
        },
        // Speaking ends the sentence: it is sent without another tap.
        end: (problem) => {
          setListening(undefined)
          if (heard.current.trim()) void send(heard.current)
          else if (problem && problem !== 'no-speech' && problem !== 'aborted') setSpeechFailed(true)
        },
      }),
    )
  }

  return (
    <div className="space-y-1.5">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void send(text)
        }}
        className="flex min-h-[3.25rem] items-center rounded-card bg-surface pl-4"
      >
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={listening ? labels.askListening : labels.askPlaceholder}
          aria-label={labels.askLabel}
          maxLength={300}
          enterKeyHint="go"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-3 outline-none placeholder:text-label-3"
        />
        {text.trim() && !listening ? (
          <button type="submit" disabled={busy} aria-label={labels.askSend} className="pressable mr-1.5 grid size-10 shrink-0 place-items-center rounded-full bg-tint text-on-tint disabled:opacity-50">
            <Icon name="send" className={busy ? 'motion-safe:animate-pulse' : undefined} />
          </button>
        ) : (
          canSpeak && (
            <button
              type="button"
              onClick={speak}
              aria-pressed={listening !== undefined}
              aria-label={listening ? labels.askMicStop : labels.askMic}
              className={`pressable mr-1.5 grid size-10 shrink-0 place-items-center rounded-full ${listening ? 'bg-tint text-on-tint motion-safe:animate-pulse' : 'text-tint'}`}
            >
              <Icon name="mic" active={listening !== undefined} />
            </button>
          )
        )}
      </form>
      {busy ? (
        <p className="px-4 text-[0.8125rem] text-label-2">{labels.askBusy}</p>
      ) : speechFailed ? (
        <p className="px-4 text-[0.8125rem] text-late">{labels.askSpeechFailed}</p>
      ) : note ? (
        <p role="status" className="px-4 text-[0.9375rem]">
          {note}
        </p>
      ) : (
        <p className="px-4 text-[0.75rem] text-label-2">
          {labels.askNotice}{' '}
          <Link href={privacyHref} className="underline">
            {labels.askNoticeLink}
          </Link>
        </p>
      )}
    </div>
  )
}
