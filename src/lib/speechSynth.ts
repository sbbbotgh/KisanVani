import type { SupportedDialect } from '../types'

const localeByDialect: Record<SupportedDialect, string> = {
  English: 'en-IN',
  Hinglish: 'hi-IN',
  Punjlish: 'pa-IN',
  Tanglish: 'ta-IN',
  Hindi: 'hi-IN',
  Punjabi: 'pa-IN',
  Tamil: 'ta-IN',
  Marathi: 'mr-IN',
}

let activeAudio: HTMLAudioElement | null = null
let activeAudioUrl: string | null = null

export class VoiceApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'VoiceApiError'
    this.status = status
  }
}

async function readError(response: Response, fallback: string): Promise<Error> {
  try {
    const body = await response.json() as { error?: string }
    return new VoiceApiError(body.error || fallback, response.status)
  } catch {
    return new VoiceApiError(fallback, response.status)
  }
}

export async function transcribeRecordedAudio(blob: Blob, dialect: SupportedDialect): Promise<string> {
  const response = await fetch(`/api/voice/speech-to-text?language_code=${localeByDialect[dialect]}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'audio/webm' },
    body: blob,
  })
  if (!response.ok) throw await readError(response, 'Sarvam speech recognition is unavailable.')
  const body = await response.json() as { transcript?: unknown }
  if (typeof body.transcript !== 'string') throw new Error('Sarvam returned an invalid transcript.')
  return body.transcript.trim()
}

export async function synthesizeAdvisoryAudio(text: string, dialect: SupportedDialect): Promise<Blob> {
  const response = await fetch('/api/voice/text-to-speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, languageCode: localeByDialect[dialect] }),
  })
  if (!response.ok) throw await readError(response, 'Sarvam speech synthesis is unavailable.')
  return response.blob()
}

export function stopSpeaking(): void {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio.currentTime = 0
    activeAudio = null
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl)
    activeAudioUrl = null
  }
}

export async function playSpeechAudio(blob: Blob): Promise<HTMLAudioElement> {
  stopSpeaking()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  activeAudio = audio
  activeAudioUrl = url
  audio.addEventListener('ended', () => {
    if (activeAudio === audio) stopSpeaking()
  }, { once: true })
  audio.addEventListener('error', () => {
    if (activeAudio === audio) stopSpeaking()
  }, { once: true })
  try {
    await audio.play()
    return audio
  } catch (error) {
    if (activeAudio === audio) stopSpeaking()
    throw error
  }
}
