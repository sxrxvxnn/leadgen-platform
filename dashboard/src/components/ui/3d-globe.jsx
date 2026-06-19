import { useEffect, useRef } from 'react'
import createGlobe from 'cobe'

export const GLOBE_CONFIG = {
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 1,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.2,
  baseColor: [1, 1, 1],
  markerColor: [0.906, 0, 0.043],
  glowColor: [0.12, 0.12, 0.12],
  markers: [
    { location: [8.5241,   76.9366], size: 0.07 }, // Technopark
    { location: [40.7128,  -74.006], size: 0.10 }, // NYC
    { location: [51.5074,  -0.1278], size: 0.07 }, // London
    { location: [37.7749,-122.4194], size: 0.06 }, // SF
    { location: [1.3521,  103.8198], size: 0.05 }, // Singapore
    { location: [35.6762,  139.6503],size: 0.05 }, // Tokyo
    { location: [48.8566,   2.3522], size: 0.05 }, // Paris
    { location: [-33.8688,151.2093], size: 0.04 }, // Sydney
    { location: [19.0760,  72.8777], size: 0.05 }, // Mumbai
    { location: [25.2048,  55.2708], size: 0.04 }, // Dubai
    { location: [52.5200,  13.4050], size: 0.04 }, // Berlin
    { location: [-23.5505,-46.6333], size: 0.06 }, // São Paulo
  ],
  arcs: [
    { from: [8.5241,   76.9366], to: [40.7128,  -74.006]  },
    { from: [8.5241,   76.9366], to: [51.5074,  -0.1278]  },
    { from: [8.5241,   76.9366], to: [1.3521,  103.8198]  },
    { from: [8.5241,   76.9366], to: [19.0760,  72.8777]  },
    { from: [40.7128,  -74.006], to: [51.5074,  -0.1278]  },
    { from: [40.7128,  -74.006], to: [37.7749,-122.4194]  },
    { from: [37.7749,-122.4194], to: [35.6762, 139.6503]  },
    { from: [48.8566,   2.3522], to: [1.3521,  103.8198]  },
    { from: [1.3521,  103.8198], to: [35.6762, 139.6503]  },
    { from: [25.2048,  55.2708], to: [19.0760,  72.8777]  },
    { from: [51.5074,  -0.1278], to: [48.8566,   2.3522]  },
    { from: [40.7128,  -74.006], to: [-23.5505,-46.6333]  },
  ],
  arcColor: [0.906, 0, 0.043],
  arcWidth: 1.5,
  arcHeight: 0.25,
}

export default function Globe({ style, config = {} }) {
  const canvasRef = useRef(null)
  const phiRef    = useRef(0)
  const widthRef  = useRef(0)
  const pointerInteracting = useRef(null)

  useEffect(() => {
    let globe
    let raf

    const onResize = () => {
      if (canvasRef.current) widthRef.current = canvasRef.current.offsetWidth
    }
    window.addEventListener('resize', onResize)

    const init = () => {
      if (!canvasRef.current) return
      const w = canvasRef.current.offsetWidth
      if (w === 0) { raf = requestAnimationFrame(init); return }
      widthRef.current = w

      const mergedConfig = { ...GLOBE_CONFIG, ...config }
      globe = createGlobe(canvasRef.current, {
        ...mergedConfig,
        width:  w * 2,
        height: w * 2,
        onRender: (state) => {
          if (!pointerInteracting.current) phiRef.current += 0.005
          state.phi    = phiRef.current
          state.width  = widthRef.current * 2
          state.height = widthRef.current * 2
        },
      })

      setTimeout(() => {
        if (canvasRef.current) canvasRef.current.style.opacity = '1'
      })
    }

    raf = requestAnimationFrame(init)

    return () => {
      globe?.destroy()
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative', ...style }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          contain: 'layout paint size',
          opacity: 0,
          transition: 'opacity 1s ease',
          cursor: 'grab',
        }}
        onPointerDown={e => {
          pointerInteracting.current = e.clientX
          canvasRef.current && (canvasRef.current.style.cursor = 'grabbing')
        }}
        onPointerUp={() => {
          pointerInteracting.current = null
          canvasRef.current && (canvasRef.current.style.cursor = 'grab')
        }}
        onPointerOut={() => {
          pointerInteracting.current = null
          canvasRef.current && (canvasRef.current.style.cursor = 'grab')
        }}
        onMouseMove={e => {
          if (pointerInteracting.current !== null) {
            phiRef.current += (e.clientX - pointerInteracting.current) / 400
            pointerInteracting.current = e.clientX
          }
        }}
        onTouchMove={e => {
          if (e.touches[0] && pointerInteracting.current !== null) {
            phiRef.current += (e.touches[0].clientX - pointerInteracting.current) / 400
            pointerInteracting.current = e.touches[0].clientX
          }
        }}
      />
    </div>
  )
}
