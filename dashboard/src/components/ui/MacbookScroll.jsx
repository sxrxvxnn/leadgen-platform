import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'

export function MacbookScroll({ children }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  // Lid opens: rotateX 28° → 0°
  const rotateX    = useTransform(scrollYProgress, [0, 0.5], [28, 0])
  // Screen content fades in as lid opens
  const opacity    = useTransform(scrollYProgress, [0.1, 0.4], [0, 1])
  // Overall scale: starts smaller, grows to full
  const scale      = useTransform(scrollYProgress, [0, 0.5], [0.65, 1])
  const translateY = useTransform(scrollYProgress, [0, 0.5], ['8%', '0%'])

  return (
    <div ref={ref} style={{ height: '260vh', position: 'relative' }}>
      <div style={{
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        perspective: '1100px',
        perspectiveOrigin: '50% 35%',
      }}>
        <motion.div style={{
          scale,
          translateY,
          transformStyle: 'preserve-3d',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>

          {/* ── SCREEN LID ─────────────────────────────────────── */}
          <motion.div style={{
            rotateX,
            transformOrigin: 'bottom center',
            transformStyle: 'preserve-3d',
            width: 720,
            background: 'linear-gradient(180deg, #d4d4d4 0%, #c8c8c8 100%)',
            borderRadius: '14px 14px 0 0',
            padding: '4px 4px 0',
            boxShadow: '0 -2px 0 #b0b0b0, 0 -20px 60px rgba(0,0,0,0.22)',
          }}>
            {/* Bezel */}
            <div style={{
              background: '#1a1a1a',
              borderRadius: '11px 11px 0 0',
              padding: '18px 16px 0',
              position: 'relative',
            }}>
              {/* Camera notch */}
              <div style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#2a2a2a',
                boxShadow: 'inset 0 0 2px rgba(255,255,255,0.06)',
              }} />
              {/* Screen glass */}
              <div style={{
                background: '#f5f5f5',
                borderRadius: '4px 4px 0 0',
                overflow: 'hidden',
                height: 430,
                position: 'relative',
              }}>
                <motion.div style={{ opacity, height: '100%' }}>
                  {children}
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* ── BASE / KEYBOARD ────────────────────────────────── */}
          <div style={{
            width: 760,
            height: 22,
            background: 'linear-gradient(180deg, #c8c8c8 0%, #b8b8b8 60%, #a8a8a8 100%)',
            borderRadius: '0 0 10px 10px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: 4,
            position: 'relative',
          }}>
            {/* Hinge groove */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 20,
              right: 20,
              height: 2,
              background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.12), transparent)',
              borderRadius: 2,
            }} />
            {/* Trackpad */}
            <div style={{
              width: 120,
              height: 8,
              background: 'rgba(0,0,0,0.08)',
              borderRadius: 4,
            }} />
          </div>

        </motion.div>
      </div>
    </div>
  )
}
