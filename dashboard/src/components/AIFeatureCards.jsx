import { useState } from 'react'
import { motion } from 'motion/react'

const FEATURES = [
  {
    id: 'icp',
    icon: '◎',
    title: 'ICP Score',
    headline: 'Qualify every lead',
    sub: 'AI scores 0–100 vs your ideal customer profile',
    colors: ['#e8a87c', '#a86448', '#c47bae'],
    bg: 'linear-gradient(145deg, rgba(168,100,72,0.11) 0%, rgba(123,107,174,0.07) 100%)',
    border: 'rgba(168,100,72,0.22)',
    dot: '#a86448',
  },
  {
    id: 'email',
    icon: '✦',
    title: 'Email Draft',
    headline: 'Write cold emails',
    sub: 'Personalized subject + body in seconds',
    colors: ['#8ec5e8', '#5b8db8', '#4a9c69'],
    bg: 'linear-gradient(145deg, rgba(91,141,184,0.11) 0%, rgba(74,124,89,0.07) 100%)',
    border: 'rgba(91,141,184,0.22)',
    dot: '#5b8db8',
  },
  {
    id: 'enrich',
    icon: '⚡',
    title: 'Full Enrich',
    headline: 'Enrich in seconds',
    sub: 'Website · compliance · maps in one run',
    colors: ['#c8b8f8', '#7b6bae', '#5b8db8'],
    bg: 'linear-gradient(145deg, rgba(123,107,174,0.11) 0%, rgba(91,141,184,0.07) 100%)',
    border: 'rgba(123,107,174,0.22)',
    dot: '#7b6bae',
  },
]

// Stacked: slightly offset + rotated so cards look piled
const STACKED = [
  { x: -10, y: 7,  rotate: -5,  zIndex: 1 },
  { x:   0, y: 2,  rotate: -1.5, zIndex: 3 },
  { x:  10, y: 5,  rotate:  3,  zIndex: 2 },
]

// Fanned: spread evenly with symmetric tilt
const FANNED = [
  { x: -220, y: 6,  rotate: -9,  zIndex: 1 },
  { x:    0, y: -10, rotate: 0,   zIndex: 3 },
  { x:  220, y: 6,  rotate:  9,  zIndex: 2 },
]

function GradientText({ text, colors, active, id }) {
  const grad = `linear-gradient(90deg, ${colors.join(', ')}, ${colors[0]})`
  return (
    <>
      {active && (
        <style>{`
          @keyframes fey-${id} {
            0%   { background-position: 0%   center; }
            100% { background-position: 200% center; }
          }
          .fey-${id} { animation: fey-${id} 2.4s linear infinite; }
        `}</style>
      )}
      <h3
        className={active ? `fey-${id}` : undefined}
        style={{
          margin: 0,
          fontSize: '15px',
          fontWeight: 660,
          letterSpacing: '-0.025em',
          lineHeight: 1.25,
          background: grad,
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {text}
      </h3>
    </>
  )
}

export default function AIFeatureCards() {
  const [hovered, setHovered] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0 32px' }}>
      <p style={{
        fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', opacity: 0.5,
        margin: '0 0 18px',
      }}>
        AI Features — hover to explore
      </p>

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ position: 'relative', height: '156px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {FEATURES.map((feat, i) => {
          const pos = hovered ? FANNED[i] : STACKED[i]
          return (
            <motion.div
              key={feat.id}
              animate={{ x: pos.x, y: pos.y, rotate: pos.rotate, zIndex: pos.zIndex }}
              transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.75 }}
              style={{
                position: 'absolute',
                width: '182px',
                borderRadius: '16px',
                padding: '18px 18px 15px',
                background: feat.bg,
                border: `1px solid ${feat.border}`,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                boxShadow: '0 6px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.05)',
                willChange: 'transform',
              }}
            >
              <div style={{ fontSize: '19px', lineHeight: 1, marginBottom: '10px' }}>{feat.icon}</div>
              <GradientText text={feat.headline} colors={feat.colors} active={hovered} id={feat.id} />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '5px 0 0', lineHeight: 1.45, opacity: 0.75 }}>
                {feat.sub}
              </p>
              <div style={{ marginTop: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: feat.dot, flexShrink: 0 }} />
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {feat.title}
                </span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
