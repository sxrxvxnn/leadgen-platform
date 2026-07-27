import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

export function PageLoader({ onDone }) {
  const [count, setCount] = useState(0)
  const [exit, setExit] = useState(false)

  useEffect(() => {
    const start = performance.now()
    const duration = 1500
    let rafId

    function tick(now) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 2.8)
      setCount(Math.round(eased * 100))
      if (t < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        setCount(100)
        setTimeout(() => setExit(true), 280)
        setTimeout(onDone, 980)
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [onDone])

  return (
    <AnimatePresence>
      {!exit ? (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: '#0A0A0A',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            padding: '48px 56px',
          }}
        >
          {/* Site name — top left */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            style={{
              position: 'absolute',
              top: 48,
              left: 56,
              fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#F5F5F5',
            }}
          >
            Sonar
          </motion.div>

          {/* Large percentage */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{
              fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(72px, 16vw, 160px)',
              lineHeight: 1,
              letterSpacing: '-0.03em',
              color: '#F5F5F5',
              marginBottom: 24,
              tabularNums: 'tabular-nums',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {String(count).padStart(3, '0')}
            <span style={{ fontSize: '0.35em', color: '#5B6670', letterSpacing: 0 }}>%</span>
          </motion.div>

          {/* Progress bar */}
          <div
            style={{
              width: '100%',
              height: 1,
              background: '#2A2A2A',
              position: 'relative',
              marginBottom: 16,
            }}
          >
            <motion.div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                background: '#E7000B',
                width: `${count}%`,
                transition: 'width 0.05s linear',
              }}
            />
          </div>

          {/* Loading label */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#3A3A3A',
            }}
          >
            Loading platform
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key="exit"
          initial={{ y: 0 }}
          animate={{ y: '-100%' }}
          transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: '#0A0A0A',
          }}
        />
      )}
    </AnimatePresence>
  )
}
