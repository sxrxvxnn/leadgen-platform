import { useMotionTemplate, useMotionValue, motion } from 'motion/react'

export function useSpotlight() {
  const mouseX = useMotionValue(-100)
  const mouseY = useMotionValue(-100)

  function onMouseMove({ currentTarget, clientX, clientY }) {
    const { left, top } = currentTarget.getBoundingClientRect()
    mouseX.set(clientX - left)
    mouseY.set(clientY - top)
  }

  const bg = useMotionTemplate`radial-gradient(700px circle at ${mouseX}px ${mouseY}px, rgba(111,99,183,0.10), transparent 75%)`

  const spotlightEl = (
    <motion.div
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: bg, borderRadius: 'inherit',
      }}
    />
  )

  return { onMouseMove, spotlightEl }
}
