// Speech recognition is the browser's own: Safari and Chrome have it, under a
// prefixed name in some versions, Firefox does not. TypeScript's DOM types
// leave the recogniser itself out, so the part used here is described by hand.
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
type RecognitionCtor = new () => Recognition

const recognitionCtor = (): RecognitionCtor | undefined => {
  const scope = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition
}

export const speechSupported = () => recognitionCtor() !== undefined

type Handlers = {
  // Called with everything heard so far, while the person is still speaking and once at the end.
  text(text: string, final: boolean): void
  end(error?: string): void
}

// Starts listening for one utterance. Returns how to stop early, or nothing where speech recognition is missing.
export const listen = (lang: string, on: Handlers): { stop(): void } | undefined => {
  const Recognition = recognitionCtor()
  if (!Recognition) return undefined
  const recognition = new Recognition()
  recognition.lang = lang
  recognition.interimResults = true
  recognition.continuous = false
  let error: string | undefined
  recognition.onresult = (event) => {
    const results = Array.from(event.results)
    on.text(results.map((result) => result[0]?.transcript ?? '').join(''), results.every((result) => result.isFinal))
  }
  recognition.onerror = (event) => {
    error = event.error
  }
  recognition.onend = () => on.end(error)
  recognition.start()
  return { stop: () => recognition.stop() }
}
