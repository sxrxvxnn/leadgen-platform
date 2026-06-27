import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const ToastContext = createContext(null)

const COLORS = {
  success: { bg: 'rgba(5,150,105,0.12)',  border: 'rgba(5,150,105,0.3)',  text: '#34d399', icon: '✓' },
  error:   { bg: 'rgba(231,0,11,0.12)',   border: 'rgba(231,0,11,0.3)',   text: '#f87171', icon: '✗' },
  warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24', icon: '!' },
  info:    { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#60a5fa', icon: 'i' },
}

function ToastItem({ id, type = 'info', message, onDismiss }) {
  const c = COLORS[type] || COLORS.info
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(() => onDismiss(id), 200)
  }

  return (
    <div
      onClick={dismiss}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 16px',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        cursor: 'pointer',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        maxWidth: 360,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.18s ease, opacity 0.18s ease',
        userSelect: 'none',
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: '50%',
        background: c.border,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700,
        color: c.text, flexShrink: 0, marginTop: 1,
      }}>
        {c.icon}
      </span>
      <p style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
        color: 'var(--text)', lineHeight: 1.5, margin: 0, flex: 1,
      }}>
        {message}
      </p>
      <span style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>×</span>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++counter.current
    setToasts(prev => [...prev.slice(-3), { id, message, type }])
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const toast = {
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error', dur),
    warning: (msg, dur) => show(msg, 'warning', dur),
    info:    (msg, dur) => show(msg, 'info', dur),
    dismiss,
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          display: 'flex', flexDirection: 'column', gap: 8,
          zIndex: 9999, pointerEvents: 'none',
        }}>
          {toasts.map(t => (
            <div key={t.id} style={{ pointerEvents: 'auto' }}>
              <ToastItem {...t} onDismiss={dismiss} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
