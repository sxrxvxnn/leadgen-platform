// ─── PAGE TYPE DETECTION ─────────────────────────────────────

function getPageType() {
  const url = window.location.href
  if (url.includes('linkedin.com/sales/search/company')) return 'salenav-companies'
  if (url.includes('linkedin.com/sales/lists/people')) return 'salenav-people-list'
  if (url.includes('linkedin.com/sales/search/people')) return 'salenav-people'
  if (url.includes('linkedin.com/sales/company/')) return 'salenav-company'
  if (url.includes('linkedin.com/search/results/companies')) return 'linkedin-companies'
  if (url.includes('linkedin.com/company/') && url.includes('/people')) return 'company-people'
  if (url.includes('linkedin.com/company/')) return 'company'
  if (url.includes('linkedin.com/in/')) return 'profile'
  if (url.includes('linkedin.com/search/results/people')) return 'search'
  return 'unknown'
}

function cleanUrl(url) {
  return url.split('?')[0].split('#')[0]
}

// ─── SALES NAVIGATOR — COMPANY SEARCH RESULTS ────────────────

function scrapeSalesNavCompanies() {
  const companies = []
  const seen = new Set()

  // Sales Navigator account search result cards
  const cardSelectors = [
    '[data-x-search-result="ACCOUNT"]',
    '.search-results__result-item',
    'li[class*="account-search"]',
    '.artdeco-list__item',
    '[data-anonymize="company-name"]',
  ]

  let cards = []
  for (const sel of cardSelectors) {
    cards = Array.from(document.querySelectorAll(sel))
    if (cards.length > 0) break
  }

  // Fallback — find all company links
  if (cards.length === 0) {
    const companyLinks = document.querySelectorAll('a[href*="/sales/company/"]')
    companyLinks.forEach(link => {
      const card = link.closest('li') || link.closest('[class*="result"]') || link.closest('[class*="item"]')
      if (card && !cards.includes(card)) cards.push(card)
    })
  }

  cards.forEach(card => {
    const company = {
      type: 'company',
      name: '',
      industry: '',
      size: '',
      headquarters: '',
      followers: '',
      description: '',
      linkedinUrl: '',
      salesNavUrl: '',
      scrapedAt: new Date().toISOString()
    }

    // Company name
    const nameSelectors = [
      '[data-anonymize="company-name"]',
      '.result-lockup__name',
      'a[href*="/sales/company/"]',
      '[class*="company-name"]',
      'span[class*="name"]',
    ]
    for (const sel of nameSelectors) {
      const el = card.querySelector(sel)
      if (el && el.innerText.trim()) { company.name = el.innerText.trim(); break }
    }

    // Sales Nav company URL
    const salesLink = card.querySelector('a[href*="/sales/company/"]')
    if (salesLink) company.salesNavUrl = salesLink.href

    // Industry
    const industrySelectors = [
      '[data-anonymize="industry"]',
      '[class*="industry"]',
      '.result-lockup__highlight-keyword',
    ]
    for (const sel of industrySelectors) {
      const el = card.querySelector(sel)
      if (el && el.innerText.trim()) { company.industry = el.innerText.trim(); break }
    }

    // Size / headcount
    const sizeSelectors = [
      '[data-anonymize="company-size"]',
      '[class*="headcount"]',
      '[class*="employee"]',
    ]
    for (const sel of sizeSelectors) {
      const el = card.querySelector(sel)
      if (el && el.innerText.trim()) { company.size = el.innerText.trim(); break }
    }

    // Location / HQ
    const locationSelectors = [
      '[data-anonymize="location"]',
      '[class*="location"]',
      '[class*="headquarters"]',
    ]
    for (const sel of locationSelectors) {
      const el = card.querySelector(sel)
      if (el && el.innerText.trim()) { company.headquarters = el.innerText.trim(); break }
    }

    // Fallback — parse from card text
    if (!company.name) {
      const lines = card.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
      if (lines.length > 0) company.name = lines[0]
    }

    if (company.name && !seen.has(company.name)) {
      seen.add(company.name)
      companies.push(company)
    }
  })

  return {
    type: 'company-list',
    source: 'sales-navigator',
    companies,
    total: companies.length,
    scrapedAt: new Date().toISOString()
  }
}

// ─── LINKEDIN COMPANY SEARCH RESULTS ─────────────────────────

function scrapeLinkedInCompanySearch() {
  const companies = []
  const seen = new Set()

  // Get all company links on the page
  const companyLinks = document.querySelectorAll('a[href*="/company/"]')

  companyLinks.forEach(link => {
    // Each company link is inside P > DIV > DIV structure
    const card = link.parentElement?.parentElement?.parentElement

    if (!card) return

    // Get company name from the link text
    const name = link.innerText.trim()
    if (!name || name.length < 2) return

    // Clean the URL
    const url = cleanUrl(link.href)
    if (!url || seen.has(url)) return
    seen.add(url)

    const company = {
      type: 'company',
      name,
      industry: '',
      size: '',
      headquarters: '',
      followers: '',
      description: '',
      linkedinUrl: url,
      scrapedAt: new Date().toISOString()
    }

    // Get all text lines from the card
    const lines = card.innerText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && l !== name && l !== 'Follow' && l !== 'Following')

    // First line after name = industry
    if (lines.length > 0) company.industry = lines[0]
    // Second line = location or size
    if (lines.length > 1) {
      const second = lines[1]
      if (/\d+/.test(second) && second.includes('follower')) {
        company.followers = second
      } else {
        company.headquarters = second
      }
    }
    // Third line
    if (lines.length > 2) {
      const third = lines[2]
      if (/follower/i.test(third)) company.followers = third
      else if (/\d+/.test(third)) company.size = third
    }

    companies.push(company)
  })

  return {
    type: 'company-list',
    source: 'linkedin-search',
    companies,
    total: companies.length,
    scrapedAt: new Date().toISOString()
  }
}

// ─── SALES NAVIGATOR — INDIVIDUAL COMPANY PAGE ───────────────

function scrapeSalesNavCompanyPage() {
  const data = {
    type: 'company',
    name: '',
    industry: '',
    size: '',
    headquarters: '',
    website: '',
    description: '',
    followers: '',
    salesNavUrl: cleanUrl(window.location.href),
    scrapedAt: new Date().toISOString()
  }

  // Name
  const nameSelectors = [
    '[data-anonymize="company-name"]',
    'h1[class*="company"]',
    '.company-details h1',
    'h1',
  ]
  for (const sel of nameSelectors) {
    const el = document.querySelector(sel)
    if (el && el.innerText.trim()) { data.name = el.innerText.trim(); break }
  }

  // Parse all info from page text
  const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  const nameIdx = lines.findIndex(l => l === data.name)
  if (nameIdx !== -1) {
    for (let i = nameIdx + 1; i < Math.min(nameIdx + 20, lines.length); i++) {
      const line = lines[i]
      if (!data.industry && line.length > 2 && line.length < 60) data.industry = line
      else if (!data.size && /\d+/.test(line) && line.includes('employee')) data.size = line
      else if (!data.headquarters && /,/.test(line) && line.length < 60) data.headquarters = line
    }
  }

  return data
}

// ─── EXISTING SCRAPERS ────────────────────────────────────────

function scrapeCompanyPage() {
  const data = {
    type: 'company',
    name: '',
    industry: '',
    size: '',
    website: '',
    headquarters: '',
    description: '',
    url: cleanUrl(window.location.href),
    scrapedAt: new Date().toISOString()
  }

  const nameSelectors = ['h1.org-top-card-summary__title', '.org-top-card-summary__title', 'h1[class*="org-top-card"]', '.ember-view h1', 'h1']
  for (const sel of nameSelectors) {
    const el = document.querySelector(sel)
    if (el && el.innerText.trim()) { data.name = el.innerText.trim(); break }
  }

  let infoItems = []
  for (const sel of ['.org-top-card-summary-info-list__info-item']) {
    infoItems = document.querySelectorAll(sel)
    if (infoItems.length > 0) break
  }
  infoItems.forEach((item, index) => {
    const text = item.innerText.trim()
    if (index === 0) data.industry = text
    if (index === 1) data.size = text
    if (index === 2) data.headquarters = text
  })

  if (!data.industry) {
    const dts = document.querySelectorAll('.artdeco-def-list__item dt')
    const dds = document.querySelectorAll('.artdeco-def-list__item dd')
    dts.forEach((dt, i) => {
      const key = dt.innerText.trim().toLowerCase()
      const val = dds[i] ? dds[i].innerText.trim() : ''
      if (key.includes('industry')) data.industry = val
      if (key.includes('size') || key.includes('employees')) data.size = val
      if (key.includes('headquarter')) data.headquarters = val
      if (key.includes('website')) data.website = val
    })
  }

  for (const sel of ['a[data-control-name="topbox_website"]']) {
    const el = document.querySelector(sel)
    if (el && el.href && !el.href.includes('linkedin')) { data.website = el.href; break }
  }

  for (const sel of ['p.org-top-card-summary__tagline', '.org-about-us-organization-description__text']) {
    const el = document.querySelector(sel)
    if (el && el.innerText.trim()) { data.description = el.innerText.trim(); break }
  }

  return data
}

function scrapeCompanyPeoplePage() {
  let companyName = ''
  const titleTag = document.title
  if (titleTag) {
    companyName = titleTag.split('|')[0].replace(/people/gi, '').replace(/:/g, '').trim()
  }

  const leads = []
  const seen = new Set()
  const listItems = document.querySelectorAll('ul.display-flex.list-style-none.flex-wrap > li')

  listItems.forEach((li) => {
    const profileLink = li.querySelector('a[href*="/in/"]')
    if (!profileLink) return
    const url = cleanUrl(profileLink.href)
    if (!url || seen.has(url)) return
    seen.add(url)

    const lead = {
      type: 'profile',
      name: '',
      title: '',
      company: companyName,
      location: '',
      profileUrl: url,
      scrapedAt: new Date().toISOString()
    }

    const lines = li.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    const skipPatterns = /^(1st|2nd|3rd|Connect|Follow|Message|LinkedIn Member|Pending|withdraw|View full profile)$/i
    const connectionPattern = /degree connection|mutual connection|other mutual/i

    if (lines.length > 0) lead.name = lines[0]

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!skipPatterns.test(line) && !connectionPattern.test(line) && !line.startsWith('·') && line.length > 2) {
        lead.title = line.length > 80 ? line.substring(0, 77) + '...' : line
        break
      }
    }

    if (lead.name && lead.name !== 'LinkedIn Member') leads.push(lead)
  })

  return { type: 'search', leads, scrapedAt: new Date().toISOString() }
}

function scrapeProfilePage() {
  const data = {
    type: 'profile',
    name: '',
    title: '',
    company: '',
    location: '',
    profileUrl: cleanUrl(window.location.href),
    scrapedAt: new Date().toISOString()
  }

  const pageTitle = document.title
  if (pageTitle) data.name = pageTitle.split('|')[0].trim()

  const skipLine = (line) => {
    const patterns = [
      /^(1st|2nd|3rd|connect|follow|message|linkedin|pending|withdraw)$/i,
      /degree connection/i, /mutual connection/i,
      /^(view|open to|highlights|about|experience|education|skills|activity|featured|interests|recommendations|show all)$/i,
      /^(notification|search|home|my network|jobs|messaging)$/i,
      /newsletter/i, /^\d+\s*(followers|connections|following)/i,
      /^(she\/her|he\/him|they\/them)$/i, /^\d+$/,
      /^(save|share|more|report|block|remove|unfollow|following)$/i,
    ]
    return patterns.some(p => p.test(line))
  }

  const isLocation = (line) => {
    return line.length < 60 && (/,/.test(line) || /(india|usa|uk|singapore|australia|canada|germany|uae|kerala|bangalore|mumbai|delhi|hyderabad|chennai|remote|london|new york|dubai|europe|asia)/i.test(line))
  }

  const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 1)
  const nameIndex = lines.findIndex(l => data.name && (l === data.name || l.startsWith(data.name)))

  if (nameIndex !== -1) {
    let titleFound = false
    for (let i = nameIndex + 1; i < Math.min(nameIndex + 15, lines.length); i++) {
      const line = lines[i]
      if (skipLine(line)) continue
      if (line === data.name) continue
      if (!titleFound && line.length > 3) {
        const rawTitle = line.split('|')[0].trim()
        data.title = rawTitle.length > 80 ? rawTitle.substring(0, 77) + '...' : rawTitle
        titleFound = true
        continue
      }
      if (titleFound && !data.location && isLocation(line)) { data.location = line; break }
    }
  }

  const expIndex = lines.findIndex(l => l === 'Experience')
  if (expIndex !== -1) {
    let expLinesFound = 0
    for (let i = expIndex + 1; i < Math.min(expIndex + 10, lines.length); i++) {
      const line = lines[i]
      if (line.length > 2 && line.length < 100 &&
        !line.includes('Full-time') && !line.includes('Part-time') &&
        !line.includes('Contract') && !line.includes('Internship') &&
        !/^\d{4}/.test(line) && !line.includes(' yr') &&
        !line.includes(' mo') && !line.includes('Present') &&
        !line.includes('On-site') && !line.includes('Remote') &&
        !line.includes('Hybrid') && !isLocation(line)) {
        if (expLinesFound === 0) {
          const rawTitle = line.split('·')[0].trim()
          data.title = rawTitle.length > 80 ? rawTitle.substring(0, 77) + '...' : rawTitle
        } else if (expLinesFound === 1) {
          data.company = line.split('·')[0].trim()
          break
        }
        expLinesFound++
      }
    }
  }

  return data
}

function scrapeSearchPage() {
  const leads = []
  const cards = document.querySelectorAll('li.reusable-search__result-container')

  cards.forEach(card => {
    const lead = { type: 'profile', name: '', title: '', company: '', location: '', profileUrl: '', scrapedAt: new Date().toISOString() }

    const nameEl = card.querySelector('span.entity-result__title-text a span[aria-hidden="true"]')
    if (nameEl) lead.name = nameEl.innerText.trim()

    const titleEl = card.querySelector('.entity-result__primary-subtitle')
    if (titleEl) { const t = titleEl.innerText.trim(); lead.title = t.length > 80 ? t.substring(0, 77) + '...' : t }

    const companyEl = card.querySelector('.entity-result__secondary-subtitle')
    if (companyEl) lead.company = companyEl.innerText.trim()

    const locationEl = card.querySelector('.entity-result__tertiary-subtitle')
    if (locationEl) lead.location = locationEl.innerText.trim()

    const linkEl = card.querySelector('a.app-aware-link')
    if (linkEl) lead.profileUrl = cleanUrl(linkEl.href)

    if (lead.name) leads.push(lead)
  })

  return { type: 'search', leads, scrapedAt: new Date().toISOString() }
}

// ─── SALES NAVIGATOR PEOPLE SEARCH ───────────────────────────

function scrapeSalesNavPeople() {
  const leads = []
  const seen = new Set()

  const cardSelectors = [
    '[data-x-search-result="LEAD"]',
    '.search-results__result-item',
    'li[class*="lead-search"]',
    '.artdeco-list__item',
  ]

  let cards = []
  for (const sel of cardSelectors) {
    cards = Array.from(document.querySelectorAll(sel))
    if (cards.length > 0) break
  }

  if (cards.length === 0) {
    const profileLinks = document.querySelectorAll('a[href*="/sales/lead/"]')
    profileLinks.forEach(link => {
      const card = link.closest('li') || link.closest('[class*="result"]')
      if (card && !cards.includes(card)) cards.push(card)
    })
  }

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

    const nameSelectors = ['[data-anonymize="person-name"]', '.result-lockup__name a', 'a[href*="/sales/lead/"]']
    for (const sel of nameSelectors) {
      const el = card.querySelector(sel)
      if (el && el.innerText.trim()) { lead.name = el.innerText.trim(); break }
    }

    const titleSelectors = ['[data-anonymize="title"]', '.result-lockup__highlight-keyword', '[class*="title"]']
    for (const sel of titleSelectors) {
      const el = card.querySelector(sel)
      if (el && el.innerText.trim()) { lead.title = el.innerText.trim(); break }
    }

    const companySelectors = ['[data-anonymize="company-name"]', '[class*="company"]']
    for (const sel of companySelectors) {
      const el = card.querySelector(sel)
      if (el && el.innerText.trim()) { lead.company = el.innerText.trim(); break }
    }

    const profileLink = card.querySelector('a[href*="/sales/lead/"]') || card.querySelector('a[href*="/in/"]')
    if (profileLink) lead.profileUrl = cleanUrl(profileLink.href)

    if (lead.name && !seen.has(lead.name)) {
      seen.add(lead.name)
      leads.push(lead)
    }
  })

  return { type: 'search', leads, scrapedAt: new Date().toISOString() }
}

// ─── MESSAGE LISTENER ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrape') {
    const pageType = getPageType()
    let result = null

    if (pageType === 'salenav-companies') result = scrapeSalesNavCompanies()
    else if (pageType === 'salenav-people') result = scrapeSalesNavPeople()
    else if (pageType === 'salenav-company') result = scrapeSalesNavCompanyPage()
    else if (pageType === 'linkedin-companies') result = scrapeLinkedInCompanySearch()
    else if (pageType === 'company-people') result = scrapeCompanyPeoplePage()
    else if (pageType === 'company') result = scrapeCompanyPage()
    else if (pageType === 'profile') result = scrapeProfilePage()
    else if (pageType === 'search') result = scrapeSearchPage()
    else result = { error: 'Navigate to a LinkedIn page to extract leads or companies.' }

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
    return true
  }

  return true
})