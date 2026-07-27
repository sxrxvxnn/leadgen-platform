import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

export function Tabs({ tabs, value, onChange, style }) {
  const tabRefs = useRef([])
  const [pill, setPill] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const idx = tabs.findIndex((t) => t.value === value)
    const el = tabRefs.current[idx]
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value, tabs])

  return (
    <div style={{ position: 'relative', display: 'inline-flex', gap: 0, ...style }}>
      {/* sliding underline indicator */}
      <motion.div
        animate={{ left: pill.left, width: pill.width }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        style={{
          position: 'absolute',
          bottom: 0,
          height: 2,
          background: 'var(--text, #01011b)',
          borderRadius: 1,
          zIndex: 1,
        }}
      />

      {tabs.map((tab, i) => (
        <button
          key={tab.value}
          ref={(el) => (tabRefs.current[i] = el)}
          onClick={() => onChange(tab.value)}
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: value === tab.value ? 'var(--text, #01011b)' : 'var(--text-muted, #888)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '10px 16px',
            transition: 'color 0.18s',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {tab.label}
          {tab.count != null && (
            <span
              style={{
                marginLeft: 6,
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 9,
                color: value === tab.value ? 'var(--text-secondary)' : 'var(--text-muted)',
                background: 'var(--bg-secondary, rgba(0,0,0,0.05))',
                border: '1px solid var(--border, rgba(0,0,0,0.1))',
                borderRadius: 4,
                padding: '1px 5px',
              }}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
