import { useRef, useState } from 'react'
import { motion } from 'motion/react'

/* variant="shimmer" — yellow primary CTA with shimmer sweep */
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
        fontFamily: "'Host Grotesk', 'Roboto', sans-serif",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: '#121212',
        background: '#FFFF00',
        border: 'none',
        borderRadius: 0,
        padding: '11px 24px',
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'background 0.15s, box-shadow 0.2s',
        boxShadow: hovered ? '0 0 20px rgba(255,255,0,0.25)' : 'none',
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
          background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <span style={{ position: 'relative', zIndex: 2 }}>{children}</span>
    </El>
  )
}

/* variant="glow" — ghost button with yellow glow on hover */
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
        fontFamily: "'Host Grotesk', 'Roboto', sans-serif",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: '#F5F5F5',
        background: 'transparent',
        border: '1px solid #3A3A3A',
        borderRadius: 0,
        padding: '10px 24px',
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'border-color 0.15s, color 0.15s, box-shadow 0.25s',
        borderColor: hovered ? '#FFFF00' : '#3A3A3A',
        boxShadow: hovered
          ? '0 0 0 1px rgba(255,255,0,0.2), 0 0 12px rgba(255,255,0,0.08)'
          : 'none',
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
          fontFamily: "'Host Grotesk', 'Roboto', sans-serif",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#F5F5F5',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 0,
          padding: '10px 24px',
          cursor: 'pointer',
          textDecoration: 'none',
          transition: 'border-color 0.15s',
          ...style,
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
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
