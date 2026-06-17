import { memo } from 'react'
import { motion } from 'motion/react'

// Paths generated from the Aceternity BackgroundBeams pattern (50 converging SVG paths)
const PATHS = Array.from({ length: 50 }, (_, i) => {
  const s = i * 7
  const t = i * -8
  return `M${-380 + s} ${-189 + t}C${-380 + s} ${-189 + t} ${-312 + s} ${216 + t} ${152 + s} ${343 + t}C${616 + s} ${470 + t} ${684 + s} ${875 + t} ${684 + s} ${875 + t}`
})

export const BackgroundBeams = memo(({ style }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      overflow: 'hidden',
      ...style,
    }}
  >
    <svg
      style={{ position: 'absolute', zIndex: 0, width: '100%', height: '100%' }}
      width="100%"
      height="100%"
      viewBox="0 0 696 316"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Static background path */}
      <path
        d={PATHS.join(' ')}
        stroke="url(#beams-radial)"
        strokeOpacity="0.04"
        strokeWidth="0.5"
      />

      {/* Animated gradient paths */}
      {PATHS.map((path, i) => (
        <motion.path
          key={i}
          d={path}
          stroke={`url(#beam-grad-${i})`}
          strokeOpacity="0.35"
          strokeWidth="0.5"
        />
      ))}

      <defs>
        {PATHS.map((_, i) => (
          <motion.linearGradient
            key={i}
            id={`beam-grad-${i}`}
            gradientUnits="userSpaceOnUse"
            x1="0%" x2="0%" y1="0%" y2="0%"
            initial={{ x1: '0%', x2: '0%', y1: '0%', y2: '0%' }}
            animate={{
              x1: ['0%', '100%'],
              x2: ['0%', '95%'],
              y1: ['0%', '100%'],
              y2: ['0%', `${93 + Math.random() * 8}%`],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              ease: 'easeInOut',
              repeat: Infinity,
              delay: Math.random() * 10,
            }}
          >
            <stop stopColor="#9e91d6" stopOpacity="0" />
            <stop stopColor="#6f63b7" stopOpacity="0.6" />
            <stop offset="32.5%" stopColor="#473982" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#6f63b7" stopOpacity="0" />
          </motion.linearGradient>
        ))}

        <radialGradient
          id="beams-radial"
          cx="0" cy="0" r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(352 34) rotate(90) scale(555 1560.62)"
        >
          <stop offset="0.067" stopColor="#9e91d6" />
          <stop offset="0.243" stopColor="#6f63b7" />
          <stop offset="0.436" stopColor="#6f63b7" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  </div>
))

BackgroundBeams.displayName = 'BackgroundBeams'
