import React, { useState, useEffect, useRef, useMemo } from 'react'
import { updateCompany, autofillCompanyLinkedIn } from '../services/api'

// ─── ACCURACY ─────────────────────────────────────────────────
const _ACC_GENERIC = new Set([
  'pvt','ltd','inc','llc','corp','private','limited','the','and','for','with',
  'india','global','group','company','business','technology','technologies',
  'solutions','services','systems','digital','software','enterprise','consulting',
  'management','international','national','associates','partners','infotech',
  'infosystems','corporation','ventures','holdings',
])
function _accWords(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(' ')
    .filter(w => w.length > 2 && !_ACC_GENERIC.has(w))
}
function _accDomain(url) {
  try {
    const u = url.includes('://') ? url : 'https://' + url
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase()
  } catch { return null }
}
function _computeAccuracy(company) {
  if (company.linkedin_website && company.website) {
    const d1 = _accDomain(company.website)
    const d2 = _accDomain(company.linkedin_website)
    if (d1 && d2) return d1 === d2 ? { confidence: 'high', issues: [] } : { confidence: 'low', issues: ['linkedin-website-mismatch'] }
  }
  const words = _accWords(company.name)
  const issues = []
  if (words.length === 0 || !(company.website || company.linkedin_url)) return { confidence: 'none', issues: [] }
  if (company.website) {
    try {
      const url = company.website.includes('://') ? company.website : 'https://' + company.website
      const core = new URL(url).hostname.replace(/^www\./, '').toLowerCase().split('.')[0]
      const ini = words.map(w => w[0]).join('')
      if (!words.some(w => core.includes(w)) && core !== ini && !core.startsWith(ini) && !ini.startsWith(core)) issues.push('website')
    } catch {}
  }
  if (company.linkedin_url) {
    const m = company.linkedin_url.match(/linkedin\.com\/company\/([a-zA-Z0-9_-]+)/i)
    if (m) {
      const slug = m[1].toLowerCase().replace(/-/g, '')
      const ini = words.map(w => w[0]).join('')
      if (!words.some(w => slug.includes(w)) && slug !== ini && !slug.startsWith(ini) && !ini.startsWith(slug)) issues.push('linkedin')
    }
  }
  return { confidence: issues.length === 0 ? 'high' : issues.length === 1 ? 'medium' : 'low', issues }
}
function _accLabel(c) {
  const { confidence, issues } = _computeAccuracy(c)
  if (confidence === 'high') return '✓ accurate'
  if (issues.includes('linkedin-website-mismatch')) return '⊘ LI≠website'
  if (confidence === 'low') return '⊘ suspicious'
  if (confidence === 'medium') return `⊘ ${issues[0]}?`
  return '—'
}
function _accColor(l) {
  if (l.startsWith('✓')) return '#4a7c59'
  if (l.startsWith('⊘')) return '#92400e'
  return 'var(--text-muted)'
}

const PROSPECT_STATUSES = ['', 'To Review', 'Prospect', 'Not a Fit', 'Contacted', 'In Progress', 'Closed Won', 'Closed Lost']
const COMPANY_TYPES = ['', 'Product', 'Service', 'Hybrid']

// All possible columns — maps to company fields exactly as stored
const ALL_COLUMNS = [
  { key: '_serial',         label: '#',              width: 48,  type: 'serial',   frozen: true,  noExport: true },
  { key: 'name',            label: 'Name',           width: 200, type: 'text',     frozen: true },
  { key: '_accuracy',       label: 'Accuracy',       width: 110, type: 'computed', noExport: true },
  { key: 'prospect_status', label: 'Status',         width: 130, type: 'select',   options: PROSPECT_STATUSES },
  { key: 'industry',        label: 'Industry',       width: 180, type: 'text' },
  { key: '_type_saas',      label: 'Type',           width: 150, type: 'computed' },  // shows "Product · SaaS"
  { key: 'website',         label: 'Website',        width: 170, type: 'url' },
  { key: 'linkedin_url',    label: 'LinkedIn URL',   width: 200, type: 'url' },
  { key: 'headquarters',    label: 'HQ',             width: 150, type: 'text' },
  { key: 'size',            label: 'Employees',      width: 120, type: 'text' },
  { key: 'followers',       label: 'Followers',      width: 110, type: 'text' },
  { key: 'founded',         label: 'Founded',        width: 90,  type: 'text' },
  { key: 'specialties',     label: 'Specialties',    width: 260, type: 'text' },
  { key: 'description',     label: 'Description',    width: 280, type: 'text' },
  { key: 'compliance',      label: 'Compliance',     width: 160, type: 'text' },
  { key: 'email_pattern',   label: 'Email Pattern',  width: 150, type: 'text' },
  { key: 'tech_stack',      label: 'Tech Stack',     width: 200, type: 'computed' },
  { key: 'revenue_estimate',label: 'Revenue Est.',   width: 130, type: 'text' },
  { key: 'traffic_estimate',label: 'Traffic',        width: 120, type: 'text' },
  { key: 'job_openings',    label: 'Job Openings',   width: 120, type: 'computed' },
  { key: 'recent_news',     label: 'Recent News',    width: 200, type: 'computed' },
  { key: 'review_presence', label: 'Reviews',        width: 130, type: 'computed' },
  { key: 'tagline',         label: 'Tagline',        width: 180, type: 'text' },
  { key: 'phone',           label: 'Phone',          width: 140, type: 'text' },
  { key: 'notes',           label: 'Notes',          width: 220, type: 'text' },
]

const DEFAULT_VISIBLE = new Set([
  '_serial','name','_accuracy','prospect_status','industry','_type_saas',
  'website','linkedin_url','headquarters','size','followers','founded',
  'specialties','description','compliance','notes',
])

function getProspectColor(s) {
  return { 'Prospect':'#4a7c59','Not a Fit':'var(--red)','Contacted':'var(--accent)','In Progress':'#5b8db8','Closed Won':'#4a7c59','Closed Lost':'var(--text-muted)' }[s] || 'var(--text-muted)'
}

function getCellValue(company, key) {
  if (key === '_serial') return ''
  if (key === '_accuracy') return _accLabel(company)
  if (key === '_type_saas') {
    const t = company.company_type || ''
    const saas = company.is_saas
    if (!t) return ''
    if (saas === true) return `${t} · SaaS`
    if (saas === false) return `${t} · Non-SaaS`
    return t
  }
  if (key === 'tech_stack') {
    const v = company.tech_stack
    if (Array.isArray(v)) return v.join(', ')
    return v || ''
  }
  if (key === 'job_openings') {
    const v = company.job_openings
    if (Array.isArray(v)) return v.length ? `${v.length} open` : ''
    return v || ''
  }
  if (key === 'recent_news') {
    const v = company.recent_news
    if (Array.isArray(v) && v.length) return v[0]?.title || v[0] || ''
    return typeof v === 'string' ? v : ''
  }
  if (key === 'review_presence') {
    const v = company.review_presence
    if (typeof v === 'object' && v) {
      const parts = []
      if (v.g2) parts.push('G2')
      if (v.capterra) parts.push('Capterra')
      if (v.trustpilot) parts.push('Trustpilot')
      return parts.join(', ')
    }
    return v || ''
  }
  if (key === 'traffic_estimate') {
    const v = company.traffic_estimate
    if (typeof v === 'object' && v) return v.monthly_visits || v.range || ''
    return v || ''
  }
  const val = company[key] ?? ''
  if (key === 'size') return typeof val === 'string' ? val.replace(/\s*employees?\s*/gi, '').trim() : val
  if (key === 'followers') return typeof val === 'string' ? val.replace(/\s*followers?\s*/gi, '').trim() : val
  return val
}

// ─── EDITABLE CELL ─────────────────────────────────────────────
function EditableCell({ company, col, onSave, isEditing, onStartEdit, onStopEdit }) {
  const [val, setVal] = useState(getCellValue(company, col.key))
  const inputRef = useRef(null)

  useEffect(() => { setVal(getCellValue(company, col.key)) }, [company, col.key])
  useEffect(() => {
    if (isEditing && inputRef.current) { inputRef.current.focus(); if (inputRef.current.select) inputRef.current.select() }
  }, [isEditing])

  function commitSave() {
    const orig = getCellValue(company, col.key)
    if (String(val) !== String(orig)) onSave(company.id, col.key, val)
    onStopEdit()
  }

  if (col.type === 'serial') return <div style={cell.readonly} />

  // Computed / read-only
  if (col.type === 'computed') {
    if (col.key === '_accuracy') {
      const label = getCellValue(company, col.key)
      return <div style={{ ...cell.readonly, color: _accColor(label), fontWeight: label.startsWith('⊘') ? 600 : 400 }}>{label}</div>
    }
    if (col.key === '_type_saas') {
      const label = getCellValue(company, col.key)
      const color = label.includes('SaaS') && !label.includes('Non') ? '#4a7c59' : label.includes('Non-SaaS') ? '#92400e' : label ? 'var(--text-secondary)' : 'var(--text-muted)'
      return <div style={{ ...cell.text, color }}>{label || '—'}</div>
    }
    const v = getCellValue(company, col.key)
    return <div style={{ ...cell.readonly, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v}>{v || '—'}</div>
  }

  if (col.type === 'url') {
    if (isEditing) return <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)} onBlur={commitSave} onKeyDown={e => { if (e.key === 'Enter') commitSave(); if (e.key === 'Escape') { setVal(getCellValue(company, col.key)); onStopEdit() } }} style={cell.input} />
    const dv = getCellValue(company, col.key)
    if (!dv) return <div style={cell.empty} onClick={onStartEdit}>—</div>
    return <a href={dv} target="_blank" rel="noreferrer" style={cell.link} onClick={e => e.stopPropagation()}>{dv.replace(/https?:\/\/(www\.)?/, '').split('/')[0]}</a>
  }

  if (col.type === 'select') {
    if (isEditing) return (
      <select ref={inputRef} value={val} onChange={e => { setVal(e.target.value); onSave(company.id, col.key, e.target.value); onStopEdit() }} onBlur={onStopEdit} style={cell.select}>
        {(col.options || []).map(o => <option key={o} value={o}>{o || '—'}</option>)}
      </select>
    )
    const dv = getCellValue(company, col.key)
    const color = col.key === 'prospect_status' ? getProspectColor(dv) : 'var(--text-secondary)'
    return <div style={{ ...cell.text, color, cursor: 'pointer' }} onClick={onStartEdit}>{dv || '—'}</div>
  }

  if (isEditing) return <input ref={inputRef} value={val} onChange={e => setVal(e.target.value)} onBlur={commitSave} onKeyDown={e => { if (e.key === 'Enter') commitSave(); if (e.key === 'Escape') { setVal(getCellValue(company, col.key)); onStopEdit() } }} style={cell.input} />
  const dv = getCellValue(company, col.key)
  return <div style={{ ...cell.text, cursor: 'text' }} onClick={onStartEdit} title={dv}>{dv || <span style={{ color: 'var(--text-muted)' }}>—</span>}</div>
}

// ─── SORTABLE COLUMN HEADER (extracted to avoid hooks-in-loop) ─
function ColHeader({ col, width, isSorted, sortDir, frozenLeft, onSort, onResize }) {
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  function onMouseDown(e) {
    e.preventDefault(); e.stopPropagation()
    isResizing.current = true; startX.current = e.clientX; startW.current = width
    const onMove = ev => { if (isResizing.current) onResize(Math.max(50, startW.current + ev.clientX - startX.current)) }
    const onUp = () => { isResizing.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = '' }
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  const canSort = col.type !== 'serial'
  const sortIcon = isSorted ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <th
      style={{
        ...th, width, minWidth: width,
        position: 'sticky', top: 0,
        zIndex: frozenLeft !== undefined ? 15 : 10,
        left: frozenLeft,
        background: isSorted ? 'rgba(168,100,72,0.10)' : 'var(--surface)',
        cursor: canSort ? 'pointer' : 'default',
      }}
      onClick={canSort ? onSort : undefined}
    >
      {col.label}{sortIcon}
      {col.type !== 'serial' && (
        <div
          onMouseDown={onMouseDown}
          onDoubleClick={() => onResize(Math.max(80, col.label.length * 9 + 40))}
          onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 1 }}
          onMouseEnter={e => (e.target.style.background = 'var(--accent)')}
          onMouseLeave={e => (e.target.style.background = 'transparent')}
        />
      )}
    </th>
  )
}

// ─── MAIN SPREADSHEET ─────────────────────────────────────────
export default function CompaniesSpreadsheet({ companies, onClose, onRefresh }) {
  const [local, setLocal] = useState(() => companies.map(c => ({ ...c })))
  const [colWidths, setColWidths] = useState(() => Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c.width])))
  const [visibleKeys, setVisibleKeys] = useState(DEFAULT_VISIBLE)
  const [showColPicker, setShowColPicker] = useState(false)
  const [colPickerSearch, setColPickerSearch] = useState('')
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' })
  const [editingCell, setEditingCell] = useState(null)
  const [selected, setSelected] = useState([])
  const [search, setSearch] = useState('')
  const [accuracyFilter, setAccuracyFilter] = useState('all')
  const [autofilling, setAutofilling] = useState(false)
  const [autofillMsg, setAutofillMsg] = useState('')
  const [saving, setSaving] = useState(null)
  const colPickerRef = useRef(null)

  useEffect(() => { setLocal(companies.map(c => ({ ...c }))) }, [companies])

  useEffect(() => {
    if (!showColPicker) return
    function h(e) { if (colPickerRef.current && !colPickerRef.current.contains(e.target)) setShowColPicker(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showColPicker])

  const visibleCols = ALL_COLUMNS.filter(c => visibleKeys.has(c.key))

  // Frozen column left offsets (checkbox = 40px)
  const frozenMeta = useMemo(() => {
    const meta = {}
    let left = 40
    for (const col of visibleCols.filter(c => c.frozen)) {
      meta[col.key] = left
      left += colWidths[col.key]
    }
    return meta
  }, [visibleCols, colWidths])

  function handleResize(key, w) {
    setColWidths(prev => ({ ...prev, [key]: w }))
  }

  function handleSort(key) {
    setSortConfig(prev => {
      if (prev.key === key) return prev.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: 'asc' }
      return { key, dir: 'asc' }
    })
  }

  async function handleSave(id, key, value) {
    setSaving(id)
    try {
      await updateCompany(id, { [key]: value })
      setLocal(prev => prev.map(c => c.id === id ? { ...c, [key]: value } : c))
      onRefresh?.()
    } catch (e) { console.error(e) }
    setSaving(null)
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  function toggleAll() {
    const ids = displayRows.map(c => c.id)
    const allSel = ids.every(id => selected.includes(id))
    setSelected(allSel ? selected.filter(id => !ids.includes(id)) : [...new Set([...selected, ...ids])])
  }

  function toggleColVisible(key) {
    const col = ALL_COLUMNS.find(c => c.key === key)
    if (col?.frozen) return
    setVisibleKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  async function autofillSelected() {
    const targets = selected.length ? local.filter(c => selected.includes(c.id)) : local
    setAutofilling(true)
    let done = 0
    for (const company of targets) {
      setAutofillMsg(`Autofilling… ${done}/${targets.length}`)
      try {
        const res = await autofillCompanyLinkedIn(company.id)
        const updated = res.data?.company
        if (updated) setLocal(prev => prev.map(c => c.id === company.id ? { ...c, ...updated } : c))
        done++
      } catch { }
    }
    setAutofilling(false)
    setAutofillMsg(`Done — ${done} updated`)
    onRefresh?.()
    setTimeout(() => setAutofillMsg(''), 4000)
  }

  function exportCSV() {
    const cols = visibleCols.filter(c => !c.noExport)
    const rows = exportRows
    const header = cols.map(c => `"${c.label}"`).join(',')
    const body = rows.map(r => cols.map(c => {
      const v = String(getCellValue(r, c.key) || '')
      return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v
    }).join(','))
    _dl([header, ...body].join('\n'), `companies-${_today()}.csv`, 'text/csv;charset=utf-8;')
  }

  function exportXLSX() {
    const cols = visibleCols.filter(c => !c.noExport)
    const rows = exportRows
    const header = cols.map(c => c.label).join('\t')
    const body = rows.map(r => cols.map(c => String(getCellValue(r, c.key) || '')).join('\t'))
    _dl([header, ...body].join('\n'), `companies-${_today()}.xls`, 'text/tab-separated-values;charset=utf-8;')
  }

  function _dl(content, name, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }))
    Object.assign(document.createElement('a'), { href: url, download: name }).click()
    URL.revokeObjectURL(url)
  }
  function _today() { return new Date().toISOString().split('T')[0] }

  const filteredRows = useMemo(() => local.filter(c => {
    const q = search.toLowerCase()
    if (search.trim() && ![(c.name||''),(c.industry||''),(c.headquarters||'')].join(' ').toLowerCase().includes(q)) return false
    if (accuracyFilter === 'all') return true
    const conf = _computeAccuracy(c).confidence
    if (accuracyFilter === 'accurate') return conf === 'high'
    if (accuracyFilter === 'suspicious') return conf !== 'high' && conf !== 'none'
    if (accuracyFilter === 'unverifiable') return conf === 'none'
    return true
  }), [local, search, accuracyFilter])

  const displayRows = useMemo(() => {
    if (!sortConfig.key) return filteredRows
    return [...filteredRows].sort((a, b) => {
      const av = String(getCellValue(a, sortConfig.key) || '')
      const bv = String(getCellValue(b, sortConfig.key) || '')
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' })
      return sortConfig.dir === 'asc' ? cmp : -cmp
    })
  }, [filteredRows, sortConfig])

  const exportRows = selected.length ? displayRows.filter(c => selected.includes(c.id)) : displayRows
  const allSelected = displayRows.length > 0 && displayRows.every(c => selected.includes(c.id))

  const pickerCols = colPickerSearch
    ? ALL_COLUMNS.filter(c => c.label.toLowerCase().includes(colPickerSearch.toLowerCase()))
    : ALL_COLUMNS

  return (
    <div style={s.overlay}>
      <div style={s.container}>

        {/* ── Toolbar ── */}
        <div style={s.toolbar}>
          <div>
            <p style={s.eyebrow}>COMPANIES SPREADSHEET</p>
            <h2 style={s.title}>
              {displayRows.length}<span style={s.unit}> companies</span>
              {selected.length > 0 && <span style={{ ...s.unit, color: 'var(--accent)', marginLeft: 8 }}>· {selected.length} selected</span>}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={s.searchInput} />

            <select value={accuracyFilter} onChange={e => setAccuracyFilter(e.target.value)}
              style={{ ...s.searchInput, width: 130, cursor: 'pointer', color: accuracyFilter === 'accurate' ? '#4a7c59' : accuracyFilter === 'suspicious' ? '#92400e' : 'rgba(253,253,253,0.5)' }}>
              <option value="all">All accuracy</option>
              <option value="accurate">✓ Accurate</option>
              <option value="suspicious">⊘ Suspicious</option>
              <option value="unverifiable">— No data</option>
            </select>

            {autofillMsg && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: autofillMsg.startsWith('Done') ? '#4a7c59' : 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {autofillMsg}
              </span>
            )}

            <button onClick={autofillSelected} disabled={autofilling} style={{ ...s.btn, opacity: autofilling ? 0.5 : 1 }}>
              ↯ Autofill{selected.length ? ` (${selected.length})` : ' All'}
            </button>

            {/* Column picker */}
            <div style={{ position: 'relative' }} ref={colPickerRef}>
              <button onClick={() => setShowColPicker(v => !v)} style={{ ...s.toolBtn, background: showColPicker ? '#c5000a' : undefined, outline: 'none' }}>
                Columns ({visibleKeys.size}/{ALL_COLUMNS.length}) ▾
              </button>
              {showColPicker && (
                <div style={s.colPicker}>
                  <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--border)' }}>
                    <input type="text" value={colPickerSearch} onChange={e => setColPickerSearch(e.target.value)}
                      placeholder="Filter columns…" autoFocus
                      style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: '11px', outline: 'none', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                      <button onClick={() => setVisibleKeys(new Set(ALL_COLUMNS.map(c => c.key)))} style={s.pickerAction}>Show all</button>
                      <button onClick={() => setVisibleKeys(new Set(DEFAULT_VISIBLE))} style={s.pickerAction}>Reset</button>
                    </div>
                  </div>
                  <div style={{ overflowY: 'auto', maxHeight: 280, padding: '4px 0' }}>
                    {pickerCols.map(col => (
                      <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: col.frozen ? 'default' : 'pointer', opacity: col.frozen ? 0.5 : 1 }}>
                        <input type="checkbox" checked={visibleKeys.has(col.key)} disabled={!!col.frozen}
                          onChange={() => toggleColVisible(col.key)}
                          style={{ accentColor: 'var(--accent)', cursor: col.frozen ? 'default' : 'pointer' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text)' }}>{col.label}</span>
                        {col.frozen && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', marginLeft: 'auto' }}>PINNED</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Export */}
            <button onClick={exportCSV} style={s.toolBtn} title={selected.length ? `Export ${selected.length} selected rows` : 'Export visible columns'}>
              CSV ↓{selected.length ? ` (${selected.length})` : ''}
            </button>
            <button onClick={exportXLSX} style={s.toolBtn}>XLS ↓</button>

            <button onClick={onClose} style={s.closeBtn}>✕ Close</button>
          </div>
        </div>

        {/* ── Selection banner ── */}
        {selected.length > 0 && (
          <div style={s.selBanner}>
            {selected.length} selected ·{' '}
            <button onClick={() => setSelected([])} style={s.bannerBtn}>Clear</button>
            {' · '}
            <button onClick={() => setSelected(displayRows.map(c => c.id))} style={s.bannerBtn}>Select all {displayRows.length}</button>
            {' · '}export will use selected rows only
          </div>
        )}

        {/* ── Table ── */}
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...th, width: 40, minWidth: 40, position: 'sticky', top: 0, left: 0, zIndex: 20, background: 'var(--surface)' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                </th>
                {visibleCols.map(col => (
                  <ColHeader
                    key={col.key}
                    col={col}
                    width={colWidths[col.key]}
                    isSorted={sortConfig.key === col.key}
                    sortDir={sortConfig.dir}
                    frozenLeft={frozenMeta[col.key]}
                    onSort={() => handleSort(col.key)}
                    onResize={w => handleResize(col.key, w)}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((company, rowIdx) => {
                const isSel = selected.includes(company.id)
                const rowBg = isSel ? 'rgba(168,100,72,0.06)' : rowIdx % 2 === 0 ? 'var(--bg)' : 'var(--surface)'
                return (
                  <tr key={company.id} style={{ background: rowBg, borderBottom: '1px solid var(--border-subtle)', opacity: saving === company.id ? 0.6 : 1, transition: 'background 0.1s' }}>
                    <td style={{ ...td, width: 40, position: 'sticky', left: 0, zIndex: 5, background: rowBg, textAlign: 'center' }}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleSelect(company.id)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                    </td>
                    {visibleCols.map(col => {
                      const isFrozen = col.frozen
                      return (
                        <td key={col.key} style={{
                          ...td, width: colWidths[col.key], maxWidth: colWidths[col.key],
                          ...(isFrozen ? { position: 'sticky', left: frozenMeta[col.key], zIndex: 4, background: rowBg } : {}),
                        }}>
                          {col.type === 'serial'
                            ? <div style={cell.readonly}>{rowIdx + 1}</div>
                            : <EditableCell
                                company={company} col={col} onSave={handleSave}
                                isEditing={editingCell?.rowId === company.id && editingCell?.colKey === col.key}
                                onStartEdit={() => setEditingCell({ rowId: company.id, colKey: col.key })}
                                onStopEdit={() => setEditingCell(null)}
                              />
                          }
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {displayRows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '-0.03em', color: 'var(--text-secondary)', marginBottom: 6 }}>No companies match.</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>Clear your search to see all.</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={s.footer}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            Click cell to edit · Click header to sort ↑↓ · Drag header edge to resize · Double-click edge to auto-size
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            {visibleCols.length} cols · {displayRows.length} / {local.length} rows{selected.length ? ` · ${selected.length} selected for export` : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 900, display: 'flex', flexDirection: 'column' },
  container: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#0f0f0f', flexShrink: 0, gap: 10, flexWrap: 'wrap' },
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase' },
  title: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 400, color: '#ffffff', letterSpacing: '-0.04em', lineHeight: 1 },
  unit: { fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 400, color: 'rgba(255,255,255,0.35)' },
  searchInput: { padding: '7px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#ffffff', outline: 'none', width: 180 },
  btn: { padding: '7px 14px', background: 'var(--accent)', border: 'none', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' },
  toolBtn: { padding: '7px 12px', background: 'var(--accent)', border: 'none', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' },
  closeBtn: { padding: '7px 14px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.20)', borderRadius: 7, fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', color: '#ffffff', cursor: 'pointer' },
  selBanner: { padding: '7px 24px', background: 'rgba(168,100,72,0.06)', borderBottom: '1px solid rgba(168,100,72,0.15)', fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.04em', color: 'var(--text)', flexShrink: 0 },
  bannerBtn: { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: 0, color: 'var(--accent)', textDecoration: 'underline' },
  tableWrap: { flex: 1, overflow: 'auto' },
  table: { borderCollapse: 'collapse', tableLayout: 'fixed' },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 },
  colPicker: { position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 230, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 200 },
  pickerAction: { padding: '3px 8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: '10px', cursor: 'pointer', color: 'var(--text-muted)' },
}
const th = { padding: '9px 12px', background: 'var(--surface)', borderBottom: '2px solid var(--border)', borderRight: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'left', userSelect: 'none', whiteSpace: 'nowrap', position: 'relative', overflow: 'hidden' }
const td = { padding: 0, height: 40, overflow: 'hidden', verticalAlign: 'middle', borderBottom: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)' }
const cell = {
  readonly: { padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', height: 40, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  text: { padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)', height: 40, display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  input: { width: '100%', height: 40, padding: '0 12px', border: 'none', borderTop: '2px solid var(--accent)', borderBottom: '2px solid var(--accent)', background: 'rgba(168,100,72,0.06)', fontFamily: 'inherit', fontSize: '12px', color: 'var(--text)', outline: 'none' },
  select: { width: '100%', height: 40, padding: '0 12px', border: 'none', borderTop: '2px solid var(--accent)', borderBottom: '2px solid var(--accent)', background: 'rgba(168,100,72,0.06)', fontFamily: 'inherit', fontSize: '12px', color: 'var(--text)', outline: 'none', cursor: 'pointer' },
  link: { padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', height: 40, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  empty: { padding: '0 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', height: 40, display: 'flex', alignItems: 'center', cursor: 'pointer' },
}
