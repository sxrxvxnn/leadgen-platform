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
      dark:   1,
      diffuse: 1.5,
      mapSamples:    16000,
      mapBrightness: 8,
      baseColor:   [1, 1, 1],
      markerColor: [1, 1, 0],
      glowColor:   [0.3, 0.3, 0.3],
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
