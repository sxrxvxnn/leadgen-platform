import { useEffect, useRef } from 'react'

const DEFAULT_COLORS = ['#e8a87c', '#a86448', '#5b8db8', '#7b6bae', '#4a9c69', '#c8b8f8', '#8ec5e8']

export default function CanvasText({
  text,
  font = 'bold 72px Inter, sans-serif',
  colors = DEFAULT_COLORS,
  width = 480,
  height = 96,
  style,
}) {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Generate animated bezier line descriptors
    const lines = Array.from({ length: 18 }, (_, i) => ({
      color:  colors[i % colors.length],
      lw:     1.2 + Math.random() * 2.2,
      speed:  0.25 + Math.random() * 0.6,
      phase:  Math.random() * Math.PI * 2,
      // start / end anchors (random positions around the canvas)
      x0: Math.random() * width,  y0: -height * 0.5 + Math.random() * height * 2,
      x1: Math.random() * width,  y1: -height * 0.5 + Math.random() * height * 2,
      // control points
      cx0: Math.random() * width, cy0: -height + Math.random() * height * 2,
      cx1: Math.random() * width, cy1: -height + Math.random() * height * 2,
    }))

    let t = 0

    function draw() {
      ctx.clearRect(0, 0, width, height)

      // Draw text as solid mask first
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#000'
      ctx.font = font
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillText(text, 0, height / 2)

      // Everything drawn after this only shows through the text mask
      ctx.globalCompositeOperation = 'source-in'

      lines.forEach(l => {
        const p = t * l.speed + l.phase
        ctx.beginPath()
        ctx.strokeStyle = l.color
        ctx.lineWidth   = l.lw
        ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(p * 0.7))
        ctx.moveTo(
          l.x0 + Math.sin(p)       * 55,
          l.y0 + Math.cos(p * 0.8) * 28,
        )
        ctx.bezierCurveTo(
          l.cx0 + Math.cos(p * 1.1) * 70,
          l.cy0 + Math.sin(p * 0.9) * 40,
          l.cx1 + Math.sin(p * 0.7) * 70,
          l.cy1 + Math.cos(p * 1.2) * 40,
          l.x1 + Math.cos(p * 1.3) * 55,
          l.y1 + Math.sin(p)       * 28,
        )
        ctx.stroke()
      })

      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      t += 0.012
      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [text, font, width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', ...style }}
    />
  )
}
