// Runs on every LinkedIn page automatically
// Extracts data based on what type of page we're on

function getPageType() {
  const url = window.location.href
  if (url.includes('/company/')) return 'company'
  if (url.includes('/in/')) return 'profile'
  if (url.includes('/search/results/people')) return 'search'
  return 'unknown'
}

function scrapeCompanyPage() {
  const data = {
    type: 'company',
    name: '',
    industry: '',
    size: '',
    website: '',
    headquarters: '',
    description: '',
    url: window.location.href,
    scrapedAt: new Date().toISOString()
  }

  // Company name
  const nameEl = document.querySelector('h1.org-top-card-summary__title')
  if (nameEl) data.name = nameEl.innerText.trim()

  // Industry, size, HQ — these sit in the info card
  const infoItems = document.querySelectorAll(
    '.org-top-card-summary-info-list__info-item'
  )
  infoItems.forEach((item, index) => {
    const text = item.innerText.trim()
    if (index === 0) data.industry = text
    if (index === 1) data.size = text
    if (index === 2) data.headquarters = text
  })

  // Website
  const websiteEl = document.querySelector(
    'a[data-control-name="topbox_website"]'
  )
  if (websiteEl) data.website = websiteEl.href

  // Description
  const descEl = document.querySelector('p.org-top-card-summary__tagline')
  if (descEl) data.description = descEl.innerText.trim()

  return data
}

function scrapeProfilePage() {
  const data = {
    type: 'profile',
    name: '',
    title: '',
    company: '',
    location: '',
    profileUrl: window.location.href,
    scrapedAt: new Date().toISOString()
  }

  // Full name
  const nameEl = document.querySelector('h1.text-heading-xlarge')
  if (nameEl) data.name = nameEl.innerText.trim()

  // Job title
  const titleEl = document.querySelector('div.text-body-medium')
  if (titleEl) data.title = titleEl.innerText.trim()

  // Location
  const locationEl = document.querySelector(
    'span.text-body-small.inline.t-black--light.break-words'
  )
  if (locationEl) data.location = locationEl.innerText.trim()

  // Current company from experience section
  const companyEl = document.querySelector(
    'span[aria-hidden="true"].t-14.t-normal'
  )
  if (companyEl) data.company = companyEl.innerText.trim()

  return data
}

function scrapeSearchPage() {
  const leads = []

  const cards = document.querySelectorAll(
    'li.reusable-search__result-container'
  )

  cards.forEach(card => {
    const lead = {
      type: 'profile',
      name: '',
      title: '',
      company: '',
      location: '',
      profileUrl: '',
      scrapedAt: new Date().toISOString()
    }

    const nameEl = card.querySelector(
      'span.entity-result__title-text a span[aria-hidden="true"]'
    )
    if (nameEl) lead.name = nameEl.innerText.trim()

    const titleEl = card.querySelector('.entity-result__primary-subtitle')
    if (titleEl) lead.title = titleEl.innerText.trim()

    const companyEl = card.querySelector('.entity-result__secondary-subtitle')
    if (companyEl) lead.company = companyEl.innerText.trim()

    const locationEl = card.querySelector('.entity-result__tertiary-subtitle')
    if (locationEl) lead.location = locationEl.innerText.trim()

    const linkEl = card.querySelector('a.app-aware-link')
    if (linkEl) lead.profileUrl = linkEl.href

    if (lead.name) leads.push(lead)
  })

  return { type: 'search', leads, scrapedAt: new Date().toISOString() }
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrape') {
    const pageType = getPageType()
    let result = null

    if (pageType === 'company') result = scrapeCompanyPage()
    else if (pageType === 'profile') result = scrapeProfilePage()
    else if (pageType === 'search') result = scrapeSearchPage()
    else result = { error: 'Navigate to a LinkedIn company, profile, or search page first.' }

    // Save to chrome local storage
    chrome.storage.local.get({ leads: [] }, (existing) => {
      if (result && !result.error) {
        const updated = [...existing.leads, result]
        chrome.storage.local.set({ leads: updated })
      }
    })

    sendResponse({ success: true, data: result })
  }

  if (message.action === 'getLeads') {
    chrome.storage.local.get({ leads: [] }, (data) => {
      sendResponse({ leads: data.leads })
    })
    return true // Required for async response
  }

  return true
})