import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Admin() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile && profile.role !== 'admin') { navigate('/dashboard'); return }
    if (profile) load()
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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

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
    heroTitle:    { fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 6vw, 80px)', fontWeight: '900', letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1, marginBottom: '10px' },, letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1, marginBottom: '10px' },
  heroSub:      { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.02em' },
  section:      { paddingBottom: '40px', marginBottom: '40px', borderBottom: '1px solid var(--border)' },
  sectionTitle: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.1em', color: 'var(--text)', textTransform: 'uppercase', marginBottom: '20px' },
  muted:        { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' },
}
