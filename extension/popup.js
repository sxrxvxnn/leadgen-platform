// Detects page type and shows it in the popup
function detectPageType(url) {
  if (url.includes('/company/')) return 'Company Page'
  if (url.includes('/in/')) return 'Profile Page'
  if (url.includes('/search/results/people')) return 'Search Results'
  return 'Not a LinkedIn page'
}

// Show status message
function showStatus(message, type) {
  const el = document.getElementById('status')
  el.textContent = message
  el.className = `status ${type}`
}

// Update lead count display
function updateLeadCount() {
  chrome.storage.local.get({ leads: [] }, (data) => {
    const countEl = document.getElementById('leadCount')
    if (data.leads.length > 0) {
      countEl.innerHTML = `<strong>${data.leads.length}</strong> leads saved locally`
    } else {
      countEl.textContent = 'No leads saved yet'
    }
  })
}

// On popup open — detect page and show lead count
document.addEventListener('DOMContentLoaded', () => {
  // Get current tab URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url
    const pageType = detectPageType(url)
    document.getElementById('pageType').textContent = pageType

    // Disable scrape button if not on LinkedIn
    if (pageType === 'Not a LinkedIn page') {
      document.getElementById('scrapeBtn').disabled = true
      document.getElementById('scrapeBtn').style.opacity = '0.4'
      document.getElementById('scrapeBtn').style.cursor = 'not-allowed'
    }
  })

  updateLeadCount()
})

// Scrape button
document.getElementById('scrapeBtn').addEventListener('click', () => {
  const btn = document.getElementById('scrapeBtn')
  btn.textContent = 'Extracting...'
  btn.disabled = true

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: 'scrape' },
      (response) => {
        btn.textContent = 'Extract Leads from This Page'
        btn.disabled = false

        if (chrome.runtime.lastError) {
          showStatus(
            'Error: Refresh the LinkedIn page and try again.',
            'error'
          )
          return
        }

        if (response && response.success) {
          if (response.data.error) {
            showStatus(response.data.error, 'error')
          } else if (response.data.type === 'search') {
            showStatus(
              `Extracted ${response.data.leads.length} leads from search results.`,
              'success'
            )
          } else {
            showStatus(
              `Extracted: ${response.data.name || response.data.title || 'Lead saved'}`,
              'success'
            )
          }
          updateLeadCount()
        }
      }
    )
  })
})

// View leads button — opens dashboard
document.getElementById('viewBtn').addEventListener('click', () => {
  // For now opens a new tab with saved leads as JSON
  // Later this will open your actual dashboard
  chrome.storage.local.get({ leads: [] }, (data) => {
    if (data.leads.length === 0) {
      showStatus('No leads saved yet. Extract some first.', 'error')
      return
    }
    // Opens the dashboard URL — we'll update this once dashboard is live
    chrome.tabs.create({ url: 'http://localhost:5173' })
  })
})