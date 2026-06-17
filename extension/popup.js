// API_BASE_URL URL is now defined in config.js

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

function setStatus(msg, type) {
  const el = document.getElementById('statusMsg')
  el.textContent = msg
  el.className = 'sl-status-msg show ' + type
}

function clearStatus() {
  document.getElementById('statusMsg').className = 'sl-status-msg'
}

function showLoginError(msg) {
  const el = document.getElementById('loginError')
  el.textContent = msg
  el.className = 'sl-error-msg show'
}

function detectPageType(url) {
  if (!url) return 'unknown'
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

// Decode JWT expiry locally — no network round-trip needed
function _jwtExpiresAt(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return (payload.exp || 0) * 1000
  } catch { return 0 }
}

// Lead count cache: { count, ts } stored in chrome.storage.session (cleared on browser restart)
const LEAD_COUNT_TTL = 60_000

function updateLeadCount(token) {
  chrome.storage.session.get(['leadCountCache'], (stored) => {
    const cache = stored.leadCountCache
    if (cache && Date.now() - cache.ts < LEAD_COUNT_TTL) {
      const el = document.getElementById('leadCount')
      if (el) el.textContent = cache.count
      return
    }
    fetch(API_BASE_URL + '/leads', { headers: { Authorization: 'Bearer ' + token } })
      .then((r) => r.json())
      .then((data) => {
        const count = data.leads ? data.leads.length : 0
        const el = document.getElementById('leadCount')
        if (el) el.textContent = count
        chrome.storage.session.set({ leadCountCache: { count, ts: Date.now() } })
      })
      .catch(() => {})
  })
}

// Call this after extracting leads so the count cache is invalidated
function invalidateLeadCountCache() {
  chrome.storage.session.remove('leadCountCache')
}

async function loginApi(email, password) {
  const res = await fetch(API_BASE_URL + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) throw new Error('Invalid credentials')
  return res.json()
}

// Validate token locally via JWT expiry — avoids a network call on every popup open
async function getValidToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['token'], (stored) => {
      const token = stored.token
      if (!token) { reject(new Error('No token')); return }
      const expiresAt = _jwtExpiresAt(token)
      // Allow up to 60s clock skew; if expiry unknown (0) assume valid
      if (expiresAt > 0 && Date.now() > expiresAt - 60_000) {
        reject(new Error('Token expired - please sign in again'))
      } else {
        resolve(token)
      }
    })
  })
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['token', 'userEmail'], (data) => {
    if (data.token) {
      initMainScreen(data.token, data.userEmail)
    } else {
      show('loginScreen')
    }
  })
})

// ─── LOGIN ────────────────────────────────────────────────────

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim()
  const password = document.getElementById('loginPassword').value
  const btn = document.getElementById('loginBtn')
  if (!email || !password) { showLoginError('Please enter email and password.'); return }
  btn.disabled = true
  btn.querySelector('span').textContent = 'Signing in...'
  try {
    const data = await loginApi(email, password)
    chrome.storage.local.set({
      token: data.access_token,
      userEmail: email
    }, () => {
      initMainScreen(data.access_token, email)
    })
  } catch (err) {
    showLoginError('Invalid email or password.')
    btn.disabled = false
    btn.querySelector('span').textContent = 'Sign in'
  }
})

document.getElementById('loginPassword').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('loginBtn').click()
})

// ─── MAIN SCREEN ─────────────────────────────────────────────

function initMainScreen(token, email) {
  show('mainScreen')
  const dot = document.getElementById('statusDot')
  if (dot) dot.className = 'sl-status-dot online'

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0] ? tabs[0].url : ''
    const cleanedUrl = url.split('?')[0].split('#')[0]
    const type = detectPageType(url)
    const badge = document.getElementById('pageBadge')
    const label = document.getElementById('pageTypeLabel')
    const extractBtn = document.getElementById('extractBtn')
    const autoScrollBtn = document.getElementById('autoScrollBtn')
    const peopleTip = document.getElementById('peopleTip')
    const enrichBtn = document.getElementById('enrichProfileBtn')

    const typeLabels = {
      'salenav-companies': 'SALES NAV ACCOUNTS',
      'salenav-people':    'SALES NAV PEOPLE',
      'salenav-company':   'SALES NAV COMPANY',
      'linkedin-companies':'COMPANY SEARCH',
      'linkedin-all-search':'LINKEDIN SEARCH',
      'company-people':    'PEOPLE PAGE — READY',
      'company':           'COMPANY PAGE',
      'profile':           'PROFILE PAGE',
      'search':            'PEOPLE SEARCH'
    }

    if (enrichBtn) enrichBtn.style.display = 'none'

    if (type === 'unknown') {
      label.textContent = 'NOT A LINKEDIN PAGE'
      extractBtn.disabled = true
      autoScrollBtn.style.display = 'none'
      peopleTip.style.display = 'none'
    } else {
      label.textContent = typeLabels[type] || type.toUpperCase()
      if (badge) badge.className = 'sl-page-badge linkedin'
      extractBtn.disabled = false
      autoScrollBtn.style.display = type === 'company-people' ? 'flex' : 'none'
      peopleTip.style.display = type === 'company-people' ? 'block' : 'none'

      // On a profile page — check if this person is already in leads (cached per URL)
      if (type === 'profile' && enrichBtn) {
        const cacheKey = 'profileUrlCache_' + btoa(cleanedUrl).slice(0, 40)
        chrome.storage.session.get([cacheKey], (stored) => {
          const cached = stored[cacheKey]
          if (cached && Date.now() - cached.ts < 120_000) {
            if (cached.leadId) {
              enrichBtn.style.display = 'flex'
              enrichBtn.dataset.leadId = cached.leadId
              label.textContent = 'EXISTING LEAD'
            }
            return
          }
          fetch(API_BASE_URL + '/leads/by-profile-url?url=' + encodeURIComponent(cleanedUrl), {
            headers: { Authorization: 'Bearer ' + token }
          })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              const leadId = data?.lead?.id || null
              chrome.storage.session.set({ [cacheKey]: { leadId, ts: Date.now() } })
              if (leadId) {
                enrichBtn.style.display = 'flex'
                enrichBtn.dataset.leadId = leadId
                label.textContent = 'EXISTING LEAD'
              }
            })
            .catch(() => {})
        })
      }
    }
  })

  updateLeadCount(token)
}

// ─── AUTO SCROLL ─────────────────────────────────────────────

document.getElementById('autoScrollBtn').addEventListener('click', () => {
  const btn = document.getElementById('autoScrollBtn')
  btn.querySelector('span').textContent = 'Scrolling…'
  btn.disabled = true

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.runtime.sendMessage(
      { action: 'injectAndAutoScroll', tabId: tabs[0].id },
      (response) => {
        if (response?.success) {
          btn.querySelector('span').textContent = '✓ Loaded ' + response.count + ' profiles'
          setTimeout(() => {
            btn.querySelector('span').textContent = 'Auto-scroll to load all profiles'
            btn.disabled = false
          }, 3500)
        } else {
          btn.querySelector('span').textContent = 'Auto-scroll to load all profiles'
          btn.disabled = false
          setStatus('Auto-scroll failed. Refresh and try again.', 'error')
        }
      }
    )
  })
})

// ─── ENRICH EXISTING LEAD ────────────────────────────────────

document.getElementById('enrichProfileBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('enrichProfileBtn')
  const leadId = btn.dataset.leadId
  if (!leadId) return
  btn.disabled = true
  btn.querySelector('span').textContent = 'Scraping…'
  clearStatus()

  let token
  try { token = await getValidToken() } catch (e) {
    setStatus('Session expired. Please sign in again.', 'error')
    show('loginScreen')
    btn.disabled = false
    btn.querySelector('span').textContent = 'Update this lead with full profile'
    return
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.runtime.sendMessage({ action: 'injectAndScrape', tabId: tabs[0].id }, (bgResponse) => {
      btn.disabled = false
      btn.querySelector('span').textContent = 'Update this lead with full profile'
      if (chrome.runtime.lastError || !bgResponse?.success) {
        setStatus('Scrape failed. Refresh LinkedIn and try again.', 'error')
        return
      }
      const d = bgResponse.data
      if (!d || d.error || d.type !== 'profile') { setStatus('Could not read profile.', 'error'); return }

      const patch = {
        name: d.name || undefined,
        title: d.title || undefined,
        company: d.company || undefined,
        location: d.location || undefined,
        about: d.about || undefined,
        experience: d.experiences && d.experiences.length > 0 ? d.experiences : undefined,
      }
      // remove undefined keys
      Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k])

      fetch(API_BASE_URL + '/leads/' + leadId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(patch)
      })
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
        .then(() => {
          setStatus('✓ Lead updated with full profile data.', 'success')
        })
        .catch(err => { setStatus('Update failed: ' + err.message, 'error') })
    })
  })
})

// ─── EXTRACT ─────────────────────────────────────────────────

document.getElementById('extractBtn').addEventListener('click', async () => {
  const btn = document.getElementById('extractBtn')
  btn.disabled = true
  btn.querySelector('span').textContent = 'Extracting...'
  clearStatus()

  let token
  try {
    token = await getValidToken()
  } catch (e) {
    setStatus('Session expired. Please sign in again.', 'error')
    show('loginScreen')
    btn.disabled = false
    btn.querySelector('span').textContent = 'Extract leads from page'
    return
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id

    chrome.runtime.sendMessage({ action: 'injectAndScrape', tabId }, (bgResponse) => {
      btn.disabled = false
      btn.querySelector('span').textContent = 'Extract leads from page'

      if (chrome.runtime.lastError || !bgResponse) {
        setStatus('Could not connect. Refresh LinkedIn and try again.', 'error')
        return
      }

      if (!bgResponse.success) {
        setStatus('Extraction failed: ' + (bgResponse.error || 'Unknown error'), 'error')
        return
      }

      const data = bgResponse.data
      if (!data) { setStatus('No data returned. Try again.', 'error'); return }
      if (data.error) { setStatus(data.error, 'error'); return }

      // Handle company list — show selection screen first
      if (data.type === 'company-list') {
        if (!data.companies || data.companies.length === 0) {
          setStatus('No companies found. Scroll down and retry.', 'error')
          return
        }
        showCompanySelectionScreen(data.companies, token)
        return
      }

      // Handle single company page
      if (data.type === 'company') {
        if (!data.name) { setStatus('Could not read company. Retry.', 'error'); return }
        saveCompany(data, token)
        setStatus('Company "' + data.name + '" saved.', 'success')
        updateLeadCount(token)
        return
      }

      // Build leads array
      let leads = []

      if (data.type === 'search') {
        if (!data.leads || data.leads.length === 0) {
          setStatus('No profiles found. Scroll down first then retry.', 'error')
          return
        }
        leads = data.leads
          .filter((l) => l.name && l.name.trim().length > 0)
          .map((l) => ({
            name: l.name.trim(),
            title: l.title ? l.title.trim() : null,
            company: l.company ? l.company.trim() : null,
            location: l.location ? l.location.trim() : null,
            profile_url: l.profileUrl ? l.profileUrl.trim() : null,
            scraped_at: l.scrapedAt || new Date().toISOString(),
            status: 'new',
            followers_count: l.followers || data.companyFollowers || null,
            employee_count: l.employeeCount || data.companySize || null,
            appointment: l.appointment || null,
          }))
      } else if (data.type === 'profile') {
        if (!data.name) { setStatus('Could not read profile. Scroll down and retry.', 'error'); return }
        leads = [{
          name: data.name.trim(),
          title: data.title ? data.title.trim() : null,
          company: data.company ? data.company.trim() : null,
          location: data.location ? data.location.trim() : null,
          profile_url: data.profileUrl ? data.profileUrl.trim() : null,
          scraped_at: data.scrapedAt || new Date().toISOString(),
          status: 'new',
          followers_count: data.followers || null,
          appointment: data.appointment || null,
        }]
      }

      if (leads.length === 0) {
        setStatus('No valid leads found. Scroll down and retry.', 'error')
        return
      }

      setStatus('Found ' + leads.length + ' profiles. Saving...', 'success')

      // If this is a company people page, also update the company's size with associated members count
      const companyName = data.companyName || ''
      const companySize = data.companySize || ''
      if (companyName && companySize) {
        fetch(API_BASE_URL + '/companies/size-by-name', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ name: companyName, size: companySize })
        }).catch(() => {})
      }

      fetch(API_BASE_URL + '/leads/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ leads: leads })
      })
        .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
        .then((result) => {
          const inserted = result.inserted || 0
          const skipped = result.skipped || 0
          if (inserted > 0) {
            setStatus('✓ ' + inserted + ' lead' + (inserted > 1 ? 's' : '') + ' saved.' + (skipped > 0 ? ' (' + skipped + ' duplicates skipped)' : ''), 'success')
          } else if (skipped > 0) {
            setStatus(skipped + ' leads already in dashboard.', 'error')
          } else {
            setStatus('No leads were saved. Try again.', 'error')
          }
          invalidateLeadCountCache(); updateLeadCount(token)
        })
        .catch((err) => { setStatus('Sync failed: ' + err.message, 'error') })
    })
  })
})

// ─── COMPANY SELECTION SCREEN ─────────────────────────────────

function showCompanySelectionScreen(companies, token) {
  const overlay = document.createElement('div')
  overlay.id = 'companySelectOverlay'
  overlay.style.cssText = `
    position: fixed; inset: 0; background: #fffcfc; z-index: 100;
    display: flex; flex-direction: column; padding: 0;
    font-family: 'IBM Plex Sans', sans-serif; overflow: hidden;
  `

  overlay.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px 14px; border-bottom:1px solid #dbd7da;">
      <div>
        <p style="font-family:'IBM Plex Mono',monospace; font-size:9px; letter-spacing:0.1em; color:#717a94; margin-bottom:4px; text-transform:uppercase;">Select companies</p>
        <p style="font-size:18px; font-weight:700; color:#01011b; letter-spacing:-0.3px;">${companies.length} found</p>
      </div>
      <button id="selectAllBtn" style="font-family:'DM Sans',sans-serif; font-size:11px; font-weight:500; color:#6f63b7; background:rgba(111,99,183,0.08); border:1px solid #9e91d6; border-radius:3px; padding:5px 10px; cursor:pointer;">Select all</button>
    </div>
    <div id="companyList" style="flex:1; overflow-y:auto; padding:12px 20px; display:flex; flex-direction:column; gap:6px;">
      ${companies.map((c, i) => `
        <label style="display:flex; align-items:center; gap:10px; padding:9px 12px; background:#ffffff; border-radius:5px; cursor:pointer; border:1px solid #dbd7da;">
          <input type="checkbox" value="${i}" checked style="accent-color:#6f63b7; cursor:pointer; flex-shrink:0; width:14px; height:14px;" />
          <div style="overflow:hidden; flex:1; min-width:0;">
            <p style="font-size:12px; font-weight:600; color:#01011b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</p>
            <p style="font-size:10px; color:#717a94; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px;">${c.industry || c.headquarters || '—'}</p>
          </div>
        </label>
      `).join('')}
    </div>
    <div style="display:flex; gap:8px; padding:12px 20px 16px; border-top:1px solid #dbd7da; flex-shrink:0;">
      <button id="cancelSelectBtn" style="flex:1; padding:9px; background:transparent; border:1px solid #dbd7da; border-radius:3px; font-size:12px; font-weight:500; color:#717a94; cursor:pointer; font-family:'DM Sans',sans-serif;">Cancel</button>
      <button id="saveSelectedBtn" style="flex:2; padding:9px; background:#ffffff; border:1px solid #31263b; border-radius:3px; font-size:12px; font-weight:600; color:#01011b; cursor:pointer; font-family:'DM Sans',sans-serif;">Save selected →</button>
    </div>
  `

  document.body.appendChild(overlay)

  let allSelected = true

  document.getElementById('selectAllBtn').addEventListener('click', () => {
    allSelected = !allSelected
    overlay.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = allSelected)
    document.getElementById('selectAllBtn').textContent = allSelected ? 'DESELECT ALL' : 'SELECT ALL'
  })

  document.getElementById('cancelSelectBtn').addEventListener('click', () => {
    overlay.remove()
    setStatus('Cancelled.', 'error')
  })

  document.getElementById('saveSelectedBtn').addEventListener('click', () => {
    const selected = []
    overlay.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
      selected.push(companies[parseInt(cb.value)])
    })
    overlay.remove()
    if (selected.length === 0) { setStatus('No companies selected.', 'error'); return }
    setStatus('Saving ' + selected.length + ' companies...', 'success')
    saveCompanyList(selected, token)
  })
}

// ─── SAVE HELPERS ─────────────────────────────────────────────

function saveCompanyList(companies, token) {
  fetch(API_BASE_URL + '/companies/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ companies: companies })
  })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
    .then(result => {
      const inserted = result.inserted || 0
      const skipped = result.skipped || 0
      if (inserted > 0) {
        setStatus('✓ ' + inserted + ' companies saved.' + (skipped > 0 ? ' ' + skipped + ' duplicates skipped.' : ''), 'success')
      } else {
        setStatus('All companies already in dashboard.', 'error')
      }
    })
    .catch(err => { setStatus('Failed to save: ' + err.message, 'error') })
}

function saveCompany(data, token) {
  fetch(API_BASE_URL + '/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      name: data.name,
      industry: data.industry || null,
      size: data.size || null,
      website: data.website || null,
      headquarters: data.headquarters || null,
      description: data.description || null,
      linkedin_url: data.url || null,
      followers: data.followers || null,
    })
  }).catch((e) => console.error('Company save error:', e))
}

// ─── NAV BUTTONS ──────────────────────────────────────────────

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