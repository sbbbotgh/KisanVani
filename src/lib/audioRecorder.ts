export interface AudioRecordingResult {
  blob: Blob
  sizeKb: number
  durationSeconds: number
}

export class LowBandwidthAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private startTime = 0
  private stream: MediaStream | null = null

  async startRecording(is2GLiteMode: boolean): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Audio recording is not supported in this browser.')
    }
    if (this.mediaRecorder?.state === 'recording') {
      throw new Error('A voice recording is already in progress.')
    }

    this.audioChunks = []
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 16000 },
        noiseSuppression: true,
        echoCancellation: true,
      },
    })

    try {
      const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus']
        .find((candidate) => MediaRecorder.isTypeSupported(candidate))
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: is2GLiteMode ? 16000 : 32000,
        ...(mimeType ? { mimeType } : {}),
      }
      this.mediaRecorder = new MediaRecorder(this.stream, options)
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data)
      }
      this.mediaRecorder.start(250)
      this.startTime = Date.now()
    } catch (error) {
      this.releaseStream()
      this.mediaRecorder = null
      throw error
    }
  }

  stopRecording(): Promise<AudioRecordingResult> {
    return new Promise((resolve, reject) => {
      const recorder = this.mediaRecorder
      if (!recorder || recorder.state === 'inactive') {
        this.releaseStream()
        reject(new Error('No active recording to stop.'))
        return
      }

      recorder.onerror = (event) => {
        this.releaseStream()
        reject(event.error ?? new Error('Audio recording failed.'))
      }
      recorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: recorder.mimeType || 'audio/webm' })
        const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000))
        this.releaseStream()
        this.mediaRecorder = null

        resolve({
          blob,
          sizeKb: Number((blob.size / 1024).toFixed(1)),
          durationSeconds,
        })
      }
      recorder.stop()
    })
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.onstop = null
      this.mediaRecorder.stop()
    }
    this.mediaRecorder = null
    this.audioChunks = []
    this.releaseStream()
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
  }
}
