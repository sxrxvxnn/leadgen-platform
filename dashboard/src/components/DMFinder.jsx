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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '8px', width: '100%', maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--gray-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <p style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '3px', color: 'var(--gray-4)', marginBottom: '6px' }}>BATCH DM FINDER</p>
              <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--white)', letterSpacing: '-0.5px', marginBottom: '4px' }}>Find Decision Makers</h2>
              <p style={{ fontSize: '12px', color: 'var(--gray-4)', lineHeight: 1.5 }}>Open each people page → Extension extracts DMs → Leads saved automatically</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--gray-4)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
            {[
              { label: 'Total', value: queue.length, color: 'var(--white)' },
              { label: 'Pending', value: pending, color: 'var(--gray-4)' },
              { label: 'Opened', value: opened, color: 'var(--amber)' },
              { label: 'Done', value: done, color: 'var(--green)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: 'center', padding: '10px', background: 'var(--black)', borderRadius: '4px' }}>
                <p style={{ fontSize: '22px', fontWeight: '900', color, lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '9px', color: 'var(--gray-4)', fontWeight: '700', letterSpacing: '1px', marginTop: '4px' }}>{label.toUpperCase()}</p>
              </div>
            ))}
          </div>

          <div style={{ height: '4px', background: 'var(--gray-2)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (queue.length ? Math.round(done / queue.length * 100) : 0) + '%', background: 'var(--green)', transition: 'width 0.4s ease' }} />
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-2)', padding: '0 28px' }}>
          {['all', 'pending', 'opened', 'done'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '10px 14px', background: 'none', border: 'none', borderBottom: '2px solid ' + (filter === f ? 'var(--amber)' : 'transparent'), fontSize: '11px', fontWeight: '700', color: filter === f ? 'var(--amber)' : 'var(--gray-4)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {shown.length === 0 && (
            <p style={{ color: 'var(--gray-4)', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>No companies in this category</p>
          )}
          {shown.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--black)', border: '1px solid ' + (item.status === 'done' ? 'rgba(0,230,118,0.2)' : item.status === 'opened' ? 'rgba(255,171,0,0.2)' : 'var(--gray-2)'), borderRadius: '6px', borderLeft: '3px solid ' + (item.status === 'done' ? 'var(--green)' : item.status === 'opened' ? 'var(--amber)' : 'var(--gray-3)') }}>
              <div style={{ width: '24px', textAlign: 'center', flexShrink: 0, fontSize: '16px', color: item.status === 'done' ? 'var(--green)' : item.status === 'opened' ? 'var(--amber)' : 'var(--gray-4)' }}>
                {item.status === 'done' ? '✓' : item.status === 'opened' ? '⏳' : '○'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--white)', marginBottom: '2px' }}>{item.name}</p>
                {item.peopleUrl
                  ? <p style={{ fontSize: '11px', color: 'var(--gray-4)' }}>{item.peopleUrl.replace('https://www.linkedin.com', '')}</p>
                  : <p style={{ fontSize: '11px', color: '#ff2d2d' }}>No LinkedIn URL — add it on Companies page</p>
                }
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {item.status !== 'done' && item.peopleUrl && (
                  <a href={item.peopleUrl} target="_blank" rel="noreferrer" onClick={() => markOpened(item.id)}
                    style={{ padding: '6px 14px', background: item.status === 'opened' ? 'var(--amber)' : 'var(--white)', borderRadius: '4px', fontSize: '12px', fontWeight: '700', color: 'var(--black)', textDecoration: 'none', display: 'inline-block' }}>
                    {item.status === 'opened' ? 'Reopen →' : 'Open →'}
                  </a>
                )}
                {item.status === 'opened' && (
                  <button onClick={() => markDone(item.id)} style={{ padding: '6px 14px', background: 'transparent', border: '1px solid var(--green)', borderRadius: '4px', fontSize: '12px', fontWeight: '700', color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✓ Done
                  </button>
                )}
                {item.status === 'done' && (
                  <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: '600' }}>Extracted ✓</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: '14px 28px', borderTop: '1px solid var(--gray-2)', background: 'rgba(255,171,0,0.04)' }}>
          <p style={{ fontSize: '10px', fontWeight: '700', color: 'var(--amber)', letterSpacing: '1px', marginBottom: '4px' }}>HOW TO USE</p>
          <p style={{ fontSize: '11px', color: 'var(--gray-4)', lineHeight: 1.6 }}>
            1. Click <strong style={{ color: 'var(--white)' }}>Open →</strong> to open LinkedIn people page
            → 2. Auto-scroll in extension → Extract leads
            → 3. Click <strong style={{ color: 'var(--green)' }}>✓ Done</strong> → Move to next company
          </p>
        </div>
      </div>
    </div>
  )
}