import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'

// ── Dark MacBook keyboard SVG ─────────────────────────────────────────
const C = {
  body:  '#1c1c1e',
  key:   '#2a2a2c',
  edge:  '#3a3a3c',
  dim:   '#505050',
  bezel: '#161618',
}

// Renders one row of keys from a [width, label?] array
function renderRow(row, y, h, sx = 14, gap = 5) {
  let x = sx
  return row.map(([w, label], i) => {
    const el = (
      <g key={i}>
        <rect x={x} y={y} width={w} height={h} rx={3.5}
              fill={C.key} stroke={C.edge} strokeWidth={0.6} />
        {label != null && (
          <text x={x + w / 2} y={y + h / 2}
                fill={C.dim} fontSize={7.5}
                fontFamily="system-ui,sans-serif"
                textAnchor="middle" dominantBaseline="middle">
            {label}
          </text>
        )}
      </g>
    )
    x += w + gap
    return el
  })
}

function Keyboard() {
  return (
    <svg viewBox="0 0 920 308" xmlns="http://www.w3.org/2000/svg"
         style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="920" height="308" fill={C.body} />

      {/* ── Fn row ──────── y=10 h=26 */}
      {renderRow([
        [52,'esc'], [14,null],
        [48,'F1'],[48,'F2'],[48,'F3'],[48,'F4'], [14,null],
        [48,'F5'],[48,'F6'],[48,'F7'],[48,'F8'], [14,null],
        [48,'F9'],[48,'F10'],[48,'F11'],[48,'F12'], [16,null],
        [52,'◉'],
      ], 10, 26, 14, 0)}

      {/* ── Number row ── y=46 h=36 */}
      {renderRow([
        [54,'`'],[54,'1'],[54,'2'],[54,'3'],[54,'4'],[54,'5'],
        [54,'6'],[54,'7'],[54,'8'],[54,'9'],[54,'0'],[54,'-'],[54,'='],
        [124,'delete'],
      ], 46, 36)}

      {/* ── QWERTY ──────── y=87 h=36 */}
      {renderRow([
        [80,'tab'],
        [54,'Q'],[54,'W'],[54,'E'],[54,'R'],[54,'T'],
        [54,'Y'],[54,'U'],[54,'I'],[54,'O'],[54,'P'],
        [54,'['],[54,']'],[108,'\\'],
      ], 87, 36)}

      {/* ── ASDF ─────────── y=128 h=36 */}
      {renderRow([
        [94,'caps'],
        [54,'A'],[54,'S'],[54,'D'],[54,'F'],[54,'G'],
        [54,'H'],[54,'J'],[54,'K'],[54,'L'],[54,';'],[54,"'"],
        [148,'return'],
      ], 128, 36)}

      {/* ── ZXCV ─────────── y=169 h=36 */}
      {renderRow([
        [124,'shift'],
        [54,'Z'],[54,'X'],[54,'C'],[54,'V'],[54,'B'],
        [54,'N'],[54,'M'],[54,','],[54,'.'],[54,'/'],
        [124,'shift'],
      ], 169, 36)}

      {/* ── Bottom row ── y=210 h=36 */}
      {renderRow([
        [54,'fn'],[64,'ctrl'],[64,'⌥'],[84,'⌘'],
        [268,''],
        [84,'⌘'],[64,'⌥'],
      ], 210, 36)}

      {/* Arrow keys — ← full, ↑/↓ half, → full */}
      <rect x={752} y={210} width={52} height={36} rx={3.5} fill={C.key} stroke={C.edge} strokeWidth={0.6} />
      <text x={778} y={228} fill={C.dim} fontSize={7.5} fontFamily="system-ui" textAnchor="middle" dominantBaseline="middle">←</text>

      <rect x={809} y={210} width={52} height={16} rx={3.5} fill={C.key} stroke={C.edge} strokeWidth={0.6} />
      <text x={835} y={218} fill={C.dim} fontSize={7.5} fontFamily="system-ui" textAnchor="middle" dominantBaseline="middle">↑</text>

      <rect x={809} y={230} width={52} height={16} rx={3.5} fill={C.key} stroke={C.edge} strokeWidth={0.6} />
      <text x={835} y={238} fill={C.dim} fontSize={7.5} fontFamily="system-ui" textAnchor="middle" dominantBaseline="middle">↓</text>

      <rect x={866} y={210} width={40} height={36} rx={3.5} fill={C.key} stroke={C.edge} strokeWidth={0.6} />
      <text x={886} y={228} fill={C.dim} fontSize={7.5} fontFamily="system-ui" textAnchor="middle" dominantBaseline="middle">→</text>

      {/* Spacebar glow */}
      <defs>
        <radialGradient id="sg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      <rect x={271} y={213} width={266} height={30} rx={3.5} fill="url(#sg)" />

      {/* Trackpad */}
      <rect x={310} y={256} width={300} height={46} rx={9}
            fill="#232325" stroke={C.edge} strokeWidth={0.6} />
    </svg>
  )
}

// ── MacBook Scroll ────────────────────────────────────────────────────
export function MacbookScroll({ children }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  // Lid rotates from nearly-closed to open
  const rotate   = useTransform(scrollYProgress, [0, 0.5], [28, 0])
  const opacity  = useTransform(scrollYProgress, [0.1, 0.45], [0, 1])
  const scale    = useTransform(scrollYProgress, [0, 0.55], [0.55, 1])
  const translateY = useTransform(scrollYProgress, [0, 0.5], ['10%', '0%'])

  return (
    <div ref={ref} style={{ height: '260vh', position: 'relative', background: '#0a0a0a' }}>
      <div style={{
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        perspective: '1000px',
        perspectiveOrigin: '50% 30%',
        background: '#0a0a0a',
      }}>
        <motion.div style={{
          scale,
          translateY,
          transformStyle: 'preserve-3d',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: 900,
        }}>

          {/* ── SCREEN LID ───────────────────────────────────────── */}
          <motion.div style={{
            rotateX: rotate,
            transformOrigin: 'bottom center',
            transformStyle: 'preserve-3d',
            width: '100%',
            // Outer aluminum edge
            background: 'linear-gradient(180deg,#3a3a3c 0%,#2a2a2c 100%)',
            borderRadius: '12px 12px 0 0',
            padding: '3px 3px 0',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}>
            {/* Dark glass bezel */}
            <div style={{
              background: C.bezel,
              borderRadius: '10px 10px 0 0',
              padding: '18px 16px 0',
              position: 'relative',
            }}>
              {/* Camera */}
              <div style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: '#2e2e30',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.05)',
              }} />

              {/* Screen area */}
              <div style={{
                background: '#f5f5f5',
                borderRadius: '4px 4px 0 0',
                overflow: 'hidden',
                height: 430,
              }}>
                <motion.div style={{ opacity, height: '100%' }}>
                  {children}
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* ── KEYBOARD / BASE ──────────────────────────────────── */}
          <div style={{
            width: '100%',
            height: 308,
            borderRadius: '0 0 16px 16px',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <Keyboard />
          </div>

          {/* Bottom chin / base edge */}
          <div style={{
            width: '96%',
            height: 8,
            background: 'linear-gradient(180deg,#2a2a2c 0%,#222224 100%)',
            borderRadius: '0 0 20px 20px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
          }} />

        </motion.div>
      </div>
    </div>
  )
}
