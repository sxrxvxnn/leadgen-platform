function getPageType() {
  const url = window.location.href
  if (url.includes('linkedin.com/company/') && url.includes('/people')) return 'company-people'
  if (url.includes('linkedin.com/company/')) return 'company'
  if (url.includes('linkedin.com/in/')) return 'profile'
  if (url.includes('linkedin.com/search/results/people')) return 'search'
  return 'unknown'
}

function cleanUrl(url) {
  return url.split('?')[0].split('#')[0]
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
    url: cleanUrl(window.location.href),
    scrapedAt: new Date().toISOString()
  }

  const nameSelectors = [
    'h1.org-top-card-summary__title',
    '.org-top-card-summary__title',
    'h1[class*="org-top-card"]',
    '.ember-view h1',
    'h1',
  ]
  for (const sel of nameSelectors) {
    const el = document.querySelector(sel)
    if (el && el.innerText.trim()) { data.name = el.innerText.trim(); break }
  }

  const infoSelectors = [
    '.org-top-card-summary-info-list__info-item',
    '[class*="org-top-card-summary-info-list"] dt',
  ]
  let infoItems = []
  for (const sel of infoSelectors) {
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
    const dts = document.querySelectorAll('.org-about-module__margin-bottom dt, .artdeco-def-list__item dt')
    const dds = document.querySelectorAll('.org-about-module__margin-bottom dd, .artdeco-def-list__item dd')
    dts.forEach((dt, i) => {
      const key = dt.innerText.trim().toLowerCase()
      const val = dds[i] ? dds[i].innerText.trim() : ''
      if (key.includes('industry')) data.industry = val
      if (key.includes('size') || key.includes('employees')) data.size = val
      if (key.includes('headquarter')) data.headquarters = val
      if (key.includes('website')) data.website = val
    })
  }

  const websiteSelectors = [
    'a[data-control-name="topbox_website"]',
    '.org-top-card-primary-actions__inner a',
  ]
  for (const sel of websiteSelectors) {
    const el = document.querySelector(sel)
    if (el && el.href && !el.href.includes('linkedin')) { data.website = el.href; break }
  }

  const descSelectors = [
    'p.org-top-card-summary__tagline',
    '.org-top-card-summary__tagline',
    '.org-about-us-organization-description__text',
  ]
  for (const sel of descSelectors) {
    const el = document.querySelector(sel)
    if (el && el.innerText.trim()) { data.description = el.innerText.trim(); break }
  }

  return data
}

function scrapeCompanyPeoplePage() {
  // Get company name from page title — remove colon and "People" suffix
  let companyName = ''
  const titleTag = document.title
  if (titleTag) {
    companyName = titleTag
      .split('|')[0]
      .replace(/people/gi, '')
      .replace(/:/g, '')
      .trim()
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

    // Split text into lines and filter empty ones
    const lines = li.innerText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    // Skip patterns — these are not name or title
    const skipPatterns = /^(1st|2nd|3rd|\·\s*1st|\·\s*2nd|\·\s*3rd|Connect|Follow|Message|LinkedIn Member|Pending|withdraw|mutual connection|and \d+ other|View full profile)$/i
    const connectionPattern = /degree connection|mutual connection|other mutual/i

    // First non-empty line is always the name
    if (lines.length > 0) lead.name = lines[0]

    // Find title — first line after name that is not a connection/skip line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (
        !skipPatterns.test(line) &&
        !connectionPattern.test(line) &&
        !line.startsWith('·') &&
        !line.startsWith('•') &&
        line.length > 3
      ) {
        lead.title = line
        break
      }
    }

    if (lead.name && lead.name !== 'LinkedIn Member') {
      leads.push(lead)
    }
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

  // Name from page title — most reliable
  const pageTitle = document.title
  if (pageTitle) {
    data.name = pageTitle.split('|')[0].trim()
  }

  // These patterns indicate we should skip the line
  const skipLine = (line) => {
    const skip = [
      /^(1st|2nd|3rd|connect|follow|message|linkedin|pending|withdraw)$/i,
      /degree connection/i,
      /mutual connection/i,
      /^(view|open to|highlights|about|experience|education|skills|activity|featured|interests|recommendations)$/i,
      /^(notification|message|search|home|my network|jobs|messaging|bell)$/i,
      /newsletter/i,
      /^\d+\s*(followers|connections|following)/i,
      /^(she\/her|he\/him|they\/them)$/i,
    ]
    return skip.some(pattern => pattern.test(line))
  }

  // Location patterns — short lines with city/country indicators
  const isLocation = (line) => {
    return (
      line.length < 60 &&
      (
        /,/.test(line) || // "Kochi, Kerala" has a comma
        /(india|usa|uk|singapore|australia|canada|germany|uae|kerala|bangalore|mumbai|delhi|hyderabad|chennai|remote)/i.test(line)
      )
    )
  }

  // Get all text from page
  const lines = document.body.innerText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1)

  // Find name position in page text
  const nameIndex = lines.findIndex(l =>
    data.name && (l === data.name || l.startsWith(data.name))
  )

  if (nameIndex !== -1) {
    let titleFound = false
    let locationFound = false

    for (let i = nameIndex + 1; i < Math.min(nameIndex + 15, lines.length); i++) {
      const line = lines[i]

      if (skipLine(line)) continue

      // Title — first valid line after name, trim at pipe or newline
      if (!titleFound && line.length > 3 && line.length < 200) {
        // Take only the first part before | or at
        const cleanTitle = line.split('|')[0].trim()
        data.title = cleanTitle
        titleFound = true

        // Try to extract company from title if it contains "at CompanyName"
        const atMatch = cleanTitle.match(/\bat\s+(.+)$/i)
        if (atMatch) {
          data.company = atMatch[1].trim()
        }
        continue
      }

      // Location — short line after title
      if (titleFound && !locationFound && isLocation(line)) {
        data.location = line
        locationFound = true
        break
      }
    }
  }

  // Fallback — try to get company from Experience section
  if (!data.company) {
    const expIndex = lines.findIndex(l => l === 'Experience')
    if (expIndex !== -1) {
      for (let i = expIndex + 1; i < Math.min(expIndex + 8, lines.length); i++) {
        const line = lines[i]
        if (
          line.length > 2 &&
          line.length < 80 &&
          !line.includes('year') &&
          !line.includes('month') &&
          !line.includes('Present') &&
          !line.includes('Full-time') &&
          !line.includes('Part-time')
        ) {
          data.company = line
          break
        }
      }
    }
  }

  return data
}

function scrapeSearchPage() {
  const leads = []
  const cards = document.querySelectorAll('li.reusable-search__result-container')

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

    const nameEl = card.querySelector('span.entity-result__title-text a span[aria-hidden="true"]')
    if (nameEl) lead.name = nameEl.innerText.trim()

    const titleEl = card.querySelector('.entity-result__primary-subtitle')
    if (titleEl) lead.title = titleEl.innerText.trim()

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

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrape') {
    const pageType = getPageType()
    let result = null

    if (pageType === 'company-people') result = scrapeCompanyPeoplePage()
    else if (pageType === 'company') result = scrapeCompanyPage()
    else if (pageType === 'profile') result = scrapeProfilePage()
    else if (pageType === 'search') result = scrapeSearchPage()
    else result = { error: 'Navigate to a LinkedIn company, profile, or search page first.' }

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