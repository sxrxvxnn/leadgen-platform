import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

export function MultiStepLoader({ steps = [], active = false, onComplete }) {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!active) { setCurrent(0); return }

    timerRef.current = setInterval(() => {
      setCurrent(prev => {
        if (prev >= steps.length - 1) {
          clearInterval(timerRef.current)
          onComplete?.()
          return prev
        }
        return prev + 1
      })
    }, 820)

    return () => clearInterval(timerRef.current)
  }, [active, steps.length])

  if (!active) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(255,252,252,0.96)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
      }}
    >
      {/* Spinner */}
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ animation: 'spin 1.2s linear infinite' }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <circle cx="24" cy="24" r="20" stroke="rgba(49,38,59,0.10)" strokeWidth="2.5"/>
          <path d="M24 4 A20 20 0 0 1 44 24" stroke="#31263b" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Steps list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 280 }}>
        {steps.map((step, i) => {
          const done    = i < current
          const active_ = i === current
          const pending = i > current

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: pending ? 0.35 : 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: 'flex', alignItems: 'center', gap: 14 }}
            >
              {/* Icon */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? '#31263b' : active_ ? 'transparent' : 'transparent',
                border: done ? 'none' : active_ ? '2px solid #31263b' : '2px solid rgba(49,38,59,0.2)',
                transition: 'all 0.3s',
              }}>
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5.5l2 2 4-4" stroke="#fffcfc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : active_ ? (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#31263b' }}/>
                ) : null}
              </div>

              {/* Text */}
              <span style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 14,
                fontWeight: active_ ? 600 : 400,
                color: done ? '#717a94' : active_ ? '#01011b' : '#c0b8c4',
                transition: 'all 0.25s',
                letterSpacing: '-0.01em',
              }}>
                {step}
              </span>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
