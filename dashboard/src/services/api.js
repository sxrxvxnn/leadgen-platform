import axios from 'axios'

const BASE_URL = 'http://localhost:8000/api'

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Automatically attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto logout if token expires
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ─── AUTH ────────────────────────────────────────────────────
export const signup = (data) => api.post('/auth/signup', data)
export const login = (data) => api.post('/auth/login', data)

// ─── LEADS ───────────────────────────────────────────────────
export const getLeads = () => api.get('/leads')
export const createLead = (data) => api.post('/leads', data)
export const updateLead = (id, data) => api.patch(`/leads/${id}`, data)
export const deleteLead = (id) => api.delete(`/leads/${id}`)
export const bulkCreateLeads = (leads) => api.post('/leads/bulk', { leads })

// ─── COMPANIES ───────────────────────────────────────────────
export const getCompanies = () => api.get('/companies')
export const createCompany = (data) => api.post('/companies', data)

export default api
// ─── ICP ─────────────────────────────────────────────────────
export const getICPProfiles = () => api.get('/icp')
export const createICPProfile = (data) => api.post('/icp', data)
export const updateICPProfile = (id, data) => api.patch(`/icp/${id}`, data)
export const deleteICPProfile = (id) => api.delete(`/icp/${id}`)
// ─── PERSONAS ────────────────────────────────────────────────
export const getPersonas = () => api.get('/personas')
export const createPersona = (data) => api.post('/personas', data)
export const deletePersona = (id) => api.delete(`/personas/${id}`)
// ─── STAR & CONNECTION STATUS ─────────────────────────────────
export const starLead = (id, starred) => api.patch(`/leads/${id}/star`, { starred })
export const updateConnectionStatus = (id, connection_status) => api.patch(`/leads/${id}/connection-status`, { connection_status })
// ─── SPREADSHEET ──────────────────────────────────────────────
export const spreadsheetUpdateLead = (id, data) => api.patch(`/leads/${id}/spreadsheet`, data)
// ─── COMPANIES EXTENDED ───────────────────────────────────────
export const updateCompany = (id, data) => api.patch(`/companies/${id}`, data)
export const deleteCompany = (id) => api.delete(`/companies/${id}`)
export const getCompanyLeads = (id) => api.get(`/companies/${id}/leads`)
// ─── COMPLIANCE CHECKER ───────────────────────────────────────
export const checkCompliance = (companyId, groqKey) =>
  api.post(`/companies/${companyId}/check-compliance`, { groq_api_key: groqKey })