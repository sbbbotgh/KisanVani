import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'

const SARVAM_API_BASE = 'https://api.sarvam.ai'
const MAX_AUDIO_BYTES = 1_000_000
const MAX_TTS_CHARACTERS = 2500
const UPSTREAM_TIMEOUT_MS = 30_000
const SPEECH_REQUESTS_PER_MINUTE = 8
const speechRateLimits = new Map<string, { startedAt: number; count: number }>()

const languageCodes = new Set([
  'bn-IN', 'en-IN', 'gu-IN', 'hi-IN', 'kn-IN', 'ml-IN', 'mr-IN',
  'od-IN', 'pa-IN', 'ta-IN', 'te-IN',
])

const speakerByLanguage: Record<string, string> = {
  'en-IN': 'shubh_enhi_ads',
  'hi-IN': 'shubh_hi_devotional',
  'mr-IN': 'ishita_mr_conversational',
  'pa-IN': 'anand_pa_conversation',
  'ta-IN': 'gokul_ta_narration',
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.end(JSON.stringify(body))
}

function isRateLimited(request: IncomingMessage): boolean {
  const forwardedFor = request.headers['x-forwarded-for']
  const clientIp = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : request.socket.remoteAddress ?? 'unknown'
  const now = Date.now()
  const current = speechRateLimits.get(clientIp)
  if (!current || now - current.startedAt >= 60_000) {
    speechRateLimits.set(clientIp, { startedAt: now, count: 1 })
    return false
  }
  current.count += 1
  return current.count > SPEECH_REQUESTS_PER_MINUTE
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_AUDIO_BYTES) {
        reject(new Error('Audio request exceeds the upload limit.'))
        request.resume()
      } else {
        chunks.push(chunk)
      }
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

async function handleSpeechToText(
  request: IncomingMessage,
  response: ServerResponse,
  apiKey: string,
  languageCode: string,
): Promise<void> {
  if (!languageCodes.has(languageCode)) {
    sendJson(response, 400, { error: 'Choose a supported speech language.' })
    return
  }

  const contentType = request.headers['content-type']?.split(';')[0] ?? ''
  if (!contentType.startsWith('audio/')) {
    sendJson(response, 415, { error: 'Send a recorded audio file to transcribe.' })
    return
  }

  const declaredSize = Number(request.headers['content-length'] ?? 0)
  if (declaredSize > MAX_AUDIO_BYTES) {
    sendJson(response, 413, { error: 'The voice recording is too large.' })
    request.resume()
    return
  }

  const audio = await readBody(request)
  if (!audio.length) {
    sendJson(response, 400, { error: 'The voice recording is empty.' })
    return
  }

  const form = new FormData()
  const extension = contentType.includes('ogg')
    ? 'ogg'
    : contentType.includes('mp4')
      ? 'm4a'
      : contentType.includes('mpeg')
        ? 'mp3'
        : contentType.includes('wav')
          ? 'wav'
          : 'webm'
  form.append('file', new Blob([new Uint8Array(audio)], { type: contentType }), `farmer-voice.${extension}`)
  form.append('language_code', languageCode)
  form.append('model', 'saaras:v3')
  form.append('mode', 'codemix')

  const upstream = await fetch(`${SARVAM_API_BASE}/speech-to-text`, {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey },
    body: form,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  if (!upstream.ok) {
    sendJson(response, 502, { error: 'Sarvam could not transcribe this recording. Please retry or type your question.' })
    return
  }

  const result = await upstream.json() as { transcript?: unknown; language_code?: unknown }
  if (typeof result.transcript !== 'string') {
    sendJson(response, 502, { error: 'Sarvam returned an invalid transcription.' })
    return
  }
  sendJson(response, 200, {
    transcript: result.transcript.trim(),
    languageCode: typeof result.language_code === 'string' ? result.language_code : languageCode,
  })
}

async function handleTextToSpeech(
  response: ServerResponse,
  apiKey: string,
  body: Buffer,
): Promise<void> {
  let input: { text?: unknown; languageCode?: unknown }
  try {
    input = JSON.parse(body.toString('utf8')) as typeof input
  } catch {
    sendJson(response, 400, { error: 'Send a valid speech request.' })
    return
  }

  if (typeof input.text !== 'string' || input.text.trim().length === 0 || input.text.length > MAX_TTS_CHARACTERS) {
    sendJson(response, 400, { error: 'Speech text must contain between 1 and 2,500 characters.' })
    return
  }
  if (typeof input.languageCode !== 'string' || !languageCodes.has(input.languageCode)) {
    sendJson(response, 400, { error: 'Choose a supported speech language.' })
    return
  }

  const upstream = await fetch(`${SARVAM_API_BASE}/text-to-speech`, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      text: input.text,
      language_code: input.languageCode,
      model: 'bulbul:v4-flash',
      speaker: speakerByLanguage[input.languageCode] ?? speakerByLanguage['hi-IN'],
      pace: 0.9,
      output_audio_codec: 'mp3',
    }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
  if (!upstream.ok) {
    sendJson(response, 502, { error: 'Sarvam could not prepare spoken advice. Please retry.' })
    return
  }

  const result = await upstream.json() as { audios?: unknown }
  const encodedAudio = Array.isArray(result.audios) ? result.audios[0] : undefined
  if (typeof encodedAudio !== 'string') {
    sendJson(response, 502, { error: 'Sarvam returned an invalid audio response.' })
    return
  }

  const audio = Buffer.from(encodedAudio, 'base64')
  response.statusCode = 200
  response.setHeader('Content-Type', 'audio/mpeg')
  response.setHeader('Content-Length', audio.byteLength)
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.end(audio)
}

function handleVoiceRequest(apiKey: string | undefined): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Use POST for voice services.' })
      return
    }
    if (!apiKey) {
      sendJson(response, 503, { error: 'Sarvam voice services are not configured on the server.' })
      return
    }
    if (isRateLimited(request)) {
      sendJson(response, 429, { error: 'Voice service is busy. Please wait a minute and try again.' })
      return
    }

    const requestUrl = new URL(request.url ?? '/', 'http://localhost')
    if (requestUrl.pathname === '/speech-to-text') {
      void handleSpeechToText(
        request,
        response,
        apiKey,
        requestUrl.searchParams.get('language_code') ?? '',
      ).catch((error: unknown) => {
        const status = error instanceof Error && error.message === 'Audio request exceeds the upload limit.' ? 413 : 502
        sendJson(response, status, {
          error: status === 413 ? 'The voice recording is too large.' : 'Sarvam speech recognition is temporarily unavailable.',
        })
      }).catch(next)
      return
    }

    if (requestUrl.pathname === '/text-to-speech') {
      void readBody(request).then((body) => handleTextToSpeech(response, apiKey, body))
        .catch((error: unknown) => {
          const status = error instanceof Error && error.message === 'Audio request exceeds the upload limit.' ? 413 : 502
          sendJson(response, status, {
            error: status === 413 ? 'The speech request is too large.' : 'Sarvam speech synthesis is temporarily unavailable.',
          })
        }).catch(next)
      return
    }

    next()
  }
}

export function sarvamVoicePlugin(apiKey: string | undefined): Plugin {
  const handler = handleVoiceRequest(apiKey)
  return {
    name: 'sarvam-voice-proxy',
    configureServer(server) {
      server.middlewares.use('/api/voice', handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/voice', handler)
    },
  }
}
