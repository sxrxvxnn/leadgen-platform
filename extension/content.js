function getPageType() {
  const url = window.location.href
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

function cleanUrl(url) {
  return url.split('?')[0].split('#')[0]
}

function scrapeCompanyPage() {
  const data = {
    type: 'company', name: '', industry: '', size: '', website: '',
    headquarters: '', description: '', url: cleanUrl(window.location.href),
    scrapedAt: new Date().toISOString()
  }
  const nameSelectors = ['h1.org-top-card-summary__title', '.org-top-card-summary__title', 'h1[class*="org-top-card"]', 'h1']
  for (const sel of nameSelectors) {
    const el = document.querySelector(sel)
    if (el && el.innerText.trim()) { data.name = el.innerText.trim(); break }
  }
  let infoItems = document.querySelectorAll('.org-top-card-summary-info-list__info-item')
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
  let companyFollowers = ''
  let companySize = ''

  const titleTag = document.title
  if (titleTag) companyName = titleTag.split('|')[0].replace(/people/gi, '').replace(/:/g, '').trim()

  const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  lines.forEach(line => {
    if (/^\d+[\d,.KkMm]*\s*followers?$/i.test(line)) companyFollowers = line
    if (/employees? on linkedin/i.test(line)) companySize = line.replace(/employees? on linkedin/i, '').trim()
  })

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
      followers: companyFollowers,
      employeeCount: companySize,
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

    const locationPatterns = /(india|usa|uk|singapore|australia|canada|germany|uae|kerala|bangalore|mumbai|delhi|hyderabad|chennai|remote|london|new york|dubai)/i
    for (let i = 1; i < lines.length; i++) {
      if (locationPatterns.test(lines[i]) && lines[i].length < 60) {
        lead.location = lines[i]
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
    followers: '',
    connections: '',
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

  const isLocation = (line) => line.length < 60 && (/,/.test(line) || /(india|usa|uk|singapore|australia|canada|germany|uae|kerala|bangalore|mumbai|delhi|hyderabad|chennai|remote|london|new york|dubai|europe|asia)/i.test(line))

  const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 1)

  lines.forEach(line => {
    if (/^\d[\d,]*\+?\s*followers?$/i.test(line)) data.followers = line
    if (/^\d[\d,]*\+?\s*connections?$/i.test(line)) data.connections = line
  })

  const nameIndex = lines.findIndex(l => data.name && (l === data.name || l.startsWith(data.name)))

  if (nameIndex !== -1) {
    let titleFound = false
    for (let i = nameIndex + 1; i < Math.min(nameIndex + 15, lines.length); i++) {
      const line = lines[i]
      if (skipLine(line) || line === data.name) continue
      if (!titleFound && line.length > 3) {
        const rawTitle = line.split('|')[0].trim()
        data.title = rawTitle.length > 80 ? rawTitle.substring(0, 77) + '...' : rawTitle
        titleFound = true; continue
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
        !line.includes('Contract') && !/^\d{4}/.test(line) &&
        !line.includes(' yr') && !line.includes(' mo') &&
        !line.includes('Present') && !line.includes('On-site') &&
        !line.includes('Remote') && !line.includes('Hybrid') && !isLocation(line)) {
        if (expLinesFound === 0) {
          const rawTitle = line.split('·')[0].trim()
          data.title = rawTitle.length > 80 ? rawTitle.substring(0, 77) + '...' : rawTitle
        } else if (expLinesFound === 1) {
          data.company = line.split('·')[0].trim(); break
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

function scrapeLinkedInCompanySearch() {
  const companies = []
  const seen = new Set()
  const companyLinks = document.querySelectorAll('a[href*="linkedin.com/company/"]')

  companyLinks.forEach(link => {
    const href = cleanUrl(link.href)
    const slugMatch = href.match(/linkedin\.com\/company\/([a-zA-Z0-9_-]+)\/?$/)
    if (!slugMatch) return
    const slug = slugMatch[1]
    if (['linkedin', 'company', 'school', 'showcase'].includes(slug)) return
    if (seen.has(slug)) return
    seen.add(slug)

    const name = link.innerText.trim()
    if (!name || name.length < 2 || name.length > 100) return
    if (/^(follow|following|connect|sign up|visit website|reactivate)$/i.test(name)) return
    if (/online event|your local time|\d{1,2}:\d{2}/.test(name)) return
    if (/^(new york|london|miami|tampa|san francisco|washington|singapore|dubai|mumbai)/i.test(name)) return

    const company = {
      type: 'company',
      name: name.split('\n')[0].trim(),
      industry: '',
      headquarters: '',
      followers: '',
      description: '',
      linkedinUrl: href,
      scrapedAt: new Date().toISOString()
    }

    let card = link
    for (let i = 0; i < 6; i++) {
      card = card.parentElement
      if (!card) break
      const cardLines = (card.innerText || '').split('\n').map(l => l.trim()).filter(l => l.length > 0)
      if (cardLines.length >= 5) {
        const followersLine = cardLines.find(l => /follower/i.test(l))
        if (followersLine) company.followers = followersLine
        const descLine = cardLines.find(l =>
          l.length > 50 && !l.includes(company.name) &&
          !/follower|follow|sign up|visit website/i.test(l)
        )
        if (descLine) company.description = descLine.substring(0, 200)

        const nameParts = link.innerText.split('\n').map(p => p.trim()).filter(p => p.length > 0)
        if (nameParts.length > 1) company.industry = nameParts[1]
        if (nameParts.length > 2) company.headquarters = nameParts[2]
        break
      }
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

function scrapeSalesNavCompanies() {
  const companies = []
  const seen = new Set()
  const cardSelectors = ['[data-x-search-result="ACCOUNT"]', '.search-results__result-item', 'li[class*="account-search"]', '.artdeco-list__item']
  let cards = []
  for (const sel of cardSelectors) {
    cards = Array.from(document.querySelectorAll(sel))
    if (cards.length > 0) break
  }
  if (cards.length === 0) {
    const companyLinks = document.querySelectorAll('a[href*="/sales/company/"]')
    companyLinks.forEach(link => {
      const card = link.closest('li') || link.closest('[class*="result"]') || link.closest('[class*="item"]')
      if (card && !cards.includes(card)) cards.push(card)
    })
  }
  cards.forEach(card => {
    const company = { type: 'company', name: '', industry: '', size: '', headquarters: '', followers: '', description: '', linkedinUrl: '', salesNavUrl: '', scrapedAt: new Date().toISOString() }
    const nameSelectors = ['[data-anonymize="company-name"]', '.result-lockup__name', 'a[href*="/sales/company/"]', '[class*="company-name"]']
    for (const sel of nameSelectors) {
      const el = card.querySelector(sel)
      if (el && el.innerText.trim()) { company.name = el.innerText.trim(); break }
    }
    const salesLink = card.querySelector('a[href*="/sales/company/"]')
    if (salesLink) company.salesNavUrl = salesLink.href
    if (company.name && !seen.has(company.name)) { seen.add(company.name); companies.push(company) }
  })
  return { type: 'company-list', source: 'sales-navigator', companies, total: companies.length, scrapedAt: new Date().toISOString() }
}

function scrapeSalesNavPeople() {
  const leads = []
  const seen = new Set()
  const cardSelectors = ['[data-x-search-result="LEAD"]', '.search-results__result-item', '.artdeco-list__item']
  let cards = []
  for (const sel of cardSelectors) {
    cards = Array.from(document.querySelectorAll(sel))
    if (cards.length > 0) break
  }
  cards.forEach(card => {
    const lead = { type: 'profile', name: '', title: '', company: '', location: '', profileUrl: '', scrapedAt: new Date().toISOString() }
    const nameSelectors = ['[data-anonymize="person-name"]', '.result-lockup__name a', 'a[href*="/sales/lead/"]']
    for (const sel of nameSelectors) {
      const el = card.querySelector(sel)
      if (el && el.innerText.trim()) { lead.name = el.innerText.trim(); break }
    }
    const profileLink = card.querySelector('a[href*="/sales/lead/"]') || card.querySelector('a[href*="/in/"]')
    if (profileLink) lead.profileUrl = cleanUrl(profileLink.href)
    if (lead.name && !seen.has(lead.name)) { seen.add(lead.name); leads.push(lead) }
  })
  return { type: 'search', leads, scrapedAt: new Date().toISOString() }
}

// ─── AUTO SCROLL ─────────────────────────────────────────────

function autoScrollPeoplePage(callback) {
  let lastCount = 0
  let unchangedRounds = 0
  let totalScrolls = 0
  const maxScrolls = 15

  function scrollStep() {
    const items = document.querySelectorAll('a[href*="linkedin.com/in/"]')
    const currentCount = items.length

    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    totalScrolls++

    if (currentCount === lastCount) {
      unchangedRounds++
    } else {
      unchangedRounds = 0
      lastCount = currentCount
    }

    if (unchangedRounds >= 3 || totalScrolls >= maxScrolls) {
      setTimeout(() => callback(currentCount), 1500)
      return
    }

    setTimeout(scrollStep, 2000)
  }

  scrollStep()
}

// ─── MESSAGE LISTENER ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrape') {
    const pageType = getPageType()
    let result = null
    if (pageType === 'salenav-companies') result = scrapeSalesNavCompanies()
    else if (pageType === 'salenav-people') result = scrapeSalesNavPeople()
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

  if (message.action === 'autoScroll') {
    const pageType = getPageType()
    if (pageType !== 'company-people') {
      sendResponse({ success: false, error: 'Not on a people page' })
      return true
    }
    autoScrollPeoplePage((count) => {
      sendResponse({ success: true, count })
    })
    return true
  }

  if (message.action === 'getLeads') {
    chrome.storage.local.get({ leads: [] }, (data) => { sendResponse({ leads: data.leads }) })
    return true
  }

  return true
})