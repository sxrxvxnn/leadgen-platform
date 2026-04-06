 function getPageType() {
  const url = window.location.href
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

function cleanUrl(url) {
  return url.split('?')[0].split('#')[0]
}

function scrapeCompanyPage() {
  const data = {
    type: 'company', name: '', industry: '', size: '', website: '',
    headquarters: '', description: '', followers: '',
    url: cleanUrl(window.location.href),
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

  const allText = document.body.innerText
  const followersMatch = allText.match(/(\d[\d,KkMm]*)\s*followers?/i)
  if (followersMatch) data.followers = followersMatch[0].trim()

  return data
}

function scrapeCompanyPeoplePage() {
  let companyName = ''
  let companyFollowers = ''
  let companySize = ''

  const titleTag = document.title
  if (titleTag) {
    companyName = titleTag.split('|')[0]
      .replace(/people/gi, '')
      .replace(/:/g, '')
      .replace(/^\s*\(\d+\)\s*/, '')
      .replace(/\s*\(\d+\)\s*$/, '')
      .trim()
  }

  const pageLines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  pageLines.forEach(line => {
    if (/^\d+[\d,.KkMm]*\s*followers?$/i.test(line)) companyFollowers = line
    if (/employees? on linkedin/i.test(line)) companySize = line.replace(/employees? on linkedin/i, '').trim()
  })

  const leads = []
  const seen = new Set()

  const profileLinks = document.querySelectorAll('a[href*="linkedin.com/in/"]')

  profileLinks.forEach(link => {
    const url = cleanUrl(link.href)
    if (!url || seen.has(url)) return
    if (/\/in\/[^/]+\/(detail|overlay|edit|recent-activity|posts|pulse)/.test(url)) return

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

    // Skip lines that are UI elements or connection degrees
    const isSkipLine = (l) => {
      return /^(1st|2nd|3rd\+?|connect|follow|message|linkedin member|pending|withdraw|view full profile|view profile|add|skip|close|next|previous|more)$/i.test(l) ||
        /degree connection/i.test(l) ||
        /\d+(st|nd|rd|th)\+?\s*degree/i.test(l) ||
        /mutual connection/i.test(l) ||
        /^\d+\s*(connection|follower|following)/i.test(l) ||
        l.startsWith('·') ||
        l.startsWith('•') ||
        l.length < 2
    }

    // Walk up DOM to find card container
    let card = link.parentElement
    for (let i = 0; i < 6; i++) {
      if (!card) break
      const parent = card.parentElement
      if (parent && parent.children.length >= 2) {
        const text = (card.innerText || '').trim()
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1)
        if (lines.length >= 2) {
          const validLines = lines.filter(l => !isSkipLine(l))

          if (validLines.length > 0) lead.name = validLines[0]
          if (validLines.length > 1) {
            // Make sure title isn't the company name
            const potentialTitle = validLines[1]
            if (potentialTitle.toLowerCase() !== companyName.toLowerCase()) {
              lead.title = potentialTitle.length > 80 ? potentialTitle.substring(0, 77) + '...' : potentialTitle
            }
          }

          const locationPattern = /(india|usa|uk|singapore|australia|canada|germany|uae|kerala|bangalore|mumbai|delhi|hyderabad|chennai|remote|london|new york|dubai)/i
          for (let j = 2; j < validLines.length; j++) {
            if (locationPattern.test(validLines[j]) && validLines[j].length < 60) {
              lead.location = validLines[j]
              break
            }
          }
          break
        }
      }
      card = card.parentElement
    }

    // Fallback name from URL slug
    if (!lead.name || lead.name.toLowerCase() === 'linkedin member' || isSkipLine(lead.name)) {
      const slugMatch = url.match(/\/in\/([^/]+)/)
      if (slugMatch) {
        lead.name = slugMatch[1].replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      }
    }

    if (lead.name && lead.name.length > 1 && !isSkipLine(lead.name)) {
      leads.push(lead)
    }
  })

  return { type: 'search', leads, companyName, companyFollowers, companySize, scrapedAt: new Date().toISOString() }
}

function scrapeProfilePage() {
  const data = {
    type: 'profile', name: '', title: '', company: '', location: '',
    profileUrl: cleanUrl(window.location.href), followers: '', connections: '',
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

    const rawName = link.innerText.trim()
    const name = rawName.split('\n')[0].trim()
    if (!name || name.length < 2 || name.length > 100) return
    if (/^(follow|following|connect|sign up|visit website|reactivate)$/i.test(name)) return
    if (/online event|your local time|\d{1,2}:\d{2}/.test(name)) return

    const company = {
      type: 'company', name, industry: '', headquarters: '',
      followers: '', description: '', linkedinUrl: href,
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
        const descLine = cardLines.find(l => l.length > 50 && !l.includes(name) && !/follower|follow|sign up|visit website/i.test(l))
        if (descLine) company.description = descLine.substring(0, 200)
        const nameParts = link.innerText.split('\n').map(p => p.trim()).filter(p => p.length > 0)
        if (nameParts.length > 1) company.industry = nameParts[1]
        if (nameParts.length > 2) company.headquarters = nameParts[2]
        break
      }
    }
    companies.push(company)
  })

  return { type: 'company-list', source: 'linkedin-search', companies, total: companies.length, scrapedAt: new Date().toISOString() }
}

function scrapeSalesNavCompanies() {
  const companies = []
  const seen = new Set()
  let cards = []
  for (const sel of ['[data-x-search-result="ACCOUNT"]', '.search-results__result-item', '.artdeco-list__item']) {
    cards = Array.from(document.querySelectorAll(sel))
    if (cards.length > 0) break
  }
  if (cards.length === 0) {
    document.querySelectorAll('a[href*="/sales/company/"]').forEach(link => {
      const card = link.closest('li') || link.closest('[class*="result"]')
      if (card && !cards.includes(card)) cards.push(card)
    })
  }
  cards.forEach(card => {
    const company = { type: 'company', name: '', industry: '', size: '', headquarters: '', followers: '', description: '', linkedinUrl: '', salesNavUrl: '', scrapedAt: new Date().toISOString() }
    for (const sel of ['[data-anonymize="company-name"]', '.result-lockup__name', 'a[href*="/sales/company/"]']) {
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
  let cards = []
  for (const sel of ['[data-x-search-result="LEAD"]', '.search-results__result-item', '.artdeco-list__item']) {
    cards = Array.from(document.querySelectorAll(sel))
    if (cards.length > 0) break
  }
  cards.forEach(card => {
    const lead = { type: 'profile', name: '', title: '', company: '', location: '', profileUrl: '', scrapedAt: new Date().toISOString() }
    for (const sel of ['[data-anonymize="person-name"]', '.result-lockup__name a', 'a[href*="/sales/lead/"]']) {
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
  const maxScrolls = 30

  function getUniqueProfileCount() {
    const links = document.querySelectorAll('a[href*="linkedin.com/in/"]')
    const unique = new Set(Array.from(links).map(l => l.href.split('?')[0]))
    return unique.size
  }

  function findAndClickShowMore() {
    const buttons = Array.from(document.querySelectorAll('button'))
    for (const btn of buttons) {
      const text = (btn.innerText || btn.textContent || '').trim()
      if (
        text === 'Show more results' ||
        text === 'Load more results' ||
        text === 'See more' ||
        text === 'Show more'
      ) {
        const rect = btn.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(() => { btn.click() }, 600)
          return true
        }
      }
    }
    return false
  }

  function scrollStep() {
    const currentCount = getUniqueProfileCount()

    // Scroll to bottom first
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    totalScrolls++

    // Try clicking show more after scroll settles
    setTimeout(() => {
      findAndClickShowMore()
    }, 1500)

    if (currentCount === lastCount) {
      unchangedRounds++
    } else {
      unchangedRounds = 0
      lastCount = currentCount
    }

    if (unchangedRounds >= 4 || totalScrolls >= maxScrolls) {
      setTimeout(() => {
        callback(getUniqueProfileCount())
      }, 2500)
      return
    }

    setTimeout(scrollStep, 3500)
  }

  lastCount = getUniqueProfileCount()
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
    else if (pageType === 'linkedin-all-search') result = scrapeLinkedInCompanySearch()
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