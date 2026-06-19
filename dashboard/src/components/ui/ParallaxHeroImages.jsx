import { useEffect, useMemo, memo } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'

const positionStyles = {
  'top-left':     { top: '8%',  left: '4%' },
  'top-right':    { top: '8%',  right: '4%' },
  'mid-left':     { top: '38%', left: '2%' },
  'mid-right':    { top: '38%', right: '2%' },
  'bottom-left':  { top: '68%', left: '4%' },
  'bottom-right': { top: '68%', right: '4%' },
  'far-left':     { top: '52%', left: '1%' },
  'far-right':    { top: '52%', right: '1%' },
}

const positionOrder = [
  'top-left', 'top-right',
  'mid-left', 'mid-right',
  'bottom-left', 'bottom-right',
  'far-left', 'far-right',
]

const depthValuesByVariant = {
  default:      [0.3, 0.35, 0.9, 0.85, 0.4, 0.45, 0.25, 0.2],
  'edge-focus': [0.85, 0.9, 0.3, 0.35, 0.8, 0.85, 0.4, 0.45],
}

const SPRING_CONFIG = { damping: 25, stiffness: 120 }

export function ParallaxHeroImages({ images, variant = 'default', style = {} }) {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const smoothMouseX = useSpring(mouseX, SPRING_CONFIG)
  const smoothMouseY = useSpring(mouseY, SPRING_CONFIG)

  const positions = useMemo(() => {
    const limited = images.slice(0, 8)
    const depths = depthValuesByVariant[variant]
    return limited.map((src, i) => ({
      src,
      position: positionOrder[i],
      depth: depths[i],
      delay: i * 0.12,
    }))
  }, [images, variant])

  useEffect(() => {
    const onMove = (e) => {
      mouseX.set((e.clientX / window.innerWidth) * 2 - 1)
      mouseY.set((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [mouseX, mouseY])

  return (
    <div style={{ pointerEvents: 'none', position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>
      {positions.map((pos, i) => (
        <ParallaxImage
          key={`${pos.src}-${i}`}
          src={pos.src}
          position={pos.position}
          depth={pos.depth}
          delay={pos.delay}
          smoothMouseX={smoothMouseX}
          smoothMouseY={smoothMouseY}
        />
      ))}
    </div>
  )
}

const ParallaxImage = memo(function ParallaxImage({ src, position, depth, delay, smoothMouseX, smoothMouseY }) {
  const maxOffset = 40
  const translateX = useTransform(smoothMouseX, [-1, 1], [-maxOffset * depth, maxOffset * depth])
  const translateY = useTransform(smoothMouseY, [-1, 1], [-maxOffset * depth, maxOffset * depth])
  const { top, left, right } = positionStyles[position]

  return (
    <motion.div
      style={{
        position: 'absolute',
        top, left, right,
        x: translateX,
        y: translateY,
        zIndex: Math.round(depth * 10),
      }}
      initial={{ opacity: 0, filter: 'blur(20px)', scale: 0.9 }}
      animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
      transition={{ duration: 0.8, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        style={{
          width: 280,
          height: 'auto',
          borderRadius: 10,
          objectFit: 'cover',
          boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08)',
          outline: '1px solid rgba(0,0,0,0.08)',
          display: 'block',
        }}
      />
    </motion.div>
  )
})
