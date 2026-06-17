import { useEffect } from 'react'

const css = `
@keyframes sk-shimmer {
  0%   { background-position: 200% 0 }
  100% { background-position: -200% 0 }
}
.sk {
  background: linear-gradient(90deg, #ecedf2 25%, #e3e4ea 50%, #ecedf2 75%);
  background-size: 200% 100%;
  animation: sk-shimmer 1.5s ease infinite;
  border-radius: 4px;
  display: inline-block;
}
`

let _injected = false
function injectCss() {
  if (_injected) return
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  _injected = true
}

export function Skeleton({ w = '100%', h = 14, r = 4, style: extra }) {
  useEffect(() => { injectCss() }, [])
  return (
    <span
      className="sk"
      style={{ width: w, height: h, borderRadius: r, display: 'inline-block', ...extra }}
    />
  )
}

// Pre-built row for table-style skeletons
export function SkeletonRow({ cols = [2, 3, 2, 1], height = 13 }) {
  return (
    <div style={{ display: 'flex', padding: '14px 0', borderBottom: '1px solid rgba(196,193,189,0.4)', alignItems: 'center', gap: 0 }}>
      {cols.map((flex, i) => (
        <div key={i} style={{ flex }}>
          <Skeleton w="70%" h={height} />
        </div>
      ))}
    </div>
  )
}

// Pre-built card skeleton for company cards
export function SkeletonCard() {
  return (
    <div style={{ padding: '18px 20px', border: '1px solid rgba(196,193,189,0.5)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Skeleton w="55%" h={14} />
      <Skeleton w="35%" h={11} />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Skeleton w={48} h={22} r={3} />
        <Skeleton w={48} h={22} r={3} />
      </div>
    </div>
  )
}
