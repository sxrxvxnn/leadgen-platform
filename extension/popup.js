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

function initMainScreen(token, email) {
  show('mainScreen')
  document.getElementById('statusDot').className = 'status-dot online'

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0] ? tabs[0].url : ''
    const type = detectPageType(url)
    const badge = document.getElementById('pageBadge')
    const label = document.getElementById('pageTypeLabel')
    const extractBtn = document.getElementById('extractBtn')

    const typeLabels = {
  'salenav-companies': 'SALES NAV ACCOUNTS ✓',
  'salenav-people': 'SALES NAV PEOPLE ✓',
  'salenav-company': 'SALES NAV COMPANY ✓',
  'linkedin-companies': 'COMPANY SEARCH ✓',
  'company-people': 'PEOPLE PAGE ✓ READY',
  'company': 'COMPANY PAGE',
  'profile': 'PROFILE PAGE',
  'search': 'SEARCH RESULTS'
}

    if (type === 'unknown') {
      label.textContent = 'NOT A LINKEDIN PAGE'
      extractBtn.disabled = true
      extractBtn.style.opacity = '0.3'
    } else {
      label.textContent = typeLabels[type] || type.toUpperCase()
      badge.className = 'page-badge linkedin'
      extractBtn.disabled = false
      extractBtn.style.opacity = '1'
    }
  })

  updateLeadCount(token)
}

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
    chrome.storage.local.set({ token: data.access_token, userEmail: data.user.email }, () => {
      initMainScreen(data.access_token, data.user.email)
    })
  } catch (err) {
    showLoginError('Invalid email or password.')
    btn.disabled = false
    btn.querySelector('span').textContent = 'Sign in'
  }
})

document.getElementById('extractBtn').addEventListener('click', () => {
  const btn = document.getElementById('extractBtn')
  btn.disabled = true
  btn.querySelector('span').textContent = 'Extracting...'
  clearStatus()

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id

    chrome.runtime.sendMessage(
      { action: 'injectAndScrape', tabId },
      (bgResponse) => {
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

        if (!data) {
          setStatus('No data returned. Try again.', 'error')
          return
        }

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

          // Handle company list from Sales Nav or LinkedIn search
          if (data.type === 'company-list') {
            if (!data.companies || data.companies.length === 0) {
              setStatus('No companies found. Scroll down to load results and retry.', 'error')
              return
            }
            saveCompanyList(data.companies, token)
            return
          }

          // Handle company page
          if (data.type === 'company') {
            if (!data.name) {
              setStatus('Could not read company name. Scroll and retry.', 'error')
              return
            }
            saveCompany(data, token)
            setStatus('Company "' + data.name + '" saved.', 'success')
            updateLeadCount(token)
            return
          }

          // Build leads array
          let leads = []

          if (data.type === 'search') {
            if (!data.leads || data.leads.length === 0) {
              setStatus('No profiles found. Scroll down to load profiles first.', 'error')
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
                status: 'new'
              }))
          } else if (data.type === 'profile') {
            if (!data.name) {
              setStatus('Could not read profile. Scroll down and retry.', 'error')
              return
            }
            leads = [{
              name: data.name.trim(),
              title: data.title ? data.title.trim() : null,
              company: data.company ? data.company.trim() : null,
              location: data.location ? data.location.trim() : null,
              profile_url: data.profileUrl ? data.profileUrl.trim() : null,
              scraped_at: data.scrapedAt || new Date().toISOString(),
              status: 'new'
            }]
          }

          if (leads.length === 0) {
            setStatus('No valid leads found. Scroll down and retry.', 'error')
            return
          }

          // Show found count immediately
          setStatus('Found ' + leads.length + ' profiles. Saving...', 'success')

          // Send directly to backend — no local duplicate check
          fetch(API + '/leads/bulk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ leads: leads })
          })
            .then((r) => {
              if (!r.ok) throw new Error('HTTP ' + r.status)
              return r.json()
            })
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
            .catch((err) => {
              setStatus('Sync failed: ' + err.message + '. Is backend running?', 'error')
            })
        })
      }
    )
  })
})

function saveCompanyList(companies, token) {
  setStatus('Saving ' + companies.length + ' companies...', 'success')

  let saved = 0
  let failed = 0

  const saveNext = (index) => {
    if (index >= companies.length) {
      setStatus('✓ ' + saved + ' companies saved to dashboard.', 'success')
      updateLeadCount(token)
      return
    }

    const company = companies[index]
    if (!company.name) { failed++; saveNext(index + 1); return }

    fetch(API + '/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        name: company.name,
        industry: company.industry || null,
        size: company.size || null,
        headquarters: company.headquarters || null,
        description: company.description || null,
        website: company.website || null,
        linkedin_url: company.linkedinUrl || company.salesNavUrl || null,
      })
    })
      .then(r => r.json())
      .then(() => { saved++; saveNext(index + 1) })
      .catch(() => { failed++; saveNext(index + 1) })
  }

  saveNext(0)
}

function saveCompany(data, token) {
  fetch(API + '/companies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
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