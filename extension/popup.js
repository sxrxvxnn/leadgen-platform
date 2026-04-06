const API = 'http://localhost:8000/api'

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
  if (url.includes('linkedin.com/company/') && url.includes('/people')) return 'company-people'
  if (url.includes('linkedin.com/company/')) return 'company'
  if (url.includes('linkedin.com/in/')) return 'profile'
  if (url.includes('linkedin.com/search/results/people')) return 'search'
  return 'unknown'
}

function updateLeadCount(token) {
  fetch(API + '/leads', { headers: { Authorization: 'Bearer ' + token } })
    .then((r) => r.json())
    .then((data) => {
      const count = data.leads ? data.leads.length : 0
      const el = document.getElementById('leadCount')
      el.innerHTML = '<span>' + count + '</span> leads synced'
    })
    .catch(() => {})
}

async function loginApi(email, password) {
  const res = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) throw new Error('Invalid credentials')
  return res.json()
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
  if (!email || !password) {
    showLoginError('Please enter email and password.')
    return
  }
  btn.disabled = true
  btn.querySelector('span').textContent = 'Signing in...'
  try {
    const data = await loginApi(email, password)
    chrome.storage.local.set({ token: data.access_token, userEmail: email }, () => {
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

    const typeLabels = {
      'salenav-companies': 'SALES NAV ACCOUNTS',
      'salenav-people': 'SALES NAV PEOPLE',
      'salenav-company': 'SALES NAV COMPANY',
      'linkedin-companies': 'COMPANY SEARCH',
      'company-people': 'PEOPLE PAGE — READY',
      'company': 'COMPANY PAGE',
      'profile': 'PROFILE PAGE',
      'search': 'SEARCH RESULTS'
    }

    if (type === 'unknown') {
      label.textContent = 'NOT A LINKEDIN PAGE'
      extractBtn.disabled = true
      extractBtn.style.opacity = '0.3'
      autoScrollBtn.style.display = 'none'
    } else {
      label.textContent = typeLabels[type] || type.toUpperCase()
      badge.className = 'page-badge linkedin'
      extractBtn.disabled = false
      extractBtn.style.opacity = '1'
      autoScrollBtn.style.display = type === 'company-people' ? 'block' : 'none'
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

document.getElementById('extractBtn').addEventListener('click', () => {
  const btn = document.getElementById('extractBtn')
  btn.disabled = true
  btn.querySelector('span').textContent = 'Extracting...'
  clearStatus()

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

      chrome.storage.local.get(['token'], (stored) => {
        const token = stored.token
        if (!token) {
          setStatus('Session expired. Please sign in again.', 'error')
          show('loginScreen')
          return
        }

        // Handle company list
        if (data.type === 'company-list') {
          if (!data.companies || data.companies.length === 0) {
            setStatus('No companies found. Scroll down and retry.', 'error')
            return
          }
          setStatus('Found ' + data.companies.length + ' companies. Saving...', 'success')
          saveCompanyList(data.companies, token)
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
              followers_count: l.followers || null,
              employee_count: l.employeeCount || null,
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
          }]
        }

        if (leads.length === 0) {
          setStatus('No valid leads found. Scroll down and retry.', 'error')
          return
        }

        setStatus('Found ' + leads.length + ' profiles. Saving...', 'success')

        fetch(API + '/leads/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ leads: leads })
        })
          .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
          .then((result) => {
            const inserted = result.inserted || 0
            const skipped = result.skipped || 0
            if (inserted > 0) {
              setStatus(
                '✓ ' + inserted + ' lead' + (inserted > 1 ? 's' : '') + ' saved.' +
                (skipped > 0 ? ' (' + skipped + ' duplicates skipped)' : ''),
                'success'
              )
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
})

// ─── SAVE HELPERS ─────────────────────────────────────────────

function saveCompanyList(companies, token) {
  fetch(API + '/companies/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ companies: companies })
  })
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
    .then(result => {
      const inserted = result.inserted || 0
      const skipped = result.skipped || 0
      if (inserted > 0) {
        setStatus(
          '✓ ' + inserted + ' companies saved.' +
          (skipped > 0 ? ' ' + skipped + ' duplicates skipped.' : ''),
          'success'
        )
      } else {
        setStatus('All companies already in dashboard.', 'error')
      }
    })
    .catch(err => { setStatus('Failed to save: ' + err.message, 'error') })
}

function saveCompany(data, token) {
  fetch(API + '/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      name: data.name,
      industry: data.industry || null,
      size: data.size || null,
      website: data.website || null,
      headquarters: data.headquarters || null,
      description: data.description || null,
      linkedin_url: data.url || null
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