import React from 'react'
import ReactDOM from 'react-dom/client'
import { domAnimation, LazyMotion, MotionConfig } from 'framer-motion'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>
        <App />
      </LazyMotion>
    </MotionConfig>
  </React.StrictMode>,
)
