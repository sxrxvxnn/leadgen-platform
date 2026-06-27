import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import api, { getFeatureFlags, updateFeatureFlag } from '../services/api'

// ── Constants ─────────────────────────────────────────────────────────────────
const OWNER_USER_ID = '5c9c0565-cec6-40ba-887a-84b665c40a44'

const TABS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'users',         label: 'Users' },
  { id: 'growth',        label: 'Growth' },
  { id: 'engagement',    label: 'Engagement' },
  { id: 'flags',         label: 'Feature Flags' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'audit',         label: 'Audit Log' },
  { id: 'team',          label: 'Team' },
  { id: 'tools',         label: 'Tools' },
]

const CAT_LABELS = { pages: 'Pages', enrichment: 'Enrichment', outreach: 'Outreach', ui: 'UI / Views', data: 'Data & Export', leads: 'Leads' }
const KIND_COLOR  = { info: '#3b82f6', warning: '#f59e0b', success: '#059669', error: '#e07070' }
const DISCORD_CH  = [
  { id: 'engineering', label: '#engineering', color: '#E7000B' },
  { id: 'design',      label: '#design',      color: '#9D0010' },
  { id: 'product',     label: '#product',     color: '#5c0008' },
]
const AUDIT_ACTIONS = ['', 'flag_toggled', 'user_suspended', 'user_role_changed', 'user_deleted', 'invite_sent', 'invite_revoked', 'announcement_created', 'announcement_deleted']

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useDebounce(value, ms = 380) {
  const [d, setD] = useState(value)
  useEffect(() => { const t = setTimeout(() => setD(value), ms); return () => clearTimeout(t) }, [value, ms])
  return d
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(s) { return s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }
function fmtShort(s) { return s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '' }
function initials(u) { return ((u.full_name || u.email || '?')[0]).toUpperCase() }
function roleColor(role) {
  if (role === 'owner') return { bg: 'rgba(231,0,11,0.12)', color: '#E7000B', border: 'rgba(231,0,11,0.25)' }
  if (role === 'admin') return { bg: 'rgba(157,0,16,0.12)', color: '#9D0010', border: 'rgba(157,0,16,0.25)' }
  return { bg: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: 'var(--border)' }
}

function exportCSV(rows) {
  const cols = ['email', 'full_name', 'role', 'companies', 'leads', 'created_at', 'suspended']
  const lines = [cols.join(','), ...rows.map(u => cols.map(c => JSON.stringify(u[c] ?? '')).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'users.csv'; a.click()
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Admin() {
  const { profile } = useAuth()
  const isOwner = profile?.id === OWNER_USER_ID
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner'
  const [tab, setTab] = useState('overview')

  // State
  const [stats, setStats]             = useState(null)
  const [recentUsers, setRecentUsers] = useState([])
  const [statsLoading, setStatsLoading] = useState(true)

  const [allUsers, setAllUsers]       = useState([])
  const [usersTotal, setUsersTotal]   = useState(0)
  const [usersPage, setUsersPage]     = useState(0)
  const [usersSearch, setUsersSearch] = useState('')
  const [usersRole, setUsersRole]     = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [updatingUser, setUpdatingUser] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [selectedUser, setSelectedUser]   = useState(null)
  const debouncedSearch = useDebounce(usersSearch)

  const [featureFlags, setFeatureFlags] = useState([])
  const [flagsLoading, setFlagsLoading] = useState(true)
  const [togglingFlag, setTogglingFlag] = useState(null)
  const [flagMsg, setFlagMsg]           = useState(null)

  const [announcements, setAnnouncements] = useState([])
  const [annLoading, setAnnLoading]       = useState(false)
  const [annForm, setAnnForm]             = useState({ title: '', body: '', kind: 'info' })
  const [annEditing, setAnnEditing]       = useState(null)
  const [annSaving, setAnnSaving]         = useState(false)

  const [growth, setGrowth]           = useState(null)
  const [growthLoading, setGrowthLoading] = useState(false)

  const [engagement, setEngagement]   = useState(null)
  const [engLoading, setEngLoading]   = useState(false)

  const [auditLogs, setAuditLogs]     = useState([])
  const [auditPage, setAuditPage]     = useState(0)
  const [auditAction, setAuditAction] = useState('')
  const [auditLoading, setAuditLoading] = useState(false)

  const [members, setMembers]         = useState([])
  const [invites, setInvites]         = useState([])
  const [teamLoading, setTeamLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole]   = useState('member')
  const [inviting, setInviting]       = useState(false)
  const [inviteMsg, setInviteMsg]     = useState('')
  const [inviteErr, setInviteErr]     = useState('')
  const [removeConfirm, setRemoveConfirm] = useState(null)

  const [discordCh, setDiscordCh]     = useState('engineering')
  const [discordMsg, setDiscordMsg]   = useState('')
  const [discordSending, setDiscordSending] = useState(false)
  const [discordFeedback, setDiscordFeedback] = useState(null)
  const [ghUsername, setGhUsername]   = useState('')
  const [ghAdding, setGhAdding]       = useState(false)
  const [ghFeedback, setGhFeedback]   = useState(null)
  const [ghLog, setGhLog]             = useState([])

  // ── Loaders ──────────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try { const r = await api.get('/admin/stats'); setStats(r.data?.stats || null); setRecentUsers(r.data?.recent_users || []) } catch {}
    setStatsLoading(false)
  }, [])

  const loadUsers = useCallback(async (search, role, page) => {
    setUsersLoading(true)
    try {
      const p = new URLSearchParams({ page })
      if (search) p.set('search', search)
      if (role)   p.set('role', role)
      const r = await api.get(`/admin/all-users?${p}`)
      setAllUsers(r.data?.users || []); setUsersTotal(r.data?.total || 0)
    } catch {}
    setUsersLoading(false)
  }, [])

  const loadFlags = useCallback(async () => {
    setFlagsLoading(true)
    try { const r = await getFeatureFlags(); setFeatureFlags(r.data?.flags || []) } catch {}
    setFlagsLoading(false)
  }, [])

  const loadAnnouncements = useCallback(async () => {
    setAnnLoading(true)
    try { const r = await api.get('/admin/announcements'); setAnnouncements(Array.isArray(r.data) ? r.data : r.data?.announcements || []) } catch {}
    setAnnLoading(false)
  }, [])

  const loadGrowth = useCallback(async () => {
    setGrowthLoading(true)
    try { const r = await api.get('/admin/growth'); setGrowth(r.data || null) } catch {}
    setGrowthLoading(false)
  }, [])

  const loadEngagement = useCallback(async () => {
    setEngLoading(true)
    try { const r = await api.get('/admin/engagement'); setEngagement(r.data || null) } catch {}
    setEngLoading(false)
  }, [])

  const loadAudit = useCallback(async (action, page) => {
    setAuditLoading(true)
    try { const p = new URLSearchParams({ page }); if (action) p.set('action', action); const r = await api.get(`/admin/audit-logs?${p}`); setAuditLogs(r.data?.logs || []) } catch {}
    setAuditLoading(false)
  }, [])

  const loadTeam = useCallback(async () => {
    setTeamLoading(true)
    try {
      const [m, i] = await Promise.all([api.get('/admin/members'), api.get('/admin/invites')])
      setMembers(m.data?.members || m.data || [])
      setInvites(i.data?.invites || i.data || [])
    } catch {}
    setTeamLoading(false)
  }, [])

  // ── Effects ───────────────────────────────────────────────────────────────────
  useEffect(() => { if (isAdmin) { loadStats(); loadFlags(); loadTeam() } }, [isAdmin])
  useEffect(() => {
    if (!isAdmin) return
    if (tab === 'users')         loadUsers(debouncedSearch, usersRole, usersPage)
    if (tab === 'announcements') loadAnnouncements()
    if (tab === 'growth')        loadGrowth()
    if (tab === 'engagement')    loadEngagement()
    if (tab === 'audit')         loadAudit(auditAction, auditPage)
  }, [tab, isAdmin])

  useEffect(() => { if (tab === 'users') { setUsersPage(0); loadUsers(debouncedSearch, usersRole, 0) } }, [debouncedSearch, usersRole])
  useEffect(() => { if (tab === 'users') loadUsers(debouncedSearch, usersRole, usersPage) }, [usersPage])
  useEffect(() => { if (tab === 'audit') loadAudit(auditAction, auditPage) }, [auditPage, auditAction])

  // ── Handlers ──────────────────────────────────────────────────────────────────
  async function handleUserUpdate(userId, patch) {
    setUpdatingUser(userId)
    try { await api.patch(`/admin/users/${userId}`, patch); setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u)) } catch {}
    setUpdatingUser(null)
  }

  async function handleUserDelete(userId) {
    setUpdatingUser(userId); setDeleteConfirm(null)
    try { await api.delete(`/admin/users/${userId}`); setAllUsers(prev => prev.filter(u => u.id !== userId)); setUsersTotal(t => t - 1) } catch {}
    setUpdatingUser(null)
  }

  async function handleToggleFlag(name, current) {
    setTogglingFlag(name); setFlagMsg(null)
    try {
      await updateFeatureFlag(name, !current)
      setFeatureFlags(prev => prev.map(f => f.name === name ? { ...f, enabled: !current } : f))
      setFlagMsg({ ok: true, text: `${name} → ${!current ? 'enabled' : 'disabled'}` })
    } catch (e) { setFlagMsg({ ok: false, text: e?.response?.data?.detail || 'Failed to toggle flag' }) }
    setTogglingFlag(null)
    setTimeout(() => setFlagMsg(null), 4000)
  }

  async function handleBulkFlags(category, enabled) {
    const targets = featureFlags.filter(f => f.category === category && f.enabled !== enabled)
    for (const f of targets) {
      try { await updateFeatureFlag(f.name, enabled) } catch {}
    }
    setFeatureFlags(prev => prev.map(f => f.category === category ? { ...f, enabled } : f))
    setFlagMsg({ ok: true, text: `${CAT_LABELS[category] || category}: all ${enabled ? 'enabled' : 'disabled'}` })
    setTimeout(() => setFlagMsg(null), 4000)
  }

  async function handleAnnSave(e) {
    e.preventDefault(); setAnnSaving(true)
    try {
      if (annEditing) {
        await api.patch(`/admin/announcements/${annEditing}`, annForm)
        setAnnouncements(prev => prev.map(a => a.id === annEditing ? { ...a, ...annForm } : a))
      } else {
        const r = await api.post('/admin/announcements', annForm)
        setAnnouncements(prev => [r.data, ...prev])
      }
      setAnnForm({ title: '', body: '', kind: 'info' }); setAnnEditing(null)
    } catch {}
    setAnnSaving(false)
  }

  async function handleAnnDelete(id) {
    try { await api.delete(`/admin/announcements/${id}`); setAnnouncements(prev => prev.filter(a => a.id !== id)) } catch {}
  }

  async function handleAnnToggle(id, current) {
    try { await api.patch(`/admin/announcements/${id}`, { active: !current }); setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, active: !current } : a)) } catch {}
  }

  async function handleInvite(e) {
    e.preventDefault(); setInviting(true); setInviteMsg(''); setInviteErr('')
    try { await api.post('/admin/invite', { email: inviteEmail.trim(), role: inviteRole }); setInviteMsg(`Invite sent to ${inviteEmail.trim()}`); setInviteEmail(''); loadTeam() }
    catch (e) { setInviteErr(e?.response?.data?.detail || 'Failed to send invite.') }
    setInviting(false)
  }

  async function handleMemberRoleChange(id, role) {
    try { await api.patch(`/admin/members/${id}`, { role }); setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m)) } catch {}
  }

  async function handleMemberRemove(id) {
    setRemoveConfirm(null)
    try { await api.delete(`/admin/members/${id}`); setMembers(prev => prev.filter(m => m.id !== id)) } catch {}
  }

  async function handleRevokeInvite(id) {
    try { await api.delete(`/admin/invites/${id}`); setInvites(prev => prev.filter(i => i.id !== id)) } catch {}
  }

  async function handleDiscordSend(e) {
    e.preventDefault(); if (!discordMsg.trim()) return
    setDiscordSending(true); setDiscordFeedback(null)
    try { await api.post('/admin/discord', { channel: discordCh, message: discordMsg.trim() }); setDiscordFeedback({ ok: true, text: `Sent to #${discordCh}` }); setDiscordMsg('') }
    catch (err) { setDiscordFeedback({ ok: false, text: err?.response?.data?.detail || 'Failed to send.' }) }
    setDiscordSending(false)
  }

  async function handleGithubInvite(e) {
    e.preventDefault(); const username = ghUsername.trim(); if (!username) return
    setGhAdding(true); setGhFeedback(null)
    try {
      const r = await api.post('/admin/github-invite', { username })
      const status = r.data.status
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

  // ── Tab: Overview ─────────────────────────────────────────────────────────────
  function renderOverview() {
    if (statsLoading) return <Skeleton rows={6} />
    const st = stats
    const metrics = [
      { label: 'Total Users',    value: st?.users?.total,      delta: st?.users?.last_7d },
      { label: 'Companies',      value: st?.companies?.total,  delta: st?.companies?.last_7d },
      { label: 'Leads',          value: st?.leads?.total,      delta: st?.leads?.last_7d },
      { label: 'Sequences',      value: st?.sequences?.total },
      { label: 'Tasks',          value: st?.tasks?.total },
      { label: 'Email Clicks',   value: st?.email_clicks?.total },
      { label: 'Unsubscribes',   value: st?.unsubscribes?.total },
    ]
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 40 }}>
          {metrics.map(m => <StatCard key={m.label} {...m} />)}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Eyebrow>Recent signups</Eyebrow>
          <button onClick={loadStats} style={s.ghostBtn}>↻ Refresh</button>
        </div>
        {recentUsers.length === 0 ? <Empty text="No signups yet." /> : (
          <div style={s.list}>
            {recentUsers.map(u => (
              <div key={u.id} style={{ ...s.row, cursor: 'pointer' }} onClick={() => setSelectedUser(u)}>
                <Avatar u={u} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={s.name}>{u.full_name || u.email}</p>
                  {u.full_name && <p style={s.sub}>{u.email}</p>}
                </div>
                <span style={s.chip}>{u.companies ?? 0} co · {u.leads ?? 0} ld</span>
                <RoleBadge role={u.role} />
                <span style={s.sub}>{fmtDate(u.joined)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Tab: Users ────────────────────────────────────────────────────────────────
  function renderUsers() {
    const totalPages = Math.ceil(usersTotal / 50)
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" placeholder="Search email or name…" value={usersSearch}
            onChange={e => setUsersSearch(e.target.value)}
            style={{ ...s.input, flex: 1, minWidth: 200 }} />
          <select value={usersRole} onChange={e => { setUsersRole(e.target.value); setUsersPage(0) }} style={s.select}>
            <option value="">All roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
          <button onClick={() => allUsers.length && exportCSV(allUsers)} style={s.ghostBtn} disabled={!allUsers.length}>
            ↓ Export CSV
          </button>
        </div>

        {usersLoading ? <Skeleton rows={8} /> : allUsers.length === 0 ? <Empty text="No users found." /> : (
          <div style={s.list}>
            {allUsers.map(u => (
              <div key={u.id} style={{ ...s.row, opacity: u.suspended ? 0.55 : 1, borderColor: u.suspended ? 'rgba(224,112,112,0.2)' : 'var(--border)', cursor: 'pointer' }}
                onClick={() => setSelectedUser(u)}>
                <Avatar u={u} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...s.name, color: u.suspended ? '#e07070' : 'var(--text)' }}>{u.full_name || u.email}</p>
                  {u.full_name && <p style={s.sub}>{u.email}</p>}
                </div>
                <span style={s.chip}>{u.companies ?? 0} co · {u.leads ?? 0} ld</span>
                <span style={s.sub}>{fmtDate(u.created_at)}</span>
                <select value={u.role} disabled={u.id === profile?.id || updatingUser === u.id}
                  onChange={e => { e.stopPropagation(); handleUserUpdate(u.id, { role: e.target.value }) }}
                  onClick={e => e.stopPropagation()}
                  style={{ ...s.select, fontSize: 10, padding: '4px 8px' }}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
                {u.id !== profile?.id && (
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleUserUpdate(u.id, { suspended: !u.suspended })}
                      disabled={updatingUser === u.id}
                      style={{ ...s.actionBtn, color: u.suspended ? '#4a7c59' : '#e07070', borderColor: u.suspended ? 'rgba(74,124,89,0.3)' : 'rgba(224,112,112,0.25)' }}>
                      {u.suspended ? 'Unsuspend' : 'Suspend'}
                    </button>
                    {deleteConfirm === u.id ? (
                      <>
                        <button onClick={() => handleUserDelete(u.id)} style={{ ...s.actionBtn, color: '#e07070', borderColor: 'rgba(224,112,112,0.4)', background: 'rgba(224,112,112,0.08)' }}>Confirm</button>
                        <button onClick={() => setDeleteConfirm(null)} style={s.actionBtn}>Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteConfirm(u.id)} style={{ ...s.actionBtn, color: '#e07070', borderColor: 'rgba(224,112,112,0.25)' }}>Delete</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
            <button onClick={() => setUsersPage(p => Math.max(0, p - 1))} disabled={usersPage === 0} style={s.pageBtn}>← Prev</button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{usersPage + 1} / {totalPages} · {usersTotal} users</span>
            <button onClick={() => setUsersPage(p => p + 1)} disabled={usersPage >= totalPages - 1} style={s.pageBtn}>Next →</button>
          </div>
        )}
      </div>
    )
  }

  // ── Tab: Growth ───────────────────────────────────────────────────────────────
  function renderGrowth() {
    if (growthLoading) return <Skeleton rows={5} />
    if (!growth) return <Empty text="No growth data." />
    const { days = [], users = [], companies = [], leads = [] } = growth
    const total = arr => arr.reduce((a, b) => a + b, 0)
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 32 }}>
          <StatCard label="Users added (30d)"     value={total(users)}     color="#E7000B" />
          <StatCard label="Companies added (30d)" value={total(companies)} color="#3b82f6" />
          <StatCard label="Leads added (30d)"     value={total(leads)}     color="#059669" />
        </div>
        <LineChart days={days} series={[
          { data: users,     color: '#E7000B', label: 'Users' },
          { data: companies, color: '#3b82f6', label: 'Companies' },
          { data: leads,     color: '#059669', label: 'Leads' },
        ]} />
      </div>
    )
  }

  // ── Tab: Engagement ───────────────────────────────────────────────────────────
  function renderEngagement() {
    if (engLoading) return <Skeleton rows={4} />
    if (!engagement) return <Empty text="No engagement data." />
    const { dau = 0, wau = 0, mau = 0, inactive_count = 0, top_by_companies = [], top_by_leads = [] } = engagement
    const stickiness = mau > 0 ? ((dau / mau) * 100).toFixed(1) : '—'
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 32 }}>
          <StatCard label="DAU"        value={dau} />
          <StatCard label="WAU"        value={wau} />
          <StatCard label="MAU"        value={mau} />
          <StatCard label="Stickiness" value={stickiness === '—' ? '—' : `${stickiness}%`} sub="DAU / MAU" />
          <StatCard label="Inactive"   value={inactive_count} sub="no activity 30d+" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24 }}>
          {[['Top by companies', top_by_companies, 'companies'], ['Top by leads', top_by_leads, 'leads']].map(([title, list, key]) => (
            <div key={key}>
              <Eyebrow>{title}</Eyebrow>
              {list.length === 0 ? <Empty text="No data." /> : (
                <div style={s.list}>
                  {list.map((u, i) => (
                    <div key={u.id} style={{ ...s.row, gap: 10, padding: '10px 14px' }}>
                      <span style={{ ...s.sub, width: 20, textAlign: 'right' }}>#{i + 1}</span>
                      <Avatar u={u} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={s.name}>{u.full_name || u.email}</p>
                        <p style={s.sub}>{u.email}</p>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{u[key]}</span>
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

  // ── Tab: Feature Flags ────────────────────────────────────────────────────────
  function renderFlags() {
    if (flagsLoading) return <Skeleton rows={6} />
    if (featureFlags.length === 0) return <Empty text="No feature flags configured." />
    const categories = [...new Set(featureFlags.map(f => f.category))]
    const enabledCount = featureFlags.filter(f => f.enabled).length
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text)' }}>{enabledCount}</strong> of {featureFlags.length} flags enabled.
            Admins &amp; owners bypass all flags. Changes propagate within 60 s.
          </p>
          {flagMsg && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: flagMsg.ok ? '#4a7c59' : '#e07070' }}>{flagMsg.ok ? '✓' : '✗'} {flagMsg.text}</span>}
        </div>
        {categories.map(cat => {
          const catFlags = featureFlags.filter(f => f.category === cat)
          const catEnabled = catFlags.filter(f => f.enabled).length
          return (
            <div key={cat} style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <Eyebrow style={{ marginBottom: 0 }}>{CAT_LABELS[cat] || cat}</Eyebrow>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{catEnabled}/{catFlags.length}</span>
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                  <button onClick={() => handleBulkFlags(cat, true)} style={{ ...s.actionBtn, fontSize: 9 }}>Enable all</button>
                  <button onClick={() => handleBulkFlags(cat, false)} style={{ ...s.actionBtn, fontSize: 9, color: '#e07070', borderColor: 'rgba(224,112,112,0.25)' }}>Disable all</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 6 }}>
                {catFlags.map(flag => (
                  <div key={flag.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface)', border: `1px solid ${flag.enabled ? 'rgba(5,150,105,0.22)' : 'var(--border)'}`, borderRadius: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: flag.enabled ? 'var(--text)' : 'var(--text-muted)', margin: 0 }}>{flag.label}</p>
                      {flag.description && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', margin: '3px 0 0', lineHeight: 1.4 }}>{flag.description}</p>}
                    </div>
                    <Toggle on={flag.enabled} loading={togglingFlag === flag.name} onToggle={() => handleToggleFlag(flag.name, flag.enabled)} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </>
    )
  }

  // ── Tab: Announcements ────────────────────────────────────────────────────────
  function renderAnnouncements() {
    return (
      <div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <Eyebrow>{annEditing ? 'Edit announcement' : 'New announcement'}</Eyebrow>
          <form onSubmit={handleAnnSave} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="text" required placeholder="Title" value={annForm.title}
              onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))} style={s.input} />
            <textarea required placeholder="Body message…" rows={3} value={annForm.body}
              onChange={e => setAnnForm(f => ({ ...f, body: e.target.value }))}
              style={{ ...s.input, resize: 'vertical', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['info', 'warning', 'success', 'error'].map(k => (
                <button key={k} type="button" onClick={() => setAnnForm(f => ({ ...f, kind: k }))}
                  style={{ padding: '6px 14px', borderRadius: 6, border: `1.5px solid ${annForm.kind === k ? KIND_COLOR[k] : 'var(--border)'}`, background: annForm.kind === k ? `${KIND_COLOR[k]}18` : 'transparent', color: annForm.kind === k ? KIND_COLOR[k] : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>
                  {k}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={annSaving} style={s.primaryBtn}>
                {annSaving ? 'Saving…' : annEditing ? 'Update' : 'Publish'}
              </button>
              {annEditing && (
                <button type="button" onClick={() => { setAnnEditing(null); setAnnForm({ title: '', body: '', kind: 'info' }) }} style={s.ghostBtn}>Cancel</button>
              )}
            </div>
          </form>
        </div>

        {annLoading ? <Skeleton rows={3} /> : announcements.length === 0 ? <Empty text="No announcements yet." /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {announcements.map(a => (
              <div key={a.id} style={{ padding: '16px 20px', background: 'var(--surface)', border: `1px solid ${a.active ? KIND_COLOR[a.kind] + '35' : 'var(--border)'}`, borderRadius: 10, opacity: a.active ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ padding: '3px 8px', borderRadius: 4, background: `${KIND_COLOR[a.kind]}18`, color: KIND_COLOR[a.kind], fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{a.kind}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{a.title}</p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{a.body}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => handleAnnToggle(a.id, a.active)} style={s.actionBtn}>{a.active ? 'Hide' : 'Show'}</button>
                    <button onClick={() => { setAnnEditing(a.id); setAnnForm({ title: a.title, body: a.body, kind: a.kind }) }} style={s.actionBtn}>Edit</button>
                    <button onClick={() => handleAnnDelete(a.id)} style={{ ...s.actionBtn, color: '#e07070', borderColor: 'rgba(224,112,112,0.25)' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Tab: Audit Log ────────────────────────────────────────────────────────────
  function renderAudit() {
    const actionColor = { flag_toggled: '#3b82f6', user_suspended: '#f59e0b', user_deleted: '#e07070', invite_sent: '#059669', announcement_created: '#9D0010' }
    return (
      <div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <select value={auditAction} onChange={e => { setAuditAction(e.target.value); setAuditPage(0) }} style={{ ...s.select, minWidth: 200 }}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.filter(Boolean).map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={() => { setAuditPage(0); loadAudit(auditAction, 0) }} style={s.ghostBtn}>↻ Refresh</button>
        </div>

        {auditLoading ? <Skeleton rows={6} /> : auditLogs.length === 0 ? <Empty text="No audit logs." /> : (
          <div style={s.list}>
            {auditLogs.map(log => (
              <div key={log.id} style={{ ...s.row, alignItems: 'flex-start' }}>
                <span style={{ padding: '3px 8px', borderRadius: 4, background: `${actionColor[log.action] || 'var(--text-muted)'}18`, color: actionColor[log.action] || 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {(log.action || '').replace(/_/g, ' ')}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {log.target && <p style={{ ...s.name, fontWeight: 500 }}>{log.target}</p>}
                  <p style={s.sub}>{log.admin_email}</p>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2, opacity: 0.7 }}>
                      {Object.entries(log.metadata).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(' · ')}
                    </p>
                  )}
                </div>
                <span style={s.sub}>{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <button onClick={() => setAuditPage(p => Math.max(0, p - 1))} disabled={auditPage === 0} style={s.pageBtn}>← Prev</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Page {auditPage + 1}</span>
          <button onClick={() => setAuditPage(p => p + 1)} disabled={auditLogs.length < 20} style={s.pageBtn}>Next →</button>
        </div>
      </div>
    )
  }

  // ── Tab: Team ─────────────────────────────────────────────────────────────────
  function renderTeam() {
    return (
      <div>
        <div style={{ ...s.card, padding: 20, marginBottom: 24 }}>
          <Eyebrow>Invite member</Eyebrow>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com" required style={{ ...s.input, flex: 1, minWidth: 200 }} />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={s.select}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={inviting} style={s.primaryBtn}>{inviting ? 'Sending…' : 'Send invite'}</button>
          </form>
          {inviteMsg && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4a7c59', marginTop: 10 }}>✓ {inviteMsg}</p>}
          {inviteErr && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e07070', marginTop: 10 }}>{inviteErr}</p>}
        </div>

        <Eyebrow>Members ({members.length})</Eyebrow>
        {teamLoading ? <Skeleton rows={3} /> : members.length === 0 ? <Empty text="No members." /> : (
          <div style={{ ...s.list, marginBottom: 24 }}>
            {members.map(m => (
              <div key={m.id} style={s.row}>
                <Avatar u={m} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={s.name}>{m.full_name || m.email}</p>
                  {m.full_name && <p style={s.sub}>{m.email}</p>}
                </div>
                <select value={m.role} onChange={e => handleMemberRoleChange(m.id, e.target.value)}
                  disabled={m.id === profile?.id}
                  style={{ ...s.select, fontSize: 10, padding: '4px 8px' }}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                {m.id !== profile?.id ? (
                  removeConfirm === m.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleMemberRemove(m.id)} style={{ ...s.actionBtn, color: '#e07070', borderColor: 'rgba(224,112,112,0.4)', background: 'rgba(224,112,112,0.08)' }}>Confirm</button>
                      <button onClick={() => setRemoveConfirm(null)} style={s.actionBtn}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setRemoveConfirm(m.id)} style={{ ...s.actionBtn, color: '#e07070', borderColor: 'rgba(224,112,112,0.25)' }}>Remove</button>
                  )
                ) : (
                  <span style={{ ...s.sub, padding: '4px 8px' }}>You</span>
                )}
              </div>
            ))}
          </div>
        )}

        {invites.length > 0 && (
          <>
            <Eyebrow>Pending invites ({invites.length})</Eyebrow>
            <div style={s.list}>
              {invites.map(inv => (
                <div key={inv.id} style={s.row}>
                  <div style={{ flex: 1 }}>
                    <p style={s.name}>{inv.email}</p>
                    <p style={s.sub}>{inv.role} · sent {fmtDate(inv.created_at)}</p>
                  </div>
                  <button onClick={() => handleRevokeInvite(inv.id)} style={s.actionBtn}>Revoke</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Tab: Tools ────────────────────────────────────────────────────────────────
  function renderTools() {
    if (!isOwner) return <Empty text="Only the owner can access these tools." />
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div style={s.card}>
          <Eyebrow>Post to Discord</Eyebrow>
          <form onSubmit={handleDiscordSend} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DISCORD_CH.map(ch => (
                <button key={ch.id} type="button" onClick={() => setDiscordCh(ch.id)}
                  style={{ padding: '7px 14px', borderRadius: 6, border: `1.5px solid ${discordCh === ch.id ? ch.color : 'var(--border)'}`, background: discordCh === ch.id ? `${ch.color}18` : 'transparent', color: discordCh === ch.id ? ch.color : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  {ch.label}
                </button>
              ))}
            </div>
            <textarea value={discordMsg} onChange={e => setDiscordMsg(e.target.value)} placeholder="Write your message here…" rows={4}
              style={{ ...s.input, resize: 'vertical', lineHeight: 1.6 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="submit" disabled={discordSending || !discordMsg.trim()} style={{ ...s.primaryBtn, opacity: !discordMsg.trim() ? 0.4 : 1 }}>
                {discordSending ? 'Sending…' : 'Send message'}
              </button>
              {discordFeedback && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: discordFeedback.ok ? '#4a7c59' : '#e07070' }}>{discordFeedback.ok ? '✓ ' : '✗ '}{discordFeedback.text}</span>}
            </div>
          </form>
        </div>

        <div style={s.card}>
          <Eyebrow>Add GitHub collaborator</Eyebrow>
          <p style={{ ...s.subText, marginBottom: 14 }}>Team member posts their GitHub username → enter it here → they get an invite by email.</p>
          <form onSubmit={handleGithubInvite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input type="text" value={ghUsername} onChange={e => setGhUsername(e.target.value)}
              placeholder="their-github-username" style={{ ...s.input, flex: 1, minWidth: 200 }} />
            <button type="submit" disabled={ghAdding || !ghUsername.trim()} style={{ ...s.primaryBtn, opacity: !ghUsername.trim() ? 0.4 : 1 }}>
              {ghAdding ? 'Adding…' : 'Add collaborator'}
            </button>
          </form>
          {ghFeedback && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: ghFeedback.ok ? '#4a7c59' : '#e07070', marginBottom: 10 }}>{ghFeedback.ok ? '✓ ' : '✗ '}{ghFeedback.text}</p>}
          {ghLog.length > 0 && (
            <div style={s.list}>
              {ghLog.map((entry, i) => (
                <div key={i} style={{ ...s.row, padding: '10px 14px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', flex: 1 }}>{entry.username}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: entry.ok ? '#4a7c59' : '#e07070' }}>{entry.label}</span>
                  <span style={s.sub}>{entry.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const tabContent = { overview: renderOverview, users: renderUsers, growth: renderGrowth, engagement: renderEngagement, flags: renderFlags, announcements: renderAnnouncements, audit: renderAudit, team: renderTeam, tools: renderTools }

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding: 'clamp(28px,4vw,64px) clamp(20px,4vw,48px) 0', borderBottom: '1px solid var(--border)' }}>
        <p style={s.eyebrow}>Platform</p>
        <h1 style={s.heroTitle}>Admin.</h1>
        <div style={{ display: 'flex', gap: 0, marginTop: 28, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '10px clamp(10px,2vw,18px)', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--text)' : 'transparent'}`, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(24px,3vw,40px) clamp(20px,4vw,48px) 80px' }}>
        {(tabContent[tab] || (() => null))()}
      </div>

      {/* User detail sheet */}
      {selectedUser && (
        <UserSheet user={selectedUser} onClose={() => setSelectedUser(null)} onUpdate={(patch) => {
          setAllUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...patch } : u))
          setSelectedUser(u => ({ ...u, ...patch }))
        }} currentUserId={profile?.id} />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Avatar({ u, size = 32 }) {
  const colors = ['#E7000B', '#9D0010', '#3b82f6', '#059669', '#f59e0b', '#8b5cf6']
  const color = colors[(u.email || '').charCodeAt(0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color + '22', border: `1.5px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: size * 0.38, fontWeight: 700, color, flexShrink: 0 }}>
      {initials(u)}
    </div>
  )
}

function RoleBadge({ role }) {
  const c = roleColor(role)
  return <span style={{ padding: '3px 8px', borderRadius: 4, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{role}</span>
}

function Toggle({ on, loading, onToggle }) {
  return (
    <button onClick={onToggle} disabled={loading}
      style={{ flexShrink: 0, width: 40, height: 22, borderRadius: 11, border: 'none', cursor: loading ? 'default' : 'pointer', position: 'relative', background: on ? '#059669' : 'var(--border)', opacity: loading ? 0.5 : 1, transition: 'background 0.2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </button>
  )
}

function StatCard({ label, value, sub, delta, color }) {
  return (
    <div style={{ padding: '18px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 900, letterSpacing: '-0.04em', color: color || 'var(--text)', lineHeight: 1 }}>{value ?? '—'}</p>
      {(sub || delta != null) && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: delta > 0 ? '#4a7c59' : 'var(--text-muted)', marginTop: 6 }}>
          {delta != null && delta > 0 ? `+${delta} this week` : sub || ''}
        </p>
      )}
    </div>
  )
}

function Skeleton({ rows = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: 44, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  )
}

function Empty({ text }) {
  return <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', padding: '20px 0' }}>{text}</p>
}

function Eyebrow({ children, style }) {
  return <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, ...style }}>{children}</p>
}

function LineChart({ days, series }) {
  const W = 900, H = 160, PAD_L = 28, PAD_B = 20
  const cW = W - PAD_L, cH = H - PAD_B
  const maxVal = Math.max(...series.flatMap(s => s.data), 1)
  const toPoints = data => data.map((v, i) => {
    const x = PAD_L + (i / Math.max(data.length - 1, 1)) * cW
    const y = H - PAD_B - (v / maxVal) * (cH - 4) - 4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const labelIdxs = days.map((_, i) => i).filter(i => i % Math.ceil(days.length / 6) === 0 || i === days.length - 1)
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {series.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 20, height: 2, background: s.color, borderRadius: 1 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 8 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 400, height: H, display: 'block' }}>
          {[0, 0.25, 0.5, 0.75, 1].map(f => {
            const y = H - PAD_B - f * (cH - 4) - 4
            return (
              <g key={f}>
                <line x1={PAD_L} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <text x={PAD_L - 5} y={y + 4} textAnchor="end" fontFamily="monospace" fontSize="8" fill="rgba(255,255,255,0.25)">{Math.round(f * maxVal)}</text>
              </g>
            )
          })}
          {labelIdxs.map(i => (
            <text key={i} x={PAD_L + (i / Math.max(days.length - 1, 1)) * cW} y={H - 2} textAnchor="middle" fontFamily="monospace" fontSize="8" fill="rgba(255,255,255,0.3)">{fmtShort(days[i])}</text>
          ))}
          {series.map(s => (
            <polyline key={s.label} points={toPoints(s.data)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
          ))}
          {series.map(s => s.data.map((v, i) => v > 0 && (
            <circle key={i} cx={PAD_L + (i / Math.max(s.data.length - 1, 1)) * cW} cy={H - PAD_B - (v / maxVal) * (cH - 4) - 4} r="2.5" fill={s.color} opacity="0.8" />
          )))}
        </svg>
      </div>
    </div>
  )
}

function UserSheet({ user, onClose, onUpdate, currentUserId }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(420px, 100vw)', background: 'var(--bg)', borderLeft: '1px solid var(--border)', zIndex: 201, overflow: 'auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>User detail</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar u={user} size={48} />
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>{user.full_name || '—'}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{user.email}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['Role', <RoleBadge role={user.role} />],
            ['Status', <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: user.suspended ? '#e07070' : '#4a7c59' }}>{user.suspended ? 'Suspended' : 'Active'}</span>],
            ['Companies', user.companies ?? 0],
            ['Leads', user.leads ?? 0],
            ['Joined', fmtDate(user.created_at || user.joined)],
          ].map(([label, val]) => (
            <div key={label} style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{val}</div>
            </div>
          ))}
        </div>
        {user.id !== currentUserId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Actions</p>
            <button onClick={() => onUpdate({ suspended: !user.suspended })}
              style={{ padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: user.suspended ? '#4a7c59' : '#e07070', cursor: 'pointer', textAlign: 'left' }}>
              {user.suspended ? 'Unsuspend account' : 'Suspend account'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  eyebrow:   { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '14px', textTransform: 'uppercase' },
  heroTitle: { fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 6vw, 80px)', fontWeight: '900', letterSpacing: '-0.05em', color: 'var(--text)', lineHeight: 1, marginBottom: '10px' },
  list:      { display: 'flex', flexDirection: 'column', gap: 4 },
  row:       { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 },
  card:      { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 },
  name:      { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', fontWeight: 600, margin: 0 },
  sub:       { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', margin: 0 },
  subText:   { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 },
  chip:      { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  input:     { padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none', width: '100%', boxSizing: 'border-box' },
  select:    { padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none', cursor: 'pointer' },
  primaryBtn:{ padding: '10px 20px', background: '#E7000B', border: 'none', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' },
  ghostBtn:  { padding: '8px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' },
  actionBtn: { padding: '5px 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' },
  pageBtn:   { padding: '7px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', cursor: 'pointer' },
}
