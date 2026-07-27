import { useRef, useState } from 'react'
import { motion, useSpring, useMotionValue } from 'motion/react'

export function FollowingPointer({ children, label = 'Explore', style }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)

  const x = useSpring(rawX, { stiffness: 280, damping: 24, mass: 0.5 })
  const y = useSpring(rawY, { stiffness: 280, damping: 24, mass: 0.5 })

  function onMouseMove(e) {
    if (!ref.current) return
    const { left, top } = ref.current.getBoundingClientRect()
    rawX.set(e.clientX - left)
    rawY.set(e.clientY - top)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      style={{ position: 'relative', cursor: 'none', ...style }}
    >
      {children}

      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          x,
          y,
          translateX: '-50%',
          translateY: '-50%',
          zIndex: 50,
        }}
        animate={{ opacity: visible ? 1 : 0, scale: visible ? 1 : 0.4 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Cursor dot */}
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'var(--color-ink-violet, #01011b)',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Label pill */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '100%',
            transform: 'translate(8px, -50%)',
            background: 'var(--color-ink-violet, #01011b)',
            color: '#fffcfc',
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.02em',
            padding: '4px 10px',
            borderRadius: 20,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </motion.div>
    </div>
  )
}
