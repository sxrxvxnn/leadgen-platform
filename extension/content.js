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

function detectAppointment() {
  const bookingPatterns = [
    /calendly\.com/i, /cal\.com/i, /topmate\.io/i, /tidycal\.com/i,
    /savvycal\.com/i, /zcal\.co/i, /hubspot.*meetings/i,
    /youcanbook/i, /acuityscheduling/i, /setmore/i, /doodle\.com/i,
  ]
  const allLinks = Array.from(document.querySelectorAll('a[href]'))
  const hasBookingLink = allLinks.some(link => bookingPatterns.some(p => p.test(link.href || '')))
  const pageText = document.body.innerText
  const hasBookingText = bookingPatterns.some(p => p.test(pageText))
  return (hasBookingLink || hasBookingText) ? 'Yes' : 'No'
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
    if (/^\d+[\d,.KkMm]*\s*followers?$/i.test(line) && !companyFollowers) companyFollowers = line
    if (/employees? on linkedin/i.test(line)) companySize = line.replace(/employees? on linkedin/i, '').trim()
    if (/associated member/i.test(line)) {
      const match = line.match(/(\d+)\s*associated/i)
      if (match && !companySize) companySize = match[1]
    }
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
      type: 'profile', name: '', title: '', company: companyName,
      location: '', profileUrl: url, followers: companyFollowers,
      employeeCount: companySize, appointment: 'No',
      scrapedAt: new Date().toISOString()
    }

    const isSkipLine = (l) => {
      return /^(1st|2nd|3rd\+?|connect|follow|message|linkedin member|pending|withdraw|view full profile|view profile|add|skip|close|next|previous|more)$/i.test(l) ||
        /degree connection/i.test(l) ||
        /\d+(st|nd|rd|th)\+?\s*degree/i.test(l) ||
        /mutual connection/i.test(l) ||
        /^\d+\s*(connection|follower|following)/i.test(l) ||
        l.startsWith('·') || l.startsWith('•') || l.length < 2
    }

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
            const potentialTitle = validLines[1]
            if (potentialTitle.toLowerCase() !== companyName.toLowerCase()) {
              lead.title = potentialTitle.length > 80 ? potentialTitle.substring(0, 77) + '...' : potentialTitle
            }
          }
          const locationPattern = /(india|usa|uk|singapore|australia|canada|germany|uae|kerala|bangalore|mumbai|delhi|hyderabad|chennai|remote|london|new york|dubai)/i
          for (let j = 2; j < validLines.length; j++) {
            if (locationPattern.test(validLines[j]) && validLines[j].length < 60) {
              lead.location = validLines[j]; break
            }
          }
          break
        }
      }
      card = card.parentElement
    }

    if (!lead.name || lead.name.toLowerCase() === 'linkedin member' || isSkipLine(lead.name)) {
      const slugMatch = url.match(/\/in\/([^/]+)/)
      if (slugMatch) {
        lead.name = slugMatch[1].replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      }
    }

    if (lead.name && lead.name.length > 1 && !isSkipLine(lead.name)) leads.push(lead)
  })

  return { type: 'search', leads, companyName, companyFollowers, companySize, scrapedAt: new Date().toISOString() }
}

function scrapeProfilePage() {
  const data = {
    type: 'profile', name: '', title: '', company: '', location: '',
    profileUrl: cleanUrl(window.location.href), followers: '', connections: '',
    about: '', experiences: [],
    appointment: 'No', scrapedAt: new Date().toISOString()
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

  const isDuration = (line) =>
    (/\d{4}/.test(line) && /present|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(line)) ||
    /\d+\s*(yr|mo|year|month)/i.test(line)

  const isEmploymentType = (line) =>
    /^(full-time|part-time|contract|freelance|internship|self-employed|apprenticeship|seasonal|on-site|remote|hybrid)$/i.test(line)

  const isLocation = (line) => line.length < 60 && (
    /,/.test(line) ||
    /(india|usa|uk|singapore|australia|canada|germany|uae|kerala|bangalore|mumbai|delhi|hyderabad|chennai|remote|london|new york|dubai|europe|asia|california|texas|florida|washington|new jersey|illinois)/i.test(line)
  )

  const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 1)

  let followersFound = false
  lines.forEach(line => {
    if (!followersFound && /^\d[\d,]*\+?\s*followers?$/i.test(line)) {
      data.followers = line
      followersFound = true
    }
    if (/^\d[\d,]*\+?\s*connections?$/i.test(line) && !data.connections) {
      data.connections = line
    }
  })

  const nameIndex = lines.findIndex(l => data.name && (l === data.name || l.startsWith(data.name)))

  if (nameIndex !== -1) {
    let titleFound = false
    let companyFound = false

    for (let i = nameIndex + 1; i < Math.min(nameIndex + 20, lines.length); i++) {
      const line = lines[i]
      if (skipLine(line) || line === data.name) continue
      if (line.startsWith('·')) continue

      if (!titleFound && line.length > 3) {
        const rawTitle = line.split('|')[0].trim()
        data.title = rawTitle.length > 80 ? rawTitle.substring(0, 77) + '...' : rawTitle
        titleFound = true
        continue
      }

      if (titleFound && !companyFound && line.includes('·') && line.length < 100 && !isLocation(line)) {
        data.company = line.split('·')[0].trim()
        companyFound = true
        continue
      }

      if (titleFound && !data.location && isLocation(line)) {
        data.location = line
        if (companyFound) break
      }

      if (titleFound && companyFound && data.location) break
    }
  }

  // ── About section ────────────────────────────────────────────
  const aboutIdx = lines.findIndex(l => /^about$/i.test(l))
  if (aboutIdx !== -1) {
    const sectionBoundaries = /^(experience|education|skills|activity|featured|interests|recommendations|licenses|certifications|projects|languages|honors|awards|publications|volunteering|contact info)$/i
    const aboutLines = []
    for (let i = aboutIdx + 1; i < Math.min(aboutIdx + 30, lines.length); i++) {
      const line = lines[i]
      if (sectionBoundaries.test(line)) break
      if (skipLine(line)) continue
      if (line.length > 5) aboutLines.push(line)
    }
    data.about = aboutLines.join(' ').trim().substring(0, 1200)
  }

  // ── Experience section ───────────────────────────────────────
  const expIdx = lines.findIndex(l => /^experience$/i.test(l))
  if (expIdx !== -1) {
    const expBoundary = /^(education|skills|activity|featured|interests|recommendations|licenses|certifications|projects|languages|honors|awards|publications|volunteering|contact info|courses)$/i
    const experiences = []
    let i = expIdx + 1
    while (i < Math.min(expIdx + 80, lines.length) && experiences.length < 8) {
      const line = lines[i]
      if (expBoundary.test(line)) break
      if (!line || line.length < 2 || skipLine(line) || isDuration(line) || isEmploymentType(line) || isLocation(line)) {
        i++; continue
      }
      // A title line is typically followed by company info or duration within a few lines
      if (line.length > 3 && line.length < 120) {
        const exp = { title: line, company: '', duration: '' }
        // Look ahead for company name and duration
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          const next = lines[j]
          if (expBoundary.test(next)) break
          if (isDuration(next) && !exp.duration) { exp.duration = next; continue }
          if (!isEmploymentType(next) && !isDuration(next) && !skipLine(next) && !exp.company && next.length > 1 && next.length < 80) {
            exp.company = next.split(' · ')[0].trim()
          }
        }
        // Only push if it looks like a real job entry (has a company or followed by duration)
        if (exp.company || exp.duration) experiences.push(exp)
        i += 3
        continue
      }
      i++
    }
    data.experiences = experiences
  }

  if (!data.company) {
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
          if (expLinesFound === 1) {
            data.company = line.split('·')[0].trim(); break
          }
          expLinesFound++
        }
      }
    }
  }

  // Pull company from first experience if still missing
  if (!data.company && data.experiences.length > 0 && data.experiences[0].company) {
    data.company = data.experiences[0].company
  }

  data.appointment = detectAppointment()
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

    // Name is first line of link text
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

    // Parse from link innerText — most reliable source
    // Format: "Name\n\nIndustry\n\nLocation"
    const linkParts = link.innerText.split('\n').map(p => p.trim()).filter(p => p.length > 0)
    // linkParts[0] = name, [1] = industry, [2] = location
    if (linkParts.length > 1) company.industry = linkParts[1]
    if (linkParts.length > 2) {
      const potentialHQ = linkParts[2]
      // Only use as HQ if it's not a followers count
      if (!/follower/i.test(potentialHQ)) {
        company.headquarters = potentialHQ
      }
    }

    // Get followers and description from card container
    let card = link
    for (let i = 0; i < 6; i++) {
      card = card.parentElement
      if (!card) break
      const cardLines = (card.innerText || '').split('\n').map(l => l.trim()).filter(l => l.length > 0)
      if (cardLines.length >= 4) {
        // Followers — line with "follower" text
        const followersLine = cardLines.find(l => /\d[\d,KkMm]*\s*followers?/i.test(l))
        if (followersLine) company.followers = followersLine

        // Description — long line, not name, not followers, not UI text
        const descLine = cardLines.find(l =>
          l.length > 40 &&
          !l.includes(name) &&
          !/follower|follow|sign up|visit website|get the linkedin/i.test(l) &&
          !l.match(/^\d+/)
        )
        if (descLine) company.description = descLine.substring(0, 200)
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
      if (text === 'Show more results' || text === 'Load more results' || text === 'See more' || text === 'Show more') {
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
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    totalScrolls++
    setTimeout(() => { findAndClickShowMore() }, 1500)

    if (currentCount === lastCount) {
      unchangedRounds++
    } else {
      unchangedRounds = 0
      lastCount = currentCount
    }

    if (unchangedRounds >= 4 || totalScrolls >= maxScrolls) {
      setTimeout(() => { callback(getUniqueProfileCount()) }, 2500)
      return
    }
    setTimeout(scrollStep, 3500)
  }

  lastCount = getUniqueProfileCount()
  scrollStep()
}

// ─── IN-PIPELINE BADGE ───────────────────────────────────────

const BADGE_ID = 'sonar-pipeline-badge'
const API_BASE = 'https://leadgenengineplatform-api.vercel.app/api'

function removeBadge() {
  const existing = document.getElementById(BADGE_ID)
  if (existing) existing.remove()
}

function injectBadge(lead) {
  removeBadge()
  const badge = document.createElement('div')
  badge.id = BADGE_ID

  const stageLabel = lead.stage ? lead.stage.charAt(0).toUpperCase() + lead.stage.slice(1) : 'Pipeline'
  const scoreText = lead.icp_score != null ? ` · ICP ${lead.icp_score}%` : ''
  const seqText = lead.in_sequence ? ' · In sequence' : ''

  badge.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0;"></span>
      <span style="font-weight:700;font-size:13px;color:#fff;">In Sonar</span>
      <span style="font-size:12px;color:rgba(255,255,255,0.75);">${stageLabel}${scoreText}${seqText}</span>
      <button id="sonar-badge-close" style="margin-left:4px;background:none;border:none;color:rgba(255,255,255,0.6);font-size:16px;line-height:1;cursor:pointer;padding:0 2px;">&times;</button>
    </div>
  `

  Object.assign(badge.style, {
    position: 'fixed',
    top: '72px',
    right: '20px',
    zIndex: '99999',
    background: 'rgba(18,18,18,0.95)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderLeft: '3px solid #E7000B',
    borderRadius: '10px',
    padding: '10px 14px',
    fontFamily: '"IBM Plex Mono", monospace, sans-serif',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(10px)',
    cursor: 'default',
    userSelect: 'none',
    minWidth: '220px',
  })

  document.body.appendChild(badge)

  document.getElementById('sonar-badge-close').addEventListener('click', (e) => {
    e.stopPropagation()
    removeBadge()
  })

  // Auto-dismiss after 8 seconds
  setTimeout(() => {
    const el = document.getElementById(BADGE_ID)
    if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; setTimeout(() => el.remove(), 400) }
  }, 8000)
}

function checkPipelineStatus() {
  if (getPageType() !== 'profile') return
  const profileUrl = cleanUrl(window.location.href)

  chrome.storage.local.get(['token'], (stored) => {
    const token = stored.token
    if (!token) return

    fetch(`${API_BASE}/leads/by-profile-url?url=${encodeURIComponent(profileUrl)}`, {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.lead) injectBadge(data.lead)
      })
      .catch(() => {})
  })
}

// Run on profile pages — wait for DOM to stabilize
let _badgeCheckTimer = null
function scheduleBadgeCheck() {
  if (getPageType() !== 'profile') return
  clearTimeout(_badgeCheckTimer)
  removeBadge()
  _badgeCheckTimer = setTimeout(checkPipelineStatus, 1800)
}

// LinkedIn is a SPA — watch for URL changes
let _lastCheckedUrl = ''
const _urlObserver = new MutationObserver(() => {
  const current = window.location.href
  if (current !== _lastCheckedUrl) {
    _lastCheckedUrl = current
    scheduleBadgeCheck()
  }
})
_urlObserver.observe(document.body, { childList: true, subtree: true })

// Initial check
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  _lastCheckedUrl = window.location.href
  scheduleBadgeCheck()
} else {
  document.addEventListener('DOMContentLoaded', () => {
    _lastCheckedUrl = window.location.href
    scheduleBadgeCheck()
  })
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
    autoScrollPeoplePage((count) => { sendResponse({ success: true, count }) })
    return true
  }

  if (message.action === 'getLeads') {
    chrome.storage.local.get({ leads: [] }, (data) => { sendResponse({ leads: data.leads }) })
    return true
  }

  return true
})