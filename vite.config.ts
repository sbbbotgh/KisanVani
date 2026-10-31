import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { geminiAdvicePlugin } from './server/geminiAdvice.js'
import { ogdMandiPlugin } from './server/ogdMandi.js'
import { sarvamVoicePlugin } from './server/sarvamVoice.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      geminiAdvicePlugin(serverEnv.GEMINI_API_KEY || process.env.GEMINI_API_KEY),
      ogdMandiPlugin(serverEnv.OGD_API_KEY || process.env.OGD_API_KEY),
      sarvamVoicePlugin(serverEnv.SARVAM_API_KEY || process.env.SARVAM_API_KEY),
    ],
  }
})
