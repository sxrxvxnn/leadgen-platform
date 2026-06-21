import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { listUnsubscribes, addUnsubscribe, removeUnsubscribe } from '../services/api'

export default function Unsubscribes() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [addError, setAddError] = useState('')
  const [msg, setMsg] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { fetch() }, [])

  async function fetch() {
    try {
      const res = await listUnsubscribes()
      setItems(res.data.unsubscribes || [])
    } catch {}
    finally { setLoading(false) }
  }

  async function handleAdd() {
    const email = newEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) { setAddError('Enter a valid email address.'); return }
    if (items.some(i => i.email === email)) { setAddError('Already suppressed.'); return }
    setAdding(true); setAddError('')
    try {
      await addUnsubscribe(email)
      setItems(prev => [{ id: Date.now(), email, created_at: new Date().toISOString() }, ...prev])
      setNewEmail('')
      flash('✓ Added to suppression list.')
    } catch { setAddError('Failed to add. Try again.') }
    finally { setAdding(false) }
  }

  async function handleRemove(id, email) {
    try {
      await removeUnsubscribe(id)
      setItems(prev => prev.filter(i => i.id !== id))
      flash(`Removed ${email} — they can receive emails again.`)
    } catch { flash('Failed to remove.') }
  }

  function handleExport() {
    const csv = ['Email,Unsubscribed At', ...filtered.map(i => `"${i.email}","${i.created_at}"`)].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'sonar-unsubscribes.csv'; a.click()
  }

  function flash(text) { setMsg(text); setTimeout(() => setMsg(''), 4000) }

  const filtered = items.filter(i => !search || i.email.includes(search.toLowerCase()))

  return (
    <div style={s.page}>
      <motion.div style={s.hero} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
        <div>
          <p style={s.eyebrow}>Email Suppression</p>
          <h1 style={s.heroTitle}>
            {items.length}
            <span style={s.heroUnit}> unsubscribes</span>
          </h1>
          <p style={s.heroSub}>People who have opted out of your Sonar sequences. They will never be emailed again by any sequence.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={s.exportBtn} onClick={handleExport}>Export CSV →</button>
        </div>
      </motion.div>

      {msg && (
        <div style={{ padding: '10px 48px', background: msg.startsWith('✓') ? 'rgba(74,124,89,0.08)' : 'rgba(231,0,11,0.06)', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: msg.startsWith('✓') ? '#4a7c59' : '#E7000B' }}>{msg}</span>
        </div>
      )}

      <div style={s.container}>
        {/* Add manually */}
        <div style={s.addCard}>
          <p style={s.addLabel}>Manually suppress an email</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <input
                ref={inputRef}
                value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setAddError('') }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="email@company.com"
                style={s.input}
              />
              {addError && <p style={s.inputErr}>{addError}</p>}
            </div>
            <button onClick={handleAdd} disabled={adding} style={s.addBtn}>
              {adding ? 'Adding…' : 'Add to suppression list'}
            </button>
          </div>
          <p style={s.addHint}>Useful for adding emails from opt-out requests received outside Sonar (e.g. direct replies).</p>
        </div>

        {/* Search */}
        <div style={s.searchRow}>
          <div style={s.searchBox}>
            <span style={s.searchIcon}>↗</span>
            <input
              type="text" placeholder="Search by email…" value={search}
              onChange={e => setSearch(e.target.value)} style={s.searchInput}
            />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
            {filtered.length} of {items.length}
          </span>
        </div>

        {/* Table */}
        <div style={s.table}>
          <div style={s.thead}>
            <span style={{ ...s.th, flex: 3 }}>EMAIL</span>
            <span style={{ ...s.th, flex: 2 }}>UNSUBSCRIBED</span>
            <span style={{ ...s.th, flex: 2 }}>SOURCE</span>
            <span style={{ ...s.th, width: 80, textAlign: 'right' }}>ACTION</span>
          </div>

          {loading && (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: '72px 24px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, letterSpacing: '-0.04em', color: 'var(--text-secondary)', marginBottom: 8 }}>
                {search ? 'No matches.' : 'No suppressions yet.'}
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                {search ? 'Try a different search.' : 'When someone clicks unsubscribe in a sequence email, they appear here.'}
              </p>
            </div>
          )}

          {!loading && filtered.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
              style={s.row}
            >
              <span style={{ ...s.td, flex: 3, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>{item.email}</span>
              <span style={{ ...s.td, flex: 2, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                {item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </span>
              <span style={{ ...s.td, flex: 2 }}>
                <span style={s.sourceBadge}>{item.source || 'sequence link'}</span>
              </span>
              <div style={{ width: 80, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => handleRemove(item.id, item.email)}
                  style={s.removeBtn}
                  title="Remove suppression — they can receive emails again"
                >
                  Re-enable
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Info box */}
        <div style={s.infoBox}>
          <p style={s.infoTitle}>How suppressions work</p>
          <ul style={s.infoList}>
            <li>When a lead clicks "Unsubscribe" in any sequence email, they are added here automatically.</li>
            <li>Sonar checks this list before sending every sequence step — suppressed emails are silently skipped.</li>
            <li>Active enrollments for suppressed emails are paused immediately.</li>
            <li>Removing a suppression re-enables them for future sequences, but does not re-enroll them in any existing sequence.</li>
          </ul>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  hero: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
    padding: '64px 48px 40px', borderBottom: '1px solid var(--border)',
  },
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase' },
  heroTitle: { fontFamily: 'var(--font-display)', fontSize: 'clamp(56px,8vw,96px)', fontWeight: 900, letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1 },
  heroUnit: { fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '-0.03em' },
  heroSub: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6, maxWidth: 480 },
  exportBtn: { padding: '8px 16px', background: 'var(--text)', border: 'none', borderRadius: 7, fontSize: 10, fontWeight: 600, color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' },
  container: { padding: '24px 48px', display: 'flex', flexDirection: 'column', gap: 20 },

  addCard: { padding: '20px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 },
  addLabel: { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 },
  input: { width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none', transition: 'border-color .15s' },
  inputErr: { fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ef4444', marginTop: 5 },
  addBtn: { padding: '9px 18px', background: 'var(--text)', border: 'none', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' },
  addHint: { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 },

  searchRow: { display: 'flex', gap: 12, alignItems: 'center' },
  searchBox: { display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, flex: 1 },
  searchIcon: { padding: '0 12px', color: 'var(--text-muted)', fontSize: 14 },
  searchInput: { flex: 1, padding: '9px 12px 9px 0', background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-mono)' },

  table: { background: 'var(--bg)', border: '1px solid rgba(196,193,189,0.5)', borderRadius: 0, overflow: 'hidden' },
  thead: { display: 'flex', padding: '10px 20px', background: 'var(--surface)', borderBottom: '1px solid rgba(196,193,189,0.4)', alignItems: 'center' },
  th: { fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' },
  row: { display: 'flex', padding: '12px 20px', borderTop: '1px solid rgba(196,193,189,0.25)', alignItems: 'center', transition: 'background 0.1s' },
  td: { padding: '0 8px 0 0', display: 'flex', alignItems: 'center' },

  sourceBadge: {
    fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3,
    background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)',
  },
  removeBtn: {
    padding: '4px 10px', background: 'transparent', border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
    letterSpacing: '0.06em', color: '#ef4444', cursor: 'pointer', transition: 'all .15s',
  },

  infoBox: { padding: '18px 22px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 },
  infoTitle: { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 },
  infoList: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 },
}
