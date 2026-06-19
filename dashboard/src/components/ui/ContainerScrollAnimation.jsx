import { useRef, useState, useEffect } from 'react'
import { useScroll, useTransform, motion } from 'motion/react'

export function ContainerScrollAnimation({
  titleComponent,
  children,
  cardBg = '#111111',
  borderColor = '#2D2D2D',
}) {
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0])
  const scale = useTransform(scrollYProgress, [0, 1], isMobile ? [0.7, 0.9] : [1.05, 1])
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100])

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: isMobile ? 600 : 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: isMobile ? '8px' : '20px 80px',
      }}
    >
      <div
        style={{
          paddingTop: isMobile ? 40 : 160,
          paddingBottom: isMobile ? 40 : 160,
          width: '100%',
          position: 'relative',
          perspective: '1000px',
        }}
      >
        {/* Floating title — translates up as card reveals */}
        <motion.div
          style={{
            translateY: translate,
            maxWidth: 1024,
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          {titleComponent}
        </motion.div>

        {/* 3D tilt card — rotates from 20° forward to flat as you scroll */}
        <motion.div
          style={{
            rotateX: rotate,
            scale,
            boxShadow:
              '0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003',
            maxWidth: 1280,
            marginTop: -48,
            marginLeft: 'auto',
            marginRight: 'auto',
            width: '100%',
            border: `4px solid ${borderColor}`,
            padding: isMobile ? 8 : 24,
            background: cardBg,
            borderRadius: 30,
          }}
        >
          <div
            style={{
              width: '100%',
              overflow: 'hidden',
              borderRadius: 16,
              padding: isMobile ? 8 : 16,
            }}
          >
            {children}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
