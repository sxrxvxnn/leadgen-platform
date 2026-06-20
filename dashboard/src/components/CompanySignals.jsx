import { useState } from 'react'
import { detectCompanySignals } from '../services/api'

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)"
const SANS = "var(--font-sans, 'Host Grotesk', sans-serif)"

const SIGNAL_CFG = {
  hiring:     { label: 'Hiring',     color: '#4a7c59', bg: 'rgba(74,124,89,0.08)',    border: 'rgba(74,124,89,0.22)' },
  funding:    { label: 'Funding',    color: '#5b8db8', bg: 'rgba(91,141,184,0.08)',   border: 'rgba(91,141,184,0.22)' },
  compliance: { label: 'Compliance', color: '#a86448', bg: 'rgba(168,100,72,0.08)',   border: 'rgba(168,100,72,0.22)' },
  news:       { label: 'News',       color: '#9b8ea8', bg: 'rgba(155,142,168,0.08)', border: 'rgba(155,142,168,0.22)' },
  growth:     { label: 'Growth',     color: '#7a8a5b', bg: 'rgba(122,138,91,0.08)',  border: 'rgba(122,138,91,0.22)' },
}

function SignalCard({ signal }) {
  const cfg = SIGNAL_CFG[signal.signal_type] || SIGNAL_CFG.news
  return (
    <div style={{ padding: '10px 12px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6, marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, padding: '1px 5px', background: 'transparent', border: `1px solid ${cfg.border}`, borderRadius: 3, color: cfg.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {cfg.label}
        </span>
        {signal.relevance_score != null && (
          <span style={{ fontFamily: MONO, fontSize: 8, color: 'var(--text-muted)' }}>{signal.relevance_score}</span>
        )}
      </div>
      <p style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: 'var(--text)', margin: '0 0 3px', lineHeight: 1.3 }}>{signal.title}</p>
      {signal.description && (
        <p style={{ fontFamily: SANS, fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{signal.description}</p>
      )}
      {signal.source_url && signal.source_url.startsWith('http') && (
        <a href={signal.source_url} target="_blank" rel="noreferrer"
          style={{ fontFamily: MONO, fontSize: 9, color: 'var(--accent)', textDecoration: 'none', marginTop: 4, display: 'inline-block', letterSpacing: '0.04em' }}>
          Source ↗
        </a>
      )}
    </div>
  )
}

export default function CompanySignals({ companyId, initialSignals = null, compact = false }) {
  const [signals, setSignals] = useState(initialSignals)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(!compact)

  async function scan(force = false) {
    setLoading(true)
    try {
      const res = await detectCompanySignals(companyId, force)
      setSignals(res.data.signals)
      setExpanded(true)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const count = signals?.length ?? 0

  if (compact) {
    return (
      <div>
        <button
          onClick={() => signals ? setExpanded(e => !e) : scan()}
          disabled={loading}
          style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 600, padding: '3px 8px',
            background: count > 0 ? 'rgba(168,100,72,0.08)' : 'transparent',
            border: `1px solid ${count > 0 ? 'rgba(168,100,72,0.3)' : 'var(--border)'}`,
            borderRadius: 4,
            color: count > 0 ? '#a86448' : 'var(--text-muted)',
            cursor: loading ? 'default' : 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          {loading ? 'Scanning…' : count > 0 ? `${count} signals` : 'Signals'}
        </button>
        {expanded && signals && signals.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {signals.map((s, i) => <SignalCard key={s.id || i} signal={s} />)}
            <button onClick={() => scan(true)} disabled={loading}
              style={{ fontFamily: MONO, fontSize: 9, padding: '2px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer', marginTop: 4 }}>
              Refresh
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <p style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', margin: 0, paddingBottom: 6, borderBottom: '1px solid var(--border)', flex: 1 }}>
          Buying Signals
        </p>
        {signals === null ? (
          <button onClick={() => scan()} disabled={loading}
            style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, padding: '3px 10px', background: loading ? 'var(--surface)' : 'var(--text)', color: loading ? 'var(--text-muted)' : 'var(--bg)', border: 'none', borderRadius: 4, cursor: loading ? 'default' : 'pointer', letterSpacing: '0.06em', flexShrink: 0 }}>
            {loading ? 'Scanning…' : 'Scan for signals'}
          </button>
        ) : (
          <button onClick={() => scan(true)} disabled={loading}
            style={{ fontFamily: MONO, fontSize: 9, padding: '2px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: loading ? 'default' : 'pointer', flexShrink: 0 }}>
            {loading ? '…' : 'Refresh'}
          </button>
        )}
      </div>

      {loading && signals === null && (
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          Scanning the web for signals…
        </p>
      )}

      {signals !== null && signals.length === 0 && (
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', fontStyle: 'italic' }}>
          No signals detected
        </p>
      )}

      {signals && signals.map((s, i) => <SignalCard key={s.id || i} signal={s} />)}
    </div>
  )
}
