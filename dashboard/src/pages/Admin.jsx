import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api, { getFeatureFlags, updateFeatureFlag } from '../services/api'

const CHANNELS = [
  { id: 'engineering', label: '#engineering', color: '#E7000B' },
  { id: 'design',      label: '#design',      color: '#9D0010' },
  { id: 'product',     label: '#product',     color: '#5c0008' },
]

const OWNER_USER_ID = '5c9c0565-cec6-40ba-887a-84b665c40a44'

const TABS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'users',         label: 'Users' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'growth',        label: 'Growth' },
  { id: 'engagement',    label: 'Engagement' },
  { id: 'audit',         label: 'Audit Log' },
  { id: 'flags',         label: 'Feature Flags' },
  { id: 'team',          label: 'Team' },
  { id: 'tools',         label: 'Tools' },
]

export default function Admin() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isOwner = profile?.id === OWNER_USER_ID
  const [tab, setTab] = useState('overview')

  // ── Team ──────────────────────────────────────────────────────────────────
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [teamLoading, setTeamLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteErr, setInviteErr] = useState('')

  // ── Discord / GitHub ───────────────────────────────────────────────────────
  const [discordChannel, setDiscordChannel] = useState('engineering')
  const [discordMsg, setDiscordMsg] = useState('')
  const [discordSending, setDiscordSending] = useState(false)
  const [discordFeedback, setDiscordFeedback] = useState(null)
  const [ghUsername, setGhUsername] = useState('')
  const [ghAdding, setGhAdding] = useState(false)
  const [ghFeedback, setGhFeedback] = useState(null)
  const [ghLog, setGhLog] = useState([])

  // ── Feature Flags ──────────────────────────────────────────────────────────
  const [featureFlags, setFeatureFlags] = useState([])
  const [flagsLoading, setFlagsLoading] = useState(true)
  const [togglingFlag, setTogglingFlag] = useState(null)
  const [flagMsg, setFlagMsg] = useState(null)

  // ── Overview / Stats ───────────────────────────────────────────────────────
  const [stats, setStats] = useState(null)
  const [recentUsers, setRecentUsers] = useState([])
  const [statsLoading, setStatsLoading] = useState(true)

  // ── All Users ──────────────────────────────────────────────────────────────
  const [allUsers, setAllUsers] = useState([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(0)
  const [usersSearch, setUsersSearch] = useState('')
  const [usersRole, setUsersRole] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [updatingUser, setUpdatingUser] = useState(null)

  // ── Announcements ──────────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState([])
  const [annLoading, setAnnLoading] = useState(false)
  const [annForm, setAnnForm] = useState({ title: '', body: '', kind: 'info' })
  const [annEditing, setAnnEditing] = useState(null)
  const [annSaving, setAnnSaving] = useState(false)

  // ── Growth ─────────────────────────────────────────────────────────────────
  const [growth, setGrowth] = useState(null)
  const [growthLoading, setGrowthLoading] = useState(false)

  // ── Engagement ─────────────────────────────────────────────────────────────
  const [engagement, setEngagement] = useState(null)
  const [engLoading, setEngLoading] = useState(false)

  // ── Audit Log ──────────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState([])
  const [auditPage, setAuditPage] = useState(0)
  const [auditAction, setAuditAction] = useState('')
  const [auditLoading, setAuditLoading] = useState(false)

  useEffect(() => {
    if (profile && profile.role !== 'admin') { navigate('/dashboard'); return }
    if (profile) {
      loadTeam()
      loadFlags()
      loadStats()
    }
  }, [profile])

  // Lazy-load per tab
  useEffect(() => {
    if (!profile) return
    if (tab === 'users') loadAllUsers()
    if (tab === 'announcements') loadAnnouncements()
    if (tab === 'growth') loadGrowth()
    if (tab === 'engagement') loadEngagement()
    if (tab === 'audit') loadAudit()
  }, [tab, profile])

  // Reload users when filters change
  useEffect(() => {
    if (tab === 'users') loadAllUsers()
  }, [usersPage, usersSearch, usersRole])

  useEffect(() => {
    if (tab === 'audit') loadAudit()
  }, [auditPage, auditAction])

  // ── Loaders ────────────────────────────────────────────────────────────────
  async function loadTeam() {
    setTeamLoading(true)
    try {
      const [mem, inv] = await Promise.all([
        api.get('/admin/members'),
        api.get('/admin/invites'),
      ])
      setMembers(mem.data?.members || mem.data || [])
      setInvites(inv.data?.invites || inv.data || [])
    } catch {}
    setTeamLoading(false)
  }

  async function loadFlags() {
    setFlagsLoading(true)
    try {
      const res = await getFeatureFlags()
      setFeatureFlags(res.data?.flags || [])
    } catch {}
    setFlagsLoading(false)
  }

  async function loadStats() {
    setStatsLoading(true)
    try {
      const res = await api.get('/admin/stats')
      setStats(res.data?.stats || null)
      setRecentUsers(res.data?.recent_users || [])
    } catch {}
    setStatsLoading(false)
  }

  async function loadAllUsers() {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams({ page: usersPage })
      if (usersSearch) params.set('search', usersSearch)
      if (usersRole) params.set('role', usersRole)
      const res = await api.get(`/admin/all-users?${params}`)
      setAllUsers(res.data?.users || [])
      setUsersTotal(res.data?.total || 0)
    } catch {}
    setUsersLoading(false)
  }

  async function loadAnnouncements() {
    setAnnLoading(true)
    try {
      const res = await api.get('/admin/announcements')
      setAnnouncements(Array.isArray(res.data) ? res.data : res.data?.announcements || [])
    } catch {}
    setAnnLoading(false)
  }

  async function loadGrowth() {
    setGrowthLoading(true)
    try {
      const res = await api.get('/admin/growth')
      setGrowth(res.data || null)
    } catch {}
    setGrowthLoading(false)
  }

  async function loadEngagement() {
    setEngLoading(true)
    try {
      const res = await api.get('/admin/engagement')
      setEngagement(res.data || null)
    } catch {}
    setEngLoading(false)
  }

  async function loadAudit() {
    setAuditLoading(true)
    try {
      const params = new URLSearchParams({ page: auditPage })
      if (auditAction) params.set('action', auditAction)
      const res = await api.get(`/admin/audit-logs?${params}`)
      setAuditLogs(res.data?.logs || [])
    } catch {}
    setAuditLoading(false)
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleInvite(e) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteMsg(''); setInviteErr('')
    try {
      await api.post('/admin/invite', { email: inviteEmail.trim(), role: inviteRole })
      setInviteMsg(`Invite sent to ${inviteEmail.trim()}`)
      setInviteEmail('')
      loadTeam()
    } catch (e) {
      setInviteErr(e?.response?.data?.detail || 'Failed to send invite.')
    }
    setInviting(false)
  }

  async function handleMemberRoleChange(memberId, newRole) {
    try {
      await api.patch(`/admin/members/${memberId}`, { role: newRole })
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    } catch {}
  }

  async function handleMemberRemove(memberId) {
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

  async function handleUserUpdate(userId, patch) {
    setUpdatingUser(userId)
    try {
      await api.patch(`/admin/users/${userId}`, patch)
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u))
    } catch {}
    setUpdatingUser(null)
  }

  async function handleToggleFlag(name, current) {
    setTogglingFlag(name); setFlagMsg(null)
    try {
      await updateFeatureFlag(name, !current)
      setFeatureFlags(prev => prev.map(f => f.name === name ? { ...f, enabled: !current } : f))
      setFlagMsg({ ok: true, text: `${name} → ${!current ? 'enabled' : 'disabled'}` })
    } catch (e) {
      setFlagMsg({ ok: false, text: e?.response?.data?.detail || 'Failed to toggle flag' })
    }
    setTogglingFlag(null)
    setTimeout(() => setFlagMsg(null), 4000)
  }

  async function handleAnnSave(e) {
    e.preventDefault()
    setAnnSaving(true)
    try {
      if (annEditing) {
        await api.patch(`/admin/announcements/${annEditing}`, annForm)
        setAnnouncements(prev => prev.map(a => a.id === annEditing ? { ...a, ...annForm } : a))
      } else {
        const res = await api.post('/admin/announcements', annForm)
        setAnnouncements(prev => [res.data, ...prev])
      }
      setAnnForm({ title: '', body: '', kind: 'info' })
      setAnnEditing(null)
    } catch {}
    setAnnSaving(false)
  }

  async function handleAnnDelete(id) {
    if (!window.confirm('Delete this announcement?')) return
    try {
      await api.delete(`/admin/announcements/${id}`)
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    } catch {}
  }

  async function handleAnnToggle(id, current) {
    try {
      await api.patch(`/admin/announcements/${id}`, { active: !current })
      setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, active: !current } : a))
    } catch {}
  }

  async function handleDiscordSend(e) {
    e.preventDefault()
    if (!discordMsg.trim()) return
    setDiscordSending(true); setDiscordFeedback(null)
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
    setGhAdding(true); setGhFeedback(null)
    try {
      const res = await api.post('/admin/github-invite', { username })
      const status = res.data.status
      setGhFeedback({ ok: true, text: status === 'invited' ? `Invite sent to ${username}` : `${username} already has access.` })
      setGhLog(prev => [{ username, time: new Date().toLocaleTimeString(), ok: true, label: status === 'invited' ? 'Invited' : 'Already member' }, ...prev].slice(0, 10))
      setGhUsername('')
    } catch (err) {
      const text = err?.response?.data?.detail || 'Failed to add.'
      setGhFeedback({ ok: false, text })
      setGhLog(prev => [{ username, time: new Date().toLocaleTimeString(), ok: false, label: 'Failed' }, ...prev].slice(0, 10))
    }
    setGhAdding(false)
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  const kindColor = { info: '#3b82f6', warning: '#f59e0b', success: '#059669', error: '#e07070' }

  // ── Tab content ────────────────────────────────────────────────────────────
  function renderOverview() {
    if (statsLoading) return <p style={s.muted}>Loading…</p>
    const st = stats
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 40 }}>
          <StatCard label="Total users"      value={st?.users?.total}     sub={`+${st?.users?.last_7d ?? 0} this week`} />
          <StatCard label="Companies"        value={st?.companies?.total} sub={`+${st?.companies?.last_7d ?? 0} this week`} />
          <StatCard label="Leads"            value={st?.leads?.total}     sub={`+${st?.leads?.last_7d ?? 0} this week`} />
          <StatCard label="Sequences"        value={st?.sequences?.total} />
          <StatCard label="Tasks"            value={st?.tasks?.total} />
          <StatCard label="Email clicks"     value={st?.email_clicks?.total} />
          <StatCard label="Unsubscribes"     value={st?.unsubscribes?.total} />
        </div>

        <h3 style={{ ...s.sectionTitle, marginBottom: 16 }}>Recent signups</h3>
        {recentUsers.length === 0 ? <p style={s.muted}>No data.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {recentUsers.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{u.name || u.email}</p>
                  {u.name && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{u.email}</p>}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{u.companies ?? 0} companies · {u.leads ?? 0} leads</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 8px', borderRadius: 4, background: u.role === 'admin' ? 'rgba(231,0,11,0.12)' : 'var(--bg)', color: u.role === 'admin' ? '#E7000B' : 'var(--text-muted)', border: '1px solid var(--border)' }}>{u.role}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{u.joined ? new Date(u.joined).toLocaleDateString() : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderUsers() {
    const totalPages = Math.ceil(usersTotal / 20)
    return (
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search email or name…"
            value={usersSearch}
            onChange={e => { setUsersSearch(e.target.value); setUsersPage(0) }}
            style={{ flex: 1, minWidth: 200, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none' }}
          />
          <select value={usersRole} onChange={e => { setUsersRole(e.target.value); setUsersPage(0) }}
            style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none' }}>
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
        </div>

        {usersLoading ? <p style={s.muted}>Loading…</p> : allUsers.length === 0 ? <p style={s.muted}>No users found.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {allUsers.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--surface)', border: `1px solid ${u.suspended ? 'rgba(224,112,112,0.25)' : 'var(--border)'}`, borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: u.suspended ? '#e07070' : 'var(--text)', fontWeight: 500 }}>{u.full_name || u.email}</p>
                  {u.full_name && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{u.email}</p>}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{u.companies ?? 0}co · {u.leads ?? 0}ld</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : ''}</span>
                <select
                  value={u.role}
                  disabled={u.id === profile?.id || updatingUser === u.id}
                  onChange={e => handleUserUpdate(u.id, { role: e.target.value })}
                  style={{ padding: '5px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)' }}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                {u.id !== profile?.id && (
                  <button
                    onClick={() => handleUserUpdate(u.id, { suspended: !u.suspended })}
                    disabled={updatingUser === u.id}
                    style={{ padding: '5px 10px', background: 'none', border: `1px solid ${u.suspended ? 'rgba(74,124,89,0.4)' : 'rgba(224,112,112,0.3)'}`, borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: u.suspended ? '#4a7c59' : '#e07070', cursor: 'pointer' }}>
                    {u.suspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
            <button onClick={() => setUsersPage(p => Math.max(0, p - 1))} disabled={usersPage === 0} style={s.pageBtn}>Prev</button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{usersPage + 1} / {totalPages} · {usersTotal} total</span>
            <button onClick={() => setUsersPage(p => p + 1)} disabled={usersPage >= totalPages - 1} style={s.pageBtn}>Next</button>
          </div>
        )}
      </div>
    )
  }

  function renderAnnouncements() {
    return (
      <div>
        <form onSubmit={handleAnnSave} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <h3 style={{ ...s.sectionTitle, marginBottom: 16 }}>{annEditing ? 'Edit announcement' : 'New announcement'}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text" required placeholder="Title"
              value={annForm.title}
              onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))}
              style={{ padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none' }}
            />
            <textarea required placeholder="Body message…" rows={3}
              value={annForm.body}
              onChange={e => setAnnForm(f => ({ ...f, body: e.target.value }))}
              style={{ padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {['info', 'warning', 'success', 'error'].map(k => (
                <button key={k} type="button" onClick={() => setAnnForm(f => ({ ...f, kind: k }))}
                  style={{ padding: '6px 14px', borderRadius: 6, border: `1.5px solid ${annForm.kind === k ? kindColor[k] : 'var(--border)'}`, background: annForm.kind === k ? `${kindColor[k]}18` : 'transparent', color: annForm.kind === k ? kindColor[k] : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>
                  {k}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={annSaving}
                style={{ padding: '10px 20px', background: '#E7000B', border: 'none', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                {annSaving ? 'Saving…' : annEditing ? 'Update' : 'Publish'}
              </button>
              {annEditing && (
                <button type="button" onClick={() => { setAnnEditing(null); setAnnForm({ title: '', body: '', kind: 'info' }) }}
                  style={{ padding: '10px 20px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>

        {annLoading ? <p style={s.muted}>Loading…</p> : announcements.length === 0 ? <p style={s.muted}>No announcements yet.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {announcements.map(a => (
              <div key={a.id} style={{ padding: '16px 20px', background: 'var(--surface)', border: `1px solid ${a.active ? kindColor[a.kind] + '40' : 'var(--border)'}`, borderRadius: 10, opacity: a.active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ padding: '3px 8px', borderRadius: 4, background: `${kindColor[a.kind]}18`, color: kindColor[a.kind], fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{a.kind}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{a.title}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{a.body}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => handleAnnToggle(a.id, a.active)}
                      style={{ padding: '5px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      {a.active ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={() => { setAnnEditing(a.id); setAnnForm({ title: a.title, body: a.body, kind: a.kind }) }}
                      style={{ padding: '5px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => handleAnnDelete(a.id)}
                      style={{ padding: '5px 10px', background: 'none', border: '1px solid rgba(224,112,112,0.3)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#e07070', cursor: 'pointer' }}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderGrowth() {
    if (growthLoading) return <p style={s.muted}>Loading…</p>
    if (!growth) return <p style={s.muted}>No growth data.</p>

    const { days = [], users = [], companies = [], leads = [] } = growth
    const maxVal = Math.max(...users, ...companies, ...leads, 1)

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
          <StatCard label="Users (30d)"     value={users.reduce((a, b) => a + b, 0)} />
          <StatCard label="Companies (30d)" value={companies.reduce((a, b) => a + b, 0)} />
          <StatCard label="Leads (30d)"     value={leads.reduce((a, b) => a + b, 0)} />
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          {[['Users', '#E7000B'], ['Companies', '#3b82f6'], ['Leads', '#059669']].map(([l, c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{l}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 140, padding: '0 4px', borderBottom: '1px solid var(--border)' }}>
          {days.map((day, i) => (
            <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'stretch', justifyContent: 'flex-end', minWidth: 0 }}>
              {[
                { val: users[i] || 0, color: '#E7000B' },
                { val: companies[i] || 0, color: '#3b82f6' },
                { val: leads[i] || 0, color: '#059669' },
              ].map(({ val, color }) => (
                val > 0 && <div key={color} title={`${val}`} style={{ background: color, borderRadius: '2px 2px 0 0', height: `${Math.max(2, (val / maxVal) * 130)}px`, opacity: 0.8 }} />
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{days[0] ? new Date(days[0]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{days[days.length - 1] ? new Date(days[days.length - 1]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
        </div>
      </div>
    )
  }

  function renderEngagement() {
    if (engLoading) return <p style={s.muted}>Loading…</p>
    if (!engagement) return <p style={s.muted}>No engagement data.</p>
    const { dau, wau, mau, inactive_count, top_by_companies = [], top_by_leads = [] } = engagement

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
          <StatCard label="DAU"      value={dau} />
          <StatCard label="WAU"      value={wau} />
          <StatCard label="MAU"      value={mau} />
          <StatCard label="Inactive" value={inactive_count} sub="no activity 30d+" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {[['Top by companies', top_by_companies, 'companies'], ['Top by leads', top_by_leads, 'leads']].map(([title, list, key]) => (
            <div key={key}>
              <h3 style={{ ...s.sectionTitle, marginBottom: 12 }}>{title}</h3>
              {list.length === 0 ? <p style={s.muted}>No data.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {list.map((u, i) => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', width: 18, textAlign: 'right' }}>#{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{u.full_name || u.email}</p>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{u.email}</p>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>{u[key]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderAudit() {
    return (
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input type="text" placeholder="Filter by action…" value={auditAction}
            onChange={e => { setAuditAction(e.target.value); setAuditPage(0) }}
            style={{ flex: 1, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none' }}
          />
        </div>

        {auditLoading ? <p style={s.muted}>Loading…</p> : auditLogs.length === 0 ? <p style={s.muted}>No audit logs.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {auditLogs.map(log => (
              <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', fontWeight: 600 }}>{log.action}</span>
                    {log.target && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>→ {log.target}</span>}
                  </div>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{log.admin_email}</p>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>{JSON.stringify(log.metadata)}</p>
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <button onClick={() => setAuditPage(p => Math.max(0, p - 1))} disabled={auditPage === 0} style={s.pageBtn}>Prev</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Page {auditPage + 1}</span>
          <button onClick={() => setAuditPage(p => p + 1)} disabled={auditLogs.length < 20} style={s.pageBtn}>Next</button>
        </div>
      </div>
    )
  }

  function renderFlags() {
    if (flagsLoading) return <p style={s.muted}>Loading…</p>
    if (featureFlags.length === 0) return <p style={s.muted}>No feature flags configured.</p>
    const categories = [...new Set(featureFlags.map(f => f.category))]
    const catLabels = { pages: 'Pages', enrichment: 'Enrichment', outreach: 'Outreach', ui: 'UI / Views', data: 'Data & Export', leads: 'Leads' }
    return <>
      {flagMsg && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: flagMsg.ok ? '#4a7c59' : '#e07070', marginBottom: 16 }}>{flagMsg.ok ? '✓' : '✗'} {flagMsg.text}</p>}
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginBottom: 20 }}>Flags gate <strong>regular users only</strong> — admins and owners always see 100% of features. Changes propagate to users within 60 seconds.</p>
      {categories.map(cat => (
      <div key={cat} style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          {catLabels[cat] || cat}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
          {featureFlags.filter(f => f.category === cat).map(flag => (
            <div key={flag.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--surface)', border: `1px solid ${flag.enabled ? 'rgba(5,150,105,0.25)' : 'var(--border)'}`, borderRadius: 8, gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: flag.enabled ? 'var(--text)' : 'var(--text-muted)', margin: 0 }}>{flag.label}</p>
                {flag.description && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', margin: '3px 0 0' }}>{flag.description}</p>}
              </div>
              <button onClick={() => handleToggleFlag(flag.name, flag.enabled)} disabled={togglingFlag === flag.name}
                style={{ flexShrink: 0, width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative', background: flag.enabled ? '#059669' : 'var(--border)', opacity: togglingFlag === flag.name ? 0.5 : 1 }}>
                <span style={{ position: 'absolute', top: 3, left: flag.enabled ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </button>
            </div>
          ))}
        </div>
      </div>
    ))}
    </>
  }

  function renderTeam() {
    return (
      <div>
        <section style={s.section}>
          <h2 style={s.sectionTitle}>Invite member</h2>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com" required
              style={{ flex: 1, minWidth: 220, padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              style={{ padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none' }}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={inviting}
              style={{ padding: '11px 20px', background: '#1d1b1b', border: 'none', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#fdfdfd', cursor: 'pointer' }}>
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </form>
          {inviteMsg && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4a7c59', marginTop: 10 }}>✓ {inviteMsg}</p>}
          {inviteErr && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e07070', marginTop: 10 }}>{inviteErr}</p>}
        </section>

        <section style={s.section}>
          <h2 style={s.sectionTitle}>Members</h2>
          {teamLoading ? <p style={s.muted}>Loading…</p> : members.length === 0 ? <p style={s.muted}>No members yet.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{m.full_name || m.email}</p>
                    {m.full_name && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{m.email}</p>}
                  </div>
                  <select value={m.role} onChange={e => handleMemberRoleChange(m.id, e.target.value)} disabled={m.id === profile?.id}
                    style={{ padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)' }}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  {m.id !== profile?.id ? (
                    <button onClick={() => handleMemberRemove(m.id)}
                      style={{ padding: '6px 10px', background: 'none', border: '1px solid rgba(224,112,112,0.3)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#e07070', cursor: 'pointer' }}>
                      Remove
                    </button>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', padding: '4px 8px' }}>You</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {invites.length > 0 && (
          <section style={{ ...s.section, borderBottom: 'none' }}>
            <h2 style={s.sectionTitle}>Pending invites</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {invites.map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>{inv.email}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{inv.role} · sent {new Date(inv.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => handleRevokeInvite(inv.id)}
                    style={{ padding: '6px 10px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  function renderTools() {
    return (
      <div>
        {isOwner && (
          <section style={s.section}>
            <h2 style={s.sectionTitle}>Post to Discord</h2>
            <form onSubmit={handleDiscordSend} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {CHANNELS.map(ch => (
                  <button key={ch.id} type="button" onClick={() => setDiscordChannel(ch.id)}
                    style={{ padding: '7px 14px', borderRadius: 6, border: discordChannel === ch.id ? `1.5px solid ${ch.color}` : '1.5px solid var(--border)', background: discordChannel === ch.id ? `${ch.color}18` : 'transparent', color: discordChannel === ch.id ? ch.color : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    {ch.label}
                  </button>
                ))}
              </div>
              <textarea value={discordMsg} onChange={e => setDiscordMsg(e.target.value)} placeholder="Write your message here…" rows={4}
                style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="submit" disabled={discordSending || !discordMsg.trim()}
                  style={{ padding: '10px 20px', background: discordSending ? 'var(--surface)' : '#E7000B', border: 'none', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#fff', cursor: discordSending ? 'default' : 'pointer', opacity: !discordMsg.trim() ? 0.4 : 1 }}>
                  {discordSending ? 'Sending…' : 'Send message'}
                </button>
                {discordFeedback && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: discordFeedback.ok ? '#4a7c59' : '#e07070', margin: 0 }}>{discordFeedback.ok ? '✓ ' : '✗ '}{discordFeedback.text}</p>}
              </div>
            </form>
          </section>
        )}

        {isOwner && (
          <section style={{ ...s.section, borderBottom: 'none' }}>
            <h2 style={s.sectionTitle}>Add to GitHub</h2>
            <p style={{ ...s.muted, marginBottom: 16 }}>Team member posts their GitHub username → enter it here → they get an invite by email.</p>
            <form onSubmit={handleGithubInvite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <input type="text" value={ghUsername} onChange={e => setGhUsername(e.target.value)} placeholder="their-github-username"
                style={{ flex: 1, minWidth: 200, padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
              <button type="submit" disabled={ghAdding || !ghUsername.trim()}
                style={{ padding: '11px 20px', background: ghAdding ? 'var(--surface)' : '#1d1b1b', border: 'none', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#fdfdfd', cursor: ghAdding ? 'default' : 'pointer', opacity: !ghUsername.trim() ? 0.4 : 1 }}>
                {ghAdding ? 'Adding…' : 'Add collaborator'}
              </button>
            </form>
            {ghFeedback && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: ghFeedback.ok ? '#4a7c59' : '#e07070', marginBottom: 16 }}>{ghFeedback.ok ? '✓ ' : '✗ '}{ghFeedback.text}</p>}
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
          </section>
        )}

        {!isOwner && <p style={s.muted}>Only the owner can use these tools.</p>}
      </div>
    )
  }

  const tabContent = {
    overview:      renderOverview,
    users:         renderUsers,
    announcements: renderAnnouncements,
    growth:        renderGrowth,
    engagement:    renderEngagement,
    audit:         renderAudit,
    flags:         renderFlags,
    team:          renderTeam,
    tools:         renderTools,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ position: 'relative', padding: '64px 48px 0', borderBottom: '1px solid var(--border)' }}>
        <p style={s.eyebrow}>Platform</p>
        <h1 style={s.heroTitle}>Admin.</h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginTop: 32, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--text)' : 'transparent'}`, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 48px 80px' }}>
        {(tabContent[tab] || (() => null))()}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ padding: '20px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1 }}>{value ?? '—'}</p>
      {sub && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</p>}
    </div>
  )
}

const s = {
  eyebrow:      { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' },
  heroTitle:    { fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 6vw, 80px)', fontWeight: '900', letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1, marginBottom: '10px' },
  section:      { paddingBottom: '32px', marginBottom: '32px', borderBottom: '1px solid var(--border)' },
  sectionTitle: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.1em', color: 'var(--text)', textTransform: 'uppercase', marginBottom: '16px' },
  muted:        { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' },
  pageBtn:      { padding: '7px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', cursor: 'pointer' },
}
