import { useMotionTemplate, useMotionValue, motion } from 'motion/react'

export function CardSpotlight({ children, style, radius = 260, color = 'rgba(111,99,183,0.12)' }) {
  const mouseX = useMotionValue(-1000)
  const mouseY = useMotionValue(-1000)

  function onMouseMove({ currentTarget, clientX, clientY }) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  const bg = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, ${color}, transparent 70%)`

  return (
    <motion.div
      onMouseMove={onMouseMove}
      onMouseLeave={() => { mouseX.set(-1000); mouseY.set(-1000) }}
      style={{ position: 'relative', ...style }}
    >
      <motion.div
        style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit',
          background: bg, pointerEvents: 'none', zIndex: 1,
        }}
      />
      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
    </motion.div>
  )
}
