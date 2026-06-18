import { useRef, useState } from 'react'
import { motion } from 'motion/react'

/* variant="shimmer" — animated diagonal shimmer sweep */
function ShimmerButton({ children, style, href, as: Tag = 'button', ...rest }) {
  const [hovered, setHovered] = useState(false)

  const El = href ? 'a' : Tag
  return (
    <El
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 14,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        color: '#fffcfc',
        background: '#31263b',
        border: 'none',
        borderRadius: 3,
        padding: '11px 22px',
        cursor: 'pointer',
        textDecoration: 'none',
        ...style,
      }}
      {...rest}
    >
      {/* Shimmer overlay */}
      <motion.div
        animate={{ x: hovered ? '200%' : '-60%' }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '60%', height: '100%',
          background: 'linear-gradient(105deg, transparent 30%, rgba(255,252,252,0.22) 50%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <span style={{ position: 'relative', zIndex: 2 }}>{children}</span>
    </El>
  )
}

/* variant="glow" — subtle radial glow that pulses */
function GlowButton({ children, style, href, as: Tag = 'button', ...rest }) {
  const [hovered, setHovered] = useState(false)
  const El = href ? 'a' : Tag

  return (
    <El
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 14,
        fontWeight: 500,
        color: '#01011b',
        background: '#ffffff',
        border: '1px solid #31263b',
        borderRadius: 3,
        padding: '10px 22px',
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'box-shadow 0.25s',
        boxShadow: hovered
          ? '0 0 0 4px rgba(111,99,183,0.18), 0 0 16px rgba(111,99,183,0.12)'
          : '0 0 0 0px rgba(111,99,183,0)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </El>
  )
}

/* variant="magnetic" — slight magnetic pull toward cursor */
function MagneticButton({ children, style, href, as: Tag = 'button', ...rest }) {
  const ref = useRef(null)
  const [delta, setDelta] = useState({ x: 0, y: 0 })
  const El = href ? 'a' : Tag

  function onMouseMove(e) {
    if (!ref.current) return
    const { width, height, left, top } = ref.current.getBoundingClientRect()
    const cx = left + width / 2
    const cy = top  + height / 2
    setDelta({ x: (e.clientX - cx) * 0.28, y: (e.clientY - cy) * 0.28 })
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={() => setDelta({ x: 0, y: 0 })}
      animate={{ x: delta.x, y: delta.y }}
      transition={{ type: 'spring', stiffness: 340, damping: 22 }}
      style={{ display: 'inline-flex' }}
    >
      <El
        href={href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: 14,
          fontWeight: 500,
          color: '#01011b',
          background: '#ffffff',
          border: '1px solid rgba(49,38,59,0.4)',
          borderRadius: 3,
          padding: '10px 22px',
          cursor: 'pointer',
          textDecoration: 'none',
          transition: 'border-color 0.15s',
          ...style,
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#31263b'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(49,38,59,0.4)'}
        {...rest}
      >
        {children}
      </El>
    </motion.div>
  )
}

export function AnimatedButton({ variant = 'shimmer', ...props }) {
  if (variant === 'glow')     return <GlowButton {...props} />
  if (variant === 'magnetic') return <MagneticButton {...props} />
  return <ShimmerButton {...props} />
}
