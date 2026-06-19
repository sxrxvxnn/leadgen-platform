import { useEffect, useRef } from 'react'
import createGlobe from 'cobe'

const DEFAULT_MARKERS = [
  { location: [8.5241,   76.9366], size: 0.07 }, // Technopark, Kerala
]

const LANDING_MARKERS = [
  { location: [8.5241,   76.9366], size: 0.07 }, // Technopark, Kerala
  { location: [51.5074,  -0.1278], size: 0.06 }, // London
  { location: [40.7128, -74.0060], size: 0.07 }, // New York
  { location: [37.7749,-122.4194], size: 0.05 }, // San Francisco
  { location: [1.3521,  103.8198], size: 0.05 }, // Singapore
  { location: [48.8566,   2.3522], size: 0.05 }, // Paris
  { location: [35.6762, 139.6503], size: 0.05 }, // Tokyo
  { location: [-33.8688, 151.2093], size: 0.04 }, // Sydney
  { location: [19.0760,  72.8777], size: 0.05 }, // Mumbai
  { location: [25.2048,  55.2708], size: 0.04 }, // Dubai
  { location: [52.5200,  13.4050], size: 0.04 }, // Berlin
  { location: [55.7558,  37.6173], size: 0.04 }, // Moscow
]

export { LANDING_MARKERS }

export default function Globe({ size = 160, markers = DEFAULT_MARKERS, markerColor = [1, 1, 0] }) {
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
      markerColor: markerColor,
      glowColor:   [0.3, 0.3, 0.3],
      markers,
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
