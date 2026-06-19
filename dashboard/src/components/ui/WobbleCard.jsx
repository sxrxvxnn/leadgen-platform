import { useState } from 'react'

// Aceternity WobbleCard — ported to JSX/inline-styles
// Outer translates toward the mouse, inner counter-translates for the parallax wobble feel
export function WobbleCard({ children, style = {}, innerStyle = {} }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [on, setOn] = useState(false)

  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    setPos({
      x: (e.clientX - (r.left + r.width / 2)) / 20,
      y: (e.clientY - (r.top + r.height / 2)) / 20,
    })
  }

  return (
    <div
      onMouseMove={move}
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => { setOn(false); setPos({ x: 0, y: 0 }) }}
      style={{
        height: '100%',
        transform: on ? `translate3d(${pos.x}px, ${pos.y}px, 0)` : 'translate3d(0,0,0)',
        transition: 'transform 0.1s ease-out',
        willChange: 'transform',
        ...style,
      }}
    >
      <div
        style={{
          height: '100%',
          transform: on
            ? `translate3d(${-pos.x}px, ${-pos.y}px, 0) scale3d(1.03, 1.03, 1)`
            : 'translate3d(0,0,0) scale3d(1,1,1)',
          transition: 'transform 0.1s ease-out',
          willChange: 'transform',
          ...innerStyle,
        }}
      >
        {children}
      </div>
    </div>
  )
}
