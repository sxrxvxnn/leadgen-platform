import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

function getDirection(e, el) {
  const { width, height, left, top } = el.getBoundingClientRect()
  const x = e.clientX - left - width / 2
  const y = e.clientY - top - height / 2

  // Angle from center: atan2 returns radians, convert to 0-360 deg
  const angle = (Math.atan2(y, x) * 180) / Math.PI
  // Normalise to 0-360, then offset so 0 = top
  const deg = (angle + 90 + 360) % 360

  if (deg < 45 || deg >= 315) return 'top'
  if (deg < 135) return 'right'
  if (deg < 225) return 'bottom'
  return 'left'
}

const INITIAL = {
  top: { x: '0%', y: '-100%' },
  bottom: { x: '0%', y: '100%' },
  left: { x: '-100%', y: '0%' },
  right: { x: '100%', y: '0%' },
}

export function DirectionAwareHover({ children, overlay, style }) {
  const ref = useRef(null)
  const [dir, setDir] = useState('top')
  const [hovered, setHovered] = useState(false)

  function handleEnter(e) {
    if (ref.current) setDir(getDirection(e, ref.current))
    setHovered(true)
  }

  function handleLeave(e) {
    if (ref.current) setDir(getDirection(e, ref.current))
    setHovered(false)
  }

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      {children}

      <AnimatePresence>
        {hovered && (
          <motion.div
            key="overlay"
            initial={{ ...INITIAL[dir], opacity: 0 }}
            animate={{ x: '0%', y: '0%', opacity: 1 }}
            exit={{ ...INITIAL[dir], opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'linear-gradient(135deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.03) 100%)',
              zIndex: 10,
            }}
          />
        )}
      </AnimatePresence>

      {/* Optional overlay content (e.g. hover text) */}
      {overlay && (
        <AnimatePresence>
          {hovered && (
            <motion.div
              key="content"
              initial={{ ...INITIAL[dir], opacity: 0 }}
              animate={{ x: '0%', y: '0%', opacity: 1 }}
              exit={{ ...INITIAL[dir], opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'flex-end',
                padding: '20px 24px',
                zIndex: 11,
              }}
            >
              {overlay}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
