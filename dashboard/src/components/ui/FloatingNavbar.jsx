import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

export function FloatingNavbar({ items = [], logo, cta }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const lastY = { current: 0 }
    function onScroll() {
      const y = window.scrollY
      setVisible(y > 100)
      lastY.current = y
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: -80,  opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 9999,
            padding: '6px 6px 6px 20px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.8) inset',
          }}
        >
          {/* Logo */}
          {logo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginRight: 8 }}>
              <div style={{ width: 22, height: 22, background: '#E7000B', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.5"/>
                  <circle cx="8" cy="8" r="4" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.85"/>
                  <circle cx="8" cy="8" r="1.5" fill="#FFFFFF"/>
                  <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </div>
              <span style={{
                fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#0A0A0A',
              }}>
                {logo}
              </span>
            </div>
          )}

          {/* Nav items */}
          {items.map(item => (
            <a
              key={item.label}
              href={item.href}
              style={{
                fontFamily: "'Host Grotesk', sans-serif",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#6B7280',
                textDecoration: 'none',
                padding: '6px 12px',
                borderRadius: 9999,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#0A0A0A' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6B7280' }}
            >
              {item.label}
            </a>
          ))}

          {/* CTA button */}
          {cta && (
            <a
              href={cta.href}
              style={{
                fontFamily: "'Host Grotesk', sans-serif",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#FFFFFF',
                background: '#E7000B',
                textDecoration: 'none',
                padding: '7px 18px',
                borderRadius: 9999,
                marginLeft: 4,
                transition: 'background 0.15s, box-shadow 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#C50009' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#E7000B' }}
            >
              {cta.label}
            </a>
          )}
        </motion.nav>
      )}
    </AnimatePresence>
  )
}
