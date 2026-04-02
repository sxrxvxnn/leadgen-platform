const API = 'http://localhost:8000/api'

// ─── Helpers ─────────────────────────────────────────────────

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
  const el = document.getElementById('statusMsg')
  el.className = 'status-msg'
}

function showLoginError(msg) {
  const el = document.getElementById('loginError')
  el.textContent = msg
  el.className = 'error-msg show'
}

function detectPageType(url) {
  if (!url) return 'unknown'
  if (url.includes('/company/')) return 'company'
  if (url.includes('/in/')) return 'profile'
  if (url.includes('/search/results/people')) return 'search'
  return 'unknown'
}

function updateLeadCount(token) {
  fetch(API + '/leads', {
    headers: { Authorization: 'Bearer ' + token }
  })
    .then((r) => r.json())
    .then((data) => {
      const count = data.leads ? data.leads.length : 0
      const el = document.getElementById('leadCount')
      el.innerHTML = '<span>' + count + '</span> leads synced'
    })
    .catch(() => {})
}

// ─── Auth ─────────────────────────────────────────────────────

async function login(email, password) {
  const res = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) throw new Error('Invalid credentials')
  return res.json()
}

// ─── Init ─────────────────────────────────────────────────────

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

function initMainScreen(token, email) {
  show('mainScreen')

  // Online dot
  document.getElementById('statusDot').className = 'status-dot online'

  // Detect page type
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0] ? tabs[0].url : ''
    const type = detectPageType(url)
    const badge = document.getElementById('pageBadge')
    const label = document.getElementById('pageTypeLabel')
    const extractBtn = document.getElementById('extractBtn')

    if (type === 'unknown') {
      label.textContent = 'NOT A LINKEDIN PAGE'
      extractBtn.disabled = true
      extractBtn.style.opacity = '0.3'
    } else {
      label.textContent = type.toUpperCase() + ' PAGE'
      badge.className = 'page-badge linkedin'
      extractBtn.disabled = false
      extractBtn.style.opacity = '1'
    }
  })

  updateLeadCount(token)
}

// ─── Login button ─────────────────────────────────────────────

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
    const data = await login(email, password)
    chrome.storage.local.set({
      token: data.access_token,
      userEmail: data.user.email
    }, () => {
      initMainScreen(data.access_token, data.user.email)
    })
  } catch (err) {
    showLoginError('Invalid email or password.')
    btn.disabled = false
    btn.querySelector('span').textContent = 'Sign in'
  }
})

// ─── Extract button ───────────────────────────────────────────

document.getElementById('extractBtn').addEventListener('click', () => {
  const btn = document.getElementById('extractBtn')
  btn.disabled = true
  btn.querySelector('span').textContent = 'Extracting...'
  clearStatus()

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'scrape' }, (response) => {
      btn.disabled = false
      btn.querySelector('span').textContent = 'Extract leads from page'

      if (chrome.runtime.lastError) {
        setStatus('Refresh the LinkedIn page and try again.', 'error')
        return
      }

      if (!response || !response.success) {
        setStatus('Extraction failed. Try again.', 'error')
        return
      }

      const data = response.data

      if (data.error) {
        setStatus(data.error, 'error')
        return
      }

      chrome.storage.local.get(['token'], (stored) => {
        const token = stored.token
        if (!token) {
          setStatus('Session expired. Please sign in again.', 'error')
          show('loginScreen')
          return
        }

        // Build leads array from scraped data
        let leads = []

        if (data.type === 'search') {
          leads = data.leads.map((l) => ({
            name: l.name,
            title: l.title,
            company: l.company,
            location: l.location,
            profile_url: l.profileUrl,
            scraped_at: l.scrapedAt,
            status: 'new'
          }))
        } else if (data.type === 'profile') {
          leads = [{
            name: data.name,
            title: data.title,
            company: data.company,
            location: data.location,
            profile_url: data.profileUrl,
            scraped_at: data.scrapedAt,
            status: 'new'
          }]
        } else if (data.type === 'company') {
          // Company pages — save as company not lead
          saveCompany(data, token)
          setStatus('Company "' + data.name + '" saved to dashboard.', 'success')
          return
        }

        if (leads.length === 0) {
          setStatus('No leads found on this page.', 'error')
          return
        }

        // Send to backend
        fetch(API + '/leads/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          },
          body: JSON.stringify({ leads })
        })
          .then((r) => r.json())
          .then((result) => {
            const inserted = result.inserted || 0
            const skipped = result.skipped || 0
            if (inserted > 0) {
              setStatus(inserted + ' lead' + (inserted > 1 ? 's' : '') + ' saved to dashboard.' + (skipped > 0 ? ' (' + skipped + ' duplicates skipped)' : ''), 'success')
            } else {
              setStatus('All leads already exist in your dashboard.', 'error')
            }
            updateLeadCount(token)
          })
          .catch(() => {
            setStatus('Failed to sync. Is your backend running?', 'error')
          })
      })
    })
  })
})

// ─── Save company helper ──────────────────────────────────────

function saveCompany(data, token) {
  fetch(API + '/companies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({
      name: data.name,
      industry: data.industry,
      size: data.size,
      website: data.website,
      headquarters: data.headquarters,
      description: data.description,
      linkedin_url: data.url
    })
  }).catch(() => {})
}

// ─── Dashboard button ─────────────────────────────────────────

document.getElementById('dashboardBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:5173' })
})

// ─── Logout button ────────────────────────────────────────────

document.getElementById('logoutBtn').addEventListener('click', () => {
  chrome.storage.local.remove(['token', 'userEmail'], () => {
    show('loginScreen')
    document.getElementById('statusDot').className = 'status-dot'
    document.getElementById('loginEmail').value = ''
    document.getElementById('loginPassword').value = ''
  })
})