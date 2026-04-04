import axios from 'axios'

const BASE_URL = 'http://localhost:8000/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto refresh token on 401
let isRefreshing = false
let failedQueue = []

function processQueue(error, token = null) {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue requests while refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = 'Bearer ' + token
          return api(originalRequest)
        }).catch(err => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Try to refresh by re-logging in with stored credentials
        const email = localStorage.getItem('userEmail')
        const encodedPassword = localStorage.getItem('userPassword')
const password = encodedPassword ? atob(encodedPassword) : null

        if (email && password) {
          const res = await axios.post(BASE_URL + '/auth/login', { email, password })
          const newToken = res.data.access_token
          localStorage.setItem('token', newToken)
          api.defaults.headers.common['Authorization'] = 'Bearer ' + newToken
          originalRequest.headers.Authorization = 'Bearer ' + newToken
          processQueue(null, newToken)
          return api(originalRequest)
        } else {
          // No stored credentials — redirect to login
          processQueue(new Error('No credentials'), null)
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          window.location.href = '/login'
          return Promise.reject(error)
        }
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('userPassword')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
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

// ─── COMPANIES ────────────────────────────────────────────────
export const getCompanies = () => api.get('/companies')
export const createCompany = (data) => api.post('/companies', data)
export const updateCompany = (id, data) => api.patch(`/companies/${id}`, data)
export const deleteCompany = (id) => api.delete(`/companies/${id}`)
export const getCompanyLeads = (id) => api.get(`/companies/${id}/leads`)
export const checkCompliance = (companyId, groqKey) => api.post(`/companies/${companyId}/check-compliance`, { groq_api_key: groqKey })

// ─── ICP ──────────────────────────────────────────────────────
export const getICPs = () => api.get('/icp')
export const createICP = (data) => api.post('/icp', data)
export const updateICP = (id, data) => api.patch(`/icp/${id}`, data)
export const deleteICP = (id) => api.delete(`/icp/${id}`)

// ─── PERSONAS ─────────────────────────────────────────────────
export const getPersonas = () => api.get('/personas')
export const createPersona = (data) => api.post('/personas', data)
export const updatePersona = (id, data) => api.patch(`/personas/${id}`, data)
export const deletePersona = (id) => api.delete(`/personas/${id}`)

export default api