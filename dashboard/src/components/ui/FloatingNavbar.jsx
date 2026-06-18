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
            background: 'rgba(18,18,18,0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid #2A2A2A',
            borderRadius: 0,
            padding: '8px 8px 8px 18px',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          {/* Logo */}
          {logo && (
            <span style={{
              fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#F5F5F5',
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
                fontFamily: "'Host Grotesk', sans-serif",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#5B6670',
                textDecoration: 'none',
                padding: '6px 12px',
                borderRadius: 0,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#F5F5F5' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#5B6670' }}
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
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#121212',
                background: '#FFFF00',
                textDecoration: 'none',
                padding: '7px 16px',
                borderRadius: 0,
                marginLeft: 8,
                transition: 'background 0.15s, box-shadow 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#E5E500'; e.currentTarget.style.boxShadow = '0 0 12px rgba(255,255,0,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFF00'; e.currentTarget.style.boxShadow = 'none' }}
            >
              {cta.label}
            </a>
          )}
        </motion.nav>
      )}
    </AnimatePresence>
  )
}
