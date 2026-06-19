import { useState } from 'react'

// ── Minimal WobbleCard — wobble only, no visual treatment ────────────────────
// Used for plain light-bg cards (problem, step, pricing, signal tiles)
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

// ── SVG noise overlay — matches Aceternity noise.webp at 7% opacity ──────────
function Noise() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'300\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3C/filter%3E%3Crect width=\'300\' height=\'300\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
      backgroundRepeat: 'repeat',
      backgroundSize: '150px 150px',
      opacity: 0.07,
      transform: 'scale(1.2)',
      WebkitMaskImage: 'radial-gradient(white, transparent 75%)',
      maskImage: 'radial-gradient(white, transparent 75%)',
      pointerEvents: 'none',
      zIndex: 0,
    }} />
  )
}

// ── BentoCard — full Aceternity visual treatment ──────────────────────────────
// bg: CSS background value (color, gradient string)
// minHeight: number (px) or string
// style: overrides on outermost wobble div
// innerStyle: overrides on inner content div (padding, etc.)
export function BentoCard({ children, bg = '#312e81', minHeight = 300, style = {}, innerStyle = {} }) {
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
    // Outer: wobble translate
    <div
      onMouseMove={move}
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => { setOn(false); setPos({ x: 0, y: 0 }) }}
      style={{
        background: bg,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        minHeight,
        height: '100%',
        transform: on ? `translate3d(${pos.x}px, ${pos.y}px, 0) scale3d(1,1,1)` : 'translate3d(0,0,0) scale3d(1,1,1)',
        transition: 'transform 0.1s ease-out',
        willChange: 'transform',
        ...style,
      }}
    >
      {/* Gradient + shadow overlay */}
      <div style={{
        position: 'relative',
        height: '100%',
        backgroundImage: 'radial-gradient(88% 100% at top, rgba(255,255,255,0.45), rgba(255,255,255,0))',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 10px 32px rgba(34,42,53,0.12), 0 1px 1px rgba(0,0,0,0.05), 0 0 0 1px rgba(34,42,53,0.05), 0 4px 6px rgba(34,42,53,0.08), 0 24px 108px rgba(47,48,55,0.10)',
      }}>
        {/* Inner: counter-translate for parallax */}
        <div
          style={{
            height: '100%',
            padding: '40px 40px',
            position: 'relative',
            transform: on
              ? `translate3d(${-pos.x}px, ${-pos.y}px, 0) scale3d(1.03, 1.03, 1)`
              : 'translate3d(0,0,0) scale3d(1,1,1)',
            transition: 'transform 0.1s ease-out',
            willChange: 'transform',
            ...innerStyle,
          }}
        >
          <Noise />
          <div style={{ position: 'relative', zIndex: 1 }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
