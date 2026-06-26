// ─── CONFIG ──────────────────────────────────────────────────
// API_BASE_URL is defined in config.js (loaded before this script)
const GMAIL_API_BASE = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'https://leadgenengineplatform-api.vercel.app/api'
const PANEL_ID = 'sonar-gmail-panel'
const TAB_ID   = 'sonar-gmail-tab'
const STYLES_ID = 'sonar-gmail-styles'

// ─── STATE ───────────────────────────────────────────────────
let _token = null
let _panelOpen = false
let _currentEmail = null   // email address being displayed
let _lastUrl = ''
let _seqCache = null

// ─── TOKEN ───────────────────────────────────────────────────
function getToken() {
  return new Promise(resolve => {
    chrome.storage.local.get(['token'], s => resolve(s.token || null))
  })
}

function _jwtExp(token) {
  try { return (JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp || 0) * 1000 } catch { return 0 }
}

async function _refreshToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['refresh_token'], async (s) => {
      if (!s.refresh_token) { reject(new Error('No refresh token')); return }
      try {
        const r = await fetch(GMAIL_API_BASE + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: s.refresh_token })
        })
        if (!r.ok) { reject(new Error('Refresh failed')); return }
        const data = await r.json()
        chrome.storage.local.set({ token: data.access_token, refresh_token: data.refresh_token })
        _token = data.access_token
        resolve(data.access_token)
      } catch (e) { reject(e) }
    })
  })
}

async function getValidToken() {
  const token = await getToken()
  if (!token) return null
  const exp = _jwtExp(token)
  if (exp > 0 && Date.now() > exp - 60_000) {
    try { return await _refreshToken() } catch { return null }
  }
  return token
}

// ─── STYLES ──────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById(STYLES_ID)) return
  const style = document.createElement('style')
  style.id = STYLES_ID
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;500;600;700;800&family=Barlow+Condensed:wght@700;800;900&display=swap');

    #${TAB_ID} {
      position: fixed; right: 0; top: 50%; transform: translateY(-50%);
      width: 28px; height: 72px;
      background: #E7000B; border-radius: 6px 0 0 6px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 2147483646;
      box-shadow: -2px 0 12px rgba(231,0,11,0.22);
      transition: width 0.2s;
    }
    #${TAB_ID}:hover { width: 32px; }
    #${TAB_ID} svg { flex-shrink: 0; }

    #${PANEL_ID} {
      position: fixed; right: -320px; top: 0; bottom: 0;
      width: 320px; z-index: 2147483647;
      background: #ffffff;
      border-left: 1px solid #e5e7eb;
      font-family: 'Host Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex; flex-direction: column;
      transition: right 0.28s cubic-bezier(0.22,1,0.36,1);
      box-shadow: -8px 0 32px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    #${PANEL_ID}.open { right: 0; }

    .sg-hd {
      display: flex; align-items: center; justify-content: space-between;
      padding: 13px 16px;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
      background: #ffffff;
    }
    .sg-logo { display: flex; align-items: center; gap: 8px; }
    .sg-logo-icon {
      width: 20px; height: 20px; background: #E7000B; border-radius: 4px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sg-brand {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; font-weight: 800; letter-spacing: .14em;
      text-transform: uppercase; color: #111827;
    }
    .sg-close {
      background: none; border: none; color: #9ca3af; font-size: 16px; cursor: pointer;
      padding: 4px; line-height: 1; transition: color 0.15s; border-radius: 4px;
    }
    .sg-close:hover { color: #111827; background: #f3f4f6; }

    .sg-body { flex: 1; overflow-y: auto; background: #ffffff; }
    .sg-body::-webkit-scrollbar { width: 4px; }
    .sg-body::-webkit-scrollbar-track { background: transparent; }
    .sg-body::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }

    .sg-section {
      padding: 14px 16px;
      border-bottom: 1px solid #f3f4f6;
    }
    .sg-label {
      font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
      color: #9ca3af; margin-bottom: 8px;
    }
    .sg-name { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 2px; line-height: 1.3; }
    .sg-sub { font-size: 11px; color: #6b7280; line-height: 1.4; }
    .sg-email { font-size: 10px; color: #9ca3af; margin-top: 4px; word-break: break-all; }

    .sg-badges { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 8px; }
    .sg-badge {
      font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
      padding: 2px 8px; border-radius: 999px; border: 1px solid;
    }
    .sg-badge-stage    { background: #f3f4f6; border-color: #e5e7eb; color: #6b7280; }
    .sg-badge-score-hi { background: rgba(22,163,74,.08); border-color: rgba(22,163,74,.25); color: #16a34a; }
    .sg-badge-score-md { background: rgba(217,119,6,.08); border-color: rgba(217,119,6,.25); color: #d97706; }
    .sg-badge-score-lo { background: #f3f4f6; border-color: #e5e7eb; color: #9ca3af; }
    .sg-badge-in       { background: rgba(22,163,74,.08); border-color: rgba(22,163,74,.25); color: #16a34a; }

    .sg-row { display: flex; gap: 6px; flex-wrap: wrap; }

    .sg-btn {
      flex: 1; min-width: 0;
      padding: 8px 10px; border-radius: 7px; font-family: inherit;
      font-size: 11px; font-weight: 600;
      cursor: pointer; border: 1px solid #e5e7eb; background: #f9fafb; color: #374151;
      transition: all 0.15s; text-align: center; white-space: nowrap;
    }
    .sg-btn:hover { border-color: #d1d5db; color: #111827; background: #f3f4f6; }
    .sg-btn:disabled { opacity: .4; cursor: not-allowed; }
    .sg-btn.pri { background: #E7000B; border-color: #E7000B; color: #fff; }
    .sg-btn.pri:hover { background: #c50009; }
    .sg-btn.grn { background: rgba(22,163,74,.07); border-color: rgba(22,163,74,.22); color: #16a34a; }
    .sg-btn.grn:hover { background: rgba(22,163,74,.14); }

    .sg-activity-row {
      display: flex; gap: 8px; align-items: flex-start; padding: 7px 0;
      border-bottom: 1px solid #f9fafb;
    }
    .sg-activity-row:last-child { border-bottom: none; }
    .sg-activity-dot {
      width: 6px; height: 6px; border-radius: 50%; background: #e5e7eb; flex-shrink: 0; margin-top: 4px;
    }
    .sg-activity-type { font-size: 9px; font-weight: 700; color: #9ca3af; letter-spacing: .08em; text-transform: uppercase; }
    .sg-activity-note { font-size: 11px; color: #374151; margin-top: 2px; line-height: 1.45; }
    .sg-activity-date { font-size: 9px; color: #9ca3af; margin-top: 2px; }

    .sg-seq-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 0; border-bottom: 1px solid #f9fafb; gap: 6px;
    }
    .sg-seq-row:last-child { border-bottom: none; }
    .sg-seq-name { font-size: 11px; color: #374151; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sg-seq-status { font-size: 9px; font-weight: 700; letter-spacing: .06em; color: #16a34a; }

    .sg-status { font-size: 12px; color: #6b7280; padding: 14px 16px; font-weight: 500; }
    .sg-status.err { color: #dc2626; }

    .sg-note-input {
      width: 100%; padding: 8px 10px; background: #f9fafb; border: 1px solid #e5e7eb;
      border-radius: 7px; font-family: inherit; font-size: 11px; color: #111827; resize: none;
      line-height: 1.5; margin-bottom: 6px; outline: none; transition: border-color .15s, box-shadow .15s;
    }
    .sg-note-input:focus { border-color: #E7000B; box-shadow: 0 0 0 3px rgba(231,0,11,.08); }
    .sg-note-input::placeholder { color: #d1d5db; }

    .sg-seq-picker {
      width: 100%; padding: 7px 10px; background: #f9fafb; border: 1px solid #e5e7eb;
      border-radius: 7px; font-family: inherit; font-size: 11px; color: #374151; outline: none;
      margin-bottom: 6px; cursor: pointer;
    }
    .sg-seq-picker option { background: #ffffff; }

    .sg-draft-result {
      font-size: 11px; color: #374151; line-height: 1.65;
      padding: 10px 12px; background: #f9fafb; border: 1px solid #e5e7eb;
      border-radius: 7px; white-space: pre-wrap; word-break: break-word;
      margin-top: 6px; max-height: 200px; overflow-y: auto;
    }
    .sg-copy-btn {
      margin-top: 6px; padding: 6px 12px; background: #f9fafb; border: 1px solid #e5e7eb;
      border-radius: 6px; font-family: inherit; font-size: 10px; font-weight: 600;
      color: #6b7280; cursor: pointer; transition: all .15s;
    }
    .sg-copy-btn:hover { border-color: #d1d5db; color: #111827; }

    .sg-ft {
      padding: 10px 16px 13px;
      border-top: 1px solid #e5e7eb; flex-shrink: 0; background: #ffffff;
    }
    .sg-ft-link {
      background: none; border: none; font-family: inherit; font-size: 11px; font-weight: 600;
      color: #9ca3af; cursor: pointer; padding: 0; transition: color .15s;
    }
    .sg-ft-link:hover { color: #111827; }

    .sg-spinner {
      display: inline-block; width: 12px; height: 12px;
      border: 2px solid #e5e7eb; border-top-color: #E7000B;
      border-radius: 50%; animation: sg-spin 0.7s linear infinite; vertical-align: middle;
    }
    @keyframes sg-spin { to { transform: rotate(360deg); } }
  `
  document.head.appendChild(style)
}

// ─── PANEL DOM ───────────────────────────────────────────────
function createPanel() {
  if (document.getElementById(PANEL_ID)) return

  // Tab trigger
  const tab = document.createElement('div')
  tab.id = TAB_ID
  tab.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke="#fff" stroke-width="1.2" opacity="0.5"/>
    <circle cx="8" cy="8" r="3.5" stroke="#fff" stroke-width="1.2" opacity="0.85"/>
    <circle cx="8" cy="8" r="1.3" fill="#fff"/>
    <line x1="9" y1="7" x2="13" y2="3" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`
  tab.addEventListener('click', togglePanel)
  document.body.appendChild(tab)

  // Panel
  const panel = document.createElement('div')
  panel.id = PANEL_ID
  panel.innerHTML = `
    <div class="sg-hd">
      <div class="sg-logo">
        <div class="sg-logo-icon">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="#fff" stroke-width="1.2" opacity="0.5"/>
            <circle cx="8" cy="8" r="3.5" stroke="#fff" stroke-width="1.2" opacity="0.85"/>
            <circle cx="8" cy="8" r="1.3" fill="#fff"/>
            <line x1="9" y1="7" x2="13" y2="3" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="sg-brand">Sonar</span>
      </div>
      <button class="sg-close" id="sg-close">✕</button>
    </div>
    <div class="sg-body" id="sg-body">
      <div class="sg-status">Open an email to see lead info.</div>
    </div>
    <div class="sg-ft">
      <button class="sg-ft-link" id="sg-dash-btn">Open Sonar dashboard →</button>
    </div>
  `
  document.body.appendChild(panel)

  document.getElementById('sg-close').addEventListener('click', () => closePanel())
  document.getElementById('sg-dash-btn').addEventListener('click', () => {
    window.open('https://sonarleads.vercel.app', '_blank')
  })
}

function togglePanel() {
  const panel = document.getElementById(PANEL_ID)
  if (!panel) return
  _panelOpen = !_panelOpen
  panel.classList.toggle('open', _panelOpen)
  if (_panelOpen && _currentEmail) loadLead(_currentEmail)
}

function closePanel() {
  const panel = document.getElementById(PANEL_ID)
  if (panel) panel.classList.remove('open')
  _panelOpen = false
}

function setBody(html) {
  const body = document.getElementById('sg-body')
  if (body) body.innerHTML = html
}

// ─── GMAIL DOM SCRAPING ──────────────────────────────────────
function extractSenderEmail() {
  // Strategy 1: [data-hovercard-id] — most reliable, Gmail sets this on sender spans
  const hoverEls = document.querySelectorAll('[data-hovercard-id]')
  for (const el of hoverEls) {
    const id = el.getAttribute('data-hovercard-id') || ''
    if (id.includes('@') && id.includes('.')) return id.toLowerCase().trim()
  }

  // Strategy 2: span[email] attribute
  const emailSpans = document.querySelectorAll('span[email]')
  for (const el of emailSpans) {
    const e = el.getAttribute('email') || ''
    if (e.includes('@')) return e.toLowerCase().trim()
  }

  // Strategy 3: [data-email] attribute
  const dataEmail = document.querySelectorAll('[data-email]')
  for (const el of dataEmail) {
    const e = el.getAttribute('data-email') || ''
    if (e.includes('@')) return e.toLowerCase().trim()
  }

  // Strategy 4: look inside the open email thread for a "From:" address in aria labels
  const fromEls = document.querySelectorAll('[aria-label]')
  for (const el of fromEls) {
    const lbl = el.getAttribute('aria-label') || ''
    const match = lbl.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)
    if (match && !match[0].includes('google')) return match[0].toLowerCase().trim()
  }

  return null
}

function extractSenderName() {
  // Try to find name from hovercard element's visible text
  const hoverEls = document.querySelectorAll('[data-hovercard-id]')
  for (const el of hoverEls) {
    const id = el.getAttribute('data-hovercard-id') || ''
    if (id.includes('@')) {
      const text = el.textContent.trim()
      if (text && !text.includes('@')) return text
    }
  }
  return null
}

function extractSubject() {
  // Gmail subject: h2.hP or the document title
  const h2 = document.querySelector('h2.hP')
  if (h2) return h2.textContent.trim()
  const title = document.title
  return title.replace(' - Gmail', '').replace(' - Google Mail', '').trim()
}

// ─── LEAD LOOKUP ─────────────────────────────────────────────
async function loadLead(email) {
  const tok = await getValidToken()
  if (!tok) {
    setBody('<div class="sg-status err">Not signed in. Open the Sonar extension popup and sign in.</div>')
    return
  }
  _token = tok

  setBody(`<div class="sg-status"><span class="sg-spinner"></span> Looking up ${email}…</div>`)

  try {
    const r = await fetch(`${GMAIL_API_BASE}/leads/by-email?email=${encodeURIComponent(email)}`, {
      headers: { Authorization: 'Bearer ' + _token }
    })
    if (r.status === 401) {
      // Token expired — try one refresh
      try {
        _token = await _refreshToken()
        const r2 = await fetch(`${GMAIL_API_BASE}/leads/by-email?email=${encodeURIComponent(email)}`, {
          headers: { Authorization: 'Bearer ' + _token }
        })
        if (!r2.ok) throw new Error('HTTP ' + r2.status)
        const data2 = await r2.json()
        if (!data2.lead) renderNotFound(email); else renderLead(data2.lead)
        return
      } catch {
        setBody('<div class="sg-status err">Session expired. Open the Sonar popup and sign in again.</div>')
        return
      }
    }
    if (!r.ok) throw new Error('HTTP ' + r.status)
    const data = await r.json()
    if (!data.lead) renderNotFound(email); else renderLead(data.lead)
  } catch (e) {
    setBody(`<div class="sg-status err">Error: ${e.message}</div>`)
  }
}

// ─── RENDER: NOT IN PIPELINE ─────────────────────────────────
function renderNotFound(email) {
  const senderName = extractSenderName() || ''
  const subject = extractSubject()

  setBody(`
    <div class="sg-section">
      <div class="sg-label">Sender</div>
      <div class="sg-name">${senderName || 'Unknown'}</div>
      <div class="sg-email">${email}</div>
      <div style="margin-top:10px;font-size:10px;color:#444;line-height:1.5;">Not in your Sonar pipeline.</div>
    </div>
    <div class="sg-section">
      <div class="sg-label">Add to Pipeline</div>
      <div class="sg-row">
        <button class="sg-btn pri" id="sg-add-btn">Add Lead</button>
      </div>
    </div>
    <div class="sg-section">
      <div class="sg-label">Reply Draft</div>
      <button class="sg-btn" id="sg-draft-btn">AI Draft Reply</button>
      <div id="sg-draft-out"></div>
    </div>
  `)

  document.getElementById('sg-add-btn').addEventListener('click', async () => {
    const btn = document.getElementById('sg-add-btn')
    btn.disabled = true; btn.textContent = 'Adding…'
    try {
      const payload = {
        name: senderName || email.split('@')[0],
        email: email,
        status: 'new',
        scraped_at: new Date().toISOString(),
      }
      const r = await fetch(`${GMAIL_API_BASE}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _token },
        body: JSON.stringify(payload)
      })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const result = await r.json()
      await loadLead(email)
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Add Lead'
      btn.style.borderColor = 'rgba(239,68,68,0.4)'; btn.style.color = '#ef4444'
    }
  })

  document.getElementById('sg-draft-btn').addEventListener('click', () => {
    draftReply(null, senderName, email, subject)
  })
}

// ─── RENDER: IN PIPELINE ─────────────────────────────────────
function renderLead(lead) {
  const icpCls = lead.icp_score >= 70 ? 'score-hi' : lead.icp_score >= 40 ? 'score-md' : 'score-lo'
  const hasEnrollments = lead.enrollments?.length > 0
  const hasActivity = lead.recent_activity?.length > 0

  const enrollRows = hasEnrollments
    ? lead.enrollments.map(e => `
        <div class="sg-seq-row">
          <span class="sg-seq-name">${e.sequences?.name || 'Sequence'}</span>
          <span class="sg-seq-status">${e.status}</span>
        </div>`).join('')
    : '<div style="font-size:10px;color:#444;padding:4px 0;">No active sequences.</div>'

  const activityRows = hasActivity
    ? lead.recent_activity.map(a => `
        <div class="sg-activity-row">
          <div class="sg-activity-dot"></div>
          <div>
            <div class="sg-activity-type">${a.type || 'note'}</div>
            ${a.note ? `<div class="sg-activity-note">${a.note}</div>` : ''}
            <div class="sg-activity-date">${new Date(a.created_at).toLocaleDateString()}</div>
          </div>
        </div>`).join('')
    : '<div style="font-size:10px;color:#444;padding:4px 0;">No recent activity.</div>'

  setBody(`
    <div class="sg-section">
      <div class="sg-label">Lead</div>
      <div class="sg-name">${lead.name || '—'}</div>
      <div class="sg-sub">${[lead.title, lead.company].filter(Boolean).join(' · ') || '—'}</div>
      <div class="sg-email">${lead.email || ''}</div>
      <div class="sg-badges">
        <span class="sg-badge sg-badge-in">In Sonar</span>
        ${lead.status ? `<span class="sg-badge sg-badge-stage">${lead.status}</span>` : ''}
        ${lead.icp_score != null ? `<span class="sg-badge sg-badge-${icpCls}" title="${lead.icp_score_reason || ''}">ICP ${lead.icp_score}</span>` : ''}
        ${lead.starred ? `<span class="sg-badge sg-badge-score-hi">Starred</span>` : ''}
      </div>
    </div>

    <div class="sg-section">
      <div class="sg-label">Quick Actions</div>
      <div class="sg-row" style="margin-bottom:6px;">
        <button class="sg-btn" id="sg-score-btn">${lead.icp_score != null ? 'Re-score ICP' : 'Score ICP'}</button>
        <button class="sg-btn grn" id="sg-view-btn">View in Sonar</button>
      </div>
      <div class="sg-row">
        <button class="sg-btn" id="sg-draft-btn">Draft Reply</button>
        <button class="sg-btn" id="sg-note-toggle">Log Note</button>
      </div>
      <div id="sg-note-area" style="display:none;margin-top:8px;">
        <textarea class="sg-note-input" id="sg-note-input" rows="3" placeholder="Add a note about this email…"></textarea>
        <button class="sg-btn pri" id="sg-note-save">Save Note</button>
      </div>
    </div>

    <div class="sg-section">
      <div class="sg-label">Sequences</div>
      ${enrollRows}
      <div style="margin-top:8px;">
        <select class="sg-seq-picker" id="sg-seq-picker">
          <option value="">Enroll in sequence…</option>
        </select>
        <button class="sg-btn pri" id="sg-enroll-btn" style="display:none;">Enroll</button>
      </div>
    </div>

    <div class="sg-section">
      <div class="sg-label">Recent Activity</div>
      ${activityRows}
    </div>

    <div id="sg-draft-section" style="display:none;" class="sg-section">
      <div class="sg-label">Reply Draft</div>
      <div id="sg-draft-out" class="sg-draft-result"></div>
      <button class="sg-copy-btn" id="sg-copy-draft">Copy to clipboard</button>
    </div>
  `)

  // Wire buttons
  document.getElementById('sg-view-btn').addEventListener('click', () => {
    window.open(`https://sonarleads.vercel.app/leads`, '_blank')
  })

  document.getElementById('sg-score-btn').addEventListener('click', () => scoreICP(lead.id))

  document.getElementById('sg-draft-btn').addEventListener('click', () => {
    draftReply(lead.id, lead.name, lead.email, extractSubject())
  })

  document.getElementById('sg-note-toggle').addEventListener('click', () => {
    const area = document.getElementById('sg-note-area')
    const btn = document.getElementById('sg-note-toggle')
    const open = area.style.display === 'none'
    area.style.display = open ? 'block' : 'none'
    btn.textContent = open ? 'Cancel' : 'Log Note'
    if (open) document.getElementById('sg-note-input').focus()
  })

  document.getElementById('sg-note-save').addEventListener('click', () => saveNote(lead.id))

  loadSequences(lead.id)
}

// ─── SCORE ICP ───────────────────────────────────────────────
async function scoreICP(leadId) {
  const btn = document.getElementById('sg-score-btn')
  if (!btn) return
  btn.disabled = true; btn.textContent = 'Scoring…'
  try {
    const r = await fetch(`${GMAIL_API_BASE}/leads/${leadId}/score-icp`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + _token }
    })
    if (!r.ok) throw new Error()
    const data = await r.json()
    btn.textContent = `ICP: ${data.score}`
    btn.style.color = data.score >= 70 ? '#22c55e' : data.score >= 40 ? '#fbbf24' : '#888'
    btn.disabled = false
  } catch {
    btn.textContent = 'Score ICP'; btn.disabled = false
  }
}

// ─── LOG NOTE ────────────────────────────────────────────────
async function saveNote(leadId) {
  const input = document.getElementById('sg-note-input')
  const note = input?.value.trim()
  if (!note) return
  const btn = document.getElementById('sg-note-save')
  btn.disabled = true; btn.textContent = 'Saving…'
  try {
    await fetch(`${GMAIL_API_BASE}/leads/${leadId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _token },
      body: JSON.stringify({ type: 'email', note })
    })
    input.value = ''
    document.getElementById('sg-note-area').style.display = 'none'
    document.getElementById('sg-note-toggle').textContent = 'Log Note'
    btn.textContent = '✓ Saved'; btn.style.color = '#22c55e'
    setTimeout(() => { if (btn) { btn.textContent = 'Save Note'; btn.disabled = false; btn.style.color = '' } }, 2000)
  } catch {
    btn.disabled = false; btn.textContent = 'Save Note'
  }
}

// ─── DRAFT REPLY ─────────────────────────────────────────────
async function draftReply(leadId, name, email, subject) {
  const btn = document.getElementById('sg-draft-btn')
  if (btn) { btn.disabled = true; btn.textContent = 'Drafting…' }

  const draftSection = document.getElementById('sg-draft-section')
  const draftOut = document.getElementById('sg-draft-out')
  const copyBtn = document.getElementById('sg-copy-draft')

  if (draftSection) draftSection.style.display = 'block'
  if (draftOut) draftOut.innerHTML = '<span class="sg-spinner"></span>'

  try {
    let result
    if (leadId) {
      const r = await fetch(`${GMAIL_API_BASE}/leads/${leadId}/draft-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _token },
        body: JSON.stringify({ context: `Replying to email with subject: ${subject}` })
      })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      result = await r.json()
    } else {
      // Not in pipeline — draft a generic outreach
      const r = await fetch(`${GMAIL_API_BASE}/leads/draft-cold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _token },
        body: JSON.stringify({ name, email, subject })
      })
      if (r.ok) result = await r.json()
      else result = { subject: `Re: ${subject}`, body: `Hi ${name || 'there'},\n\nThanks for reaching out. ` }
    }
    const text = `Subject: ${result.subject}\n\n${result.body}`
    if (draftOut) draftOut.textContent = text
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = '✓ Copied!'
          setTimeout(() => { if (copyBtn) copyBtn.textContent = 'Copy to clipboard' }, 2000)
        })
      }, { once: true })
    }
  } catch (e) {
    if (draftOut) draftOut.textContent = 'Draft failed: ' + e.message
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Draft Reply' }
  }
}

// ─── LOAD SEQUENCES ──────────────────────────────────────────
async function loadSequences(leadId) {
  const picker = document.getElementById('sg-seq-picker')
  const enrollBtn = document.getElementById('sg-enroll-btn')
  if (!picker) return

  try {
    if (!_seqCache) {
      const r = await fetch(`${GMAIL_API_BASE}/sequences`, {
        headers: { Authorization: 'Bearer ' + _token }
      })
      if (r.ok) _seqCache = (await r.json()).sequences || []
      else _seqCache = []
    }
    _seqCache.forEach(s => {
      const opt = document.createElement('option')
      opt.value = s.id; opt.textContent = s.name
      picker.appendChild(opt)
    })

    picker.addEventListener('change', () => {
      if (enrollBtn) enrollBtn.style.display = picker.value ? 'block' : 'none'
    })

    if (enrollBtn) {
      enrollBtn.addEventListener('click', async () => {
        const seqId = picker.value; if (!seqId) return
        enrollBtn.disabled = true; enrollBtn.textContent = 'Enrolling…'
        try {
          await fetch(`${GMAIL_API_BASE}/sequences/${seqId}/enroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + _token },
            body: JSON.stringify({ lead_ids: [leadId] })
          })
          enrollBtn.textContent = '✓ Enrolled'; enrollBtn.style.color = '#22c55e'
          picker.style.display = 'none'
        } catch {
          enrollBtn.disabled = false; enrollBtn.textContent = 'Enroll'
        }
      })
    }
  } catch {}
}

// ─── NAVIGATION DETECTION ────────────────────────────────────
function handleUrlChange() {
  const url = window.location.href
  if (url === _lastUrl) return
  _lastUrl = url

  // Gmail opens individual emails at #inbox/<id> or #all/<id> etc.
  const isThreadOpen = /[#/](inbox|sent|all|search|label|starred|important)\/[a-zA-Z0-9]+/.test(url) ||
                       /[#/][a-zA-Z0-9]{16}$/.test(url)

  if (isThreadOpen) {
    // Give Gmail time to render the email DOM
    setTimeout(() => detectAndLoad(), 800)
    setTimeout(() => detectAndLoad(), 1800)
  }
}

function detectAndLoad() {
  const email = extractSenderEmail()
  if (!email || email === _currentEmail) return
  _currentEmail = email
  if (_panelOpen) loadLead(email)
}

// ─── INIT ────────────────────────────────────────────────────
async function init() {
  _token = await getValidToken()
  injectStyles()
  createPanel()

  // Watch for URL changes (Gmail SPA)
  const urlObserver = new MutationObserver(handleUrlChange)
  urlObserver.observe(document.body, { childList: true, subtree: true })

  // Also listen to popstate/hashchange
  window.addEventListener('popstate', handleUrlChange)
  window.addEventListener('hashchange', handleUrlChange)

  // Initial check
  handleUrlChange()
}

// Wait for document.body before running
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
