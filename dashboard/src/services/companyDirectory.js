const KEY = 'leadgen_company_directory'

export function getDirectory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function syncToDirectory(companies) {
  if (!Array.isArray(companies) || companies.length === 0) return
  const existing = getDirectory()
  const byId = {}
  for (const c of existing) {
    const key = c.id || c.name
    byId[key] = c
  }
  for (const c of companies) {
    const key = c.id || c.name
    byId[key] = {
      ...byId[key],
      ...c,
      _savedAt: byId[key]?._savedAt || new Date().toISOString(),
    }
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.values(byId)))
  } catch (e) {
    // Storage quota exceeded — trim oldest 20% and retry
    const vals = Object.values(byId)
    vals.sort((a, b) => ((a._savedAt || '') < (b._savedAt || '') ? -1 : 1))
    const trimmed = vals.slice(Math.floor(vals.length * 0.2))
    localStorage.setItem(KEY, JSON.stringify(trimmed))
  }
}

export function searchDirectory(query) {
  const dir = getDirectory()
  if (!query.trim()) return dir
  const q = query.toLowerCase()
  return dir.filter((c) =>
    [
      c.name,
      c.website,
      c.industry,
      c.headquarters,
      c.description,
      c.classification,
      c.prospect_status,
      c.size,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
}

export function clearDirectory() {
  localStorage.removeItem(KEY)
}
