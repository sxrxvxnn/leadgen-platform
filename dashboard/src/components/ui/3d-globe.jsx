import { useRef, useEffect, useState } from 'react'

// Stable portrait URLs — swap out for real customer photos when available
const MARKERS = [
  { lat: 40.7128,  lng: -74.006,  img: 'https://randomuser.me/api/portraits/men/32.jpg'   },
  { lat: 51.5074,  lng: -0.1278,  img: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { lat: 48.8566,  lng: 2.3522,   img: 'https://randomuser.me/api/portraits/men/68.jpg'   },
  { lat: 1.3521,   lng: 103.8198, img: 'https://randomuser.me/api/portraits/women/22.jpg' },
  { lat: 35.6762,  lng: 139.6503, img: 'https://randomuser.me/api/portraits/men/11.jpg'   },
  { lat: -23.5505, lng: -46.6333, img: 'https://randomuser.me/api/portraits/women/55.jpg' },
]

const ARCS = [
  { startLat: 51.5074,  startLng: -0.1278,  endLat: 40.7128,  endLng: -74.006  },
  { startLat: 48.8566,  startLng: 2.3522,   endLat: 1.3521,   endLng: 103.8198 },
  { startLat: 40.7128,  startLng: -74.006,  endLat: -23.5505, endLng: -46.6333 },
  { startLat: 1.3521,   startLng: 103.8198, endLat: 35.6762,  endLng: 139.6503 },
]

function makeMarker() {
  const wrap = document.createElement('div')
  wrap.style.cssText = `
    display:flex; flex-direction:column; align-items:center;
    pointer-events:none; transform:translate(-50%,-100%);
  `

  const avatar = document.createElement('div')
  avatar.style.cssText = `
    width:44px; height:44px; border-radius:50%; overflow:hidden;
    border:2px solid rgba(255,255,255,0.75);
    box-shadow:0 2px 16px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.12);
    background:#1e293b; flex-shrink:0;
  `
  const img = document.createElement('img')
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;'
  avatar.appendChild(img)

  // Line from avatar down to globe surface
  const line = document.createElement('div')
  line.style.cssText = `
    width:1px; height:26px; flex-shrink:0;
    background:linear-gradient(to bottom,rgba(255,255,255,0.5),rgba(231,0,11,0.9));
  `

  // Red dot at the surface
  const dot = document.createElement('div')
  dot.style.cssText = `
    width:5px; height:5px; border-radius:50%; flex-shrink:0;
    background:#E7000B; box-shadow:0 0 5px #E7000B;
  `

  wrap.appendChild(avatar)
  wrap.appendChild(line)
  wrap.appendChild(dot)

  // Attach img src after DOM is created so we can return wrap first
  wrap._setImg = (src) => { img.src = src }
  return wrap
}

export default function Globe({ style }) {
  const wrapRef  = useRef(null)
  const globeRef = useRef(null)
  const [size,    setSize]    = useState(0)
  const [GlobeGL, setGlobeGL] = useState(null)

  useEffect(() => {
    if (!wrapRef.current) return
    setSize(wrapRef.current.offsetWidth || 500)
    const obs = new ResizeObserver(([e]) => setSize(Math.round(e.contentRect.width)))
    obs.observe(wrapRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    import('react-globe.gl').then(m => setGlobeGL(() => m.default))
  }, [])

  useEffect(() => {
    if (!globeRef.current || !GlobeGL) return
    const ctrl = globeRef.current.controls()
    ctrl.autoRotate      = true
    ctrl.autoRotateSpeed = 0.45
    ctrl.enableZoom      = false
    ctrl.minPolarAngle   = Math.PI * 0.2
    ctrl.maxPolarAngle   = Math.PI * 0.8
    globeRef.current.pointOfView({ lat: 20, lng: 10, altitude: 1.75 }, 1000)
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
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          showAtmosphere={false}
          arcsData={ARCS}
          arcColor={() => 'rgba(231,0,11,0.6)'}
          arcAltitude={0.15}
          arcStroke={0.3}
          arcDashLength={0.5}
          arcDashGap={0.2}
          arcDashAnimateTime={2500}
          htmlElementsData={MARKERS}
          htmlElement={d => {
            const el = makeMarker()
            el._setImg(d.img)
            return el
          }}
          htmlAltitude={0.02}
        />
      )}
    </div>
  )
}

export const GLOBE_CONFIG = {}
