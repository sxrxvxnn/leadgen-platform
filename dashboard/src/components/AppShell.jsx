import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import MobileHeader from './MobileHeader'
import { useIsMobile } from '../hooks/useIsMobile'
import { getActiveAnnouncements, getFeatureFlags } from '../services/api'
import { useSoundEffects } from '../hooks/useSoundEffects'

const SHORTCUTS = [
  { keys: ['G', 'D'], label: 'Go to Dashboard', path: '/dashboard' },
  { keys: ['G', 'L'], label: 'Go to Leads', path: '/leads' },
  { keys: ['G', 'C'], label: 'Go to Companies', path: '/companies' },
  { keys: ['G', 'P'], label: 'Go to Prospect', path: '/prospect' },
  { keys: ['G', 'S'], label: 'Go to Sequences', path: '/sequences' },
  { keys: ['G', 'A'], label: 'Go to Analytics', path: '/analytics' },
  { keys: ['G', 'T'], label: 'Go to Tasks', path: '/tasks' },
  { keys: ['G', 'E'], label: 'Go to Settings', path: '/settings' },
  { keys: ['?'], label: 'Show shortcuts', path: null },
]

const KIND_STYLE = {
  info: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', color: '#60a5fa' },
  warning: { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.25)', color: '#fbbf24' },
  success: { bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.25)', color: '#34d399' },
  error: { bg: 'rgba(231,0,11,0.08)', border: 'rgba(231,0,11,0.25)', color: '#f87171' },
}

export default function AppShell() {
  const [banners, setBanners] = useState([])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const pendingKey = useRef(null)
  const pendingTimer = useRef(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  useSoundEffects({ enabled: soundEnabled })

  useEffect(() => {
    getFeatureFlags()
      .then((r) => {
        const flag = (r.data?.flags || []).find((f) => f.name === 'ui_sounds')
        if (flag) setSoundEnabled(flag.enabled)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const dismissed = JSON.parse(sessionStorage.getItem('dismissed_banners') || '[]')
    getActiveAnnouncements()
      .then((r) => {
        const items = Array.isArray(r.data) ? r.data : []
        setBanners(items.filter((a) => !dismissed.includes(a.id)))
      })
      .catch(() => {})
  }, [])

  // Keyboard shortcuts — ignore when typing in inputs
  useEffect(() => {
    function onKey(e) {
      const tag = document.activeElement?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        document.activeElement?.isContentEditable
      )
        return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toUpperCase()

      if (key === '?') {
        setShowShortcuts((s) => !s)
        return
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false)
        return
      }

      if (pendingKey.current === 'G') {
        clearTimeout(pendingTimer.current)
        pendingKey.current = null
        const match = SHORTCUTS.find((s) => s.keys[0] === 'G' && s.keys[1] === key && s.path)
        if (match) {
          e.preventDefault()
          navigate(match.path)
        }
        return
      }

      if (key === 'G') {
        pendingKey.current = 'G'
        pendingTimer.current = setTimeout(() => {
          pendingKey.current = null
        }, 800)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(pendingTimer.current)
    }
  }, [navigate])

  function dismiss(id) {
    setBanners((b) => b.filter((a) => a.id !== id))
    const prev = JSON.parse(sessionStorage.getItem('dismissed_banners') || '[]')
    sessionStorage.setItem('dismissed_banners', JSON.stringify([...prev, id]))
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {!isMobile && <Sidebar />}

      <main
        style={{
          flex: 1,
          minWidth: 0,
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          // On mobile, content starts below the fixed header
          paddingTop: isMobile ? 52 : 0,
        }}
      >
        {isMobile && <MobileHeader />}

        {banners.map((ann) => {
          const s = KIND_STYLE[ann.kind] || KIND_STYLE.info
          return (
            <div
              key={ann.id}
              style={{
                background: s.bg,
                borderBottom: `1px solid ${s.border}`,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <p
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  color: s.color,
                  fontWeight: 600,
                  flex: 1,
                  margin: 0,
                }}
              >
                {ann.title}
                {ann.body ? ` — ${ann.body}` : ''}
              </p>
              <button
                onClick={() => dismiss(ann.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: s.color,
                  fontSize: 16,
                  lineHeight: 1,
                  opacity: 0.7,
                  flexShrink: 0,
                  padding: '0 4px',
                }}
              >
                ×
              </button>
            </div>
          )
        })}

        <Outlet />

        {isMobile && <BottomNav />}
      </main>

      {/* Shortcuts modal */}
      {showShortcuts && (
        <>
          <div
            onClick={() => setShowShortcuts(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400 }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(400px,92vw)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              zIndex: 401,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <p
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                Keyboard shortcuts
              </p>
              <button
                onClick={() => setShowShortcuts(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '12px 0' }}>
              {SHORTCUTS.map((s) => (
                <div
                  key={s.keys.join('')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 20px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 11,
                      color: 'var(--text-muted)',
                    }}
                  >
                    {s.label}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          fontFamily: "'IBM Plex Mono',monospace",
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--text)',
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)' }}>
              <p
                style={{
                  fontFamily: "'IBM Plex Mono',monospace",
                  fontSize: 9,
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                Press{' '}
                <kbd
                  style={{
                    padding: '2px 5px',
                    borderRadius: 3,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    fontSize: 9,
                  }}
                >
                  ?
                </kbd>{' '}
                to toggle this panel
              </p>
            </div>
          </div>
        </>
      )}

      {/* Hint: press ? for shortcuts — shown once */}
      {!isMobile && !showShortcuts && (
        <button
          onClick={() => setShowShortcuts(true)}
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 100,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            fontFamily: "'IBM Plex Mono',monospace",
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            lineHeight: 1,
          }}
          title="Keyboard shortcuts (?)"
        >
          ?
        </button>
      )}
    </div>
  )
}
