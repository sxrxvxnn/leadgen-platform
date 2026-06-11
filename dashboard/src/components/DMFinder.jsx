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
  const opened = queue.filter(q => q.status === 'opened').length
  const done = queue.filter(q => q.status === 'done').length
  const shown = filter === 'all' ? queue : queue.filter(q => q.status === filter)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(29,27,27,0.4)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(29,27,27,0.12)' }}>

        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Batch DM Finder</p>
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', fontWeight: '400', color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Find Decision Makers</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>Open each people page → Extension extracts DMs → Leads saved automatically</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
            {[
              { label: 'Total', value: queue.length, color: 'var(--text)' },
              { label: 'Pending', value: pending, color: 'var(--text-muted)' },
              { label: 'Opened', value: opened, color: 'var(--accent)' },
              { label: 'Done', value: done, color: '#4a7c59' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center', padding: '12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '24px', fontWeight: '400', color, lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', letterSpacing: '0.5px', marginTop: '4px' }}>{label}</p>
              </div>
            ))}
          </div>

          <div style={{ height: '4px', background: 'var(--surface-raised)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (queue.length ? Math.round(done / queue.length * 100) : 0) + '%', background: '#4a7c59', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 28px' }}>
          {['all', 'pending', 'opened', 'done'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '10px 14px', background: 'none', border: 'none', borderBottom: '2px solid ' + (filter === f ? 'var(--accent)' : 'transparent'), fontSize: '11px', fontWeight: filter === f ? '600' : '400', color: filter === f ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {shown.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>No companies in this category</p>
          )}
          {shown.map(item => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
              background: 'var(--surface)', border: `1px solid ${item.status === 'done' ? 'rgba(74,124,89,0.25)' : item.status === 'opened' ? 'rgba(168,100,72,0.25)' : 'var(--border)'}`,
              borderRadius: '10px', borderLeft: `3px solid ${item.status === 'done' ? '#4a7c59' : item.status === 'opened' ? 'var(--accent)' : 'var(--border)'}`,
            }}>
              <div style={{ width: '24px', textAlign: 'center', flexShrink: 0, fontSize: '15px', color: item.status === 'done' ? '#4a7c59' : item.status === 'opened' ? 'var(--accent)' : 'var(--text-muted)' }}>
                {item.status === 'done' ? '✓' : item.status === 'opened' ? '⏳' : '○'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)', marginBottom: '2px' }}>{item.name}</p>
                {item.peopleUrl
                  ? <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.peopleUrl.replace('https://www.linkedin.com', '')}</p>
                  : <p style={{ fontSize: '11px', color: 'var(--red)' }}>No LinkedIn URL — add it on Companies page</p>
                }
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {item.status !== 'done' && item.peopleUrl && (
                  <a href={item.peopleUrl} target="_blank" rel="noreferrer" onClick={() => markOpened(item.id)}
                    style={{ padding: '6px 14px', background: item.status === 'opened' ? 'var(--accent)' : 'var(--text)', borderRadius: '7px', fontSize: '12px', fontWeight: '500', color: 'var(--bg)', textDecoration: 'none', display: 'inline-block' }}>
                    {item.status === 'opened' ? 'Reopen →' : 'Open →'}
                  </a>
                )}
                {item.status === 'opened' && (
                  <button onClick={() => markDone(item.id)} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid rgba(74,124,89,0.4)', borderRadius: '7px', fontSize: '12px', fontWeight: '500', color: '#4a7c59', cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✓ Done
                  </button>
                )}
                {item.status === 'done' && (
                  <span style={{ fontSize: '12px', color: '#4a7c59', fontWeight: '500' }}>Extracted ✓</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 28px', borderTop: '1px solid var(--border)', background: 'rgba(168,100,72,0.04)', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
          <p style={{ fontSize: '10px', fontWeight: '600', color: 'var(--accent)', letterSpacing: '1px', marginBottom: '4px', textTransform: 'uppercase' }}>How to use</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            1. Click <strong style={{ color: 'var(--text)' }}>Open →</strong> to open LinkedIn people page
            → 2. Auto-scroll in extension → Extract leads
            → 3. Click <strong style={{ color: '#4a7c59' }}>✓ Done</strong> → Move to next company
          </p>
        </div>
      </div>
    </div>
  )
}
