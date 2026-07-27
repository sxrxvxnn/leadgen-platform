import { useRef, useState, useEffect } from 'react'
import { useScroll, useTransform, motion } from 'motion/react'

// MacBook-style lid-open scroll reveal for landing sections.
// The card starts at rotateX(-28deg) + compressed scale, opens to flat as you scroll.
export function SectionReveal({
  title,
  children,
  cardBg = 'transparent',
  borderColor = '#2a2a2a',
}) {
  const ref = useRef(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (window.innerWidth < 768) setIsMobile(true)
  }, [])

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  // Hold closed briefly, then open — mirrors MacBook lid timing
  const rotate = useTransform(scrollYProgress, [0.08, 0.12, 0.4], [-28, -28, 0])
  const scale = useTransform(scrollYProgress, [0, 0.4], [isMobile ? 0.65 : 0.88, 1])

  // Title fades up and out as the card opens (same as MacBook title)
  const titleTranslateY = useTransform(scrollYProgress, [0, 0.3], [0, 100])
  const titleOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])

  return (
    <div
      ref={ref}
      style={{
        minHeight: isMobile ? '120vh' : '160vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: isMobile ? 40 : 200,
        paddingLeft: isMobile ? 12 : 40,
        paddingRight: isMobile ? 12 : 40,
        overflow: 'hidden',
      }}
    >
      {/* Floating title — translates up and fades as card opens */}
      {title && (
        <motion.div
          style={{
            opacity: titleOpacity,
            translateY: titleTranslateY,
            textAlign: 'center',
            marginBottom: 40,
            width: '100%',
            maxWidth: 720,
          }}
        >
          {title}
        </motion.div>
      )}

      {/* 3D perspective wrapper */}
      <div style={{ perspective: '800px', width: '100%', maxWidth: 1280 }}>
        <motion.div
          style={{
            rotateX: rotate,
            scale,
            transformOrigin: 'top center',
            transformStyle: 'preserve-3d',
            background: cardBg,
            border: `1.5px solid ${borderColor}`,
            borderRadius: 20,
            overflow: 'hidden',
            padding: isMobile ? 12 : 24,
            boxShadow:
              '0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003',
          }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}
