import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'motion/react'

export function TracingBeam({ children, style }) {
  const ref = useRef(null)
  const contentRef = useRef(null)
  const [svgHeight, setSvgHeight] = useState(0)

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  useEffect(() => {
    if (contentRef.current) setSvgHeight(contentRef.current.offsetHeight)
  }, [])

  const y1 = useSpring(useTransform(scrollYProgress, [0, 0.8], [50, svgHeight]), {
    stiffness: 500,
    damping: 90,
  })
  const y2 = useSpring(useTransform(scrollYProgress, [0, 1], [50, svgHeight - 200]), {
    stiffness: 500,
    damping: 90,
  })

  return (
    <motion.div
      ref={ref}
      style={{ position: 'relative', margin: '0 auto', width: '100%', ...style }}
    >
      {/* Beam track — sits left of content */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: -36,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Top dot */}
        <motion.div
          animate={{
            boxShadow: scrollYProgress.get() > 0 ? 'none' : '0 3px 8px rgba(111,99,183,0.35)',
          }}
          transition={{ duration: 0.2, delay: 0.5 }}
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: '1px solid #dbd7da',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#fffcfc',
            marginBottom: 0,
            marginLeft: 2,
          }}
        >
          <motion.div
            animate={{
              background: scrollYProgress.get() > 0 ? '#dbd7da' : '#6f63b7',
            }}
            transition={{ duration: 0.2, delay: 0.5 }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#6f63b7' }}
          />
        </motion.div>

        {/* SVG beam */}
        <svg
          viewBox={`0 0 20 ${svgHeight}`}
          width="20"
          height={svgHeight}
          style={{ display: 'block' }}
          aria-hidden="true"
        >
          {/* Track */}
          <motion.path
            d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`}
            fill="none"
            stroke="#9e91d6"
            strokeOpacity="0.16"
          />
          {/* Glowing beam */}
          <motion.path
            d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`}
            fill="none"
            stroke="url(#tracing-gradient)"
            strokeWidth="1.5"
          />
          <defs>
            <motion.linearGradient
              id="tracing-gradient"
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={y1}
              y2={y2}
            >
              <stop stopColor="#9e91d6" stopOpacity="0" />
              <stop stopColor="#6f63b7" />
              <stop offset="0.325" stopColor="#473982" />
              <stop offset="1" stopColor="#6f63b7" stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </svg>
      </div>

      <div ref={contentRef}>{children}</div>
    </motion.div>
  )
}
