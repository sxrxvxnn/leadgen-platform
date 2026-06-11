import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('userEmail')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─── AUTH ─────────────────────────────────────────────────────
export const login = (data) => api.post('/auth/login', data)
export const signup = (data) => api.post('/auth/signup', data)

// ─── LEADS ────────────────────────────────────────────────────
export const getLeads = () => api.get('/leads')
export const createLead = (data) => api.post('/leads', data)
export const updateLead = (id, data) => api.patch(`/leads/${id}`, data)
export const deleteLead = (id) => api.delete(`/leads/${id}`)
export const bulkCreateLeads = (data) => api.post('/leads/bulk', data)
export const starLead = (id, starred) => api.patch(`/leads/${id}/star`, { starred })
export const updateConnectionStatus = (id, connection_status) => api.patch(`/leads/${id}/connection-status`, { connection_status })
export const spreadsheetUpdateLead = (id, data) => api.patch(`/leads/${id}/spreadsheet`, data)
export const autofillBulk = (leadIds, groqKey, batchStart = 0, openaiKey = '') =>
  api.post('/leads/autofill-bulk', {
    lead_ids: leadIds,
    groq_api_key: groqKey,
    openai_api_key: openaiKey,
    gemini_api_key: localStorage.getItem('geminiKey') || '',
    batch_start: batchStart,
  })
export const enrichLead = (id, payload) => api.post(`/leads/${id}/enrich`, payload)

// ─── COMPANIES ────────────────────────────────────────────────
export const getCompanies = () => api.get('/companies')
export const createCompany = (data) => api.post('/companies', data)
export const updateCompany = (id, data) => api.patch(`/companies/${id}`, data)
export const deleteCompany = (id) => api.delete(`/companies/${id}`)
export const getCompanyLeads = (id) => api.get(`/companies/${id}/leads`)
export const checkCompliance = (companyId, groqKey) =>
  api.post(`/companies/${companyId}/check-compliance`, {
    groq_key: groqKey,
    gemini_key: localStorage.getItem('geminiKey') || '',
  })
export const autofillCompanyLinkedIn = (id) =>
  api.post(`/companies/${id}/autofill-linkedin`, {
    openrouter_key: localStorage.getItem('openrouterKey') || '',
  })
export const prefillCompany = (name, websiteUrl) =>
  api.post('/companies/prefill', {
    name,
    website_url: websiteUrl || '',
    openrouter_key: localStorage.getItem('openrouterKey') || '',
  })
export const updateCompanySizeByName = (name, size) =>
  api.patch('/companies/size-by-name', { name, size })

// ─── ICP ──────────────────────────────────────────────────────
export const getICPs = () => api.get('/icp')
export const getICPProfiles = () => api.get('/icp')
export const createICP = (data) => api.post('/icp', data)
export const createICPProfile = (data) => api.post('/icp', data)
export const updateICP = (id, data) => api.patch(`/icp/${id}`, data)
export const updateICPProfile = (id, data) => api.patch(`/icp/${id}`, data)
export const deleteICP = (id) => api.delete(`/icp/${id}`)
export const deleteICPProfile = (id) => api.delete(`/icp/${id}`)

// ─── PERSONAS ─────────────────────────────────────────────────
export const getPersonas = () => api.get('/personas')
export const createPersona = (data) => api.post('/personas', data)
export const updatePersona = (id, data) => api.patch(`/personas/${id}`, data)
export const deletePersona = (id) => api.delete(`/personas/${id}`)

export default api
