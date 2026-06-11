// API_BASE_URL URL is now defined in config.js

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'))
  document.getElementById(id).classList.add('active')
}

function setStatus(msg, type) {
  const el = document.getElementById('statusMsg')
  el.textContent = msg
  el.className = 'status-msg show ' + type
}

function clearStatus() {
  document.getElementById('statusMsg').className = 'status-msg'
}

function showLoginError(msg) {
  const el = document.getElementById('loginError')
  el.textContent = msg
  el.className = 'error-msg show'
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

function updateLeadCount(token) {
  fetch(API_BASE_URL + '/leads', { headers: { Authorization: 'Bearer ' + token } })
    .then((r) => r.json())
    .then((data) => {
      const count = data.leads ? data.leads.length : 0
      const el = document.getElementById('leadCount')
      el.innerHTML = '<span>' + count + '</span> leads synced'
    })
    .catch(() => {})
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

async function getValidToken() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['token', 'userEmail'], async (stored) => {
      const token = stored.token
      if (!token) { reject(new Error('No token')); return }

      try {
        const testRes = await fetch(API_BASE_URL + '/leads', {
          headers: { 'Authorization': 'Bearer ' + token }
        })

        if (testRes.status !== 401) {
          resolve(token)
          return
        }

        // Token expired - user needs to re-login
        reject(new Error('Token expired - please sign in again'))

      } catch (e) {
        reject(e)
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
      document.getElementById('statusDot').className = 'status-dot'
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
  document.getElementById('statusDot').className = 'status-dot online'

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0] ? tabs[0].url : ''
    const type = detectPageType(url)
    const badge = document.getElementById('pageBadge')
    const label = document.getElementById('pageTypeLabel')
    const extractBtn = document.getElementById('extractBtn')
    const autoScrollBtn = document.getElementById('autoScrollBtn')
    const peopleTip = document.getElementById('peopleTip')

    const typeLabels = {
      'salenav-companies': 'SALES NAV ACCOUNTS',
      'salenav-people': 'SALES NAV PEOPLE',
      'salenav-company': 'SALES NAV COMPANY',
      'linkedin-companies': 'COMPANY SEARCH',
      'linkedin-all-search': 'LINKEDIN SEARCH',
      'company-people': 'PEOPLE PAGE — READY',
      'company': 'COMPANY PAGE',
      'profile': 'PROFILE PAGE',
      'search': 'PEOPLE SEARCH'
    }

    if (type === 'unknown') {
      label.textContent = 'NOT A LINKEDIN PAGE'
      extractBtn.disabled = true
      extractBtn.style.opacity = '0.3'
      autoScrollBtn.style.display = 'none'
      peopleTip.style.display = 'none'
    } else {
      label.textContent = typeLabels[type] || type.toUpperCase()
      badge.className = 'page-badge linkedin'
      extractBtn.disabled = false
      extractBtn.style.opacity = '1'
      autoScrollBtn.style.display = type === 'company-people' ? 'block' : 'none'
      peopleTip.style.display = type === 'company-people' ? 'block' : 'none'
    }
  })

  updateLeadCount(token)
}

// ─── AUTO SCROLL ─────────────────────────────────────────────

document.getElementById('autoScrollBtn').addEventListener('click', () => {
  const btn = document.getElementById('autoScrollBtn')
  btn.textContent = '↓ Scrolling... please wait'
  btn.disabled = true

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.runtime.sendMessage(
      { action: 'injectAndAutoScroll', tabId: tabs[0].id },
      (response) => {
        if (response?.success) {
          btn.textContent = '✓ Loaded ' + response.count + ' profiles — now Extract'
          btn.style.color = '#00e676'
          btn.style.borderColor = '#00e676'
          setTimeout(() => {
            btn.textContent = '↓ Auto-scroll to load all profiles'
            btn.style.color = '#ffab00'
            btn.style.borderColor = '#ffab00'
            btn.disabled = false
          }, 4000)
        } else {
          btn.textContent = '↓ Auto-scroll to load all profiles'
          btn.disabled = false
          setStatus('Auto-scroll failed. Refresh and try again.', 'error')
        }
      }
    )
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
          updateLeadCount(token)
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
    position: fixed; inset: 0; background: #0a0a0a; z-index: 100;
    display: flex; flex-direction: column; padding: 16px;
    font-family: inherit; overflow: hidden;
  `

  overlay.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <div>
        <p style="font-size:9px; font-weight:700; letter-spacing:2px; color:#555; margin-bottom:4px;">SELECT COMPANIES</p>
        <p style="font-size:16px; font-weight:900; color:#f0ede8;">${companies.length} found</p>
      </div>
      <button id="selectAllBtn" style="font-size:9px; font-weight:700; letter-spacing:1px; color:#ffab00; background:none; border:1px solid #ffab00; border-radius:3px; padding:4px 8px; cursor:pointer; font-family:inherit;">SELECT ALL</button>
    </div>
    <div id="companyList" style="flex:1; overflow-y:auto; margin-bottom:12px; display:flex; flex-direction:column; gap:6px;">
      ${companies.map((c, i) => `
        <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; background:#111; border-radius:4px; cursor:pointer; border:1px solid #1a1a1a;">
          <input type="checkbox" value="${i}" checked style="accent-color:#ffab00; cursor:pointer; flex-shrink:0;" />
          <div style="overflow:hidden; flex:1;">
            <p style="font-size:12px; font-weight:600; color:#f0ede8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</p>
            <p style="font-size:10px; color:#555; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.industry || c.headquarters || '—'}</p>
          </div>
        </label>
      `).join('')}
    </div>
    <div style="display:flex; gap:8px; flex-shrink:0;">
      <button id="cancelSelectBtn" style="flex:1; padding:10px; background:transparent; border:1px solid #222; border-radius:4px; font-size:11px; color:#555; cursor:pointer; font-family:inherit;">Cancel</button>
      <button id="saveSelectedBtn" style="flex:2; padding:10px; background:#f0ede8; border:none; border-radius:4px; font-size:12px; font-weight:700; color:#0a0a0a; cursor:pointer; font-family:inherit;">Save Selected →</button>
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
  chrome.tabs.create({ url: 'http://localhost:5173' })
})

document.getElementById('logoutBtn').addEventListener('click', () => {
  chrome.storage.local.remove(['token', 'userEmail'], () => {
    show('loginScreen')
    document.getElementById('statusDot').className = 'status-dot'
    document.getElementById('loginEmail').value = ''
    document.getElementById('loginPassword').value = ''
  })
})