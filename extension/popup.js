// API_BASE_URL defined in config.js

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

function setStatus(msg, type) {
  const el = document.getElementById('statusMsg')
  el.textContent = msg
  el.className = 'status-msg show ' + (type === 'error' ? 'err' : 'ok')
}

function clearStatus() {
  const el = document.getElementById('statusMsg'); if (el) el.className = 'status-msg'
}

// ─── JWT UTILITIES ────────────────────────────────────────────

function _jwtExpiresAt(token) {
  try { return (JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp || 0) * 1000 } catch { return 0 }
}

async function getValidToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['token'], (s) => {
      if (!s.token) { reject(new Error('No token')); return }
      const exp = _jwtExpiresAt(s.token)
      if (exp > 0 && Date.now() > exp - 60_000) { reject(new Error('Expired')); return }
      resolve(s.token)
    })
  })
}

// ─── STATS CACHE ──────────────────────────────────────────────

const STATS_TTL = 60_000

async function loadStats(token) {
  chrome.storage.session.get(['statsCache'], async (s) => {
    const cached = s.statsCache
    if (cached && Date.now() - cached.ts < STATS_TTL) {
      applyStats(cached); return
    }
    try {
      const r = await fetch(API_BASE_URL + '/dashboard/summary', { headers: { Authorization: 'Bearer ' + token } })
      if (!r.ok) return
      const d = await r.json()
      const stats = {
        leads:     d.leads?.total || 0,
        companies: d.companies?.total || 0,
        seqs:      d.sequences?.active_count || 0,
        ts:        Date.now(),
      }
      chrome.storage.session.set({ statsCache: stats })
      applyStats(stats)
    } catch {}
  })
}

function applyStats(stats) {
  const l = document.getElementById('statLeads'); if (l) l.textContent = stats.leads
  const c = document.getElementById('statCompanies'); if (c) c.textContent = stats.companies
  const s = document.getElementById('statSeqs'); if (s) s.textContent = stats.seqs
}

function invalidateStatsCache() { chrome.storage.session.remove('statsCache') }

// ─── LOGIN ───────────────────────────────────────────────────

document.getElementById('loginBtn').addEventListener('click', async () => {
  const btn = document.getElementById('loginBtn')
  const email = document.getElementById('loginEmail').value.trim()
  const password = document.getElementById('loginPassword').value
  const errEl = document.getElementById('loginError')
  if (!email || !password) { errEl.textContent = 'Enter email and password.'; errEl.className = 'err-msg show'; return }
  btn.disabled = true; btn.querySelector('span').textContent = 'Signing in…'; errEl.className = 'err-msg'
  try {
    const r = await fetch(API_BASE_URL + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    if (!r.ok) throw new Error('Invalid credentials')
    const data = await r.json()
    chrome.storage.local.set({ token: data.access_token, userEmail: email }, () => initMain(data.access_token, email))
  } catch {
    errEl.textContent = 'Invalid email or password.'; errEl.className = 'err-msg show'
    btn.disabled = false; btn.querySelector('span').textContent = 'Sign in'
  }
})

document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginBtn').click() })

// ─── MAIN SCREEN ─────────────────────────────────────────────

function initMain(token, email) {
  show('mainScreen')
  const dot = document.getElementById('onlineDot'); if (dot) dot.classList.add('on')
  loadStats(token)
  detectPage(token)
}

function detectPage(token) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || ''
    const clean = url.split('?')[0].split('#')[0]
    const type = detectPageType(url)

    const dotEl  = document.getElementById('pageDot')
    const label  = document.getElementById('pageTypeLabel')
    const extBtn = document.getElementById('extractBtn')
    const scrollBtn = document.getElementById('autoScrollBtn')
    const tip    = document.getElementById('peopleTip')
    const enrichBtn = document.getElementById('enrichProfileBtn')
    const card   = document.getElementById('profileCard')

    const TYPE_LABELS = {
      'gmail':              'Gmail — Sidebar Active',
      'salenav-companies':  'Sales Nav Accounts',
      'salenav-people':     'Sales Nav People',
      'salenav-company':    'Sales Nav Company',
      'linkedin-companies': 'Company Search',
      'linkedin-all-search':'LinkedIn Search',
      'company-people':     'People Page — Ready',
      'company':            'Company Page',
      'profile':            'Profile Page',
      'search':             'People Search',
    }

    enrichBtn.style.display = 'none'
    scrollBtn.style.display = 'none'
    tip.style.display = 'none'
    if (card) card.className = 'profile-card'
    clearStatus()

    if (type === 'gmail') {
      label.textContent = TYPE_LABELS['gmail']
      label.className = 'ok'
      if (dotEl) dotEl.className = 'page-dot ok'
      extBtn.disabled = true
      extBtn.querySelector('span').textContent = 'Open email to activate sidebar'
      return
    }

    if (type === 'unknown') {
      label.textContent = 'Not a LinkedIn page'
      extBtn.disabled = true
      return
    }

    label.textContent = TYPE_LABELS[type] || type
    label.className = 'li'
    if (dotEl) dotEl.className = 'page-dot li'
    extBtn.disabled = false

    if (type === 'company-people') {
      scrollBtn.style.display = 'flex'
      tip.style.display = 'block'
    }

    if (type === 'profile') {
      loadProfileCard(clean, token)
    }
  })
}

function detectPageType(url) {
  if (!url) return 'unknown'
  if (url.includes('mail.google.com')) return 'gmail'
  if (url.includes('linkedin.com/sales/search/company')) return 'salenav-companies'
  if (url.includes('linkedin.com/sales/search/people')) return 'salenav-people'
  if (url.includes('linkedin.com/sales/company/')) return 'salenav-company'
  if (url.includes('linkedin.com/search/results/companies')) return 'linkedin-companies'
  if (url.includes('linkedin.com/search/results/people')) return 'search'
  if (url.includes('linkedin.com/search/results/all')) return 'linkedin-all-search'
  if (url.includes('linkedin.com/company/') && url.includes('/people')) return 'company-people'
  if (url.includes('linkedin.com/company/')) return 'company'
  if (url.includes('linkedin.com/in/')) return 'profile'
  return 'unknown'
}

function loadProfileCard(url, token) {
  const cacheKey = 'pc_' + btoa(url).slice(0, 36)
  chrome.storage.session.get([cacheKey], (s) => {
    const cached = s[cacheKey]
    if (cached && Date.now() - cached.ts < 90_000) { applyProfileCard(cached); return }
    fetch(API_BASE_URL + '/leads/by-profile-url?url=' + encodeURIComponent(url), { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const entry = { lead: data?.lead || null, ts: Date.now() }
        chrome.storage.session.set({ [cacheKey]: entry })
        applyProfileCard(entry)
      }).catch(() => {})
  })
}

function applyProfileCard(entry) {
  const lead = entry.lead
  const card = document.getElementById('profileCard')
  const enrichBtn = document.getElementById('enrichProfileBtn')
  const dotEl = document.getElementById('pageDot')
  const label = document.getElementById('pageTypeLabel')
  if (!card) return

  card.className = 'profile-card show'

  if (lead) {
    document.getElementById('pcName').textContent = lead.name || '—'
    document.getElementById('pcSub').textContent = [lead.title, lead.company].filter(Boolean).join(' · ')
    const badges = document.getElementById('pcBadges')
    let html = '<span class="pc-badge in">In Sonar</span>'
    if (lead.stage) html += `<span class="pc-badge stage">${lead.stage}</span>`
    if (lead.icp_score != null) {
      const cls = lead.icp_score >= 70 ? 'icp-hi' : lead.icp_score >= 40 ? 'icp-md' : 'stage'
      html += `<span class="pc-badge ${cls}">ICP ${lead.icp_score}</span>`
    }
    badges.innerHTML = html
    enrichBtn.style.display = 'flex'
    enrichBtn.dataset.leadId = lead.id
    if (dotEl) dotEl.className = 'page-dot ok'
    label.textContent = 'In Sonar Pipeline'
    label.className = 'ok'
  } else {
    document.getElementById('pcName').textContent = 'Not in pipeline'
    document.getElementById('pcSub').textContent = 'Click "Extract" to add this lead'
    document.getElementById('pcBadges').innerHTML = ''
  }
}

// ─── AUTO SCROLL ─────────────────────────────────────────────

document.getElementById('autoScrollBtn').addEventListener('click', () => {
  const btn = document.getElementById('autoScrollBtn')
  btn.querySelector('span').textContent = 'Scrolling…'; btn.disabled = true
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.runtime.sendMessage({ action: 'injectAndAutoScroll', tabId: tabs[0].id }, (response) => {
      if (response?.success) {
        btn.querySelector('span').textContent = '✓ ' + response.count + ' profiles loaded'
        setTimeout(() => { btn.querySelector('span').textContent = 'Auto-scroll to load all profiles'; btn.disabled = false }, 3500)
      } else {
        btn.querySelector('span').textContent = 'Auto-scroll to load all profiles'; btn.disabled = false
        setStatus('Auto-scroll failed. Refresh and try again.', 'error')
      }
    })
  })
})

// ─── SYNC EXISTING LEAD ──────────────────────────────────────

document.getElementById('enrichProfileBtn').addEventListener('click', async () => {
  const btn = document.getElementById('enrichProfileBtn')
  const leadId = btn.dataset.leadId; if (!leadId) return
  btn.disabled = true; btn.querySelector('span').textContent = 'Scraping…'; clearStatus()
  let token; try { token = await getValidToken() } catch { setStatus('Session expired.', 'error'); show('loginScreen'); return }
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.runtime.sendMessage({ action: 'injectAndScrape', tabId: tabs[0].id }, (res) => {
      btn.disabled = false; btn.querySelector('span').textContent = 'Sync full profile data'
      if (!res?.success || res.data?.type !== 'profile') { setStatus('Could not read profile.', 'error'); return }
      const d = res.data
      const patch = {}
      if (d.name) patch.name = d.name; if (d.title) patch.title = d.title; if (d.company) patch.company = d.company
      if (d.location) patch.location = d.location; if (d.about) patch.about = d.about; if (d.experiences?.length) patch.experience = d.experiences
      fetch(API_BASE_URL + '/leads/' + leadId, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(patch) })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
        .then(() => setStatus('✓ Lead synced with full profile.', 'success'))
        .catch(e => setStatus('Sync failed: ' + e.message, 'error'))
    })
  })
})

// ─── EXTRACT ─────────────────────────────────────────────────

document.getElementById('extractBtn').addEventListener('click', async () => {
  const btn = document.getElementById('extractBtn')
  btn.disabled = true; btn.querySelector('span').textContent = 'Extracting…'; clearStatus()
  let token; try { token = await getValidToken() } catch { setStatus('Session expired.', 'error'); show('loginScreen'); btn.disabled = false; btn.querySelector('span').textContent = 'Extract leads from page'; return }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.runtime.sendMessage({ action: 'injectAndScrape', tabId: tabs[0].id }, (bgRes) => {
      btn.disabled = false; btn.querySelector('span').textContent = 'Extract leads from page'
      if (chrome.runtime.lastError || !bgRes) { setStatus('Could not connect. Refresh LinkedIn.', 'error'); return }
      if (!bgRes.success) { setStatus('Failed: ' + (bgRes.error || 'Unknown error'), 'error'); return }

      const data = bgRes.data
      if (!data) { setStatus('No data returned.', 'error'); return }
      if (data.error) { setStatus(data.error, 'error'); return }

      if (data.type === 'company-list') {
        if (!data.companies?.length) { setStatus('No companies found.', 'error'); return }
        showCompanySelectionScreen(data.companies, token); return
      }

      if (data.type === 'company') {
        if (!data.name) { setStatus('Could not read company.', 'error'); return }
        saveCompany(data, token); setStatus('Company "' + data.name + '" saved.', 'success'); invalidateStatsCache(); return
      }

      let leads = []
      if (data.type === 'search') {
        if (!data.leads?.length) { setStatus('No profiles found. Scroll down first.', 'error'); return }
        leads = data.leads.filter(l => l.name?.trim()).map(l => ({
          name: l.name.trim(), title: l.title?.trim() || null, company: l.company?.trim() || null,
          location: l.location?.trim() || null, profile_url: l.profileUrl?.trim() || null,
          scraped_at: l.scrapedAt || new Date().toISOString(), status: 'new',
          followers_count: l.followers || data.companyFollowers || null,
          employee_count: l.employeeCount || data.companySize || null,
          appointment: l.appointment || null,
        }))
      } else if (data.type === 'profile') {
        if (!data.name) { setStatus('Could not read profile.', 'error'); return }
        leads = [{ name: data.name.trim(), title: data.title?.trim() || null, company: data.company?.trim() || null, location: data.location?.trim() || null, profile_url: data.profileUrl?.trim() || null, scraped_at: data.scrapedAt || new Date().toISOString(), status: 'new', followers_count: data.followers || null, appointment: data.appointment || null }]
      }

      if (!leads.length) { setStatus('No valid leads found.', 'error'); return }
      setStatus('Found ' + leads.length + ' profiles. Saving…', 'ok')

      if (data.companyName && data.companySize) {
        fetch(API_BASE_URL + '/companies/size-by-name', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ name: data.companyName, size: data.companySize }) }).catch(() => {})
      }

      fetch(API_BASE_URL + '/leads/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ leads }) })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
        .then(result => {
          const ins = result.inserted || 0, sk = result.skipped || 0
          if (ins > 0) setStatus('✓ ' + ins + ' lead' + (ins > 1 ? 's' : '') + ' saved.' + (sk > 0 ? ' (' + sk + ' dupes skipped)' : ''), 'ok')
          else if (sk > 0) setStatus(sk + ' leads already in dashboard.', 'error')
          else setStatus('No leads saved. Try again.', 'error')
          invalidateStatsCache(); loadStats(token)
        })
        .catch(e => setStatus('Sync failed: ' + e.message, 'error'))
    })
  })
})

// ─── COMPANY SELECTION OVERLAY ───────────────────────────────

function showCompanySelectionScreen(companies, token) {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:#0f0f0f;z-index:100;display:flex;flex-direction:column;overflow:hidden;font-family:"IBM Plex Mono",monospace'
  overlay.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #222">
      <div>
        <p style="font-size:8px;letter-spacing:.14em;text-transform:uppercase;color:#555;margin-bottom:3px">Select companies</p>
        <p style="font-size:16px;font-weight:700;color:#fff">${companies.length} found</p>
      </div>
      <button id="selAll" style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#E7000B;background:rgba(231,0,11,.08);border:1px solid rgba(231,0,11,.2);border-radius:4px;padding:5px 10px;cursor:pointer;font-family:inherit">Select all</button>
    </div>
    <div id="coList" style="flex:1;overflow-y:auto;padding:10px 16px;display:flex;flex-direction:column;gap:6px">
      ${companies.map((c, i) => `
        <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#161616;border-radius:6px;cursor:pointer;border:1px solid #222">
          <input type="checkbox" value="${i}" checked style="accent-color:#E7000B;width:13px;height:13px;flex-shrink:0" />
          <div style="overflow:hidden;flex:1;min-width:0">
            <p style="font-size:11px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</p>
            <p style="font-size:9px;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${c.industry || c.headquarters || '—'}</p>
          </div>
        </label>`).join('')}
    </div>
    <div style="display:flex;gap:8px;padding:12px 16px 14px;border-top:1px solid #222;flex-shrink:0">
      <button id="selCancel" style="flex:1;padding:9px;background:none;border:1px solid #222;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#555;cursor:pointer;font-family:inherit">Cancel</button>
      <button id="selSave" style="flex:2;padding:9px;background:#E7000B;border:none;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;cursor:pointer;font-family:inherit">Save selected →</button>
    </div>`
  document.body.appendChild(overlay)
  let allSel = true
  overlay.querySelector('#selAll').addEventListener('click', () => { allSel = !allSel; overlay.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = allSel); overlay.querySelector('#selAll').textContent = allSel ? 'Select all' : 'Deselect all' })
  overlay.querySelector('#selCancel').addEventListener('click', () => { overlay.remove(); setStatus('Cancelled.', 'error') })
  overlay.querySelector('#selSave').addEventListener('click', () => {
    const sel = []; overlay.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => sel.push(companies[parseInt(cb.value)])); overlay.remove()
    if (!sel.length) { setStatus('None selected.', 'error'); return }
    setStatus('Saving ' + sel.length + ' companies…', 'ok')
    saveCompanyList(sel, token)
  })
}

function saveCompanyList(companies, token) {
  fetch(API_BASE_URL + '/companies/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ companies }) })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
    .then(result => {
      const ins = result.inserted || 0, sk = result.skipped || 0
      if (ins > 0) setStatus('✓ ' + ins + ' companies saved.' + (sk > 0 ? ' ' + sk + ' dupes.' : ''), 'ok')
      else setStatus('All already in dashboard.', 'error')
      invalidateStatsCache()
    })
    .catch(e => setStatus('Failed: ' + e.message, 'error'))
}

function saveCompany(data, token) {
  fetch(API_BASE_URL + '/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ name: data.name, industry: data.industry || null, size: data.size || null, website: data.website || null, headquarters: data.headquarters || null, description: data.description || null, linkedin_url: data.url || null, followers: data.followers || null })
  }).catch(e => console.error('Company save:', e))
}

// ─── NAV ─────────────────────────────────────────────────────

document.getElementById('dashboardBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://sonarleads.vercel.app' })
})

document.getElementById('logoutBtn').addEventListener('click', () => {
  chrome.storage.local.remove(['token', 'userEmail'], () => {
    show('loginScreen')
    document.getElementById('loginEmail').value = ''
    document.getElementById('loginPassword').value = ''
  })
})

// ─── INIT ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['token', 'userEmail'], (data) => {
    if (data.token) initMain(data.token, data.userEmail)
    else show('loginScreen')
  })
})
