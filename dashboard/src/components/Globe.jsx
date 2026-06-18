import { useEffect, useRef } from 'react'
import createGlobe from 'cobe'

export default function Globe({ size = 160 }) {
  const canvasRef = useRef(null)
  const phiRef    = useRef(1.343) // start centered ~Kerala longitude (76.9° E)

  useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const px  = size * dpr

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: dpr,
      width:  px,
      height: px,
      phi:    phiRef.current,
      theta:  0.18,
      dark:   0,
      diffuse: 1.4,
      mapSamples:    14000,
      mapBrightness: 7,
      baseColor:   [0.92, 0.91, 0.9],
      markerColor: [0.36, 0.47, 0.72],
      glowColor:   [0.93, 0.92, 0.96],
      markers: [
        { location: [8.5241, 76.9366], size: 0.07 }, // Technopark, Kerala
      ],
      onRender: (state) => {
        state.phi   = phiRef.current
        phiRef.current += 0.0022
      },
    })

    return () => globe.destroy()
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: 'block', borderRadius: '50%' }}
    />
  )
}
