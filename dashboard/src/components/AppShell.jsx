import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import MobileHeader from './MobileHeader'
import { useIsMobile } from '../hooks/useIsMobile'
import { getActiveAnnouncements } from '../services/api'

const KIND_STYLE = {
  info:    { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', color: '#60a5fa' },
  warning: { bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.25)',  color: '#fbbf24' },
  success: { bg: 'rgba(5,150,105,0.08)',  border: 'rgba(5,150,105,0.25)', color: '#34d399' },
  error:   { bg: 'rgba(231,0,11,0.08)',   border: 'rgba(231,0,11,0.25)',  color: '#f87171' },
}

export default function AppShell() {
  const [banners, setBanners] = useState([])
  const isMobile = useIsMobile()

  useEffect(() => {
    const dismissed = JSON.parse(sessionStorage.getItem('dismissed_banners') || '[]')
    getActiveAnnouncements()
      .then(r => {
        const items = Array.isArray(r.data) ? r.data : []
        setBanners(items.filter(a => !dismissed.includes(a.id)))
      })
      .catch(() => {})
  }, [])

  function dismiss(id) {
    setBanners(b => b.filter(a => a.id !== id))
    const prev = JSON.parse(sessionStorage.getItem('dismissed_banners') || '[]')
    sessionStorage.setItem('dismissed_banners', JSON.stringify([...prev, id]))
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {!isMobile && <Sidebar />}

      <main style={{
        flex: 1,
        minWidth: 0,
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        // On mobile, content starts below the fixed header
        paddingTop: isMobile ? 52 : 0,
      }}>
        {isMobile && <MobileHeader />}

        {banners.map(ann => {
          const s = KIND_STYLE[ann.kind] || KIND_STYLE.info
          return (
            <div key={ann.id} style={{ background: s.bg, borderBottom: `1px solid ${s.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: s.color, fontWeight: 600, flex: 1, margin: 0 }}>
                {ann.title}{ann.body ? ` — ${ann.body}` : ''}
              </p>
              <button
                onClick={() => dismiss(ann.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.color, fontSize: 16, lineHeight: 1, opacity: 0.7, flexShrink: 0, padding: '0 4px' }}
              >×</button>
            </div>
          )
        })}

        <Outlet />

        {isMobile && <BottomNav />}
      </main>
    </div>
  )
}
