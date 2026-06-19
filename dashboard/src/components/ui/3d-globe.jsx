import { useRef, useEffect, useState } from 'react'

const MARKERS = [
  { lat: 8.5241,   lng: 76.9366,  label: 'TK' }, // Technopark
  { lat: 40.7128,  lng: -74.006,  label: 'NY' }, // NYC
  { lat: 51.5074,  lng: -0.1278,  label: 'LN' }, // London
  { lat: 37.7749,  lng:-122.4194, label: 'SF' }, // SF
  { lat: 1.3521,   lng: 103.8198, label: 'SG' }, // Singapore
  { lat: 25.2048,  lng: 55.2708,  label: 'DB' }, // Dubai
]

const ARCS = [
  { startLat: 8.5241,  startLng: 76.9366,  endLat: 40.7128,  endLng: -74.006  },
  { startLat: 8.5241,  startLng: 76.9366,  endLat: 51.5074,  endLng: -0.1278  },
  { startLat: 8.5241,  startLng: 76.9366,  endLat: 1.3521,   endLng: 103.8198 },
  { startLat: 8.5241,  startLng: 76.9366,  endLat: 25.2048,  endLng: 55.2708  },
  { startLat: 40.7128, startLng: -74.006,  endLat: 51.5074,  endLng: -0.1278  },
  { startLat: 37.7749, startLng:-122.4194, endLat: 40.7128,  endLng: -74.006  },
]

function makeMarker(d) {
  const el = document.createElement('div')
  el.style.cssText = `
    width:40px;height:40px;border-radius:50%;
    background:#111;border:2px solid #E7000B;
    display:flex;align-items:center;justify-content:center;
    font-family:'Host Grotesk',sans-serif;font-size:11px;
    font-weight:600;color:#fff;letter-spacing:.04em;
    box-shadow:0 0 14px rgba(231,0,11,.5);
    pointer-events:none;
  `
  el.textContent = d.label
  return el
}

export default function Globe({ style }) {
  const wrapRef = useRef(null)
  const globeRef = useRef(null)
  const [size, setSize] = useState(0)
  const [GlobeGL, setGlobeGL] = useState(null)

  // Measure container once mounted
  useEffect(() => {
    if (wrapRef.current) setSize(wrapRef.current.offsetWidth || 400)
    const obs = new ResizeObserver(([e]) => setSize(Math.round(e.contentRect.width)))
    obs.observe(wrapRef.current)
    return () => obs.disconnect()
  }, [])

  // Lazy-load the heavy library
  useEffect(() => {
    import('react-globe.gl').then(m => setGlobeGL(() => m.default))
  }, [])

  // Configure controls after globe mounts
  useEffect(() => {
    if (!globeRef.current || !GlobeGL) return
    const ctrl = globeRef.current.controls()
    ctrl.autoRotate = true
    ctrl.autoRotateSpeed = 0.5
    ctrl.enableZoom = false
    ctrl.minPolarAngle = Math.PI * 0.15
    ctrl.maxPolarAngle = Math.PI * 0.85
    globeRef.current.pointOfView({ lat: 22, lng: 30, altitude: 1.7 }, 800)
  }, [GlobeGL, size])

  return (
    <div
      ref={wrapRef}
      style={{
        width: '100%',
        aspectRatio: '1/1',
        position: 'relative',
        overflow: 'visible',
        ...style,
      }}
    >
      {GlobeGL && size > 0 && (
        <GlobeGL
          ref={globeRef}
          width={size}
          height={size}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          atmosphereColor="#E7000B"
          atmosphereAltitude={0.1}
          arcsData={ARCS}
          arcColor={() => '#E7000B'}
          arcAltitude={0.2}
          arcStroke={0.5}
          arcDashLength={0.5}
          arcDashGap={0.2}
          arcDashAnimateTime={2200}
          htmlElementsData={MARKERS}
          htmlElement={makeMarker}
          htmlAltitude={0.05}
        />
      )}
    </div>
  )
}

export const GLOBE_CONFIG = {}
