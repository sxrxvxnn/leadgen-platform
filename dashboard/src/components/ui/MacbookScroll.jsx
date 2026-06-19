import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'

// ── SVG Keyboard ──────────────────────────────────────────────────────
// Pre-computed proportional rows; no DOM flex = no sizing surprises
function SVGKeyboard({ width = 496 }) {
  const GAP = 2.5
  const R   = 1.8

  function row(y, h, count) {
    const kw = (width - (count - 1) * GAP) / count
    return Array.from({ length: count }, (_, i) => ({
      x: +(i * (kw + GAP)).toFixed(2), y, w: +kw.toFixed(2), h,
    }))
  }

  function bottomRow(y, h) {
    // 18.5 units: fn1.5 ctrl1.5 opt1.5 cmd2 space5.5 cmd2 opt1.5 ←1 ↕1 →1
    const unit = (width - 9 * GAP) / 18.5
    const defs = [1.5, 1.5, 1.5, 2.0, 5.5, 2.0, 1.5, 1, 1, 1]
    const out = []; let x = 0
    defs.forEach(u => {
      const w = +(u * unit).toFixed(2)
      out.push({ x: +x.toFixed(2), y, w, h })
      x += w + GAP
    })
    return out
  }

  const rects = [
    ...row(0,   11, 15),   // Fn
    ...row(14,  17, 14),   // Numbers
    ...row(34,  17, 14),   // QWERTY
    ...row(54,  17, 13),   // ASDF
    ...row(74,  17, 12),   // ZXCV
    ...bottomRow(94, 19),  // Bottom
  ]

  return (
    <svg width={width} height={115} viewBox={`0 0 ${width} 115`}
      style={{ display: 'block', flexShrink: 0 }}>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h}
          rx={R} ry={R} fill="#1b1b1e" stroke="#313136" strokeWidth={0.7} />
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

  // Whole MacBook grows from 50% to full size
  const scale = useTransform(scrollYProgress, [0, 0.6], [0.50, 1.0])

  // Lid: stays at -65° (closed) until 5% scroll, then opens fully by 72%
  const lidRotate = useTransform(scrollYProgress, [0, 0.05, 0.72], [-65, -65, 0])

  // Screen content fades in as lid passes ~40% open
  const screenOp = useTransform(scrollYProgress, [0.35, 0.65], [0, 1])

  // Title fades + lifts out early
  const titleOp = useTransform(scrollYProgress, [0, 0.18], [1, 0])
  const titleY  = useTransform(scrollYProgress, [0, 0.18], [0, -30])

  const W  = 540  // MacBook width
  const LH = 340  // Lid height (screen)
  const BH = 185  // Base height (keyboard)

  return (
    <div style={{ background: '#0B0B0F' }}>
      {/*
        Outer div: 220vh — scroll target. Provides 220% of viewport height of
        scroll range before the MacBook section ends.
      */}
      <div ref={ref} style={{ minHeight: '220vh', position: 'relative' }}>

        {/*
          Sticky inner: always occupies 100vh in the viewport while the outer
          div scrolls past. No empty black — MacBook is always visible.
        */}
        <div style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>

          {/* ── Title ── Barlow Condensed uppercase, matching landing h2 */}
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

          {/*
            ── 3D rig ──
            Layer 1 (SCALE): motion.div — applies scale. Has transformStyle:preserve-3d
              so the 3D context flows through despite having a transform.
            Layer 2 (PERSPECTIVE): plain div — sets perspective:900px. Has NO transform
              so the perspective is clean and unambiguous for the lid child.
            Layer 3 (LID): motion.div — applies rotateX. Direct child of perspective
              layer, so it renders with full 3D depth.
          */}

          {/* SCALE layer */}
          <motion.div style={{
            scale,
            transformOrigin: 'center bottom',
            transformStyle: 'preserve-3d',   // pass 3D through the scale
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>

            {/* PERSPECTIVE layer — no transform here, pure perspective context */}
            <div style={{
              perspective: '900px',
              transformStyle: 'preserve-3d',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}>

              {/* LID — direct child of perspective div, gets clean 3D */}
              <motion.div style={{
                rotateX: lidRotate,
                transformOrigin: 'bottom center',
                width: W,
                height: LH,
                flexShrink: 0,
              }}>
                {/* Lid chassis */}
                <div style={{
                  width: '100%', height: '100%',
                  background: '#1c1c1e',
                  borderRadius: '13px 13px 0 0',
                  padding: '10px 10px 5px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  boxShadow: '0 0 0 0.5px #2e2e33 inset',
                }}>
                  {/* Camera */}
                  <div style={{
                    position: 'absolute', top: 5, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 6, height: 6,
                    borderRadius: '50%', background: '#2c2c30',
                  }} />
                  {/* Screen */}
                  <div style={{
                    flex: 1, borderRadius: 5,
                    overflow: 'hidden',
                    background: '#111113',  // dark "off" screen
                    position: 'relative',
                  }}>
                    <motion.div style={{
                      opacity: screenOp,
                      position: 'absolute', inset: 0,
                      background: '#f0f0f2',
                      overflow: 'hidden',
                    }}>
                      {children}
                    </motion.div>
                  </div>
                </div>
              </motion.div>

              {/* HINGE */}
              <div style={{
                width: W * 0.80,
                height: 5,
                background: 'linear-gradient(90deg,#090909 0%,#2a2a2d 35%,#3c3c42 50%,#2a2a2d 65%,#090909 100%)',
                flexShrink: 0,
              }} />

              {/* KEYBOARD BASE */}
              <div style={{
                width: W,
                height: BH,
                background: '#1c1c1e',
                borderRadius: '0 0 13px 13px',
                padding: '12px 22px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                flexShrink: 0,
                boxShadow: '0 0 0 0.5px #2e2e33 inset',
              }}>
                <SVGKeyboard width={496} />
                {/* Trackpad */}
                <div style={{
                  margin: '0 auto', width: '40%', flex: 1,
                  borderRadius: 8, background: '#161618',
                  border: '0.5px solid #2e2e33',
                }} />
              </div>

            </div>{/* end PERSPECTIVE */}
          </motion.div>{/* end SCALE */}

        </div>{/* end sticky */}
      </div>{/* end scroll target */}
    </div>
  )
}
