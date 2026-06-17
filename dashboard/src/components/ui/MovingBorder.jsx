import { useRef } from 'react'
import { motion, useAnimationFrame, useMotionTemplate, useMotionValue, useTransform } from 'motion/react'

function MovingBorderTrack({ duration = 2800, color = '#6f63b7', rx = '30%', ry = '30%' }) {
  const pathRef = useRef(null)
  const progress = useMotionValue(0)

  useAnimationFrame((time) => {
    const len = pathRef.current?.getTotalLength()
    if (len) progress.set((time * (len / duration)) % len)
  })

  const x = useTransform(progress, (v) => pathRef.current?.getPointAtLength(v).x)
  const y = useTransform(progress, (v) => pathRef.current?.getPointAtLength(v).y)
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }}
        width="100%"
        height="100%"
      >
        <rect fill="none" width="100%" height="100%" rx={rx} ry={ry} ref={pathRef} />
      </svg>
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'inline-block',
          transform,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: `radial-gradient(${color} 30%, transparent 70%)`,
          opacity: 0.85,
        }}
      />
    </>
  )
}

export function MovingBorderButton({ children, as: Tag = 'button', duration, borderColor, borderRadius = '3px', style, innerStyle, onClick, to, href, download, ...rest }) {
  const props = { onClick, href, download, ...rest }
  if (to) props.to = to

  return (
    <Tag
      style={{
        position: 'relative',
        padding: '1px',
        background: 'transparent',
        border: 'none',
        borderRadius,
        cursor: 'pointer',
        display: 'inline-block',
        overflow: 'hidden',
        ...style,
      }}
      {...props}
    >
      <MovingBorderTrack duration={duration} color={borderColor || '#6f63b7'} />
      <div
        style={{
          position: 'relative',
          background: '#ffffff',
          borderRadius: `calc(${borderRadius} - 1px)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...innerStyle,
        }}
      >
        {children}
      </div>
    </Tag>
  )
}
