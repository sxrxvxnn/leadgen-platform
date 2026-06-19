import React, { useState } from 'react'

export default function DMFinder({ companies, onClose }) {
  const [queue, setQueue] = useState(
    companies.map(c => {
      const slug = c.linkedin_url ? c.linkedin_url.split('/company/')[1]?.split('/')[0] : null
      return {
        id: c.id,
        name: c.name,
        status: 'pending',
        peopleUrl: slug ? 'https://www.linkedin.com/company/' + slug + '/people/' : null,
      }
    })
  )
  const [filter, setFilter] = useState('all')

  function markOpened(id) {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'opened' } : q))
  }
  function markDone(id) {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'done' } : q))
  }

  const pending = queue.filter(q => q.status === 'pending').length
  const opened  = queue.filter(q => q.status === 'opened').length
  const done    = queue.filter(q => q.status === 'done').length
  const shown   = filter === 'all' ? queue : queue.filter(q => q.status === filter)
  const pct     = queue.length ? Math.round(done / queue.length * 100) : 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(29,27,27,0.5)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(29,27,27,0.14)' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px dashed var(--border-dash)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <p style={s.eyebrow}>Batch DM Finder</p>
              <h2 style={s.title}>Find Decision Makers</h2>
              <p style={s.subtitle}>Open each people page → Extension extracts DMs → Leads saved automatically</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '5px 10px', letterSpacing: '0.04em' }}>✕ Close</button>
          </div>

          {/* Stats — gap-px grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#c4c1bd', border: '1px solid #c4c1bd', borderRadius: '6px', overflow: 'hidden', marginBottom: '14px' }}>
            {[
              { label: 'Total',   value: queue.length, color: 'var(--text)' },
              { label: 'Pending', value: pending,       color: 'var(--text-muted)' },
              { label: 'Opened',  value: opened,        color: 'var(--accent)' },
              { label: 'Done',    value: done,          color: '#4a7c59' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'var(--bg)', padding: '14px 16px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: '400', letterSpacing: '-0.04em', color, lineHeight: 1, marginBottom: '4px' }}>{value}</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ height: '3px', background: 'var(--surface)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: '#4a7c59', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 28px', borderBottom: '1px solid var(--border)' }}>
          {['all', 'pending', 'opened', 'done'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 12px',
              background: filter === f ? 'var(--text)' : 'transparent',
              border: `1px solid ${filter === f ? 'var(--text)' : 'var(--border)'}`,
              borderRadius: '5px',
              fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: filter === f ? '600' : '400',
              letterSpacing: '0.04em',
              color: filter === f ? '#FFFFFF' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Company list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {shown.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '400', letterSpacing: '-0.03em', color: 'var(--text-secondary)' }}>Nothing here.</p>
            </div>
          )}
          {shown.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px',
              background: 'var(--surface)',
              border: `1px solid ${item.status === 'done' ? 'rgba(74,124,89,0.22)' : item.status === 'opened' ? 'rgba(168,100,72,0.22)' : 'var(--border)'}`,
              borderRadius: '6px',
            }}>
              {/* Status dot */}
              <div style={{ width: '22px', textAlign: 'center', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '12px', color: item.status === 'done' ? '#4a7c59' : item.status === 'opened' ? 'var(--accent)' : 'rgba(196,193,189,0.6)' }}>
                {item.status === 'done' ? '✓' : item.status === 'opened' ? '◉' : '○'}
              </div>

              {/* Name + URL */}
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: '400', letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: '2px', lineHeight: 1.2 }}>{item.name}</p>
                {item.peopleUrl
                  ? <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.01em' }}>{item.peopleUrl.replace('https://www.linkedin.com', '')}</p>
                  : <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)' }}>No LinkedIn URL — add it on Companies page</p>
                }
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {item.status !== 'done' && item.peopleUrl && (
                  <a href={item.peopleUrl} target="_blank" rel="noreferrer" onClick={() => markOpened(item.id)}
                    style={{ padding: '6px 14px', background: item.status === 'opened' ? 'var(--accent)' : 'var(--text)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: '#FFFFFF', textDecoration: 'none', display: 'inline-block' }}>
                    {item.status === 'opened' ? 'Reopen →' : 'Open →'}
                  </a>
                )}
                {item.status === 'opened' && (
                  <button onClick={() => markDone(item.id)} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(74,124,89,0.35)', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: '#4a7c59', cursor: 'pointer' }}>
                    ✓ Done
                  </button>
                )}
                {item.status === 'done' && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: '#4a7c59' }}>Extracted ✓</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '14px 28px', borderTop: '1px dashed var(--border-dash)', background: 'rgba(168,100,72,0.03)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '5px' }}>How to use</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            1. Click <strong style={{ color: 'var(--text)', fontWeight: '600' }}>Open →</strong> to open LinkedIn people page
            → 2. Auto-scroll in extension → Extract leads
            → 3. Click <strong style={{ color: '#4a7c59', fontWeight: '600' }}>✓ Done</strong> → Move to next
          </p>
        </div>

      </div>
    </div>
  )
}

const s = {
  eyebrow:  { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' },
  title:    { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1, marginBottom: '6px' },
  subtitle: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 },
}
