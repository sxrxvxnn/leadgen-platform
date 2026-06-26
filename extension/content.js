// ─── CONFIG ──────────────────────────────────────────────────────
const API_BASE = 'https://leadgenengineplatform-api.vercel.app/api'
const PANEL_ROOT_ID = 'sonar-panel-root'
const DASHBOARD_URL = 'https://sonarleads.vercel.app'

// ─── UTILITIES ───────────────────────────────────────────────────

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

function cleanUrl(url) { return url.split('?')[0].split('#')[0].rstrip ? url.split('?')[0].split('#')[0] : url.split('?')[0].split('#')[0] }

function getTokenFromStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['token'], (s) => { s.token ? resolve(s.token) : reject(new Error('not_logged_in')) })
  })
}

async function fetchAPI(path, method = 'GET', body = null, token) {
  const opts = { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } }
  if (body && method !== 'GET') opts.body = JSON.stringify(body)
  const r = await fetch(API_BASE + path, opts)
  if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status })
  return r.json()
}

function detectAppointment() {
  const patterns = [/calendly\.com/i, /cal\.com/i, /topmate\.io/i, /tidycal\.com/i, /savvycal\.com/i, /zcal\.co/i, /hubspot.*meetings/i, /youcanbook/i, /acuityscheduling/i, /setmore/i]
  const allLinks = Array.from(document.querySelectorAll('a[href]'))
  const hasBookingLink = allLinks.some(link => patterns.some(p => p.test(link.href || '')))
  return (hasBookingLink || patterns.some(p => p.test(document.body.innerText))) ? 'Yes' : 'No'
}

// ─── SCRAPERS (unchanged from v1.2) ──────────────────────────────

function scrapeCompanyPage() {
  const data = { type: 'company', name: '', industry: '', size: '', website: '', headquarters: '', description: '', followers: '', url: cleanUrl(window.location.href), scrapedAt: new Date().toISOString() }
  for (const sel of ['h1.org-top-card-summary__title', '.org-top-card-summary__title', 'h1']) { const el = document.querySelector(sel); if (el && el.innerText.trim()) { data.name = el.innerText.trim(); break } }
  document.querySelectorAll('.org-top-card-summary-info-list__info-item').forEach((item, i) => { const t = item.innerText.trim(); if (i === 0) data.industry = t; if (i === 1) data.size = t; if (i === 2) data.headquarters = t })
  if (!data.industry) { document.querySelectorAll('.artdeco-def-list__item dt').forEach((dt, i) => { const key = dt.innerText.trim().toLowerCase(); const val = document.querySelectorAll('.artdeco-def-list__item dd')[i]?.innerText.trim() || ''; if (key.includes('industry')) data.industry = val; if (key.includes('size') || key.includes('employees')) data.size = val; if (key.includes('headquarter')) data.headquarters = val; if (key.includes('website')) data.website = val }) }
  for (const sel of ['a[data-control-name="topbox_website"]']) { const el = document.querySelector(sel); if (el && el.href && !el.href.includes('linkedin')) { data.website = el.href; break } }
  for (const sel of ['p.org-top-card-summary__tagline', '.org-about-us-organization-description__text']) { const el = document.querySelector(sel); if (el) { data.description = el.innerText.trim(); break } }
  const m = document.body.innerText.match(/(\d[\d,KkMm]*)\s*followers?/i); if (m) data.followers = m[0].trim()
  return data
}

function scrapeCompanyPeoplePage() {
  let companyName = '', companyFollowers = '', companySize = ''
  const titleTag = document.title
  if (titleTag) companyName = titleTag.split('|')[0].replace(/people/gi, '').replace(/:/g, '').replace(/^\s*\(\d+\)\s*/, '').replace(/\s*\(\d+\)\s*$/, '').trim()
  const pageLines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  pageLines.forEach(line => { if (/^\d+[\d,.KkMm]*\s*followers?$/i.test(line) && !companyFollowers) companyFollowers = line; if (/employees? on linkedin/i.test(line)) companySize = line.replace(/employees? on linkedin/i, '').trim() })
  const leads = [], seen = new Set()
  document.querySelectorAll('a[href*="linkedin.com/in/"]').forEach(link => {
    const url = cleanUrl(link.href)
    if (!url || seen.has(url)) return
    if (/\/in\/[^/]+\/(detail|overlay|edit|recent-activity|posts|pulse)/.test(url)) return
    seen.add(url)
    const lead = { type: 'profile', name: '', title: '', company: companyName, location: '', profileUrl: url, followers: companyFollowers, employeeCount: companySize, appointment: 'No', scrapedAt: new Date().toISOString() }
    const isSkip = (l) => /^(1st|2nd|3rd\+?|connect|follow|message|linkedin member|pending|withdraw|view full profile|view profile|add|skip|close|next|previous|more)$/i.test(l) || /degree connection/i.test(l) || /mutual connection/i.test(l) || /^\d+\s*(connection|follower|following)/i.test(l) || l.startsWith('·') || l.length < 2
    let card = link.parentElement
    for (let i = 0; i < 6; i++) {
      if (!card) break
      const parent = card.parentElement
      if (parent && parent.children.length >= 2) {
        const lines = (card.innerText || '').trim().split('\n').map(l => l.trim()).filter(l => l.length > 1).filter(l => !isSkip(l))
        if (lines.length >= 2) { lead.name = lines[0]; if (lines[1]?.toLowerCase() !== companyName.toLowerCase()) lead.title = lines[1]?.length > 80 ? lines[1].substring(0, 77) + '...' : lines[1]; break }
      }
      card = card.parentElement
    }
    if (!lead.name || lead.name.toLowerCase() === 'linkedin member' || isSkip(lead.name)) { const m = url.match(/\/in\/([^/]+)/); if (m) lead.name = m[1].replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }
    if (lead.name && lead.name.length > 1 && !isSkip(lead.name)) leads.push(lead)
  })
  return { type: 'search', leads, companyName, companyFollowers, companySize, scrapedAt: new Date().toISOString() }
}

function scrapeProfilePage() {
  const data = { type: 'profile', name: '', title: '', company: '', location: '', profileUrl: cleanUrl(window.location.href), followers: '', connections: '', about: '', experiences: [], appointment: 'No', scrapedAt: new Date().toISOString() }
  const pageTitle = document.title; if (pageTitle) data.name = pageTitle.split('|')[0].trim()
  const skipLine = (l) => [/^(1st|2nd|3rd|connect|follow|message|linkedin|pending|withdraw)$/i, /degree connection/i, /mutual connection/i, /^(view|open to|highlights|about|experience|education|skills|activity|featured|interests|recommendations|show all)$/i, /^(notification|search|home|my network|jobs|messaging)$/i, /newsletter/i, /^\d+\s*(followers|connections|following)/i, /^(she\/her|he\/him|they\/them)$/i, /^\d+$/, /^(save|share|more|report|block|remove|unfollow|following)$/i].some(p => p.test(l))
  const isDuration = (l) => (/\d{4}/.test(l) && /present|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(l)) || /\d+\s*(yr|mo|year|month)/i.test(l)
  const isLocation = (l) => l.length < 60 && (l.includes(',') || /(india|usa|uk|singapore|australia|canada|germany|uae|kerala|bangalore|mumbai|delhi|hyderabad|chennai|remote|london|new york|dubai|europe|california)/i.test(l))
  const isEmploymentType = (l) => /^(full-time|part-time|contract|freelance|internship|self-employed|remote|hybrid|on-site)$/i.test(l)
  const lines = document.body.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 1)
  lines.forEach(l => { if (!data.followers && /^\d[\d,]*\+?\s*followers?$/i.test(l)) data.followers = l; if (/^\d[\d,]*\+?\s*connections?$/i.test(l) && !data.connections) data.connections = l })
  const ni = lines.findIndex(l => data.name && (l === data.name || l.startsWith(data.name)))
  if (ni !== -1) { let tf = false, cf = false; for (let i = ni + 1; i < Math.min(ni + 20, lines.length); i++) { const l = lines[i]; if (skipLine(l) || l === data.name || l.startsWith('·')) continue; if (!tf && l.length > 3) { data.title = l.split('|')[0].trim().substring(0, 80); tf = true; continue } if (tf && !cf && l.includes('·') && l.length < 100 && !isLocation(l)) { data.company = l.split('·')[0].trim(); cf = true; continue } if (tf && !data.location && isLocation(l)) { data.location = l; if (cf) break } if (tf && cf && data.location) break } }
  const aboutIdx = lines.findIndex(l => /^about$/i.test(l)); if (aboutIdx !== -1) { const boundary = /^(experience|education|skills|activity|featured|interests|recommendations|licenses|certifications|projects|languages|honors|awards)$/i; const al = []; for (let i = aboutIdx + 1; i < Math.min(aboutIdx + 30, lines.length); i++) { if (boundary.test(lines[i])) break; if (!skipLine(lines[i]) && lines[i].length > 5) al.push(lines[i]) }; data.about = al.join(' ').substring(0, 1200) }
  const expIdx = lines.findIndex(l => /^experience$/i.test(l)); if (expIdx !== -1) { const eb = /^(education|skills|activity|featured|interests|recommendations|licenses|certifications|projects|languages)$/i; let i = expIdx + 1; while (i < Math.min(expIdx + 80, lines.length) && data.experiences.length < 8) { const l = lines[i]; if (eb.test(l)) break; if (!l || l.length < 2 || skipLine(l) || isDuration(l) || isEmploymentType(l) || isLocation(l)) { i++; continue }; if (l.length > 3 && l.length < 120) { const exp = { title: l, company: '', duration: '' }; for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) { const n = lines[j]; if (eb.test(n)) break; if (isDuration(n) && !exp.duration) { exp.duration = n; continue } if (!isEmploymentType(n) && !isDuration(n) && !skipLine(n) && !exp.company && n.length > 1 && n.length < 80) exp.company = n.split(' · ')[0].trim() }; if (exp.company || exp.duration) data.experiences.push(exp); i += 3; continue }; i++ } }
  if (!data.company && data.experiences.length > 0) data.company = data.experiences[0].company
  data.appointment = detectAppointment()
  return data
}

function scrapeSearchPage() {
  const leads = []
  document.querySelectorAll('li.reusable-search__result-container').forEach(card => {
    const lead = { type: 'profile', name: '', title: '', company: '', location: '', profileUrl: '', scrapedAt: new Date().toISOString() }
    const nameEl = card.querySelector('span.entity-result__title-text a span[aria-hidden="true"]'); if (nameEl) lead.name = nameEl.innerText.trim()
    const titleEl = card.querySelector('.entity-result__primary-subtitle'); if (titleEl) lead.title = titleEl.innerText.trim().substring(0, 80)
    const companyEl = card.querySelector('.entity-result__secondary-subtitle'); if (companyEl) lead.company = companyEl.innerText.trim()
    const locationEl = card.querySelector('.entity-result__tertiary-subtitle'); if (locationEl) lead.location = locationEl.innerText.trim()
    const linkEl = card.querySelector('a.app-aware-link'); if (linkEl) lead.profileUrl = cleanUrl(linkEl.href)
    if (lead.name) leads.push(lead)
  })
  return { type: 'search', leads, scrapedAt: new Date().toISOString() }
}

function scrapeLinkedInCompanySearch() {
  const companies = [], seen = new Set()
  document.querySelectorAll('a[href*="linkedin.com/company/"]').forEach(link => {
    const href = cleanUrl(link.href); const m = href.match(/linkedin\.com\/company\/([a-zA-Z0-9_-]+)\/?$/); if (!m) return; const slug = m[1]; if (['linkedin', 'company', 'school', 'showcase'].includes(slug) || seen.has(slug)) return; seen.add(slug)
    const name = link.innerText.split('\n')[0].trim(); if (!name || name.length < 2 || name.length > 100 || /^(follow|following|connect|sign up|visit website)$/i.test(name)) return
    const company = { type: 'company', name, industry: '', headquarters: '', followers: '', description: '', linkedinUrl: href, scrapedAt: new Date().toISOString() }
    const parts = link.innerText.split('\n').map(p => p.trim()).filter(p => p.length > 0); if (parts.length > 1) company.industry = parts[1]; if (parts.length > 2 && !/follower/i.test(parts[2])) company.headquarters = parts[2]
    let card = link; for (let i = 0; i < 6; i++) { card = card.parentElement; if (!card) break; const cardLines = (card.innerText || '').split('\n').map(l => l.trim()).filter(l => l.length > 0); if (cardLines.length >= 4) { const fl = cardLines.find(l => /\d[\d,KkMm]*\s*followers?/i.test(l)); if (fl) company.followers = fl; const dl = cardLines.find(l => l.length > 40 && !l.includes(name) && !/follower|follow|sign up/i.test(l) && !l.match(/^\d+/)); if (dl) company.description = dl.substring(0, 200); break } }
    companies.push(company)
  })
  return { type: 'company-list', source: 'linkedin-search', companies, total: companies.length, scrapedAt: new Date().toISOString() }
}

function scrapeSalesNavCompanies() {
  const companies = [], seen = new Set(); let cards = []
  for (const sel of ['[data-x-search-result="ACCOUNT"]', '.search-results__result-item', '.artdeco-list__item']) { cards = Array.from(document.querySelectorAll(sel)); if (cards.length > 0) break }
  if (cards.length === 0) { document.querySelectorAll('a[href*="/sales/company/"]').forEach(link => { const card = link.closest('li') || link.closest('[class*="result"]'); if (card && !cards.includes(card)) cards.push(card) }) }
  cards.forEach(card => {
    const company = { type: 'company', name: '', industry: '', size: '', headquarters: '', followers: '', description: '', linkedinUrl: '', salesNavUrl: '', scrapedAt: new Date().toISOString() }
    for (const sel of ['[data-anonymize="company-name"]', '.result-lockup__name', 'a[href*="/sales/company/"]']) { const el = card.querySelector(sel); if (el && el.innerText.trim()) { company.name = el.innerText.trim(); break } }
    const salesLink = card.querySelector('a[href*="/sales/company/"]'); if (salesLink) company.salesNavUrl = salesLink.href
    if (company.name && !seen.has(company.name)) { seen.add(company.name); companies.push(company) }
  })
  return { type: 'company-list', source: 'sales-navigator', companies, total: companies.length, scrapedAt: new Date().toISOString() }
}

function scrapeSalesNavPeople() {
  const leads = [], seen = new Set(); let cards = []
  for (const sel of ['[data-x-search-result="LEAD"]', '.search-results__result-item', '.artdeco-list__item']) { cards = Array.from(document.querySelectorAll(sel)); if (cards.length > 0) break }
  cards.forEach(card => {
    const lead = { type: 'profile', name: '', title: '', company: '', location: '', profileUrl: '', scrapedAt: new Date().toISOString() }
    for (const sel of ['[data-anonymize="person-name"]', '.result-lockup__name a', 'a[href*="/sales/lead/"]']) { const el = card.querySelector(sel); if (el && el.innerText.trim()) { lead.name = el.innerText.trim(); break } }
    const profileLink = card.querySelector('a[href*="/sales/lead/"]') || card.querySelector('a[href*="/in/"]'); if (profileLink) lead.profileUrl = cleanUrl(profileLink.href)
    if (lead.name && !seen.has(lead.name)) { seen.add(lead.name); leads.push(lead) }
  })
  return { type: 'search', leads, scrapedAt: new Date().toISOString() }
}

function autoScrollPeoplePage(callback) {
  let lastCount = 0, unchangedRounds = 0, totalScrolls = 0; const maxScrolls = 30
  const getCount = () => new Set(Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]')).map(l => l.href.split('?')[0])).size
  const clickShowMore = () => { for (const btn of document.querySelectorAll('button')) { const t = (btn.innerText || '').trim(); if (['Show more results', 'Load more results', 'See more', 'Show more'].includes(t)) { const r = btn.getBoundingClientRect(); if (r.width > 0) { btn.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => btn.click(), 600); return true } } }; return false }
  function step() { const current = getCount(); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); totalScrolls++; setTimeout(() => clickShowMore(), 1500); if (current === lastCount) unchangedRounds++; else { unchangedRounds = 0; lastCount = current }; if (unchangedRounds >= 4 || totalScrolls >= maxScrolls) { setTimeout(() => callback(getCount()), 2500); return }; setTimeout(step, 3500) }
  lastCount = getCount(); step()
}

// ─── PANEL STYLES ────────────────────────────────────────────────

function injectPanelStyles() {
  if (document.getElementById('sonar-panel-styles')) return
  const style = document.createElement('style')
  style.id = 'sonar-panel-styles'
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;500;600;700;800&family=Barlow+Condensed:wght@700;800;900&display=swap');

    #sonar-root *, #sonar-root *::before, #sonar-root *::after { box-sizing:border-box; margin:0; padding:0; font-family:'Host Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    #sonar-tab { position:fixed; right:0; top:50%; transform:translateY(-50%); z-index:2147483646; width:30px; height:76px; background:#fff; border:1px solid #e5e7eb; border-right:none; border-radius:8px 0 0 8px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .15s,width .15s; box-shadow:-2px 0 8px rgba(0,0,0,.07); }
    #sonar-tab:hover { background:#f9fafb; width:34px; }
    #sonar-tab svg { display:block; }
    #sonar-panel { position:fixed; right:-304px; top:0; height:100vh; width:304px; background:#fff; border-left:1px solid #e5e7eb; z-index:2147483647; transition:right .28s cubic-bezier(.22,1,.36,1); overflow-y:auto; overflow-x:hidden; display:flex; flex-direction:column; scrollbar-width:thin; scrollbar-color:#e5e7eb transparent; box-shadow:-8px 0 32px rgba(0,0,0,.08); }
    #sonar-panel::-webkit-scrollbar { width:4px; }
    #sonar-panel::-webkit-scrollbar-track { background:transparent; }
    #sonar-panel::-webkit-scrollbar-thumb { background:#e5e7eb; border-radius:2px; }
    #sonar-panel.open { right:0; }
    .sp-hd { display:flex; align-items:center; justify-content:space-between; padding:13px 14px; border-bottom:1px solid #e5e7eb; flex-shrink:0; background:#fff; }
    .sp-brand { display:flex; align-items:center; gap:8px; }
    .sp-logo { width:20px; height:20px; background:#E7000B; border-radius:5px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .sp-name-text { font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:800; letter-spacing:.14em; color:#111827; text-transform:uppercase; }
    .sp-x { background:none; border:none; color:#9ca3af; font-size:18px; cursor:pointer; padding:2px 4px; line-height:1; transition:color .15s; border-radius:4px; }
    .sp-x:hover { color:#111827; background:#f3f4f6; }
    .sp-sec { padding:13px 14px; border-bottom:1px solid #f3f4f6; flex-shrink:0; }
    .sp-sec:last-child { border-bottom:none; }
    .sp-lbl { font-size:9px; font-weight:700; letter-spacing:.12em; color:#9ca3af; text-transform:uppercase; margin-bottom:8px; display:block; }
    .sp-person-name { font-size:14px; font-weight:700; color:#111827; margin-bottom:3px; line-height:1.25; }
    .sp-person-sub { font-size:11px; color:#6b7280; margin-bottom:2px; line-height:1.4; }
    .sp-status-row { display:flex; align-items:center; gap:7px; margin-bottom:9px; }
    .sp-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
    .sp-dot.in { background:#16a34a; box-shadow:0 0 7px rgba(22,163,74,.35); }
    .sp-dot.out { background:#d1d5db; }
    .sp-status-label { font-size:11px; font-weight:700; color:#111827; }
    .sp-chips { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:4px; }
    .sp-chip { display:inline-block; font-size:9px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; padding:2px 8px; border-radius:999px; border:1px solid; white-space:nowrap; }
    .sp-chip.stage { background:#f3f4f6; border-color:#e5e7eb; color:#6b7280; }
    .sp-chip.icp-hi { background:rgba(22,163,74,.08); border-color:rgba(22,163,74,.25); color:#16a34a; }
    .sp-chip.icp-md { background:rgba(217,119,6,.08); border-color:rgba(217,119,6,.25); color:#d97706; }
    .sp-chip.icp-lo { background:#f3f4f6; border-color:#e5e7eb; color:#9ca3af; }
    .sp-chip.ok  { background:rgba(22,163,74,.08); border-color:rgba(22,163,74,.25); color:#16a34a; }
    .sp-chip.warn { background:rgba(217,119,6,.08); border-color:rgba(217,119,6,.25); color:#d97706; }
    .sp-chip.bad  { background:rgba(220,38,38,.07); border-color:rgba(220,38,38,.22); color:#dc2626; }
    .sp-chip.seq  { background:rgba(37,99,235,.07); border-color:rgba(37,99,235,.2); color:#2563eb; }
    .sp-email-row { display:flex; align-items:center; gap:8px; }
    .sp-email-addr { font-size:11px; color:#374151; flex:1; word-break:break-all; font-weight:500; }
    .sp-copy { background:#f9fafb; border:1px solid #e5e7eb; border-radius:5px; color:#6b7280; font-size:9px; font-weight:600; padding:3px 9px; cursor:pointer; font-family:inherit; flex-shrink:0; transition:border-color .15s,color .15s; }
    .sp-copy:hover { border-color:#d1d5db; color:#111827; }
    .sp-btn { display:flex; align-items:center; justify-content:space-between; width:100%; padding:9px 13px; border-radius:7px; font-family:inherit; font-size:11px; font-weight:600; cursor:pointer; transition:all .15s; margin-bottom:6px; border:none; }
    .sp-btn:last-child { margin-bottom:0; }
    .sp-btn:disabled { opacity:.35; cursor:not-allowed; }
    .sp-btn.pri { background:#E7000B; color:#fff; }
    .sp-btn.pri:hover:not(:disabled) { background:#c50009; box-shadow:0 4px 14px rgba(231,0,11,.22); }
    .sp-btn.sec { background:#f9fafb; color:#374151; border:1px solid #e5e7eb; }
    .sp-btn.sec:hover:not(:disabled) { border-color:#d1d5db; color:#111827; background:#f3f4f6; }
    .sp-btn.ok   { background:rgba(22,163,74,.07); color:#16a34a; border:1px solid rgba(22,163,74,.2); }
    .sp-btn.warn { background:rgba(217,119,6,.07); color:#d97706; border:1px solid rgba(217,119,6,.2); }
    .sp-seq-row { display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f9fafb; }
    .sp-seq-row:last-child { border-bottom:none; }
    .sp-seq-nm { font-size:11px; color:#374151; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:8px; }
    .sp-enroll { font-size:9px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; background:rgba(231,0,11,.07); border:1px solid rgba(231,0,11,.2); color:#E7000B; border-radius:999px; padding:4px 10px; cursor:pointer; font-family:inherit; transition:background .15s; flex-shrink:0; }
    .sp-enroll:hover { background:rgba(231,0,11,.14); }
    .sp-enroll:disabled { opacity:.35; cursor:not-allowed; }
    .sp-load { display:flex; align-items:center; justify-content:center; padding:24px; color:#9ca3af; font-size:11px; gap:8px; font-weight:500; }
    .sp-note { font-size:11px; color:#6b7280; line-height:1.6; }
    .sp-divider { height:1px; background:#f3f4f6; margin:8px 0; }
    .sp-ft { margin-top:auto; padding:11px 14px; border-top:1px solid #e5e7eb; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; background:#fff; }
    .sp-ft a { font-size:11px; color:#9ca3af; text-decoration:none; font-weight:500; transition:color .15s; }
    .sp-ft a:hover { color:#111827; }
    .sp-ft-v { font-size:10px; color:#d1d5db; }
    @keyframes sp-spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
    .sp-spinner { display:inline-block; width:10px; height:10px; border:1.5px solid #e5e7eb; border-top-color:#E7000B; border-radius:50%; animation:sp-spin .75s linear infinite; }

    /* Search results inline buttons */
    .snr-btn { display:inline-flex; align-items:center; gap:3px; padding:4px 10px; border-radius:999px; font-family:'Host Grotesk',sans-serif; font-size:10px; font-weight:600; cursor:pointer; transition:all .15s; border:1px solid; white-space:nowrap; vertical-align:middle; }
    .snr-btn.add  { color:#E7000B; border-color:rgba(231,0,11,.3); background:rgba(231,0,11,.06); }
    .snr-btn.add:hover { background:rgba(231,0,11,.12); border-color:#E7000B; }
    .snr-btn.in   { color:#16a34a; border-color:rgba(22,163,74,.3); background:rgba(22,163,74,.06); cursor:default; pointer-events:none; }
    .snr-btn.load { color:#d1d5db; border-color:#e5e7eb; background:#fff; cursor:wait; }

    /* Company page quick-add */
    #sonar-company-btn { position:fixed; bottom:24px; right:24px; z-index:2147483646; display:flex; align-items:center; gap:8px; padding:11px 18px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; cursor:pointer; font-family:'Host Grotesk',sans-serif; font-size:12px; font-weight:700; color:#111827; box-shadow:0 4px 16px rgba(0,0,0,.1); transition:border-color .15s,box-shadow .15s; }
    #sonar-company-btn:hover { border-color:#d1d5db; box-shadow:0 6px 24px rgba(0,0,0,.14); }
    #sonar-company-btn.added { color:#16a34a; border-color:rgba(22,163,74,.3); }
  `
  document.head.appendChild(style)
}

// ─── PANEL DOM ───────────────────────────────────────────────────

function createPanel() {
  if (document.getElementById(PANEL_ROOT_ID)) return
  injectPanelStyles()

  const root = document.createElement('div')
  root.id = PANEL_ROOT_ID
  root.innerHTML = `
    <div id="sonar-tab" title="Open Sonar">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#E7000B" stroke-width="1.3" opacity="0.45"/>
        <circle cx="8" cy="8" r="4" stroke="#E7000B" stroke-width="1.3" opacity="0.8"/>
        <circle cx="8" cy="8" r="1.5" fill="#E7000B"/>
        <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#E7000B" stroke-width="1.3" stroke-linecap="round"/>
      </svg>
    </div>
    <div id="sonar-panel">
      <div class="sp-hd">
        <div class="sp-brand">
          <div class="sp-logo">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#fff" stroke-width="1.3" opacity="0.5"/>
              <circle cx="8" cy="8" r="4" stroke="#fff" stroke-width="1.3" opacity="0.85"/>
              <circle cx="8" cy="8" r="1.5" fill="#fff"/>
              <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
          </div>
          <span class="sp-name-text">Sonar</span>
        </div>
        <button class="sp-x" id="sonar-close">×</button>
      </div>
      <div id="sonar-body"><div class="sp-load"><span class="sp-spinner"></span> <span>Loading…</span></div></div>
      <div class="sp-ft">
        <a href="${DASHBOARD_URL}" target="_blank">Open dashboard →</a>
        <span class="sp-ft-v">v1.5</span>
      </div>
    </div>
  `
  document.body.appendChild(root)
  document.getElementById('sonar-tab').addEventListener('click', togglePanel)
  document.getElementById('sonar-close').addEventListener('click', hidePanel)
}

let _panelOpen = false

function showPanel() { document.getElementById('sonar-panel')?.classList.add('open'); document.getElementById('sonar-tab').style.display = 'none'; _panelOpen = true }
function hidePanel() { document.getElementById('sonar-panel')?.classList.remove('open'); const t = document.getElementById('sonar-tab'); if (t) t.style.display = ''; _panelOpen = false }
function togglePanel() { _panelOpen ? hidePanel() : showPanel() }
function setBody(html) { const b = document.getElementById('sonar-body'); if (b) b.innerHTML = html }

// ─── PANEL CONTENT ───────────────────────────────────────────────

function buildIcpChip(score) {
  if (score == null) return ''
  const cls = score >= 70 ? 'icp-hi' : score >= 40 ? 'icp-md' : 'icp-lo'
  return `<span class="sp-chip ${cls}">ICP ${score}</span>`
}

function buildEmailChip(status) {
  if (!status) return ''
  const map = { valid: ['ok', '✓ valid'], risky: ['warn', '⚠ risky'], invalid: ['bad', '✕ invalid'], role: ['warn', '⊘ role'], catch_all: ['warn', '~ catch-all'] }
  const [cls, lbl] = map[status] || ['', '']
  return cls ? `<span class="sp-chip ${cls}">${lbl}</span>` : ''
}

async function loadPanel() {
  if (getPageType() !== 'profile') return

  const url = window.location.href.split('?')[0].split('#')[0]
  setBody('<div class="sp-load"><span class="sp-spinner"></span> <span>Checking pipeline…</span></div>')

  let token
  try { token = await getTokenFromStorage() } catch {
    setBody(`
      <div class="sp-sec">
        <span class="sp-lbl">Status</span>
        <div class="sp-status-row"><div class="sp-dot out"></div><span class="sp-status-label" style="color:#6b7280">Not signed in</span></div>
        <p class="sp-note">Open the Sonar extension popup to sign in, then refresh this page.</p>
      </div>`)
    return
  }

  try {
    const [pipeRes, seqRes] = await Promise.all([
      fetchAPI(`/leads/by-profile-url?url=${encodeURIComponent(url)}`, 'GET', null, token),
      fetchAPI('/sequences', 'GET', null, token),
    ])

    const pageData = scrapeProfilePage()
    const lead = pipeRes.lead || null
    const sequences = (seqRes.sequences || []).filter(s => s.status === 'active')

    let html = ''

    // ── Person info
    html += `<div class="sp-sec">
      <span class="sp-lbl">Profile</span>
      <div class="sp-person-name">${pageData.name || '—'}</div>
      ${pageData.title ? `<div class="sp-person-sub">${pageData.title}</div>` : ''}
      ${pageData.company ? `<div class="sp-person-sub" style="color:#6b7280">${pageData.company}</div>` : ''}
      ${pageData.location ? `<div class="sp-person-sub" style="color:#9ca3af;margin-top:2px">${pageData.location}</div>` : ''}
    </div>`

    if (lead) {
      // ── Job change detection
      const storedCompany = (lead.company || '').trim().toLowerCase()
      const liveCompany   = (pageData.company || '').trim().toLowerCase()
      const storedTitle   = (lead.title || '').trim().toLowerCase()
      const liveTitle     = (pageData.title || '').trim().toLowerCase()
      const companyChanged = liveCompany && storedCompany && liveCompany !== storedCompany
      const titleChanged   = liveTitle && storedTitle && liveTitle !== storedTitle && companyChanged

      if (companyChanged) {
        html += `<div style="margin:0 0 10px;padding:10px 12px;background:rgba(176,125,46,0.08);border:1px solid rgba(176,125,46,0.3);border-radius:7px">
          <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#b07d2e;margin-bottom:5px">Job Change Detected</div>
          <div style="font-size:10px;color:#374151;line-height:1.5">${lead.company} <span style="color:#b07d2e">→</span> ${pageData.company}</div>
          <button id="sp-flag-jobchange" data-lid="${lead.id}" data-old-company="${lead.company || ''}" data-old-title="${lead.title || ''}" data-new-company="${pageData.company || ''}" data-new-title="${pageData.title || ''}" style="margin-top:8px;padding:4px 10px;background:rgba(176,125,46,0.15);border:1px solid rgba(176,125,46,0.35);border-radius:4px;color:#b07d2e;font-size:9px;font-weight:700;letter-spacing:.06em;cursor:pointer;font-family:inherit">Flag in Sonar</button>
        </div>`
      }

      // ── Pipeline status
      html += `<div class="sp-sec">
        <span class="sp-lbl">Pipeline</span>
        <div class="sp-status-row"><div class="sp-dot in"></div><span class="sp-status-label">In Sonar</span></div>
        <div class="sp-chips">
          ${lead.stage ? `<span class="sp-chip stage">${lead.stage}</span>` : ''}
          ${buildIcpChip(lead.icp_score)}
          ${buildEmailChip(lead.email_status)}
          ${lead.in_sequence ? '<span class="sp-chip seq">In sequence</span>' : ''}
        </div>
      </div>`

      // ── Email
      const email = lead.email
      if (email) {
        html += `<div class="sp-sec">
          <span class="sp-lbl">Email</span>
          <div class="sp-email-row">
            <span class="sp-email-addr">${email}</span>
            <button class="sp-copy" data-copy="${email}">Copy</button>
          </div>
        </div>`
      }

      // ── Actions
      html += `<div class="sp-sec">
        <button class="sp-btn sec" id="sp-view" data-id="${lead.id}"><span>View in Sonar</span><span>→</span></button>
        <button class="sp-btn sec" id="sp-update" data-id="${lead.id}"><span>Sync profile data</span><span>↑</span></button>
        ${!email ? `<button class="sp-btn sec" id="sp-find-email" data-id="${lead.id}"><span>Find email</span><span>◎</span></button>` : ''}
        ${lead.email && lead.email_status !== 'valid' ? `<button class="sp-btn sec" id="sp-verify" data-id="${lead.id}"><span>Verify email</span><span>✓</span></button>` : ''}
        <button class="sp-btn sec" id="sp-draft" data-id="${lead.id}" data-name="${pageData.name}" data-company="${pageData.company || ''}"><span>Draft email with AI</span><span>✉</span></button>
      </div>`
    } else {
      // ── Not in pipeline
      html += `<div class="sp-sec">
        <span class="sp-lbl">Pipeline</span>
        <div class="sp-status-row"><div class="sp-dot out"></div><span class="sp-status-label" style="color:#6b7280">Not in Sonar</span></div>
        <button class="sp-btn pri" id="sp-add"><span>Add to pipeline</span><span>+</span></button>
        <button class="sp-btn sec" id="sp-find-email"><span>Find email</span><span>◎</span></button>
      </div>`
    }

    // ── Email reveal placeholder (populated dynamically)
    html += `<div id="sp-email-reveal"></div>`

    // ── AI draft result placeholder
    html += `<div id="sp-draft-result"></div>`

    // ── Sequences
    if (sequences.length > 0) {
      html += `<div class="sp-sec">
        <span class="sp-lbl">Enroll in sequence</span>
        ${sequences.slice(0, 6).map(seq => `
          <div class="sp-seq-row">
            <span class="sp-seq-nm">${seq.name}</span>
            <button class="sp-enroll" data-seq="${seq.id}" data-lid="${lead?.id || ''}" ${!lead ? 'data-needadd="1"' : ''}>Enroll</button>
          </div>`).join('')}
      </div>`
    }

    // ── Connections + followers
    if (pageData.connections || pageData.followers) {
      html += `<div class="sp-sec">
        <span class="sp-lbl">LinkedIn</span>
        <div style="display:flex;gap:16px">
          ${pageData.connections ? `<div><div style="font-size:11px;color:#111827;font-weight:700">${pageData.connections}</div><div style="font-size:9px;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;margin-top:2px">Connections</div></div>` : ''}
          ${pageData.followers ? `<div><div style="font-size:11px;color:#111827;font-weight:700">${pageData.followers}</div><div style="font-size:9px;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;margin-top:2px">Followers</div></div>` : ''}
          ${pageData.appointment === 'Yes' ? `<div><div style="font-size:11px;color:#16a34a;font-weight:700">Yes</div><div style="font-size:9px;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;margin-top:2px">Booking link</div></div>` : ''}
        </div>
      </div>`
    }

    setBody(html)
    wirePanelHandlers(pageData, lead, token)

  } catch (e) {
    setBody(`<div class="sp-load" style="color:#E7000B">Failed to load. Refresh and try again.</div>`)
  }
}

function wirePanelHandlers(pageData, lead, token) {
  // Copy buttons
  document.querySelectorAll('.sp-copy[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.copy).catch(() => {})
      const orig = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = orig, 1500)
    })
  })

  // Flag job change
  document.getElementById('sp-flag-jobchange')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Flagging…'
    try {
      await fetchAPI('/job-change-alerts', 'POST', {
        lead_id:     btn.dataset.lid,
        old_company: btn.dataset.oldCompany,
        old_title:   btn.dataset.oldTitle,
        new_company: btn.dataset.newCompany,
        new_title:   btn.dataset.newTitle,
        detected_via: 'extension',
      }, token)
      btn.textContent = '✓ Flagged in Sonar'
      btn.style.color = '#4a7c59'
      btn.style.borderColor = 'rgba(74,124,89,0.4)'
    } catch { btn.textContent = 'Failed'; btn.disabled = false }
  })

  // View in Sonar
  document.getElementById('sp-view')?.addEventListener('click', () => {
    window.open(`${DASHBOARD_URL}/leads`, '_blank')
  })

  // Sync profile data
  document.getElementById('sp-update')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true; btn.querySelector('span').textContent = 'Syncing…'
    try {
      const d = scrapeProfilePage()
      const patch = {}; if (d.name) patch.name = d.name; if (d.title) patch.title = d.title; if (d.company) patch.company = d.company; if (d.location) patch.location = d.location; if (d.about) patch.about = d.about; if (d.experiences?.length) patch.experience = d.experiences
      await fetchAPI(`/leads/${lead.id}`, 'PATCH', patch, token)
      btn.className = 'sp-btn ok'; btn.querySelector('span').textContent = '✓ Synced'
    } catch { btn.querySelector('span').textContent = 'Failed'; btn.disabled = false }
  })

  // Add to pipeline
  document.getElementById('sp-add')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true; btn.querySelector('span').textContent = 'Adding…'
    try {
      const d = scrapeProfilePage()
      const url = window.location.href.split('?')[0].split('#')[0]
      await fetchAPI('/leads', 'POST', { name: d.name, title: d.title, company: d.company, location: d.location, about: d.about, profile_url: url, linkedin_url: url, source: 'chrome_extension' }, token)
      btn.className = 'sp-btn ok'; btn.querySelector('span').textContent = '✓ Added to pipeline'
      setTimeout(() => loadPanel(), 900)
    } catch (err) {
      if (err.status === 409) { btn.className = 'sp-btn warn'; btn.querySelector('span').textContent = 'Already in Sonar' }
      else { btn.querySelector('span').textContent = 'Failed'; btn.disabled = false }
    }
  })

  // Find email
  document.getElementById('sp-find-email')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true; btn.querySelector('span').textContent = 'Searching…'
    try {
      const d = scrapeProfilePage()
      const res = await fetchAPI('/prospect/people-search', 'POST', { query: { name: d.name, company: d.company }, page: 1, limit: 1 }, token)
      const person = (res.results || [])[0]
      const email = person?.work_email || person?.email
      if (email) {
        const section = document.getElementById('sp-email-reveal')
        if (section) section.innerHTML = `<div class="sp-sec"><span class="sp-lbl">Found email</span><div class="sp-email-row"><span class="sp-email-addr">${email}</span><button class="sp-copy" data-copy="${email}">Copy</button></div></div>`
        document.querySelectorAll('.sp-copy[data-copy]').forEach(b => { b.addEventListener('click', () => { navigator.clipboard.writeText(b.dataset.copy).catch(() => {}); const o = b.textContent; b.textContent = 'Copied!'; setTimeout(() => b.textContent = o, 1500) }) })
        btn.className = 'sp-btn ok'; btn.querySelector('span').textContent = '✓ Found'
      } else {
        btn.querySelector('span').textContent = 'Not found'; btn.disabled = false
      }
    } catch { btn.querySelector('span').textContent = 'Failed'; btn.disabled = false }
  })

  // Verify email
  document.getElementById('sp-verify')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true; btn.querySelector('span').textContent = 'Verifying…'
    try {
      const res = await fetchAPI(`/leads/${lead.id}/verify-email`, 'POST', {}, token)
      const good = res.status === 'valid'
      btn.className = `sp-btn ${good ? 'ok' : 'warn'}`
      btn.querySelector('span').textContent = `${good ? '✓ Valid' : res.status === 'risky' ? '⚠ Risky' : '✕ Invalid'} · ${res.score || 0}% deliverability`
    } catch { btn.querySelector('span').textContent = 'Failed'; btn.disabled = false }
  })

  // AI email draft
  document.getElementById('sp-draft')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true; btn.querySelector('span').textContent = 'Drafting…'
    try {
      const res = await fetchAPI(`/leads/${lead.id}/draft-email`, 'POST', {}, token)
      const section = document.getElementById('sp-draft-result')
      if (section && res.subject && res.body) {
        section.innerHTML = `<div class="sp-sec"><span class="sp-lbl">AI Draft</span><div style="font-size:11px;color:#E7000B;margin-bottom:6px;font-weight:600">${res.subject}</div><div style="font-size:11px;color:#6b7280;line-height:1.6;white-space:pre-wrap">${res.body.substring(0, 300)}${res.body.length > 300 ? '…' : ''}</div><button class="sp-copy" data-copy="${encodeURIComponent(res.subject + '\n\n' + res.body)}" style="margin-top:8px">Copy draft</button></div>`
        document.querySelectorAll('.sp-copy[data-copy]').forEach(b => {
          b.addEventListener('click', () => { navigator.clipboard.writeText(decodeURIComponent(b.dataset.copy)).catch(() => {}); const o = b.textContent; b.textContent = 'Copied!'; setTimeout(() => b.textContent = o, 1500) })
        })
      }
      btn.className = 'sp-btn ok'; btn.querySelector('span').textContent = '✓ Draft ready'
    } catch { btn.querySelector('span').textContent = 'Failed'; btn.disabled = false }
  })

  // Sequence enrollment
  document.querySelectorAll('.sp-enroll').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = '…'
      try {
        let leadId = btn.dataset.lid
        if (!leadId || btn.dataset.needadd === '1') {
          const d = scrapeProfilePage()
          const url = window.location.href.split('?')[0].split('#')[0]
          const res = await fetchAPI('/leads', 'POST', { name: d.name, title: d.title, company: d.company, profile_url: url, linkedin_url: url, source: 'chrome_extension' }, token)
          leadId = res.lead?.id
        }
        await fetchAPI(`/sequences/${btn.dataset.seq}/enroll`, 'POST', { lead_ids: [leadId] }, token)
        btn.textContent = '✓'; btn.style.cssText += ';background:rgba(22,163,74,.08);border-color:rgba(22,163,74,.25);color:#16a34a'
      } catch { btn.textContent = '!'; btn.disabled = false }
    })
  })
}

// ─── SEARCH RESULTS INLINE BUTTONS ───────────────────────────────

const _taggedCards = new WeakSet()

async function injectSearchButtons() {
  let token
  try { token = await getTokenFromStorage() } catch { return }

  const cards = document.querySelectorAll('li.reusable-search__result-container')
  const batch = []

  cards.forEach(card => {
    if (_taggedCards.has(card)) return
    _taggedCards.add(card)

    const link = card.querySelector('a.app-aware-link[href*="/in/"]')
    if (!link) return
    const url = link.href.split('?')[0].split('#')[0]

    // Find action area — add button after entity title
    const titleEl = card.querySelector('.entity-result__title-actions') || card.querySelector('.entity-result__actions') || card.querySelector('.entity-result__title-text')
    if (!titleEl) return

    const wrap = document.createElement('span')
    wrap.style.cssText = 'display:inline-flex;align-items:center;margin-left:6px;vertical-align:middle'
    const btn = document.createElement('button')
    btn.className = 'snr-btn load'
    btn.innerHTML = '<span class="sp-spinner" style="width:8px;height:8px;border-width:1.5px"></span>'
    btn.dataset.url = url
    wrap.appendChild(btn)
    titleEl.appendChild(wrap)

    batch.push({ url, btn, card })
  })

  if (!batch.length) return

  try {
    const res = await fetchAPI('/leads/check-urls', 'POST', { urls: batch.map(b => b.url) }, token)
    const results = res.results || {}

    batch.forEach(({ url, btn, card }) => {
      const hit = results[url]
      if (hit?.found) {
        btn.className = 'snr-btn in'
        btn.innerHTML = '✓ In Sonar'
        if (hit.lead?.icp_score != null) {
          const score = hit.lead.icp_score
          const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#9ca3af'
          btn.innerHTML += ` <span style="opacity:.7;color:${color}">· ICP ${score}</span>`
        }
      } else {
        btn.className = 'snr-btn add'
        btn.innerHTML = '+ Add'
        btn.addEventListener('click', async (e) => {
          e.preventDefault(); e.stopPropagation()
          btn.className = 'snr-btn load'; btn.innerHTML = '<span class="sp-spinner" style="width:8px;height:8px;border-width:1.5px"></span>'
          try {
            const t = await getTokenFromStorage()
            const nameEl = card.querySelector('span.entity-result__title-text a span[aria-hidden="true"]')
            const titleEl2 = card.querySelector('.entity-result__primary-subtitle')
            const companyEl = card.querySelector('.entity-result__secondary-subtitle')
            await fetchAPI('/leads', 'POST', {
              name: nameEl?.innerText.trim() || '',
              title: titleEl2?.innerText.trim() || '',
              company: companyEl?.innerText.trim() || '',
              profile_url: url, linkedin_url: url, source: 'chrome_extension_search'
            }, t)
            btn.className = 'snr-btn in'; btn.innerHTML = '✓ Added'
          } catch (err) {
            if (err.status === 409) { btn.className = 'snr-btn in'; btn.innerHTML = '✓ In Sonar' }
            else { btn.className = 'snr-btn add'; btn.innerHTML = '+ Add' }
          }
        })
      }
    })
  } catch {
    batch.forEach(({ btn }) => { btn.className = 'snr-btn add'; btn.innerHTML = '+ Add' })
  }
}

// ─── COMPANY PAGE QUICK-ADD ───────────────────────────────────────

async function injectCompanyButton() {
  if (document.getElementById('sonar-company-btn')) return
  injectPanelStyles()

  let token
  try { token = await getTokenFromStorage() } catch { return }

  const companyData = scrapeCompanyPage()
  if (!companyData.name) return

  const btn = document.createElement('button')
  btn.id = 'sonar-company-btn'
  btn.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="#E7000B" stroke-width="1.3" opacity="0.5"/>
      <circle cx="8" cy="8" r="4" stroke="#E7000B" stroke-width="1.3" opacity="0.85"/>
      <circle cx="8" cy="8" r="1.5" fill="#E7000B"/>
      <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#E7000B" stroke-width="1.3" stroke-linecap="round"/>
    </svg>
    <span>Add company to Sonar</span>
  `

  document.body.appendChild(btn)

  btn.addEventListener('click', async () => {
    btn.disabled = true
    const spanEl = btn.querySelector('span'); spanEl.textContent = 'Adding…'
    try {
      await fetchAPI('/companies', 'POST', {
        name: companyData.name,
        industry: companyData.industry || '',
        size: companyData.size || '',
        headquarters: companyData.headquarters || '',
        description: companyData.description || '',
        linkedin_url: companyData.url,
        followers: companyData.followers || '',
      }, token)
      btn.classList.add('added'); spanEl.textContent = '✓ Added to Sonar'
    } catch (err) {
      if (err.status === 409) { btn.classList.add('added'); spanEl.textContent = '✓ Already in Sonar' }
      else { spanEl.textContent = 'Failed'; btn.disabled = false }
    }
  })
}

// ─── SPA NAVIGATION ──────────────────────────────────────────────

let _lastUrl = location.href

function handleNavChange() {
  const type = getPageType()

  // Remove old panel tab if we left a profile page
  const root = document.getElementById(PANEL_ROOT_ID)

  if (type === 'profile') {
    if (!root) createPanel()
    else { setBody('<div class="sp-load"><span class="sp-spinner"></span> <span>Checking pipeline…</span></div>') }
    _panelOpen = false
    const panel = document.getElementById('sonar-panel'); if (panel) panel.classList.remove('open')
    const tab = document.getElementById('sonar-tab'); if (tab) tab.style.display = ''
    setTimeout(() => loadPanel(), 1600)
  } else {
    if (root) { root.remove(); _panelOpen = false }
  }

  if (type === 'search' || type === 'linkedin-all-search') {
    setTimeout(() => injectSearchButtons(), 2000)
  }

  if (type === 'company') {
    const oldBtn = document.getElementById('sonar-company-btn'); if (oldBtn) oldBtn.remove()
    setTimeout(() => injectCompanyButton(), 1800)
  }
}

const _navObserver = new MutationObserver(() => {
  const cur = location.href
  if (cur !== _lastUrl) { _lastUrl = cur; handleNavChange() }
})

// Watch for new search results (infinite scroll)
let _searchObserver = null
function watchSearchResults() {
  if (_searchObserver) { _searchObserver.disconnect(); _searchObserver = null }
  const container = document.querySelector('.search-results-container') || document.querySelector('main')
  if (!container) return
  _searchObserver = new MutationObserver(() => {
    if (getPageType() === 'search' || getPageType() === 'linkedin-all-search') {
      clearTimeout(_searchObserver._timer)
      _searchObserver._timer = setTimeout(() => injectSearchButtons(), 800)
    }
  })
  _searchObserver.observe(container, { childList: true, subtree: true })
}

// ─── INIT ─────────────────────────────────────────────────────────

;(function init() {
  _navObserver.observe(document.body, { childList: true, subtree: true })

  const type = getPageType()

  if (type === 'profile') {
    createPanel()
    setTimeout(() => loadPanel(), 1800)
  }

  if (type === 'search' || type === 'linkedin-all-search') {
    setTimeout(() => { injectSearchButtons(); watchSearchResults() }, 2200)
  }

  if (type === 'company') {
    setTimeout(() => injectCompanyButton(), 1800)
  }
})()

// ─── MESSAGE LISTENER (popup communication) ───────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrape') {
    const type = getPageType()
    let result = null
    if (type === 'salenav-companies') result = scrapeSalesNavCompanies()
    else if (type === 'salenav-people') result = scrapeSalesNavPeople()
    else if (type === 'linkedin-companies' || type === 'linkedin-all-search') result = scrapeLinkedInCompanySearch()
    else if (type === 'company-people') result = scrapeCompanyPeoplePage()
    else if (type === 'company') result = scrapeCompanyPage()
    else if (type === 'profile') result = scrapeProfilePage()
    else if (type === 'search') result = scrapeSearchPage()
    else result = { error: 'Navigate to a LinkedIn page to extract leads or companies.' }
    chrome.storage.local.get({ leads: [] }, (existing) => { if (result && !result.error) chrome.storage.local.set({ leads: [...existing.leads, result] }) })
    sendResponse({ success: true, data: result })
  }

  if (message.action === 'autoScroll') {
    if (getPageType() !== 'company-people') { sendResponse({ success: false, error: 'Not on a people page' }); return true }
    autoScrollPeoplePage((count) => sendResponse({ success: true, count }))
    return true
  }

  if (message.action === 'getLeads') {
    chrome.storage.local.get({ leads: [] }, (data) => sendResponse({ leads: data.leads }))
    return true
  }

  return true
})
