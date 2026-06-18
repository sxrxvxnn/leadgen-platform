import { useState } from 'react'
import { motion } from 'motion/react'

const PALETTE = ['#e8a87c','#a86448','#5b8db8','#7b6bae','#4a9c69','#c8b8f8','#8ec5e8','#e87c7c','#b8c85b','#7cc8b8']
const SIZE = 30

function hashColor(name) {
  let h = 0
  for (const c of name) h = (h << 5) - h + c.charCodeAt(0)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

function initials(name) {
  const parts = (name || '?').trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function ImagesFanBadge({ leads = [], max = 5 }) {
  const [hovered, setHovered] = useState(false)
  const items = leads.slice(0, max)
  const extra = leads.length - max

  if (items.length === 0) return null

  const GAP_STACKED  = -(SIZE * 0.45)
  const GAP_FANNED   = 6
  const fanned_width = items.length * SIZE + (items.length - 1) * GAP_FANNED

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        height: SIZE,
        width: hovered
          ? fanned_width + (extra > 0 ? SIZE + GAP_FANNED : 0)
          : SIZE + (items.length - 1) * (SIZE + GAP_STACKED),
        transition: 'width 0.35s cubic-bezier(0.22,1,0.36,1)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {items.map((lead, i) => {
        const color = hashColor(lead.name || String(i))
        const init  = initials(lead.name)
        const x = hovered
          ? i * (SIZE + GAP_FANNED)
          : i * (SIZE + GAP_STACKED)

        return (
          <motion.div
            key={lead.id || i}
            animate={{ x }}
            transition={{ type: 'spring', stiffness: 280, damping: 22, mass: 0.6 }}
            title={lead.name}
            style={{
              position: 'absolute',
              left: 0,
              width: SIZE,
              height: SIZE,
              borderRadius: '50%',
              background: color,
              border: '2px solid var(--bg, #fff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-sans, sans-serif)',
              fontSize: 10,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.02em',
              cursor: 'default',
              zIndex: items.length - i,
              userSelect: 'none',
            }}
          >
            {init}
          </motion.div>
        )
      })}

      {extra > 0 && (
        <motion.div
          animate={{ x: hovered ? items.length * (SIZE + GAP_FANNED) : items.length * (SIZE + GAP_STACKED) }}
          transition={{ type: 'spring', stiffness: 280, damping: 22, mass: 0.6 }}
          style={{
            position: 'absolute',
            left: 0,
            width: SIZE,
            height: SIZE,
            borderRadius: '50%',
            background: 'var(--border-strong, #c4c1bd)',
            border: '2px solid var(--bg, #fff)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--text-muted, #888)',
            zIndex: 0,
          }}
        >
          +{extra}
        </motion.div>
      )}
    </div>
  )
}
