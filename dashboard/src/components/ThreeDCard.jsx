import { createContext, useContext, useRef, useState } from 'react'
import { motion } from 'motion/react'

const Context = createContext(null)

export function CardContainer({ children, style, ...rest }) {
  const containerRef = useRef(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  const [active, setActive] = useState(false)

  function onMouseMove(e) {
    if (!containerRef.current) return
    const { left, top, width, height } = containerRef.current.getBoundingClientRect()
    const cx = left + width / 2
    const cy = top + height / 2
    const MAX = 9
    setRotateX(-((e.clientY - cy) / height) * MAX * 2)
    setRotateY(((e.clientX - cx) / width) * MAX * 2)
  }

  function onMouseEnter() {
    setActive(true)
  }

  function onMouseLeave() {
    setActive(false)
    setRotateX(0)
    setRotateY(0)
  }

  return (
    <Context.Provider value={{ active }}>
      <div
        ref={containerRef}
        onMouseMove={onMouseMove}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{ perspective: '1000px', perspectiveOrigin: 'center', ...style }}
        {...rest}
      >
        <motion.div
          animate={{
            rotateX: active ? rotateX : 0,
            rotateY: active ? rotateY : 0,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 28, mass: 0.5 }}
          style={{ transformStyle: 'preserve-3d', width: '100%', height: '100%' }}
        >
          {children}
        </motion.div>
      </div>
    </Context.Provider>
  )
}

// Wrap card content — strip overflow:hidden so preserve-3d works end-to-end
export function CardBody({ children, style, ...rest }) {
  return (
    <div style={{ transformStyle: 'preserve-3d', ...style }} {...rest}>
      {children}
    </div>
  )
}

// Individual elements at a given Z depth
export function CardItem({ as: Tag = 'div', translateZ = 0, children, style, ...rest }) {
  const ctx = useContext(Context)
  return (
    <Tag
      style={{
        transform: ctx?.active ? `translateZ(${translateZ}px)` : 'translateZ(0px)',
        transition: 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
