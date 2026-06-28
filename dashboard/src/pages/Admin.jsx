import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase-client'
import api, { getFeatureFlags, updateFeatureFlag } from '../services/api'

// ── Constants ─────────────────────────────────────────────────────────────────
const OWNER_USER_ID = '5c9c0565-cec6-40ba-887a-84b665c40a44'

const TABS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'users',         label: 'Users' },
  { id: 'growth',        label: 'Growth' },
  { id: 'engagement',    label: 'Engagement' },
  { id: 'retention',     label: 'Retention' },
  { id: 'flags',         label: 'Feature Flags' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'changelog',     label: 'Changelog' },
  { id: 'audit',         label: 'Audit' },
  { id: 'team',          label: 'Team' },
  { id: 'tools',         label: 'Tools' },
  { id: 'health',        label: 'Health' },
]

const CAT_LABELS   = { pages: 'Pages', enrichment: 'Enrichment', outreach: 'Outreach', ui: 'UI / Views', data: 'Data & Export', leads: 'Leads' }
const KIND_COLOR   = { info: '#3b82f6', warning: '#f59e0b', success: '#059669', error: '#e07070' }
const DISCORD_CH   = [{ id: 'engineering', label: '#engineering', color: '#E7000B' }, { id: 'design', label: '#design', color: '#9D0010' }, { id: 'product', label: '#product', color: '#5c0008' }]
const AUDIT_ACTIONS = ['flag_toggled', 'user_suspended', 'user_role_changed', 'user_deleted', 'invite_sent', 'invite_revoked', 'email_blast', 'announcement_created', 'announcement_deleted', 'update_user']
const LABELS       = ['', 'VIP', 'churn-risk', 'trial', 'power-user', 'support', 'enterprise']
const ACT_COLOR    = { flag_toggled: '#3b82f6', user_suspended: '#f59e0b', user_deleted: '#e07070', invite_sent: '#059669', email_blast: '#8b5cf6', announcement_created: '#9D0010', update_user: '#64748b' }

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useDebounce(v, ms = 380) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate  = s => s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const fmtShort = s => s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
const fmtTs    = s => s ? new Date(s).toLocaleString() : '—'
const initials = u => ((u.full_name || u.email || '?')[0]).toUpperCase()
const roleC    = r => r === 'owner' ? { bg:'rgba(231,0,11,0.12)', c:'#E7000B', b:'rgba(231,0,11,0.25)' } : r === 'admin' ? { bg:'rgba(157,0,16,0.12)', c:'#9D0010', b:'rgba(157,0,16,0.25)' } : { bg:'rgba(255,255,255,0.04)', c:'var(--text-muted)', b:'var(--border)' }
const AVATAR_COLORS = ['#E7000B','#9D0010','#3b82f6','#059669','#f59e0b','#8b5cf6','#06b6d4']

function exportCSV(rows) {
  const cols = ['email','full_name','role','admin_label','companies','leads','created_at','suspended']
  const lines = [cols.join(','), ...rows.map(u => cols.map(c => JSON.stringify(u[c]??'')).join(','))]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  a.download = `users-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

function exportAuditLogsCSV(logs) {
  const cols = ['action','admin_email','target','created_at']
  const lines = [cols.join(','), ...logs.map(l => cols.map(c => JSON.stringify(l[c]??'')).join(','))]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  a.download = `audit-log-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Admin() {
  const { profile } = useAuth()
  const isOwner  = profile?.id === OWNER_USER_ID
  const isAdmin  = profile?.role === 'admin' || profile?.role === 'owner'
  const [tab, setTab] = useState('overview')

  // ── Stats / Overview ──────────────────────────────────────────────────────
  const [stats, setStats]           = useState(null)
  const [recentUsers, setRecentUsers] = useState([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [adoption, setAdoption]     = useState(null)
  const [adoptionLoading, setAdoptionLoading] = useState(false)

  // ── Users ─────────────────────────────────────────────────────────────────
  const [allUsers, setAllUsers]     = useState([])
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage]   = useState(0)
  const [usersSearch, setUsersSearch] = useState('')
  const [usersRole, setUsersRole]   = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [updatingUser, setUpdatingUser] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [selected, setSelected]     = useState(new Set())
  const [selectedUser, setSelectedUser] = useState(null)
  const [userDetail, setUserDetail] = useState(null)
  const [userDetailLoading, setUserDetailLoading] = useState(false)
  const dSearch = useDebounce(usersSearch)

  // ── Feature Flags ─────────────────────────────────────────────────────────
  const [featureFlags, setFeatureFlags] = useState([])
  const [flagsLoading, setFlagsLoading] = useState(true)
  const [togglingFlag, setTogglingFlag] = useState(null)
  const [flagMsg, setFlagMsg]           = useState(null)

  // ── Announcements ─────────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState([])
  const [annLoading, setAnnLoading]       = useState(false)
  const [annForm, setAnnForm]             = useState({ title:'', body:'', kind:'info' })
  const [annEditing, setAnnEditing]       = useState(null)
  const [annSaving, setAnnSaving]         = useState(false)

  // ── Changelog ─────────────────────────────────────────────────────────────
  const [changelog, setChangelog]   = useState([])
  const [clLoading, setClLoading]   = useState(false)
  const [clForm, setClForm]         = useState({ title:'', body:'', version:'', published:false })
  const [clEditing, setClEditing]   = useState(null)
  const [clSaving, setClSaving]     = useState(false)

  // ── Growth ────────────────────────────────────────────────────────────────
  const [growth, setGrowth]               = useState(null)
  const [growthLoading, setGrowthLoading] = useState(false)

  // ── Engagement ────────────────────────────────────────────────────────────
  const [engagement, setEngagement]   = useState(null)
  const [engLoading, setEngLoading]   = useState(false)

  // ── Retention ─────────────────────────────────────────────────────────────
  const [retention, setRetention]         = useState(null)
  const [retentionLoading, setRetentionLoading] = useState(false)

  // ── Audit ─────────────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs]         = useState([])
  const [auditPage, setAuditPage]         = useState(0)
  const [auditAction, setAuditAction]     = useState('')
  const [auditLoading, setAuditLoading]   = useState(false)
  const [liveCount, setLiveCount]         = useState(0)

  // ── Team ──────────────────────────────────────────────────────────────────
  const [members, setMembers]             = useState([])
  const [invites, setInvites]             = useState([])
  const [teamLoading, setTeamLoading]     = useState(true)
  const [inviteEmail, setInviteEmail]     = useState('')
  const [inviteRole, setInviteRole]       = useState('member')
  const [inviting, setInviting]           = useState(false)
  const [inviteMsg, setInviteMsg]         = useState('')
  const [inviteErr, setInviteErr]         = useState('')
  const [removeConfirm, setRemoveConfirm] = useState(null)

  // ── Tools / Discord / GitHub ──────────────────────────────────────────────
  const [discordCh, setDiscordCh]         = useState('engineering')
  const [discordMsg, setDiscordMsg]       = useState('')
  const [discordSending, setDiscordSending] = useState(false)
  const [discordFb, setDiscordFb]         = useState(null)
  const [ghUsername, setGhUsername]       = useState('')
  const [ghAdding, setGhAdding]           = useState(false)
  const [ghFb, setGhFb]                   = useState(null)
  const [ghLog, setGhLog]                 = useState([])

  // ── Email blast ───────────────────────────────────────────────────────────
  const [blast, setBlast]     = useState({ subject:'', body:'', segment:'all' })
  const [blasting, setBlasting] = useState(false)
  const [blastResult, setBlastResult] = useState(null)

  // ── Health ────────────────────────────────────────────────────────────────
  const [health, setHealth]           = useState(null)
  const [healthLoading, setHealthLoading] = useState(false)

  // ── Cmd+K palette ─────────────────────────────────────────────────────────
  const [cmdOpen, setCmdOpen]       = useState(false)
  const [cmdQuery, setCmdQuery]     = useState('')
  const [cmdResults, setCmdResults] = useState(null)
  const [cmdIndex, setCmdIndex]     = useState(0)
  const [cmdSearching, setCmdSearching] = useState(false)
  const cmdRef = useRef(null)
  const dCmd = useDebounce(cmdQuery, 250)

  // ── Loaders ───────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try { const r = await api.get('/admin/stats'); setStats(r.data?.stats||null); setRecentUsers(r.data?.recent_users||[]) } catch {}
    setStatsLoading(false)
  }, [])

  const loadAdoption = useCallback(async () => {
    setAdoptionLoading(true)
    try { const r = await api.get('/admin/feature-adoption'); setAdoption(r.data||null) } catch {}
    setAdoptionLoading(false)
  }, [])

  const loadUsers = useCallback(async (search, role, page) => {
    setUsersLoading(true)
    try {
      const p = new URLSearchParams({ page })
      if (search) p.set('search', search)
      if (role)   p.set('role', role)
      const r = await api.get(`/admin/all-users?${p}`)
      setAllUsers(r.data?.users||[]); setUsersTotal(r.data?.total||0)
    } catch {}
    setUsersLoading(false)
  }, [])

  const loadFlags = useCallback(async () => {
    setFlagsLoading(true)
    try { const r = await getFeatureFlags(); setFeatureFlags(r.data?.flags||[]) } catch {}
    setFlagsLoading(false)
  }, [])

  const loadAnnouncements = useCallback(async () => {
    setAnnLoading(true)
    try { const r = await api.get('/admin/announcements'); setAnnouncements(Array.isArray(r.data)?r.data:r.data?.announcements||[]) } catch {}
    setAnnLoading(false)
  }, [])

  const loadChangelog = useCallback(async () => {
    setClLoading(true)
    try { const r = await api.get('/admin/changelog'); setChangelog(r.data||[]) } catch {}
    setClLoading(false)
  }, [])

  const loadGrowth = useCallback(async () => {
    setGrowthLoading(true)
    try { const r = await api.get('/admin/growth'); setGrowth(r.data||null) } catch {}
    setGrowthLoading(false)
  }, [])

  const loadEngagement = useCallback(async () => {
    setEngLoading(true)
    try { const r = await api.get('/admin/engagement'); setEngagement(r.data||null) } catch {}
    setEngLoading(false)
  }, [])

  const loadRetention = useCallback(async () => {
    setRetentionLoading(true)
    try { const r = await api.get('/admin/retention'); setRetention(r.data||null) } catch {}
    setRetentionLoading(false)
  }, [])

  const loadAudit = useCallback(async (action, page) => {
    setAuditLoading(true)
    try { const p = new URLSearchParams({ page }); if (action) p.set('action', action); const r = await api.get(`/admin/audit-logs?${p}`); setAuditLogs(r.data?.logs||[]) } catch {}
    setAuditLoading(false)
  }, [])

  function exportAuditCSV() { exportAuditLogsCSV(auditLogs) }

  const loadTeam = useCallback(async () => {
    setTeamLoading(true)
    try { const [m,i] = await Promise.all([api.get('/admin/members'),api.get('/admin/invites')]); setMembers(m.data?.members||m.data||[]); setInvites(i.data?.invites||i.data||[]) } catch {}
    setTeamLoading(false)
  }, [])

  const loadHealth = useCallback(async () => {
    setHealthLoading(true)
    try { const r = await api.get('/admin/health-check'); setHealth(r.data||null) } catch {}
    setHealthLoading(false)
  }, [])

  // ── Effects ───────────────────────────────────────────────────────────────
  // Track which tabs have already fetched so we never re-fetch on revisit
  const loadedTabs = useRef(new Set())

  // Mount: only load what overview needs (1 call instead of 4)
  useEffect(() => { if (isAdmin) loadStats() }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    // Static tabs: fetch once, never again unless user manually refreshes
    const STATIC = ['growth', 'engagement', 'retention', 'changelog', 'flags', 'team', 'overview']
    if (STATIC.includes(tab) && loadedTabs.current.has(tab)) return

    if (tab === 'overview')      { loadAdoption(); loadedTabs.current.add('overview') }
    if (tab === 'users')         loadUsers(dSearch, usersRole, usersPage)
    if (tab === 'announcements') loadAnnouncements()
    if (tab === 'changelog')     { loadChangelog(); loadedTabs.current.add('changelog') }
    if (tab === 'growth')        { loadGrowth(); loadedTabs.current.add('growth') }
    if (tab === 'engagement')    { loadEngagement(); loadedTabs.current.add('engagement') }
    if (tab === 'retention')     { loadRetention(); loadedTabs.current.add('retention') }
    if (tab === 'audit')         loadAudit(auditAction, auditPage)
    if (tab === 'flags')         { loadFlags(); loadedTabs.current.add('flags') }
    if (tab === 'team')          { loadTeam(); loadedTabs.current.add('team') }
    // health: manual trigger only — no auto-fetch
  }, [tab, isAdmin])

  useEffect(() => { if (tab === 'users') { setUsersPage(0); setSelected(new Set()); loadUsers(dSearch, usersRole, 0) } }, [dSearch, usersRole])
  useEffect(() => { if (tab === 'users') loadUsers(dSearch, usersRole, usersPage) }, [usersPage])
  useEffect(() => { if (tab === 'audit') loadAudit(auditAction, auditPage) }, [auditPage, auditAction])

  // Real-time audit log via Supabase Realtime
  useEffect(() => {
    if (tab !== 'audit') return
    const channel = supabase.channel('admin-audit-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_audit_log' }, payload => {
        setAuditLogs(prev => [payload.new, ...prev])
        setLiveCount(c => c + 1)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [tab])

  // Cmd+K keyboard shortcut
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); setCmdQuery(''); setCmdResults(null); setCmdIndex(0) }
      if (e.key === 'Escape') setCmdOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (cmdOpen) setTimeout(() => cmdRef.current?.focus(), 50) }, [cmdOpen])

  useEffect(() => {
    if (!dCmd || dCmd.length < 2) { setCmdResults(null); return }
    setCmdSearching(true)
    api.get(`/admin/search?q=${encodeURIComponent(dCmd)}`)
      .then(r => { setCmdResults(r.data||{}); setCmdIndex(0) })
      .catch(() => {})
      .finally(() => setCmdSearching(false))
  }, [dCmd])

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function openUserSheet(u) {
    setSelectedUser(u); setUserDetail(null); setUserDetailLoading(true)
    try {
      const [detail, login] = await Promise.all([api.get(`/admin/user/${u.id}`), api.get(`/admin/login-history/${u.id}`)])
      setUserDetail({ ...detail.data, login: login.data })
    } catch {}
    setUserDetailLoading(false)
  }

  async function handleUserUpdate(userId, patch) {
    setUpdatingUser(userId)
    try {
      await api.patch(`/admin/users/${userId}`, patch)
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u))
      if (selectedUser?.id === userId) setSelectedUser(u => ({ ...u, ...patch }))
    } catch {}
    setUpdatingUser(null)
  }

  async function handleUserDelete(userId) {
    setUpdatingUser(userId); setDeleteConfirm(null)
    try { await api.delete(`/admin/users/${userId}`); setAllUsers(prev => prev.filter(u => u.id !== userId)); setUsersTotal(t => t - 1); if (selectedUser?.id === userId) setSelectedUser(null) } catch {}
    setUpdatingUser(null)
  }

  async function handleBulkAction(action) {
    const ids = [...selected]
    for (const id of ids) {
      if (action === 'suspend')   await handleUserUpdate(id, { suspended: true })
      if (action === 'unsuspend') await handleUserUpdate(id, { suspended: false })
      if (action === 'admin')     await handleUserUpdate(id, { role: 'admin' })
      if (action === 'member')    await handleUserUpdate(id, { role: 'member' })
    }
    setSelected(new Set())
  }

  async function handleToggleFlag(name, current) {
    setTogglingFlag(name); setFlagMsg(null)
    try { await updateFeatureFlag(name, !current); setFeatureFlags(prev => prev.map(f => f.name===name ? {...f,enabled:!current} : f)); setFlagMsg({ ok:true, text:`${name} → ${!current?'enabled':'disabled'}` }) }
    catch (e) { setFlagMsg({ ok:false, text: e?.response?.data?.detail||'Failed' }) }
    setTogglingFlag(null); setTimeout(() => setFlagMsg(null), 4000)
  }

  async function handleBulkFlags(cat, enabled) {
    const targets = featureFlags.filter(f => f.category === cat && f.enabled !== enabled)
    for (const f of targets) { try { await updateFeatureFlag(f.name, enabled) } catch {} }
    setFeatureFlags(prev => prev.map(f => f.category===cat ? {...f,enabled} : f))
    setFlagMsg({ ok:true, text:`${CAT_LABELS[cat]||cat}: all ${enabled?'enabled':'disabled'}` })
    setTimeout(() => setFlagMsg(null), 4000)
  }

  async function handleAnnSave(e) {
    e.preventDefault(); setAnnSaving(true)
    try {
      if (annEditing) { await api.patch(`/admin/announcements/${annEditing}`, annForm); setAnnouncements(prev => prev.map(a => a.id===annEditing?{...a,...annForm}:a)) }
      else { const r = await api.post('/admin/announcements', annForm); setAnnouncements(prev => [r.data,...prev]) }
      setAnnForm({ title:'', body:'', kind:'info' }); setAnnEditing(null)
    } catch {}
    setAnnSaving(false)
  }

  async function handleAnnDelete(id) {
    try { await api.delete(`/admin/announcements/${id}`); setAnnouncements(prev => prev.filter(a => a.id!==id)) } catch {}
  }

  async function handleAnnToggle(id, current) {
    try { await api.patch(`/admin/announcements/${id}`, { active:!current }); setAnnouncements(prev => prev.map(a => a.id===id?{...a,active:!current}:a)) } catch {}
  }

  async function handleClSave(e) {
    e.preventDefault(); setClSaving(true)
    try {
      if (clEditing) { await api.patch(`/admin/changelog/${clEditing}`, clForm); setChangelog(prev => prev.map(c => c.id===clEditing?{...c,...clForm}:c)) }
      else { const r = await api.post('/admin/changelog', clForm); setChangelog(prev => [r.data,...prev]) }
      setClForm({ title:'', body:'', version:'', published:false }); setClEditing(null)
    } catch {}
    setClSaving(false)
  }

  async function handleClDelete(id) {
    try { await api.delete(`/admin/changelog/${id}`); setChangelog(prev => prev.filter(c => c.id!==id)) } catch {}
  }

  async function handleClToggle(id, current) {
    try { await api.patch(`/admin/changelog/${id}`, { published:!current }); setChangelog(prev => prev.map(c => c.id===id?{...c,published:!current}:c)) } catch {}
  }

  async function handleInvite(e) {
    e.preventDefault(); setInviting(true); setInviteMsg(''); setInviteErr('')
    try { await api.post('/admin/invite', { email:inviteEmail.trim(), role:inviteRole }); setInviteMsg(`Invite sent to ${inviteEmail.trim()}`); setInviteEmail(''); loadTeam() }
    catch (e) { setInviteErr(e?.response?.data?.detail||'Failed to send invite.') }
    setInviting(false)
  }

  async function handleMemberRoleChange(id, role) {
    try { await api.patch(`/admin/members/${id}`, { role }); setMembers(prev => prev.map(m => m.id===id?{...m,role}:m)) } catch {}
  }

  async function handleMemberRemove(id) {
    setRemoveConfirm(null)
    try { await api.delete(`/admin/members/${id}`); setMembers(prev => prev.filter(m => m.id!==id)) } catch {}
  }

  async function handleRevokeInvite(id) {
    try { await api.delete(`/admin/invites/${id}`); setInvites(prev => prev.filter(i => i.id!==id)) } catch {}
  }

  async function handleDiscordSend(e) {
    e.preventDefault(); if (!discordMsg.trim()) return
    setDiscordSending(true); setDiscordFb(null)
    try { await api.post('/admin/discord', { channel:discordCh, message:discordMsg.trim() }); setDiscordFb({ ok:true, text:`Sent to #${discordCh}` }); setDiscordMsg('') }
    catch (err) { setDiscordFb({ ok:false, text:err?.response?.data?.detail||'Failed.' }) }
    setDiscordSending(false)
  }

  async function handleGithubInvite(e) {
    e.preventDefault(); const username = ghUsername.trim(); if (!username) return
    setGhAdding(true); setGhFb(null)
    try {
      const r = await api.post('/admin/github-invite', { username })
      const status = r.data.status
      setGhFb({ ok:true, text:status==='invited'?`Invite sent to ${username}`:`${username} already has access.` })
      setGhLog(prev => [{ username, time:new Date().toLocaleTimeString(), ok:true, label:status==='invited'?'Invited':'Already member' }, ...prev].slice(0,10))
      setGhUsername('')
    } catch (err) {
      const text = err?.response?.data?.detail||'Failed.'
      setGhFb({ ok:false, text }); setGhLog(prev => [{ username, time:new Date().toLocaleTimeString(), ok:false, label:'Failed' }, ...prev].slice(0,10))
    }
    setGhAdding(false)
  }

  async function handleBlast(e) {
    e.preventDefault(); setBlasting(true); setBlastResult(null)
    try { const r = await api.post('/admin/email-blast', blast); setBlastResult(r.data); setBlast(b => ({...b,subject:'',body:''})) }
    catch (err) { setBlastResult({ error: err?.response?.data?.detail||'Failed to send.' }) }
    setBlasting(false)
  }

  function handleCmdKeyDown(e) {
    const allResults = [...(cmdResults?.users||[]).map(u=>({type:'user',item:u})), ...(cmdResults?.companies||[]).map(c=>({type:'company',item:c})), ...(cmdResults?.leads||[]).map(l=>({type:'lead',item:l}))]
    const total = allResults.length + TABS.length
    if (e.key === 'ArrowDown') { e.preventDefault(); setCmdIndex(i => (i+1)%total) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCmdIndex(i => (i-1+total)%total) }
    if (e.key === 'Enter') {
      if (cmdIndex < TABS.length) { setTab(TABS[cmdIndex].id); setCmdOpen(false); setCmdQuery('') }
      else {
        const r = allResults[cmdIndex - TABS.length]
        if (r?.type === 'user') { openUserSheet(r.item); setCmdOpen(false); setCmdQuery('') }
      }
    }
  }

  // ── Tab: Overview ─────────────────────────────────────────────────────────
  function renderOverview() {
    const st = stats
    return (
      <div>
        {statsLoading ? <Skeleton rows={2} cols={4} /> : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))', gap:10, marginBottom:36 }}>
            {[
              { label:'Total Users',    value:st?.users?.total,      delta:st?.users?.last_7d },
              { label:'Companies',      value:st?.companies?.total,  delta:st?.companies?.last_7d },
              { label:'Leads',          value:st?.leads?.total,      delta:st?.leads?.last_7d },
              { label:'Sequences',      value:st?.sequences?.total },
              { label:'Tasks',          value:st?.tasks?.total },
              { label:'Email Clicks',   value:st?.email_clicks?.total },
              { label:'Unsubscribes',   value:st?.unsubscribes?.total },
            ].map(m => <StatCard key={m.label} {...m} />)}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <Eyebrow>Feature adoption</Eyebrow>
          {adoptionLoading && <span style={s.sub}>Loading…</span>}
        </div>
        {adoption?.features && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:8, marginBottom:36 }}>
            {adoption.features.map(f => (
              <div key={f.name} style={{ padding:'12px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={s.name}>{f.name}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700, color:'var(--text)' }}>{f.adoption_pct}%</span>
                </div>
                <div style={{ height:4, borderRadius:2, background:'var(--border)', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${f.adoption_pct}%`, background:'#E7000B', borderRadius:2, transition:'width 0.6s ease' }} />
                </div>
                <span style={{ ...s.sub, marginTop:4, display:'block' }}>{f.users_adopted} of {adoption.total_users} users · {f.total} total records</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <Eyebrow>Recent signups</Eyebrow>
          <button onClick={() => { loadedTabs.current.delete('overview'); loadStats(); loadAdoption() }} style={s.ghostBtn}>↻ Refresh</button>
        </div>
        {statsLoading ? <Skeleton rows={5} /> : recentUsers.length===0 ? <Empty text="No signups yet." /> : (
          <div style={s.list}>
            {recentUsers.map(u => (
              <div key={u.id} style={{ ...s.row, cursor:'pointer' }} onClick={() => openUserSheet(u)}>
                <Avatar u={u} />
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={s.name}>{u.full_name||u.email}</p>
                  {u.full_name && <p style={s.sub}>{u.email}</p>}
                </div>
                <span style={s.chip}>{u.companies??0} co · {u.leads??0} ld</span>
                <RoleBadge role={u.role} />
                <span style={s.sub}>{fmtDate(u.joined)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Tab: Users ────────────────────────────────────────────────────────────
  function renderUsers() {
    const totalPages = Math.ceil(usersTotal / 50)
    const allChecked = allUsers.length > 0 && allUsers.every(u => selected.has(u.id))
    return (
      <div>
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <input type="text" placeholder="Search email or name…" value={usersSearch} onChange={e => setUsersSearch(e.target.value)} style={{ ...s.input, flex:1, minWidth:200 }} />
          <select value={usersRole} onChange={e => { setUsersRole(e.target.value); setUsersPage(0) }} style={s.select}>
            <option value="">All roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
          <button onClick={() => allUsers.length && exportCSV(allUsers.filter(u => selected.size ? selected.has(u.id) : true))} style={s.ghostBtn} disabled={!allUsers.length}>
            ↓ Export{selected.size ? ` (${selected.size})` : ''}
          </button>
        </div>

        {usersLoading ? <Skeleton rows={8} /> : allUsers.length===0 ? <Empty text="No users found." /> : (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, padding:'8px 16px', background:'rgba(255,255,255,0.02)', borderRadius:6 }}>
              <input type="checkbox" checked={allChecked} onChange={e => e.target.checked ? setSelected(new Set(allUsers.map(u=>u.id))) : setSelected(new Set())} style={{ cursor:'pointer' }} />
              <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)' }}>{usersTotal} users · page {usersPage+1}</span>
            </div>
            <div style={s.list}>
              {allUsers.map(u => (
                <div key={u.id} style={{ ...s.row, opacity:u.suspended?0.55:1, borderColor:u.suspended?'rgba(224,112,112,0.2)':'var(--border)' }}>
                  <input type="checkbox" checked={selected.has(u.id)} onChange={() => setSelected(prev => { const n=new Set(prev); n.has(u.id)?n.delete(u.id):n.add(u.id); return n })} onClick={e=>e.stopPropagation()} style={{ cursor:'pointer', flexShrink:0 }} />
                  <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0, cursor:'pointer' }} onClick={() => openUserSheet(u)}>
                    <Avatar u={u} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <p style={{ ...s.name, color:u.suspended?'#e07070':'var(--text)' }}>{u.full_name||u.email}</p>
                        {u.admin_label && <span style={{ padding:'2px 6px', borderRadius:3, background:'rgba(139,92,246,0.12)', color:'#8b5cf6', fontFamily:'var(--font-mono)', fontSize:8, fontWeight:700 }}>{u.admin_label}</span>}
                      </div>
                      {u.full_name && <p style={s.sub}>{u.email}</p>}
                    </div>
                  </div>
                  <span style={s.chip}>{u.companies??0}co · {u.leads??0}ld</span>
                  <RoleBadge role={u.role} />
                  <span style={{ ...s.sub, whiteSpace:'nowrap' }}>{fmtDate(u.created_at)}</span>
                  <div style={{ display:'flex', gap:4 }} onClick={e=>e.stopPropagation()}>
                    <select value={u.role} disabled={u.id===profile?.id||updatingUser===u.id} onChange={e=>handleUserUpdate(u.id,{role:e.target.value})} style={{ ...s.select, fontSize:10, padding:'4px 8px' }}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                    {u.id!==profile?.id && (
                      <>
                        <button onClick={()=>handleUserUpdate(u.id,{suspended:!u.suspended})} disabled={updatingUser===u.id} style={{ ...s.actionBtn, color:u.suspended?'#4a7c59':'#e07070', borderColor:u.suspended?'rgba(74,124,89,0.3)':'rgba(224,112,112,0.25)' }}>{u.suspended?'Unsuspend':'Suspend'}</button>
                        {deleteConfirm===u.id ? (
                          <><button onClick={()=>handleUserDelete(u.id)} style={{ ...s.actionBtn, color:'#e07070', borderColor:'rgba(224,112,112,0.4)', background:'rgba(224,112,112,0.08)' }}>Confirm</button><button onClick={()=>setDeleteConfirm(null)} style={s.actionBtn}>Cancel</button></>
                        ) : (
                          <button onClick={()=>setDeleteConfirm(u.id)} style={{ ...s.actionBtn, color:'#e07070', borderColor:'rgba(224,112,112,0.25)' }}>Delete</button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {totalPages > 1 && (
          <div style={{ display:'flex', gap:8, marginTop:16, alignItems:'center' }}>
            <button onClick={()=>setUsersPage(p=>Math.max(0,p-1))} disabled={usersPage===0} style={s.pageBtn}>← Prev</button>
            <span style={s.sub}>{usersPage+1} / {totalPages} · {usersTotal} total</span>
            <button onClick={()=>setUsersPage(p=>p+1)} disabled={usersPage>=totalPages-1} style={s.pageBtn}>Next →</button>
          </div>
        )}

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center', gap:10, padding:'14px 20px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'0 8px 32px rgba(0,0,0,0.5)', zIndex:50, whiteSpace:'nowrap' }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:600, color:'var(--text)' }}>{selected.size} selected</span>
            <div style={{ width:1, height:16, background:'var(--border)' }} />
            <button onClick={()=>handleBulkAction('suspend')}   style={{ ...s.actionBtn, color:'#f59e0b', borderColor:'rgba(245,158,11,0.3)' }}>Suspend all</button>
            <button onClick={()=>handleBulkAction('unsuspend')} style={{ ...s.actionBtn, color:'#4a7c59', borderColor:'rgba(74,124,89,0.3)' }}>Unsuspend all</button>
            <button onClick={()=>handleBulkAction('admin')}     style={{ ...s.actionBtn, color:'#9D0010', borderColor:'rgba(157,0,16,0.3)' }}>Make admin</button>
            <button onClick={()=>handleBulkAction('member')}    style={s.actionBtn}>Make member</button>
            <button onClick={()=>exportCSV(allUsers.filter(u=>selected.has(u.id)))} style={s.actionBtn}>Export CSV</button>
            <div style={{ width:1, height:16, background:'var(--border)' }} />
            <button onClick={()=>setSelected(new Set())} style={{ ...s.actionBtn, color:'#e07070' }}>✕ Clear</button>
          </div>
        )}
      </div>
    )
  }

  // ── Tab: Growth ───────────────────────────────────────────────────────────
  function renderGrowth() {
    if (growthLoading) return <Skeleton rows={5} />
    if (!growth) return <Empty text="No growth data." />
    const { days=[], users=[], companies=[], leads=[] } = growth
    const total = arr => arr.reduce((a,b)=>a+b,0)
    return (
      <div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:32 }}>
          <StatCard label="Users added (30d)"     value={total(users)}     color="#E7000B" />
          <StatCard label="Companies added (30d)" value={total(companies)} color="#3b82f6" />
          <StatCard label="Leads added (30d)"     value={total(leads)}     color="#059669" />
        </div>
        <LineChart days={days} series={[{ data:users, color:'#E7000B', label:'Users' }, { data:companies, color:'#3b82f6', label:'Companies' }, { data:leads, color:'#059669', label:'Leads' }]} />
      </div>
    )
  }

  // ── Tab: Engagement ───────────────────────────────────────────────────────
  function renderEngagement() {
    if (engLoading) return <Skeleton rows={4} />
    if (!engagement) return <Empty text="No engagement data." />
    const { dau=0, wau=0, mau=0, inactive_count=0, top_by_companies=[], top_by_leads=[] } = engagement
    const stickiness = mau>0 ? ((dau/mau)*100).toFixed(1) : '—'
    return (
      <div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10, marginBottom:32 }}>
          <StatCard label="DAU"        value={dau} />
          <StatCard label="WAU"        value={wau} />
          <StatCard label="MAU"        value={mau} />
          <StatCard label="Stickiness" value={stickiness==='—'?'—':`${stickiness}%`} sub="DAU / MAU" />
          <StatCard label="Inactive"   value={inactive_count} sub="no activity 30d+" />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:24 }}>
          {[['Top by companies',top_by_companies,'companies'],['Top by leads',top_by_leads,'leads']].map(([title,list,key])=>(
            <div key={key}>
              <Eyebrow>{title}</Eyebrow>
              {list.length===0 ? <Empty text="No data." /> : (
                <div style={s.list}>
                  {list.map((u,i) => (
                    <div key={u.id} style={{ ...s.row, gap:10, padding:'10px 14px', cursor:'pointer' }} onClick={()=>openUserSheet(u)}>
                      <span style={{ ...s.sub, width:20, textAlign:'right' }}>#{i+1}</span>
                      <Avatar u={u} size={28} />
                      <div style={{ flex:1, minWidth:0 }}><p style={s.name}>{u.full_name||u.email}</p><p style={s.sub}>{u.email}</p></div>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:700, color:'var(--text)' }}>{u[key]}</span>
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

  // ── Tab: Retention ────────────────────────────────────────────────────────
  function renderRetention() {
    if (retentionLoading) return <Skeleton rows={8} />
    if (!retention?.cohorts) return <Empty text="No retention data." />
    const cohorts = retention.cohorts
    const maxPct = Math.max(...cohorts.map(c=>c.retention_pct), 1)
    return (
      <div>
        <p style={{ ...s.sub, marginBottom:20 }}>8-week cohort retention — percentage of each sign-up cohort that was active in the last 7 days.</p>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'var(--font-mono)', fontSize:11 }}>
            <thead>
              <tr>
                {['Cohort','Users','Returned','W1 Active','Retention'].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:'var(--text-muted)', fontWeight:600, fontSize:9, letterSpacing:'0.1em', textTransform:'uppercase', borderBottom:'1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c,i) => {
                const pctColor = c.retention_pct>=50?'#059669':c.retention_pct>=25?'#f59e0b':'#e07070'
                return (
                  <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding:'12px 14px', color:'var(--text)', fontWeight:600 }}>Wk {c.week}</td>
                    <td style={{ padding:'12px 14px', color:'var(--text-muted)' }}>{c.size}</td>
                    <td style={{ padding:'12px 14px', color:'var(--text-muted)' }}>{c.returned}</td>
                    <td style={{ padding:'12px 14px', color:'var(--text-muted)' }}>{c.retained}</td>
                    <td style={{ padding:'12px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontWeight:700, color:pctColor, minWidth:40 }}>{c.retention_pct}%</span>
                        <div style={{ flex:1, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden', maxWidth:120 }}>
                          <div style={{ height:'100%', width:`${(c.retention_pct/maxPct)*100}%`, background:pctColor, borderRadius:3, transition:'width 0.5s ease' }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Tab: Feature Flags ────────────────────────────────────────────────────
  function renderFlags() {
    if (flagsLoading) return <Skeleton rows={6} />
    if (featureFlags.length===0) return <Empty text="No feature flags configured." />
    const categories = [...new Set(featureFlags.map(f=>f.category))]
    const enabledCount = featureFlags.filter(f=>f.enabled).length
    return (
      <>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <p style={s.sub}><strong style={{ color:'var(--text)' }}>{enabledCount}</strong> of {featureFlags.length} flags enabled · admins bypass all flags · propagates within 60 s</p>
            <button onClick={() => { loadedTabs.current.delete('flags'); loadFlags() }} style={s.ghostBtn}>↻ Refresh</button>
          </div>
          {flagMsg && <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:flagMsg.ok?'#4a7c59':'#e07070' }}>{flagMsg.ok?'✓':'✗'} {flagMsg.text}</span>}
        </div>
        {categories.map(cat => {
          const catFlags = featureFlags.filter(f=>f.category===cat)
          const catEnabled = catFlags.filter(f=>f.enabled).length
          return (
            <div key={cat} style={{ marginBottom:28 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <Eyebrow style={{ marginBottom:0 }}>{CAT_LABELS[cat]||cat}</Eyebrow>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)' }}>{catEnabled}/{catFlags.length}</span>
                <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
                  <button onClick={()=>handleBulkFlags(cat,true)}  style={{ ...s.actionBtn, fontSize:9 }}>Enable all</button>
                  <button onClick={()=>handleBulkFlags(cat,false)} style={{ ...s.actionBtn, fontSize:9, color:'#e07070', borderColor:'rgba(224,112,112,0.25)' }}>Disable all</button>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:6 }}>
                {catFlags.map(flag => (
                  <div key={flag.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--surface)', border:`1px solid ${flag.enabled?'rgba(5,150,105,0.22)':'var(--border)'}`, borderRadius:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, color:flag.enabled?'var(--text)':'var(--text-muted)', margin:0 }}>{flag.label}</p>
                      {flag.description && <p style={{ ...s.sub, margin:'3px 0 0', lineHeight:1.4 }}>{flag.description}</p>}
                    </div>
                    <Toggle on={flag.enabled} loading={togglingFlag===flag.name} onToggle={()=>handleToggleFlag(flag.name,flag.enabled)} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </>
    )
  }

  // ── Tab: Announcements ────────────────────────────────────────────────────
  function renderAnnouncements() {
    return (
      <div>
        <div style={{ ...s.card, marginBottom:24 }}>
          <Eyebrow>{annEditing?'Edit announcement':'New announcement'}</Eyebrow>
          <form onSubmit={handleAnnSave} style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <input type="text" required placeholder="Title" value={annForm.title} onChange={e=>setAnnForm(f=>({...f,title:e.target.value}))} style={s.input} />
            <textarea required placeholder="Body…" rows={3} value={annForm.body} onChange={e=>setAnnForm(f=>({...f,body:e.target.value}))} style={{ ...s.input, resize:'vertical', lineHeight:1.6 }} />
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['info','warning','success','error'].map(k=>(
                <button key={k} type="button" onClick={()=>setAnnForm(f=>({...f,kind:k}))} style={{ padding:'6px 14px', borderRadius:6, border:`1.5px solid ${annForm.kind===k?KIND_COLOR[k]:'var(--border)'}`, background:annForm.kind===k?`${KIND_COLOR[k]}18`:'transparent', color:annForm.kind===k?KIND_COLOR[k]:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:11, cursor:'pointer' }}>{k}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button type="submit" disabled={annSaving} style={s.primaryBtn}>{annSaving?'Saving…':annEditing?'Update':'Publish'}</button>
              {annEditing && <button type="button" onClick={()=>{setAnnEditing(null);setAnnForm({title:'',body:'',kind:'info'})}} style={s.ghostBtn}>Cancel</button>}
            </div>
          </form>
        </div>
        {annLoading ? <Skeleton rows={3} /> : announcements.length===0 ? <Empty text="No announcements yet." /> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {announcements.map(a=>(
              <div key={a.id} style={{ padding:'16px 20px', background:'var(--surface)', border:`1px solid ${a.active?KIND_COLOR[a.kind]+'35':'var(--border)'}`, borderRadius:10, opacity:a.active?1:0.5 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  <span style={{ padding:'3px 8px', borderRadius:4, background:`${KIND_COLOR[a.kind]}18`, color:KIND_COLOR[a.kind], fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, flexShrink:0 }}>{a.kind}</span>
                  <div style={{ flex:1 }}><p style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:4 }}>{a.title}</p><p style={{ ...s.sub, lineHeight:1.5 }}>{a.body}</p></div>
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    <button onClick={()=>handleAnnToggle(a.id,a.active)} style={s.actionBtn}>{a.active?'Hide':'Show'}</button>
                    <button onClick={()=>{setAnnEditing(a.id);setAnnForm({title:a.title,body:a.body,kind:a.kind})}} style={s.actionBtn}>Edit</button>
                    <button onClick={()=>handleAnnDelete(a.id)} style={{ ...s.actionBtn, color:'#e07070', borderColor:'rgba(224,112,112,0.25)' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Tab: Changelog ────────────────────────────────────────────────────────
  function renderChangelog() {
    return (
      <div>
        <div style={{ ...s.card, marginBottom:24 }}>
          <Eyebrow>{clEditing?'Edit entry':'New release note'}</Eyebrow>
          <form onSubmit={handleClSave} style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:8 }}>
              <input type="text" placeholder="v1.2.3" value={clForm.version} onChange={e=>setClForm(f=>({...f,version:e.target.value}))} style={s.input} />
              <input type="text" required placeholder="What's new in this release…" value={clForm.title} onChange={e=>setClForm(f=>({...f,title:e.target.value}))} style={s.input} />
            </div>
            <textarea placeholder="Details, bug fixes, improvements…" rows={4} value={clForm.body} onChange={e=>setClForm(f=>({...f,body:e.target.value}))} style={{ ...s.input, resize:'vertical', lineHeight:1.6 }} />
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                <Toggle on={clForm.published} loading={false} onToggle={()=>setClForm(f=>({...f,published:!f.published}))} />
                <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:clForm.published?'var(--text)':'var(--text-muted)' }}>{clForm.published?'Published (visible to users)':'Draft'}</span>
              </label>
              <button type="submit" disabled={clSaving} style={s.primaryBtn}>{clSaving?'Saving…':clEditing?'Update':'Create'}</button>
              {clEditing && <button type="button" onClick={()=>{setClEditing(null);setClForm({title:'',body:'',version:'',published:false})}} style={s.ghostBtn}>Cancel</button>}
            </div>
          </form>
        </div>
        {clLoading ? <Skeleton rows={4} /> : changelog.length===0 ? <Empty text="No changelog entries yet." /> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {changelog.map(c=>(
              <div key={c.id} style={{ padding:'16px 20px', background:'var(--surface)', border:`1px solid ${c.published?'rgba(5,150,105,0.22)':'var(--border)'}`, borderRadius:10, opacity:c.published?1:0.6 }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  {c.version && <span style={{ padding:'3px 8px', borderRadius:4, background:'rgba(255,255,255,0.06)', color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:10, fontWeight:700, flexShrink:0 }}>{c.version}</span>}
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <p style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:600, color:'var(--text)' }}>{c.title}</p>
                      <span style={{ padding:'2px 6px', borderRadius:3, background:c.published?'rgba(5,150,105,0.12)':'rgba(255,255,255,0.04)', color:c.published?'#059669':'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:8, fontWeight:700 }}>{c.published?'Published':'Draft'}</span>
                    </div>
                    {c.body && <p style={{ ...s.sub, lineHeight:1.5 }}>{c.body}</p>}
                    <p style={{ ...s.sub, marginTop:4, opacity:0.6 }}>{fmtDate(c.created_at)}</p>
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    <button onClick={()=>handleClToggle(c.id,c.published)} style={s.actionBtn}>{c.published?'Unpublish':'Publish'}</button>
                    <button onClick={()=>{setClEditing(c.id);setClForm({title:c.title,body:c.body||'',version:c.version||'',published:c.published})}} style={s.actionBtn}>Edit</button>
                    <button onClick={()=>handleClDelete(c.id)} style={{ ...s.actionBtn, color:'#e07070', borderColor:'rgba(224,112,112,0.25)' }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Tab: Audit ────────────────────────────────────────────────────────────
  function renderAudit() {
    return (
      <div>
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <select value={auditAction} onChange={e=>{setAuditAction(e.target.value);setAuditPage(0)}} style={{ ...s.select, minWidth:200 }}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map(a=><option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
          </select>
          <button onClick={()=>{ setLiveCount(0); loadAudit(auditAction,auditPage) }} style={s.ghostBtn}>↻ Refresh{liveCount>0 && <span style={{ marginLeft:6, padding:'1px 5px', borderRadius:8, background:'#E7000B', color:'#fff', fontSize:9 }}>{liveCount} new</span>}</button>
          <button onClick={exportAuditCSV} disabled={auditLogs.length===0} style={{ ...s.ghostBtn, opacity: auditLogs.length===0 ? 0.4 : 1 }}>↓ Export CSV</button>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'#059669', marginLeft:'auto' }}>● Live</span>
        </div>
        {auditLoading ? <Skeleton rows={6} /> : auditLogs.length===0 ? <Empty text="No audit logs." /> : (
          <div style={s.list}>
            {auditLogs.map(log=>(
              <div key={log.id} style={{ ...s.row, alignItems:'flex-start' }}>
                <span style={{ padding:'3px 8px', borderRadius:4, background:`${ACT_COLOR[log.action]||'rgba(255,255,255,0.1)'}18`, color:ACT_COLOR[log.action]||'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, whiteSpace:'nowrap', flexShrink:0 }}>
                  {(log.action||'').replace(/_/g,' ')}
                </span>
                <div style={{ flex:1, minWidth:0 }}>
                  {log.target && <p style={{ ...s.name, fontWeight:500 }}>{log.target}</p>}
                  <p style={s.sub}>{log.admin_email}</p>
                  {log.metadata && Object.keys(log.metadata).length>0 && (
                    <p style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', marginTop:2, opacity:0.7 }}>
                      {Object.entries(log.metadata).map(([k,v])=>`${k}: ${JSON.stringify(v)}`).join(' · ')}
                    </p>
                  )}
                </div>
                <span style={{ ...s.sub, whiteSpace:'nowrap' }}>{fmtTs(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display:'flex', gap:8, marginTop:16, alignItems:'center' }}>
          <button onClick={()=>setAuditPage(p=>Math.max(0,p-1))} disabled={auditPage===0} style={s.pageBtn}>← Prev</button>
          <span style={s.sub}>Page {auditPage+1}</span>
          <button onClick={()=>setAuditPage(p=>p+1)} disabled={auditLogs.length<100} style={s.pageBtn}>Next →</button>
        </div>
      </div>
    )
  }

  // ── Tab: Team ─────────────────────────────────────────────────────────────
  function renderTeam() {
    return (
      <div>
        <div style={{ ...s.card, marginBottom:24 }}>
          <Eyebrow>Invite member</Eyebrow>
          <form onSubmit={handleInvite} style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="colleague@company.com" required style={{ ...s.input, flex:1, minWidth:200 }} />
            <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)} style={s.select}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={inviting} style={s.primaryBtn}>{inviting?'Sending…':'Send invite'}</button>
          </form>
          {inviteMsg && <p style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'#4a7c59', marginTop:10 }}>✓ {inviteMsg}</p>}
          {inviteErr && <p style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'#e07070', marginTop:10 }}>{inviteErr}</p>}
        </div>
        <Eyebrow>Members ({members.length})</Eyebrow>
        {teamLoading ? <Skeleton rows={3} /> : members.length===0 ? <Empty text="No members." /> : (
          <div style={{ ...s.list, marginBottom:24 }}>
            {members.map(m=>(
              <div key={m.id} style={s.row}>
                <Avatar u={m} />
                <div style={{ flex:1, minWidth:0 }}><p style={s.name}>{m.full_name||m.email}</p>{m.full_name&&<p style={s.sub}>{m.email}</p>}</div>
                <select value={m.role} onChange={e=>handleMemberRoleChange(m.id,e.target.value)} disabled={m.id===profile?.id} style={{ ...s.select, fontSize:10, padding:'4px 8px' }}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                {m.id!==profile?.id ? (
                  removeConfirm===m.id ? (
                    <><button onClick={()=>handleMemberRemove(m.id)} style={{ ...s.actionBtn, color:'#e07070', borderColor:'rgba(224,112,112,0.4)', background:'rgba(224,112,112,0.08)' }}>Confirm</button><button onClick={()=>setRemoveConfirm(null)} style={s.actionBtn}>Cancel</button></>
                  ) : (
                    <button onClick={()=>setRemoveConfirm(m.id)} style={{ ...s.actionBtn, color:'#e07070', borderColor:'rgba(224,112,112,0.25)' }}>Remove</button>
                  )
                ) : <span style={{ ...s.sub, padding:'4px 8px' }}>You</span>}
              </div>
            ))}
          </div>
        )}
        {invites.length>0 && (<>
          <Eyebrow>Pending invites ({invites.length})</Eyebrow>
          <div style={s.list}>{invites.map(inv=>(
            <div key={inv.id} style={s.row}>
              <div style={{ flex:1 }}><p style={s.name}>{inv.email}</p><p style={s.sub}>{inv.role} · sent {fmtDate(inv.created_at)}</p></div>
              <button onClick={()=>handleRevokeInvite(inv.id)} style={s.actionBtn}>Revoke</button>
            </div>
          ))}</div>
        </>)}
      </div>
    )
  }

  // ── Tab: Tools ────────────────────────────────────────────────────────────
  function renderTools() {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
        {/* Email Blast */}
        <div style={s.card}>
          <Eyebrow>Email blast</Eyebrow>
          <form onSubmit={handleBlast} style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', gap:8 }}>
              {[['all','All users'],['active','Active (30d)'],['inactive','Inactive (30d+)']].map(([val,label])=>(
                <button key={val} type="button" onClick={()=>setBlast(b=>({...b,segment:val}))} style={{ padding:'7px 14px', borderRadius:6, border:`1.5px solid ${blast.segment===val?'#E7000B':'var(--border)'}`, background:blast.segment===val?'rgba(231,0,11,0.1)':'transparent', color:blast.segment===val?'#E7000B':'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:11, fontWeight:600, cursor:'pointer' }}>{label}</button>
              ))}
            </div>
            <input type="text" required placeholder="Subject line…" value={blast.subject} onChange={e=>setBlast(b=>({...b,subject:e.target.value}))} style={s.input} />
            <textarea required placeholder="Email body…" rows={5} value={blast.body} onChange={e=>setBlast(b=>({...b,body:e.target.value}))} style={{ ...s.input, resize:'vertical', lineHeight:1.6 }} />
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button type="submit" disabled={blasting||!blast.subject.trim()||!blast.body.trim()} style={{ ...s.primaryBtn, opacity:(!blast.subject.trim()||!blast.body.trim())?0.4:1 }}>{blasting?'Sending…':'Send blast'}</button>
              {blastResult && (
                <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:blastResult.error?'#e07070':'#4a7c59' }}>
                  {blastResult.error ? `✗ ${blastResult.error}` : `✓ Sent to ${blastResult.sent} · ${blastResult.errors} errors`}
                </span>
              )}
            </div>
          </form>
        </div>

        {isOwner && (<>
          {/* Discord */}
          <div style={s.card}>
            <Eyebrow>Post to Discord</Eyebrow>
            <form onSubmit={handleDiscordSend} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {DISCORD_CH.map(ch=>(
                  <button key={ch.id} type="button" onClick={()=>setDiscordCh(ch.id)} style={{ padding:'7px 14px', borderRadius:6, border:`1.5px solid ${discordCh===ch.id?ch.color:'var(--border)'}`, background:discordCh===ch.id?`${ch.color}18`:'transparent', color:discordCh===ch.id?ch.color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:11, fontWeight:600, cursor:'pointer' }}>{ch.label}</button>
                ))}
              </div>
              <textarea value={discordMsg} onChange={e=>setDiscordMsg(e.target.value)} placeholder="Write your message here…" rows={4} style={{ ...s.input, resize:'vertical', lineHeight:1.6 }} />
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <button type="submit" disabled={discordSending||!discordMsg.trim()} style={{ ...s.primaryBtn, opacity:!discordMsg.trim()?0.4:1 }}>{discordSending?'Sending…':'Send message'}</button>
                {discordFb && <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:discordFb.ok?'#4a7c59':'#e07070' }}>{discordFb.ok?'✓ ':'✗ '}{discordFb.text}</span>}
              </div>
            </form>
          </div>

          {/* GitHub */}
          <div style={s.card}>
            <Eyebrow>Add GitHub collaborator</Eyebrow>
            <p style={{ ...s.sub, marginBottom:14 }}>Team member posts their GitHub username → enter it here → they get an invite by email.</p>
            <form onSubmit={handleGithubInvite} style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
              <input type="text" value={ghUsername} onChange={e=>setGhUsername(e.target.value)} placeholder="their-github-username" style={{ ...s.input, flex:1, minWidth:200 }} />
              <button type="submit" disabled={ghAdding||!ghUsername.trim()} style={{ ...s.primaryBtn, opacity:!ghUsername.trim()?0.4:1 }}>{ghAdding?'Adding…':'Add collaborator'}</button>
            </form>
            {ghFb && <p style={{ fontFamily:'var(--font-mono)', fontSize:11, color:ghFb.ok?'#4a7c59':'#e07070', marginBottom:10 }}>{ghFb.ok?'✓ ':'✗ '}{ghFb.text}</p>}
            {ghLog.length>0 && (
              <div style={s.list}>{ghLog.map((e,i)=>(
                <div key={i} style={{ ...s.row, padding:'10px 14px' }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text)', flex:1 }}>{e.username}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:e.ok?'#4a7c59':'#e07070' }}>{e.label}</span>
                  <span style={s.sub}>{e.time}</span>
                </div>
              ))}</div>
            )}
          </div>
        </>)}

        {!isOwner && <Empty text="Discord and GitHub tools are owner-only." />}
      </div>
    )
  }

  // ── Tab: Health ───────────────────────────────────────────────────────────
  function renderHealth() {
    const statusC = { ok:'#059669', configured:'#059669', missing:'#e07070', error:'#e07070' }
    const statusLabel = { ok:'OK', configured:'Configured', missing:'Missing', error:'Error' }
    return (
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          {health?.timestamp && <p style={s.sub}>Last checked {fmtTs(health.timestamp)}</p>}
          <button onClick={loadHealth} disabled={healthLoading} style={s.ghostBtn}>{healthLoading?'Checking…':'↻ Run health check'}</button>
        </div>
        {healthLoading ? <Skeleton rows={6} /> : !health ? <Empty text="Click 'Run health check' to see status." /> : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
            {Object.entries(health.checks||{}).map(([key, val]) => {
              const status = val.status || 'unknown'
              const color = statusC[status] || 'var(--text-muted)'
              return (
                <div key={key} style={{ padding:'18px 20px', background:'var(--surface)', border:`1px solid ${color}33`, borderRadius:10 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <p style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase' }}>{key.replace(/_/g,' ')}</p>
                    <span style={{ padding:'2px 7px', borderRadius:3, background:`${color}18`, color, fontFamily:'var(--font-mono)', fontSize:8, fontWeight:700 }}>{statusLabel[status]||status}</span>
                  </div>
                  {val.latency_ms!=null && <p style={{ fontFamily:'var(--font-mono)', fontSize:20, fontWeight:900, color:'var(--text)', letterSpacing:'-0.03em' }}>{val.latency_ms}ms</p>}
                  {val.count!=null && <p style={{ fontFamily:'var(--font-mono)', fontSize:20, fontWeight:900, color:'var(--text)', letterSpacing:'-0.03em' }}>{val.count}</p>}
                  {val.prefix && <p style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{val.prefix}</p>}
                  {val.error && <p style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'#e07070', marginTop:4, lineHeight:1.4 }}>{val.error}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const tabContent = { overview:renderOverview, users:renderUsers, growth:renderGrowth, engagement:renderEngagement, retention:renderRetention, flags:renderFlags, announcements:renderAnnouncements, changelog:renderChangelog, audit:renderAudit, team:renderTeam, tools:renderTools, health:renderHealth }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding:'clamp(28px,4vw,64px) clamp(20px,4vw,48px) 0', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
          <div>
            <p style={s.eyebrow}>Platform</p>
            <h1 style={s.heroTitle}>Admin.</h1>
          </div>
          <button onClick={()=>setCmdOpen(true)} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)', cursor:'pointer', marginTop:'clamp(28px,4vw,64px)', whiteSpace:'nowrap' }}>
            ⌘K Search
          </button>
        </div>
        <div style={{ display:'flex', gap:0, marginTop:24, overflowX:'auto', scrollbarWidth:'none' }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'10px clamp(10px,1.5vw,18px)', background:'none', border:'none', borderBottom:`2px solid ${tab===t.id?'var(--text)':'transparent'}`, fontFamily:'var(--font-mono)', fontSize:11, fontWeight:tab===t.id?600:400, color:tab===t.id?'var(--text)':'var(--text-muted)', cursor:'pointer', whiteSpace:'nowrap', transition:'color 0.15s' }}>
              {t.label}{t.id==='audit'&&liveCount>0&&<span style={{ marginLeft:5, padding:'1px 4px', borderRadius:8, background:'#E7000B', color:'#fff', fontSize:8 }}>{liveCount}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'clamp(24px,3vw,40px) clamp(20px,4vw,48px) 80px' }}>
        {(tabContent[tab]||(() => null))()}
      </div>

      {/* Cmd+K Palette */}
      {cmdOpen && (
        <>
          <div onClick={()=>setCmdOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:300 }} />
          <div style={{ position:'fixed', top:'20%', left:'50%', transform:'translateX(-50%)', width:'min(580px,95vw)', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:14, zIndex:301, overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.7)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
              <span style={{ color:'var(--text-muted)', fontSize:16 }}>⌘</span>
              <input ref={cmdRef} value={cmdQuery} onChange={e=>setCmdQuery(e.target.value)} onKeyDown={handleCmdKeyDown} placeholder="Search users, companies, leads or jump to tab…" style={{ flex:1, background:'none', border:'none', outline:'none', fontFamily:'var(--font-mono)', fontSize:13, color:'var(--text)' }} />
              {cmdSearching && <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)' }}>…</span>}
              <kbd onClick={()=>setCmdOpen(false)} style={{ padding:'3px 7px', border:'1px solid var(--border)', borderRadius:4, fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', cursor:'pointer' }}>ESC</kbd>
            </div>
            <div style={{ maxHeight:400, overflowY:'auto', padding:'8px 0' }}>
              {!cmdQuery && (
                <>
                  <p style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', padding:'6px 18px 4px' }}>Jump to</p>
                  {TABS.map((t,i)=>(
                    <button key={t.id} onClick={()=>{setTab(t.id);setCmdOpen(false);setCmdQuery('')}} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 18px', background:cmdIndex===i?'rgba(255,255,255,0.06)':'none', border:'none', cursor:'pointer', textAlign:'left' }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text)' }}>{t.label}</span>
                    </button>
                  ))}
                </>
              )}
              {cmdQuery && cmdResults && (
                <>
                  {cmdResults.users?.length>0 && (<>
                    <p style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', padding:'10px 18px 4px' }}>Users</p>
                    {cmdResults.users.map((u,i)=>(
                      <button key={u.id} onClick={()=>{openUserSheet(u);setCmdOpen(false);setCmdQuery('');setTab('users')}} style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 18px', background:cmdIndex===TABS.length+i?'rgba(255,255,255,0.06)':'none', border:'none', cursor:'pointer' }}>
                        <Avatar u={u} size={24} />
                        <div style={{ flex:1, textAlign:'left' }}>
                          <p style={s.name}>{u.full_name||u.email}</p>
                          {u.full_name && <p style={s.sub}>{u.email}</p>}
                        </div>
                        <RoleBadge role={u.role} />
                      </button>
                    ))}
                  </>)}
                  {cmdResults.companies?.length>0 && (<>
                    <p style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', padding:'10px 18px 4px' }}>Companies</p>
                    {cmdResults.companies.map(c=>(
                      <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 18px' }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text)', flex:1 }}>{c.name}</span>
                        <span style={s.sub}>{c.domain}</span>
                      </div>
                    ))}
                  </>)}
                  {cmdResults.leads?.length>0 && (<>
                    <p style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, letterSpacing:'0.1em', color:'var(--text-muted)', textTransform:'uppercase', padding:'10px 18px 4px' }}>Leads</p>
                    {cmdResults.leads.map(l=>(
                      <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 18px' }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text)', flex:1 }}>{[l.first_name,l.last_name].filter(Boolean).join(' ')||l.email}</span>
                        <span style={s.sub}>{l.company}</span>
                      </div>
                    ))}
                  </>)}
                  {!cmdResults.users?.length && !cmdResults.companies?.length && !cmdResults.leads?.length && (
                    <p style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-muted)', padding:'20px 18px' }}>No results for "{cmdQuery}"</p>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* User detail sheet */}
      {selectedUser && (
        <UserSheet user={selectedUser} detail={userDetail} detailLoading={userDetailLoading} currentUserId={profile?.id} onClose={()=>{setSelectedUser(null);setUserDetail(null)}}
          onUpdate={patch=>{
            handleUserUpdate(selectedUser.id, patch)
            setSelectedUser(u=>({...u,...patch}))
          }} />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Avatar({ u, size=32 }) {
  const color = AVATAR_COLORS[(u.email||'').charCodeAt(0) % AVATAR_COLORS.length]
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:color+'22', border:`1.5px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-mono)', fontSize:size*0.38, fontWeight:700, color, flexShrink:0 }}>
      {initials(u)}
    </div>
  )
}

function RoleBadge({ role }) {
  const c = roleC(role)
  return <span style={{ padding:'3px 8px', borderRadius:4, background:c.bg, color:c.c, border:`1px solid ${c.b}`, fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, flexShrink:0 }}>{role}</span>
}

function Toggle({ on, loading, onToggle }) {
  return (
    <button onClick={onToggle} disabled={loading} style={{ flexShrink:0, width:40, height:22, borderRadius:11, border:'none', cursor:loading?'default':'pointer', position:'relative', background:on?'#059669':'var(--border)', opacity:loading?0.5:1, transition:'background 0.2s' }}>
      <span style={{ position:'absolute', top:3, left:on?20:3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.25)' }} />
    </button>
  )
}

function StatCard({ label, value, sub, delta, color }) {
  return (
    <div style={{ padding:'18px 20px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10 }}>
      <p style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:8 }}>{label}</p>
      <p style={{ fontFamily:'var(--font-display)', fontSize:30, fontWeight:900, letterSpacing:'-0.04em', color:color||'var(--text)', lineHeight:1 }}>{value??'—'}</p>
      {(sub||delta!=null) && <p style={{ fontFamily:'var(--font-mono)', fontSize:10, color:delta>0?'#4a7c59':'var(--text-muted)', marginTop:6 }}>{delta!=null&&delta>0?`+${delta} this week`:sub||''}</p>}
    </div>
  )
}

function Skeleton({ rows=4, cols=1 }) {
  if (cols > 1) return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:10 }}>
      {Array.from({ length:rows*cols }).map((_,i) => <div key={i} style={{ height:80, borderRadius:8, background:'var(--surface)', border:'1px solid var(--border)', opacity:1-i*0.05 }} />)}
    </div>
  )
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {Array.from({ length:rows }).map((_,i) => <div key={i} style={{ height:44, borderRadius:8, background:'var(--surface)', border:'1px solid var(--border)', opacity:1-i*0.12 }} />)}
    </div>
  )
}

function Empty({ text }) {
  return <p style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-muted)', padding:'20px 0' }}>{text}</p>
}

function Eyebrow({ children, style }) {
  return <p style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, letterSpacing:'0.12em', color:'var(--text-muted)', textTransform:'uppercase', marginBottom:10, ...style }}>{children}</p>
}

function LineChart({ days, series }) {
  const W=900, H=160, PL=28, PB=20
  const cW=W-PL, cH=H-PB
  const maxVal = Math.max(...series.flatMap(s=>s.data), 1)
  const pts = data => data.map((v,i) => `${(PL+(i/Math.max(data.length-1,1))*cW).toFixed(1)},${(H-PB-(v/maxVal)*(cH-4)-4).toFixed(1)}`).join(' ')
  const labelIdxs = days.map((_,i)=>i).filter(i=>i%Math.ceil(days.length/6)===0||i===days.length-1)
  return (
    <div>
      <div style={{ display:'flex', gap:16, marginBottom:12 }}>
        {series.map(s=>(
          <div key={s.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:20, height:2, background:s.color, borderRadius:1 }} />
            <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>
      <div style={{ overflowX:'auto', borderRadius:8 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', minWidth:400, height:H, display:'block' }}>
          {[0,.25,.5,.75,1].map(f=>{
            const y=H-PB-f*(cH-4)-4
            return <g key={f}><line x1={PL} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/><text x={PL-5} y={y+4} textAnchor="end" fontFamily="monospace" fontSize="8" fill="rgba(255,255,255,0.25)">{Math.round(f*maxVal)}</text></g>
          })}
          {labelIdxs.map(i=><text key={i} x={PL+(i/Math.max(days.length-1,1))*cW} y={H-2} textAnchor="middle" fontFamily="monospace" fontSize="8" fill="rgba(255,255,255,0.3)">{fmtShort(days[i])}</text>)}
          {series.map(s=><polyline key={s.label} points={pts(s.data)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9"/>)}
          {series.map(s=>s.data.map((v,i)=>v>0&&<circle key={i} cx={PL+(i/Math.max(s.data.length-1,1))*cW} cy={H-PB-(v/maxVal)*(cH-4)-4} r="2.5" fill={s.color} opacity="0.8"/>))}
        </svg>
      </div>
    </div>
  )
}

function UserSheet({ user, detail, detailLoading, onClose, onUpdate, currentUserId }) {
  const [notes, setNotes]     = useState(user.admin_notes||'')
  const [label, setLabel]     = useState(user.admin_label||'')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  async function saveNotes() {
    setSaving(true)
    try { await onUpdate({ admin_notes:notes, admin_label:label||null }); setSaved(true); setTimeout(()=>setSaved(false),2000) } catch {}
    setSaving(false)
  }

  const counts = detail?.counts || {}
  const auth   = detail?.auth   || detail?.login || {}

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200 }} />
      <div style={{ position:'fixed', top:0, right:0, bottom:0, width:'min(480px,100vw)', background:'var(--bg)', borderLeft:'1px solid var(--border)', zIndex:201, overflowY:'auto', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <Avatar u={user} size={44} />
            <div>
              <p style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:700, color:'var(--text)', letterSpacing:'-0.02em' }}>{user.full_name||'—'}</p>
              <p style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:20, lineHeight:1 }}>×</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:20 }}>
          {/* Stat grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[['Role',<RoleBadge role={user.role}/>],['Status',<span style={{ fontFamily:'var(--font-mono)',fontSize:11,color:user.suspended?'#e07070':'#4a7c59' }}>{user.suspended?'Suspended':'Active'}</span>],['Companies',counts.companies??user.companies??0],['Leads',counts.leads??user.leads??0],['Sequences',counts.sequences??0],['Tasks',counts.tasks??0],['Joined',fmtDate(user.created_at||user.joined)],['Last login',auth.last_sign_in?fmtDate(auth.last_sign_in):'—']].map(([lbl,val])=>(
              <div key={lbl} style={{ padding:'12px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
                <p style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>{lbl}</p>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text)', fontWeight:600 }}>{val}</div>
              </div>
            ))}
          </div>

          {auth.email_confirmed!=null && (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
              <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:auth.email_confirmed?'#4a7c59':'#f59e0b' }}>{auth.email_confirmed?'✓ Email confirmed':'⚠ Email not confirmed'}</span>
            </div>
          )}

          {/* Admin label */}
          <div>
            <Eyebrow>Label</Eyebrow>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {LABELS.map(l=>(
                <button key={l} type="button" onClick={()=>setLabel(l)} style={{ padding:'6px 12px', borderRadius:6, border:`1.5px solid ${label===l?'#8b5cf6':'var(--border)'}`, background:label===l?'rgba(139,92,246,0.12)':'transparent', color:label===l?'#8b5cf6':'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:10, cursor:'pointer' }}>{l||'None'}</button>
              ))}
            </div>
          </div>

          {/* Admin notes */}
          <div>
            <Eyebrow>Internal notes</Eyebrow>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} placeholder="Internal notes (not visible to user)…" style={{ ...s.input, resize:'vertical', lineHeight:1.6 }} />
            <button onClick={saveNotes} disabled={saving} style={{ ...s.primaryBtn, marginTop:8, fontSize:11, padding:'8px 16px' }}>
              {saved?'✓ Saved':saving?'Saving…':'Save notes & label'}
            </button>
          </div>

          {/* Recent activity */}
          {detailLoading && <div style={{ padding:'12px 0', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>Loading activity…</div>}
          {detail?.recent_companies?.length>0 && (
            <div>
              <Eyebrow>Recent companies ({detail.recent_companies.length})</Eyebrow>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {detail.recent_companies.map(c=>(
                  <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:7 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={s.name}>{c.name}</p>
                      <p style={s.sub}>{c.domain}</p>
                    </div>
                    <span style={s.sub}>{fmtDate(c.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {detail?.recent_leads?.length>0 && (
            <div>
              <Eyebrow>Recent leads ({detail.recent_leads.length})</Eyebrow>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {detail.recent_leads.map(l=>(
                  <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:7 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={s.name}>{[l.first_name,l.last_name].filter(Boolean).join(' ')||'—'}</p>
                      <p style={s.sub}>{l.email||l.company}</p>
                    </div>
                    <span style={s.sub}>{fmtDate(l.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {user.id!==currentUserId && (
            <div>
              <Eyebrow>Actions</Eyebrow>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <button onClick={()=>onUpdate({suspended:!user.suspended})} style={{ padding:'10px 16px', background:'var(--surface)', border:`1px solid ${user.suspended?'rgba(74,124,89,0.3)':'rgba(224,112,112,0.25)'}`, borderRadius:7, fontFamily:'var(--font-mono)', fontSize:12, color:user.suspended?'#4a7c59':'#e07070', cursor:'pointer', textAlign:'left' }}>
                  {user.suspended?'Unsuspend account':'Suspend account'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  eyebrow:   { fontFamily:'var(--font-mono)', fontSize:'10px', fontWeight:'600', letterSpacing:'0.14em', color:'var(--text-muted)', marginBottom:'14px', textTransform:'uppercase' },
  heroTitle: { fontFamily:'var(--font-display)', fontSize:'clamp(40px,6vw,80px)', fontWeight:'900', letterSpacing:'-0.05em', color:'var(--text)', lineHeight:1, marginBottom:'10px' },
  list:      { display:'flex', flexDirection:'column', gap:4 },
  row:       { display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 },
  card:      { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:20 },
  name:      { fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text)', fontWeight:600, margin:0 },
  sub:       { fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', margin:0 },
  chip:      { fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', whiteSpace:'nowrap' },
  input:     { padding:'10px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:7, fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text)', outline:'none', width:'100%', boxSizing:'border-box' },
  select:    { padding:'10px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:7, fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text)', outline:'none', cursor:'pointer' },
  primaryBtn:{ padding:'10px 20px', background:'#E7000B', border:'none', borderRadius:7, fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, color:'#fff', cursor:'pointer' },
  ghostBtn:  { padding:'8px 14px', background:'none', border:'1px solid var(--border)', borderRadius:7, fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)', cursor:'pointer' },
  actionBtn: { padding:'5px 10px', background:'none', border:'1px solid var(--border)', borderRadius:5, fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', cursor:'pointer', whiteSpace:'nowrap' },
  pageBtn:   { padding:'7px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text)', cursor:'pointer' },
}
