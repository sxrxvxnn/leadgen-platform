import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api, { getFeatureFlags, updateFeatureFlag } from '../services/api'

const CHANNELS = [
  { id: 'engineering', label: '#engineering', color: '#E7000B' },
  { id: 'design',      label: '#design',      color: '#9D0010' },
  { id: 'product',     label: '#product',     color: '#5c0008' },
]

const OWNER_USER_ID = '5c9c0565-cec6-40ba-887a-84b665c40a44'

export default function Admin() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isOwner = profile?.id === OWNER_USER_ID
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Discord broadcast
  const [discordChannel, setDiscordChannel] = useState('engineering')
  const [discordMsg, setDiscordMsg] = useState('')
  const [discordSending, setDiscordSending] = useState(false)
  const [discordFeedback, setDiscordFeedback] = useState(null)

  // GitHub collaborator
  const [ghUsername, setGhUsername] = useState('')
  const [ghAdding, setGhAdding] = useState(false)
  const [ghFeedback, setGhFeedback] = useState(null)
  const [ghLog, setGhLog] = useState([])

  // Feature flags
  const [featureFlags, setFeatureFlags] = useState([])
  const [flagsLoading, setFlagsLoading] = useState(true)
  const [togglingFlag, setTogglingFlag] = useState(null)

  useEffect(() => {
    if (profile && profile.role !== 'admin') { navigate('/dashboard'); return }
    if (profile) { load(); loadFlags() }
  }, [profile])

  async function load() {
    setLoading(true)
    try {
      const [mem, inv] = await Promise.all([
        api.get('/admin/members'),
        api.get('/admin/invites'),
      ])
      setMembers(mem.data)
      setInvites(inv.data)
    } catch {}
    setLoading(false)
  }

  async function loadFlags() {
    setFlagsLoading(true)
    try {
      const res = await getFeatureFlags()
      setFeatureFlags(res.data?.flags || [])
    } catch {}
    setFlagsLoading(false)
  }

  async function handleToggleFlag(name, current) {
    setTogglingFlag(name)
    try {
      await updateFeatureFlag(name, !current)
      setFeatureFlags(prev => prev.map(f => f.name === name ? { ...f, enabled: !current } : f))
    } catch {}
    setTogglingFlag(null)
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true); setMsg(''); setError('')
    try {
      await api.post('/admin/invite', { email: inviteEmail.trim(), role: inviteRole })
      setMsg(`Invite sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
      load()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to send invite.')
    }
    setInviting(false)
  }

  async function handleRoleChange(memberId, newRole) {
    try {
      await api.patch(`/admin/members/${memberId}`, { role: newRole })
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    } catch {}
  }

  async function handleRemove(memberId) {
    if (!window.confirm('Remove this member?')) return
    try {
      await api.delete(`/admin/members/${memberId}`)
      setMembers(prev => prev.filter(m => m.id !== memberId))
    } catch {}
  }

  async function handleRevokeInvite(inviteId) {
    try {
      await api.delete(`/admin/invites/${inviteId}`)
      setInvites(prev => prev.filter(i => i.id !== inviteId))
    } catch {}
  }

  async function handleDiscordSend(e) {
    e.preventDefault()
    if (!discordMsg.trim()) return
    setDiscordSending(true)
    setDiscordFeedback(null)
    try {
      await api.post('/admin/discord', { channel: discordChannel, message: discordMsg.trim() })
      setDiscordFeedback({ ok: true, text: `Sent to #${discordChannel}` })
      setDiscordMsg('')
    } catch (err) {
      setDiscordFeedback({ ok: false, text: err?.response?.data?.detail || 'Failed to send.' })
    }
    setDiscordSending(false)
  }

  async function handleGithubInvite(e) {
    e.preventDefault()
    const username = ghUsername.trim()
    if (!username) return
    setGhAdding(true)
    setGhFeedback(null)
    try {
      const res = await api.post('/admin/github-invite', { username })
      const status = res.data.status
      const entry = {
        username,
        time: new Date().toLocaleTimeString(),
        ok: true,
        label: status === 'invited' ? 'Invite sent' : 'Already a member',
      }
      setGhFeedback({ ok: true, text: status === 'invited' ? `✓ Invite sent to ${username} — they need to accept via email.` : `${username} already has access.` })
      setGhLog(prev => [entry, ...prev].slice(0, 10))
      setGhUsername('')
    } catch (err) {
      const text = err?.response?.data?.detail || 'Failed to add.'
      setGhFeedback({ ok: false, text })
      setGhLog(prev => [{ username, time: new Date().toLocaleTimeString(), ok: false, label: 'Failed' }, ...prev].slice(0, 10))
    }
    setGhAdding(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      <div style={{ position: 'relative', padding: '64px 48px 48px', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ position: 'relative' }}>
          <p style={s.eyebrow}>Team</p>
          <h1 style={s.heroTitle}>Admin.</h1>
          <p style={s.heroSub}>Manage members, roles, and invitations.</p>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 48px 80px' }}>

        {/* Invite */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Invite member</h2>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              style={{ flex: 1, minWidth: '220px', padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', outline: 'none' }}
            />
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              style={{ padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', outline: 'none', cursor: 'pointer' }}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={inviting}
              style={{ padding: '11px 20px', background: '#1d1b1b', border: 'none', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600', color: '#fdfdfd', cursor: 'pointer' }}
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </form>
          {msg && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#4a7c59', marginTop: '10px' }}>✓ {msg}</p>}
          {error && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#e07070', marginTop: '10px' }}>{error}</p>}
        </section>

        {/* Members */}
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Members</h2>
          {loading ? (
            <p style={s.muted}>Loading…</p>
          ) : members.length === 0 ? (
            <p style={s.muted}>No members yet. Invite someone above.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', fontWeight: '500' }}>{m.full_name || m.email}</p>
                    {m.full_name && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>{m.email}</p>}
                  </div>
                  <select
                    value={m.role}
                    onChange={e => handleRoleChange(m.id, e.target.value)}
                    disabled={m.id === profile?.id}
                    style={{ padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '5px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text)', cursor: m.id === profile?.id ? 'default' : 'pointer' }}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  {m.id !== profile?.id && (
                    <button
                      onClick={() => handleRemove(m.id)}
                      style={{ padding: '6px 10px', background: 'none', border: '1px solid rgba(224,112,112,0.3)', borderRadius: '5px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#e07070', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  )}
                  {m.id === profile?.id && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', padding: '4px 8px' }}>You</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Discord broadcast — owner only */}
        {isOwner && <section style={s.section}>
          <h2 style={s.sectionTitle}>Post to Discord</h2>
          <form onSubmit={handleDiscordSend} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {CHANNELS.map(ch => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setDiscordChannel(ch.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: discordChannel === ch.id ? `1.5px solid ${ch.color}` : '1.5px solid var(--border)',
                    background: discordChannel === ch.id ? `${ch.color}18` : 'transparent',
                    color: discordChannel === ch.id ? ch.color : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {ch.label}
                </button>
              ))}
            </div>
            <textarea
              value={discordMsg}
              onChange={e => setDiscordMsg(e.target.value)}
              placeholder="Write your message here — onboarding steps, announcements, reminders…"
              rows={4}
              style={{
                padding: '12px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--text)',
                outline: 'none',
                resize: 'vertical',
                lineHeight: 1.6,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="submit"
                disabled={discordSending || !discordMsg.trim()}
                style={{
                  padding: '10px 20px',
                  background: discordSending ? 'var(--surface)' : '#E7000B',
                  border: 'none',
                  borderRadius: 7,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: discordSending ? 'default' : 'pointer',
                  opacity: !discordMsg.trim() ? 0.4 : 1,
                }}
              >
                {discordSending ? 'Sending…' : 'Send message'}
              </button>
              {discordFeedback && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: discordFeedback.ok ? '#4a7c59' : '#e07070', margin: 0 }}>
                  {discordFeedback.ok ? '✓ ' : '✗ '}{discordFeedback.text}
                </p>
              )}
            </div>
          </form>
        </section>}

        {/* GitHub collaborator — owner only */}
        {isOwner && <section style={s.section}>
          <h2 style={s.sectionTitle}>Add to GitHub</h2>
          <p style={{ ...s.muted, marginBottom: 16 }}>
            Team member posts their GitHub username in #engineering → enter it here → they get an invite by email.
          </p>
          <form onSubmit={handleGithubInvite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <input
              type="text"
              value={ghUsername}
              onChange={e => setGhUsername(e.target.value)}
              placeholder="their-github-username"
              style={{
                flex: 1,
                minWidth: 200,
                padding: '11px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 7,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--text)',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={ghAdding || !ghUsername.trim()}
              style={{
                padding: '11px 20px',
                background: ghAdding ? 'var(--surface)' : '#1d1b1b',
                border: 'none',
                borderRadius: 7,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 600,
                color: '#fdfdfd',
                cursor: ghAdding ? 'default' : 'pointer',
                opacity: !ghUsername.trim() ? 0.4 : 1,
              }}
            >
              {ghAdding ? 'Adding…' : 'Add collaborator'}
            </button>
          </form>
          {ghFeedback && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: ghFeedback.ok ? '#4a7c59' : '#e07070', marginBottom: 16 }}>
              {ghFeedback.ok ? '✓ ' : '✗ '}{ghFeedback.text}
            </p>
          )}
          {ghLog.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {ghLog.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', flex: 1 }}>{entry.username}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: entry.ok ? '#4a7c59' : '#e07070' }}>{entry.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{entry.time}</span>
                </div>
              ))}
            </div>
          )}
        </section>}

        {/* ── Feature Flags ── */}
        <section style={s.section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={s.sectionTitle}>Feature Flags</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                Admin always sees all features · flags gate regular users only
              </span>
            </div>
          </div>
          {flagsLoading
            ? <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>
            : (() => {
                const categories = [...new Set(featureFlags.map(f => f.category))]
                const catLabels = { enrichment: 'Enrichment', outreach: 'Outreach', ui: 'UI / Views', data: 'Data & Export' }
                return categories.map(cat => (
                  <div key={cat} style={{ marginBottom: 28 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                      {catLabels[cat] || cat}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
                      {featureFlags.filter(f => f.category === cat).map(flag => (
                        <div key={flag.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface)', border: `1px solid ${flag.enabled ? 'rgba(5,150,105,0.25)' : 'var(--border)'}`, borderRadius: 8, gap: 12, transition: 'border-color 0.15s' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: flag.enabled ? 'var(--text)' : 'var(--text-muted)', margin: 0, letterSpacing: '-0.01em' }}>{flag.label}</p>
                            {flag.description && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', margin: '3px 0 0', lineHeight: 1.4 }}>{flag.description}</p>}
                          </div>
                          {/* Toggle switch */}
                          <button
                            onClick={() => handleToggleFlag(flag.name, flag.enabled)}
                            disabled={togglingFlag === flag.name}
                            title={flag.enabled ? 'Click to disable for users' : 'Click to enable for users'}
                            style={{ flexShrink: 0, width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', background: flag.enabled ? '#059669' : 'var(--border)', opacity: togglingFlag === flag.name ? 0.5 : 1 }}>
                            <span style={{ position: 'absolute', top: 3, left: flag.enabled ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()
          }
        </section>

        {/* Pending invites */}
        {invites.length > 0 && (
          <section style={{ ...s.section, borderBottom: 'none' }}>
            <h2 style={s.sectionTitle}>Pending invites</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {invites.map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)' }}>{inv.email}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>{inv.role} · sent {new Date(inv.created_at).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    style={{ padding: '6px 10px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

const s = {
  eyebrow:      { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' },
    heroTitle:    { fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 6vw, 80px)', fontWeight: '900', letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1, marginBottom: '10px' },
  heroSub:      { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.02em' },
  section:      { paddingBottom: '40px', marginBottom: '40px', borderBottom: '1px solid var(--border)' },
  sectionTitle: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.1em', color: 'var(--text)', textTransform: 'uppercase', marginBottom: '20px' },
  muted:        { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' },
}
