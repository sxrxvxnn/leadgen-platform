import { useState, useEffect } from 'react'
import { useBulkOps } from '../context/BulkOpsContext'

function fmtEta(startedAt, filledCount, total) {
  if (!startedAt || filledCount < 2 || total <= filledCount) return null
  const elapsed = (Date.now() - startedAt) / 1000
  const rate = filledCount / elapsed
  const remaining = total - filledCount
  const secs = Math.round(remaining / rate)
  if (secs < 60) return '< 1 min'
  const mins = Math.round(secs / 60)
  return `~${mins} min`
}

export default function EnrichmentProgressModal() {
  const { autofill } = useBulkOps()
  const [dismissed, setDismissed] = useState(false)
  const [minimized, setMinimized] = useState(false)

  // Re-show when a new run starts
  useEffect(() => {
    if (autofill.running) {
      setDismissed(false)
      setMinimized(false)
    }
  }, [autofill.running, autofill.startedAt])

  const visible =
    (autofill.running || (autofill.filledCount > 0 && !autofill.running)) && !dismissed

  if (!visible) return null

  const pct = autofill.total > 0 ? Math.round((autofill.filledCount / autofill.total) * 100) : 0
  const eta = fmtEta(autofill.startedAt, autofill.filledCount, autofill.total)
  const done = !autofill.running

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: minimized ? 'auto' : 320,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        zIndex: 9999,
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 12px',
          borderBottom: minimized ? 'none' : '1px solid var(--border)',
          background: done ? 'rgba(74,124,89,0.06)' : 'transparent',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: done ? '#4a7c59' : 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {done ? (
            '✓'
          ) : (
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--accent)',
                animation: 'pulse 1.4s ease-in-out infinite',
              }}
            />
          )}
          {done ? 'Enrichment complete' : 'Enriching companies'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setMinimized((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 13,
              padding: '0 4px',
              lineHeight: 1,
            }}
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? '▲' : '▼'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: 14,
              padding: '0 4px',
              lineHeight: 1,
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      </div>

      {!minimized && (
        <div style={{ padding: '10px 12px 12px' }}>
          {/* Progress bar */}
          {autofill.total > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  height: 4,
                  background: 'var(--border)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: done ? '#4a7c59' : 'var(--accent)',
                    borderRadius: 2,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 5,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                }}
              >
                <span>
                  {autofill.filledCount}/{autofill.total} companies
                </span>
                {eta && !done && <span>{eta} remaining</span>}
                {done && <span style={{ color: '#4a7c59' }}>{pct}% done</span>}
              </div>
            </div>
          )}

          {/* Status message */}
          {autofill.msg && (
            <p
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                margin: '0 0 8px',
                lineHeight: 1.5,
              }}
            >
              {autofill.msg}
            </p>
          )}

          {/* Recent activity — only for in-browser enrichment */}
          {(autofill.recentActivity || []).length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              {(autofill.recentActivity || []).map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 5,
                    fontSize: 10,
                    color: i === 0 ? 'var(--text)' : 'var(--text-muted)',
                    marginBottom: 3,
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ color: '#4a7c59', flexShrink: 0 }}>✓</span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 160,
                    }}
                  >
                    {a.name || 'Company'}
                  </span>
                  {a.fields?.length > 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                      {a.fields.slice(0, 2).join(', ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Email notification note */}
          {done && autofill.filledCount > 0 && (
            <p
              style={{
                fontSize: 9,
                color: 'var(--text-muted)',
                margin: '8px 0 0',
                lineHeight: 1.5,
              }}
            >
              A summary email has been sent to your inbox.
            </p>
          )}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
