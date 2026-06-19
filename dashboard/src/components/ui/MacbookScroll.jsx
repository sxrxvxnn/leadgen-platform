import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'

// ── SVG Keyboard — pre-calculated proportional key shapes ────────────
function SVGKeyboard() {
  const W = 476
  const GAP = 2.5
  const R = 1.8

  function evenRow(y, h, count) {
    const keyW = (W - (count - 1) * GAP) / count
    return Array.from({ length: count }, (_, i) => ({
      x: i * (keyW + GAP), y, w: keyW, h,
    }))
  }

  // Bottom row: [fn ctrl opt cmd ----space---- cmd opt ← ↑↓ →]
  function bottomRow(y, h) {
    const unit = (W - 9 * GAP) / 18
    const defs = [1.5, 1.5, 1.5, 2.2, 5.3, 2.2, 1.5, 1, 1, 1]
    const keys = []; let x = 0
    defs.forEach(u => {
      const w = u * unit
      keys.push({ x, y, w, h })
      x += w + GAP
    })
    return keys
  }

  const rects = [
    ...evenRow(0,    11, 15),
    ...evenRow(14,   17, 14),
    ...evenRow(34,   17, 14),
    ...evenRow(54,   17, 13),
    ...evenRow(74,   17, 12),
    ...bottomRow(94, 19),
  ]

  return (
    <svg
      width={W} height={115}
      viewBox={`0 0 ${W} 115`}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x} y={r.y}
          width={r.w} height={r.h}
          rx={R} ry={R}
          fill="#1b1b1e"
          stroke="#2e2e33"
          strokeWidth={0.6}
        />
      ))}
    </svg>
  )
}

// ── MacbookScroll ─────────────────────────────────────────────────────
export function MacbookScroll({ children, title }) {
  const ref = useRef(null)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  const scale     = useTransform(scrollYProgress, [0, 0.55], [0.48, 1.0])
  const lidRotate = useTransform(scrollYProgress, [0, 0.06, 0.72], [-62, -62, 0])
  const contentOp = useTransform(scrollYProgress, [0.38, 0.62], [0, 1])
  const titleOp   = useTransform(scrollYProgress, [0, 0.18], [1, 0])
  const titleY    = useTransform(scrollYProgress, [0, 0.18], [0, -28])

  const MAC_W  = 530
  const LID_H  = 330
  const BASE_H = 195

  return (
    <div style={{ background: '#0B0B0F' }}>
      {/*
        Outer div is 220vh — the scroll target.
        Inner sticky div pins to top of viewport so the MacBook is always
        visible; no long empty black space while scrolling.
      */}
      <div ref={ref} style={{ minHeight: '220vh', position: 'relative' }}>
        <div style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          perspective: '1000px',
        }}>

          {/* Title — Barlow Condensed, uppercase, matches site display font */}
          {title && (
            <motion.h2 style={{
              opacity: titleOp,
              y: titleY,
              marginBottom: 36,
              textAlign: 'center',
              fontFamily: "'Barlow Condensed','Arial Narrow',sans-serif",
              fontSize: 'clamp(42px, 5vw, 70px)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              lineHeight: 1.0,
              color: '#ffffff',
            }}>
              {title}
            </motion.h2>
          )}

          {/* MacBook — scale grows from 48% to 100% as you scroll */}
          <motion.div style={{
            scale,
            transformOrigin: 'center bottom',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>

            {/* Lid — rotates open from -62° to 0° */}
            <motion.div style={{
              rotateX: lidRotate,
              transformOrigin: 'bottom center',
              transformStyle: 'preserve-3d',
              width: MAC_W,
              height: LID_H,
              flexShrink: 0,
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: '#1e1e20',
                borderRadius: '14px 14px 0 0',
                padding: '10px 10px 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                position: 'relative',
                boxShadow: '0 -1px 0 #2c2c2e inset',
              }}>
                {/* Camera dot */}
                <div style={{
                  position: 'absolute', top: 5, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 5, height: 5,
                  borderRadius: '50%',
                  background: '#2e2e32',
                }} />
                {/* Screen */}
                <div style={{
                  flex: 1,
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: '#f0f0f2',
                }}>
                  <motion.div style={{ opacity: contentOp, height: '100%' }}>
                    {children}
                  </motion.div>
                </div>
              </div>
            </motion.div>

            {/* Hinge seam */}
            <div style={{
              width: MAC_W * 0.82,
              height: 5,
              background: 'linear-gradient(to right, #0a0a0a 0%, #2c2c2e 40%, #2c2c2e 60%, #0a0a0a 100%)',
              borderRadius: 1,
              zIndex: 2,
              flexShrink: 0,
            }} />

            {/* Keyboard base */}
            <div style={{
              width: MAC_W,
              height: BASE_H,
              background: '#1e1e20',
              borderRadius: '0 0 14px 14px',
              padding: '14px 27px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              flexShrink: 0,
              boxShadow: '0 1px 0 #2c2c2e inset',
            }}>
              <SVGKeyboard />
              {/* Trackpad */}
              <div style={{
                margin: '0 auto',
                width: '42%',
                flex: 1,
                borderRadius: 9,
                background: '#191919',
                border: '0.5px solid #2a2a2d',
              }} />
            </div>

          </motion.div>
        </div>
      </div>
    </div>
  )
}
