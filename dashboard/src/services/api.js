import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

// ─── Simple TTL cache for GET requests ───────────────────────
const _cache = new Map()
const CACHE_TTL = 30_000

function _cacheGet(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null }
  return entry.data
}
function _cacheSet(key, data) { _cache.set(key, { data, ts: Date.now() }) }
export function invalidateCache(...keys) {
  if (keys.length === 0) { _cache.clear(); return }
  for (const k of keys) _cache.delete(k)
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Lock prevents multiple simultaneous refresh calls when several requests 401 at once
let _refreshPromise = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retried) {
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        original._retried = true
        try {
          if (!_refreshPromise) {
            _refreshPromise = api.post('/auth/refresh', { refresh_token: refreshToken })
              .finally(() => { _refreshPromise = null })
          }
          const res = await _refreshPromise
          const newToken = res.data.access_token
          localStorage.setItem('token', newToken)
          if (res.data.refresh_token) localStorage.setItem('refreshToken', res.data.refresh_token)
          original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` }
          return api(original)
        } catch {
          // Refresh failed — fall through to clear session
        }
      }
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      localStorage.removeItem('userEmail')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Decode JWT expiry without a library
function _tokenExpiresAt(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return (payload.exp || 0) * 1000
  } catch { return 0 }
}

// Call before any streaming fetch — refreshes token if <5 min remain
async function ensureFreshToken() {
  const token = localStorage.getItem('token')
  if (!token) return
  const expiresAt = _tokenExpiresAt(token)
  if (expiresAt - Date.now() > 5 * 60 * 1000) return  // still has 5+ min
  const refreshToken = localStorage.getItem('refreshToken')
  if (!refreshToken) return
  try {
    const res = await api.post('/auth/refresh', { refresh_token: refreshToken })
    localStorage.setItem('token', res.data.access_token)
    if (res.data.refresh_token) localStorage.setItem('refreshToken', res.data.refresh_token)
  } catch {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    window.location.href = '/login'
  }
}

// Shared helper for streaming NDJSON fetch calls
async function _streamingFetch(url, body, onProgress) {
  await ensureFreshToken()
  const token = localStorage.getItem('token')
  const response = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    window.location.href = '/login'
    throw new Error('Session expired — redirecting to login')
  }
  if (!response.ok) {
    const txt = await response.text()
    try { throw new Error(JSON.parse(txt).detail || txt) } catch { throw new Error(txt) }
  }
  const reader  = response.body.getReader()
  const decoder = new TextDecoder()
  const results = []
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const result = JSON.parse(line)
        results.push(result)
        if (onProgress) onProgress(result._progress?.completed, result._progress?.total, result)
      } catch (_) {}
    }
  }
  return results
}

// ─── AUTH ─────────────────────────────────────────────────────
export const login         = (data) => api.post('/auth/login', data)
export const signup        = (data) => api.post('/auth/signup', data)
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email })
export const resetPassword  = (recovery_token, new_password) =>
  api.post('/auth/reset-password', { recovery_token, new_password })

// ─── LEADS ────────────────────────────────────────────────────
export const getLeads = async () => {
  const cached = _cacheGet('/leads')
  if (cached) return cached
  const res = await api.get('/leads')
  _cacheSet('/leads', res)
  return res
}
export const createLead = (data) => { invalidateCache('/leads'); return api.post('/leads', data) }
export const updateLead = (id, data) => { invalidateCache('/leads'); return api.patch(`/leads/${id}`, data) }
export const deleteLead = (id) => { invalidateCache('/leads'); return api.delete(`/leads/${id}`) }
export const bulkCreateLeads = (data) => { invalidateCache('/leads'); return api.post('/leads/bulk', data) }
export const starLead = (id, starred) => { invalidateCache('/leads'); return api.patch(`/leads/${id}/star`, { starred }) }
export const updateConnectionStatus = (id, connection_status) => { invalidateCache('/leads'); return api.patch(`/leads/${id}/connection-status`, { connection_status }) }
export const spreadsheetUpdateLead = (id, data) => { invalidateCache('/leads'); return api.patch(`/leads/${id}/spreadsheet`, data) }
export const autofillBulk = (leadIds, batchStart = 0) =>
  api.post('/leads/autofill-bulk', {
    lead_ids: leadIds,
    batch_start: batchStart,
  })
export const enrichLead = (id, payload) => api.post(`/leads/${id}/enrich`, payload)
export const scoreLeadICP = (id) => api.post(`/leads/${id}/score-icp`)
export const draftEmail = (id, payload = {}) => api.post(`/leads/${id}/draft-email`, payload)
export const enrichPipeline = (companyId, onProgress) =>
  _streamingFetch(`/companies/${companyId}/enrich-pipeline`, {}, onProgress)

// ─── COMPANIES ────────────────────────────────────────────────
export const getCompanies = async () => {
  const cached = _cacheGet('/companies')
  if (cached) return cached
  const res = await api.get('/companies')
  _cacheSet('/companies', res)
  return res
}
export const createCompany = (data) => { invalidateCache('/companies'); return api.post('/companies', data) }
export const updateCompany = (id, data) => { invalidateCache('/companies'); return api.patch(`/companies/${id}`, data) }
export const deleteCompany = (id) => { invalidateCache('/companies'); return api.delete(`/companies/${id}`) }
export const bulkDeleteCompanies = (ids) => { invalidateCache('/companies'); return api.delete('/companies', { data: { ids } }) }
export const analyzeCompany = (id, payload) => api.post(`/companies/${id}/analyze-website`, payload)
export const getCompanyLeads = (id) => api.get(`/companies/${id}/leads`)
export const checkCompliance = (companyId) =>
  api.post(`/companies/${companyId}/check-compliance`, {})
export const autofillCompanyLinkedIn = (id) =>
  api.post(`/companies/${id}/autofill-linkedin`, {
    li_cookie: localStorage.getItem('liCookie') || '',
  })
export const prefillCompany = (name, websiteUrl) =>
  api.post('/companies/prefill', {
    name,
    website_url: websiteUrl || '',
  })
export const updateCompanySizeByName = (name, size) =>
  api.patch('/companies/size-by-name', { name, size })
export const bulkCreateCompanies = (companies) => api.post('/companies/bulk', { companies })
export const getTechnoparkDirectory = (params = {}) => api.get('/companies/technopark-directory', { params })
export const mapsDiscover = (payload) => api.post('/companies/maps-discover', payload)
export const bulkMapsEnrich = (companyIds = [], onProgress) =>
  _streamingFetch('/companies/bulk-maps-enrich', { company_ids: companyIds }, onProgress)

export const bulkAnalyzeCompanies = (companyIds = [], onProgress) =>
  _streamingFetch('/companies/bulk-analyze', { company_ids: companyIds }, onProgress)

export const bulkAutofillCompanies = (companyIds = [], onProgress) =>
  _streamingFetch('/companies/bulk-autofill', { company_ids: companyIds }, onProgress)

// ─── ICP ──────────────────────────────────────────────────────
export const getICPs = () => api.get('/icp')
export const getICPProfiles = () => api.get('/icp')
export const createICP = (data) => api.post('/icp', data)
export const createICPProfile = (data) => api.post('/icp', data)
export const updateICP = (id, data) => api.patch(`/icp/${id}`, data)
export const updateICPProfile = (id, data) => api.patch(`/icp/${id}`, data)
export const deleteICP = (id) => api.delete(`/icp/${id}`)
export const deleteICPProfile = (id) => api.delete(`/icp/${id}`)

export const searchCompanyPeople = (company_name, domain, roles = []) =>
  api.post('/companies/people-search', { company_name, domain, roles })

// ─── PERSONAS ─────────────────────────────────────────────────
export const getPersonas = () => api.get('/personas')
export const createPersona = (data) => api.post('/personas', data)
export const updatePersona = (id, data) => api.patch(`/personas/${id}`, data)
export const deletePersona = (id) => api.delete(`/personas/${id}`)

// ─── ASYNC JOBS (SQS-backed) ──────────────────────────────────────────────────
export const getJob          = (jobId) => api.get(`/jobs/${jobId}`)
export const listJobs        = ()       => api.get('/jobs')

export const bulkAutofillCompaniesAsync = (companyIds, liCookie = '') =>
  api.post('/companies/bulk-autofill/async', {
    company_ids: companyIds,
    li_cookie:   liCookie,
  })

export const bulkAnalyzeCompaniesAsync = (companyIds) =>
  api.post('/companies/bulk-analyze/async', { company_ids: companyIds })

export const bulkMapsEnrichAsync = (companyIds) =>
  api.post('/companies/bulk-maps-enrich/async', { company_ids: companyIds })

export default api
