import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

export function FloatingNavbar({ items = [], logo, cta }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      // Original nav (~64px) has scrolled away — show floating nav
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
            background: 'rgba(255,252,252,0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(49,38,59,0.12)',
            borderRadius: 40,
            padding: '8px 8px 8px 18px',
            boxShadow: '0 8px 32px rgba(49,38,59,0.12), 0 1px 4px rgba(49,38,59,0.08)',
          }}
        >
          {/* Logo */}
          {logo && (
            <span style={{
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: '#01011b',
              marginRight: 8,
            }}>
              {logo}
            </span>
          )}

          {/* Nav items */}
          {items.map(item => (
            <a
              key={item.label}
              href={item.href}
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 13,
                fontWeight: 500,
                color: '#717a94',
                textDecoration: 'none',
                padding: '6px 12px',
                borderRadius: 24,
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#01011b'; e.currentTarget.style.background = 'rgba(49,38,59,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#717a94'; e.currentTarget.style.background = 'transparent' }}
            >
              {item.label}
            </a>
          ))}

          {/* CTA button */}
          {cta && (
            <a
              href={cta.href}
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: '#fffcfc',
                background: '#31263b',
                textDecoration: 'none',
                padding: '7px 16px',
                borderRadius: 24,
                marginLeft: 4,
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#01011b'}
              onMouseLeave={e => e.currentTarget.style.background = '#31263b'}
            >
              {cta.label}
            </a>
          )}
        </motion.nav>
      )}
    </AnimatePresence>
  )
}
