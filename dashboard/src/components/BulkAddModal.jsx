import React, { useState, useRef, useMemo } from 'react'
import { prefillCompany, bulkCreateCompanies, getTechnoparkDirectory, bulkCreateLeads } from '../services/api'

const TABS = [
  { key: 'manual',     label: 'Manual Entry' },
  { key: 'csv',        label: 'Import CSV' },
  { key: 'paste',      label: 'Paste List' },
  { key: 'technopark', label: 'Technopark' },
]

let _id = 0
const newRow = () => ({ id: ++_id, name: '', website: '', status: 'idle', filled: null })

export default function BulkAddModal({ onClose, onRefresh, initialTab = 'manual' }) {
  const [tab, setTab] = useState(initialTab)
  const [rows, setRows] = useState([newRow(), newRow(), newRow()])
  const [fillTarget, setFillTarget] = useState(null)
  const [fillingAll, setFillingAll] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  // CSV state
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [colMap, setColMap] = useState({ name: '', website: '', employees: '', followers: '' })
  const fileRef = useRef(null)

  // Paste state
  const [pasteText, setPasteText] = useState('')
  const [pasteRows, setPasteRows] = useState([])

  // Technopark state
  const [tpData, setTpData] = useState(null)       // { companies, parks, buildings }
  const [tpLoading, setTpLoading] = useState(false)
  const [tpSearch, setTpSearch] = useState('')
  const [tpPark, setTpPark] = useState('')
  const [tpBuilding, setTpBuilding] = useState('')
  const [tpSelected, setTpSelected] = useState(new Set())
  const [tpAdding, setTpAdding] = useState(false)
  const [tpAddMsg, setTpAddMsg] = useState('')
  const [tpError, setTpError] = useState('')

  // ── Manual tab ────────────────────────────────────────────────

  function updateRow(id, field, val) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: val, status: 'idle', filled: null } : r))
  }

  function addRow() { setRows(prev => [...prev, newRow()]) }

  function removeRow(id) { setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev) }

  async function fillRow(row) {
    if (!row.name.trim()) return
    setFillTarget(row.id)
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'loading' } : r))
    try {
      const res = await prefillCompany(row.name.trim(), row.website.trim())
      const d = res.data
      const li = d.linkedin_data || {}
      const filled = {
        name:         d.name || row.name.trim(),
        website:      d.website_url || row.website.trim() || null,
        linkedin_url: d.linkedin_url || null,
        headquarters: li.location || null,
        followers:    li.followers || null,
        size:         li.employee_count ? `${li.employee_count} employees` : null,
        description:  li.description || null,
        phone:        li.phone || null,
        founded:      li.founded || null,
        specialties:  li.specialties || null,
        tagline:      li.tagline || null,
      }
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'filled', filled, website: filled.website || r.website } : r))
    } catch {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error' } : r))
    } finally {
      setFillTarget(null)
    }
  }

  async function fillAll() {
    const pending = rows.filter(r => r.name.trim() && r.status === 'idle')
    if (!pending.length) return
    setFillingAll(true)
    const BATCH = 4
    for (let i = 0; i < pending.length; i += BATCH) {
      await Promise.all(pending.slice(i, i + BATCH).map(row => fillRow(row)))
    }
    setFillingAll(false)
  }

  async function importManual() {
    const companies = rows
      .filter(r => r.name.trim())
      .map(r => r.filled ? { ...r.filled } : { name: r.name.trim(), website: r.website.trim() || null })
    await doImport(companies)
  }

  // ── CSV tab ───────────────────────────────────────────────────

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/)
    if (!lines.length) return { headers: [], rows: [] }
    const sep = lines[0].includes('\t') ? '\t' : ','
    const split = (line) => {
      const out = []; let cur = '', inQ = false
      for (const c of line) {
        if (c === '"') { inQ = !inQ; continue }
        if (c === sep && !inQ) { out.push(cur.trim()); cur = ''; continue }
        cur += c
      }
      out.push(cur.trim())
      return out
    }
    const headers = split(lines[0])
    const rows = lines.slice(1)
      .map(l => { const v = split(l); return Object.fromEntries(headers.map((h, i) => [h, v[i] || ''])) })
      .filter(r => Object.values(r).some(v => v.trim()))
    return { headers, rows }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const { headers, rows } = parseCSV(ev.target.result)
      setCsvHeaders(headers)
      setCsvRows(rows)
      setColMap({
        name:      headers.find(h => /^(name|company)$/i.test(h.trim())) || headers.find(h => /name|company/i.test(h)) || '',
        website:   headers.find(h => /website|url|web|domain/i.test(h)) || '',
        employees: headers.find(h => /employee|headcount|staff|size/i.test(h)) || '',
        followers: headers.find(h => /follower|follow/i.test(h)) || '',
      })
    }
    reader.readAsText(file)
  }

  async function importCSV() {
    if (!colMap.name) return
    const companies = csvRows
      .filter(r => r[colMap.name]?.trim())
      .map(r => {
        const rawEmp = colMap.employees ? r[colMap.employees]?.replace(/,/g, '').trim() : ''
        const rawFol = colMap.followers ? r[colMap.followers]?.replace(/,/g, '').trim() : ''
        return {
          name:      r[colMap.name].trim(),
          website:   colMap.website ? (r[colMap.website]?.trim() || null) : null,
          size:      rawEmp ? rawEmp : null,
          followers: rawFol ? rawFol : null,
        }
      })
    await doImport(companies)
  }

  // ── Paste tab ─────────────────────────────────────────────────

  function parsePaste() {
    const parsed = pasteText.trim().split(/\r?\n/)
      .filter(l => l.trim())
      .map(l => { const [name, website] = l.split('\t'); return { name: name?.trim() || '', website: website?.trim() || '' } })
      .filter(r => r.name)
    setPasteRows(parsed)
  }

  async function importPaste() { await doImport(pasteRows) }

  // ── Shared import ─────────────────────────────────────────────

  async function doImport(companies) {
    if (!companies.length) return
    setImporting(true)
    try {
      const res = await bulkCreateCompanies(companies)
      setResult({ inserted: res.data.inserted, updated: res.data.updated || 0, skipped: res.data.skipped })
      onRefresh()
    } catch (e) {
      console.error('Bulk import error:', e)
    } finally {
      setImporting(false)
    }
  }

  function resetAll() {
    setResult(null); setRows([newRow(), newRow(), newRow()])
    setCsvRows([]); setCsvHeaders([]); setPasteText(''); setPasteRows([])
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Technopark tab ───────────────────────────────────────────

  async function loadTechnopark() {
    if (tpData) return
    setTpLoading(true)
    setTpError('')
    try {
      const res = await getTechnoparkDirectory()
      setTpData(res.data)
    } catch (e) {
      console.error('Technopark load error:', e)
      setTpError(e.code === 'ERR_NETWORK' ? 'Cannot reach backend — is the server running?' : (e.response?.data?.detail || e.message || 'Failed to load directory'))
    } finally {
      setTpLoading(false)
    }
  }

  const tpFiltered = useMemo(() => {
    if (!tpData) return []
    let list = tpData.companies
    if (tpSearch.trim()) {
      const q = tpSearch.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q))
    }
    if (tpPark) list = list.filter(c => c.park === tpPark)
    if (tpBuilding) list = list.filter(c => c.building === tpBuilding)
    return list
  }, [tpData, tpSearch, tpPark, tpBuilding])

  function tpToggle(name) {
    setTpSelected(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function tpSelectAll() {
    const eligible = tpFiltered.filter(c => !c.already_added)
    setTpSelected(new Set(eligible.map(c => c.name)))
  }

  function tpClearSelection() { setTpSelected(new Set()) }

  async function tpAddSelected() {
    const toAdd = tpFiltered.filter(c => tpSelected.has(c.name))
    if (!toAdd.length) return
    setTpAdding(true)
    setTpAddMsg(`Adding ${toAdd.length} companies…`)
    try {
      const payload = toAdd.map(c => ({ name: c.name, website: c.website || null }))
      const res = await bulkCreateCompanies(payload)
      const { inserted, updated } = res.data

      // Also create leads for contacts from Technopark directory
      const leadPayload = toAdd
        .filter(c => c.contact_name)
        .map(c => ({ name: c.contact_name, title: c.contact_title || null, company: c.name, website: c.website || null }))
      if (leadPayload.length) {
        await bulkCreateLeads({ leads: leadPayload })
      }

      setTpAddMsg(`Done — ${inserted} added${updated ? ` · ${updated} updated` : ''}${leadPayload.length ? ` · ${leadPayload.length} contacts imported` : ''}. Use "Fill All" to enrich.`)
      setTpSelected(new Set())
      // Refresh already_added flags
      const refreshed = await getTechnoparkDirectory({ search: tpSearch, park: tpPark, building: tpBuilding })
      setTpData(refreshed.data)
      onRefresh()
    } catch (e) {
      setTpAddMsg('Error: ' + e.message)
    } finally {
      setTpAdding(false)
      setTimeout(() => setTpAddMsg(''), 6000)
    }
  }

  const [tpLeadImporting, setTpLeadImporting] = useState(new Set())

  async function tpImportLead(c) {
    if (!c.contact_name || tpLeadImporting.has(c.technopark_id)) return
    setTpLeadImporting(prev => new Set(prev).add(c.technopark_id))
    try {
      await bulkCreateLeads({ leads: [{ name: c.contact_name, title: c.contact_title || null, company: c.name, website: c.website || null }] })
      setTpAddMsg(`Lead imported: ${c.contact_name} → ${c.name}`)
      setTimeout(() => setTpAddMsg(''), 4000)
    } catch (e) {
      setTpAddMsg('Lead import failed: ' + e.message)
    } finally {
      setTpLeadImporting(prev => { const next = new Set(prev); next.delete(c.technopark_id); return next })
    }
  }

  const validManualCount = rows.filter(r => r.name.trim()).length
  const filledCount = rows.filter(r => r.status === 'filled').length
  const pendingFill = rows.filter(r => r.name.trim() && r.status === 'idle')

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: tab === 'technopark' ? '820px' : '600px' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <p style={s.eyebrow}>Companies</p>
            <h2 style={s.title}>Bulk Add</h2>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          {TABS.map(t => (
            <button key={t.key}
              onClick={() => {
                setTab(t.key)
                if (t.key === 'technopark') loadTechnopark()
              }}
              style={{ ...s.tab, ...(tab === t.key ? s.tabActive : {}) }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Result */}
        {result ? (
          <div style={s.body}>
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={s.successCircle}>✓</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', marginBottom: '6px' }}>Import complete.</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.7 }}>
                {result.inserted} added{result.updated > 0 ? ` · ${result.updated} updated (website/size corrected)` : ''} · {result.skipped} skipped
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={resetAll} style={s.secondaryBtn}>Add More</button>
                <button onClick={onClose} style={s.primaryBtn}>Done →</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={s.body}>

            {/* ── MANUAL ── */}
            {tab === 'manual' && (
              <>
                <p style={s.hint}>Enter company names and optional websites. Use <strong>↯ Fill</strong> to auto-enrich from LinkedIn.</p>
                <div style={s.table}>
                  <div style={s.tableHead}>
                    <span style={{ flex: 2, ...s.th }}>Company Name *</span>
                    <span style={{ flex: 2, ...s.th }}>Website</span>
                    <span style={{ width: '80px', ...s.th }}>Status</span>
                    <span style={{ width: '28px' }} />
                  </div>
                  <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    {rows.map(row => (
                      <div key={row.id} style={s.tableRow}>
                        <input
                          type="text" value={row.name} placeholder="e.g. Beagle Security"
                          onChange={e => updateRow(row.id, 'name', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && row.name.trim()) fillRow(row) }}
                          style={{ flex: 2, ...s.cellInput, borderColor: row.status === 'error' ? 'rgba(184,50,50,0.4)' : 'transparent' }}
                        />
                        <input
                          type="text" value={row.website} placeholder="https://…"
                          onChange={e => updateRow(row.id, 'website', e.target.value)}
                          style={{ flex: 2, ...s.cellInput }}
                        />
                        <div style={{ width: '80px', display: 'flex', alignItems: 'center', paddingLeft: '6px' }}>
                          {row.status === 'idle' && row.name.trim() && (
                            <button onClick={() => fillRow(row)} disabled={!!fillTarget} style={s.fillBtn}>↯ Fill</button>
                          )}
                          {row.status === 'loading' && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>…</span>}
                          {row.status === 'filled' && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', color: '#4a7c59', letterSpacing: '0.04em' }}>✓ done</span>}
                          {row.status === 'error' && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)' }}>not found</span>}
                        </div>
                        <button onClick={() => removeRow(row.id)} style={s.removeBtn}>✕</button>
                      </div>
                    ))}
                  </div>
                  {filledCount > 0 && (
                    <div style={s.filledBanner}>
                      ✓ {filledCount} {filledCount === 1 ? 'company' : 'companies'} enriched with LinkedIn data (followers, HQ, description)
                    </div>
                  )}
                </div>
                <button onClick={addRow} style={s.addRowBtn}>+ Add row</button>
                <div style={s.footer}>
                  <button onClick={fillAll} disabled={fillingAll || pendingFill.length === 0}
                    style={{ ...s.secondaryBtn, opacity: fillingAll || pendingFill.length === 0 ? 0.4 : 1 }}>
                    {fillingAll ? 'Filling…' : `↯ Find & Fill All (${pendingFill.length})`}
                  </button>
                  <button onClick={importManual} disabled={importing || validManualCount === 0}
                    style={{ ...s.primaryBtn, flex: 1, opacity: importing || validManualCount === 0 ? 0.4 : 1 }}>
                    {importing ? 'Importing…' : `Import ${validManualCount} ${validManualCount === 1 ? 'company' : 'companies'} →`}
                  </button>
                </div>
              </>
            )}

            {/* ── CSV ── */}
            {tab === 'csv' && (
              <>
                {csvRows.length === 0 ? (
                  <>
                    <div style={s.dropzone} onClick={() => fileRef.current?.click()}>
                      <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={handleFileUpload} />
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', marginBottom: '10px', color: 'var(--text-muted)' }}>↑</p>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '400', letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: '6px' }}>Drop or click to upload</p>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>CSV, TSV, or TXT · first row must be headers</p>
                    </div>
                    <p style={s.hint}>Required column: <strong>name</strong> or <strong>company</strong>. Optional: <strong>website</strong> or <strong>url</strong>.</p>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                      <div>
                        <label style={s.label}>Name column *</label>
                        <select value={colMap.name} onChange={e => setColMap(p => ({ ...p, name: e.target.value }))} style={s.select}>
                          <option value="">— select —</option>
                          {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={s.label}>Website (optional)</label>
                        <select value={colMap.website} onChange={e => setColMap(p => ({ ...p, website: e.target.value }))} style={s.select}>
                          <option value="">— none —</option>
                          {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={s.label}>Employee Count (optional)</label>
                        <select value={colMap.employees} onChange={e => setColMap(p => ({ ...p, employees: e.target.value }))} style={s.select}>
                          <option value="">— none —</option>
                          {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={s.label}>Followers (optional)</label>
                        <select value={colMap.followers} onChange={e => setColMap(p => ({ ...p, followers: e.target.value }))} style={s.select}>
                          <option value="">— none —</option>
                          {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={s.table}>
                      <div style={s.tableHead}>
                        {csvHeaders.map(h => (
                          <span key={h} style={{ flex: 1, minWidth: 0, ...s.th, color: (h === colMap.name || h === colMap.website) ? 'var(--accent)' : 'var(--text-muted)' }}>{h}</span>
                        ))}
                      </div>
                      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {csvRows.slice(0, 30).map((row, i) => (
                          <div key={i} style={{ ...s.tableRow, flexWrap: 'nowrap' }}>
                            {csvHeaders.map(h => (
                              <span key={h} style={{ flex: 1, minWidth: 0, fontSize: '12px', color: h === colMap.name ? 'var(--text)' : 'var(--text-muted)', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {row[h] || '—'}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', margin: '8px 0 14px', letterSpacing: '0.04em' }}>
                      {csvRows.length} rows · {csvRows.filter(r => r[colMap.name]?.trim()).length} valid
                    </p>
                    <div style={s.footer}>
                      <button onClick={() => { setCsvRows([]); setCsvHeaders([]); if (fileRef.current) fileRef.current.value = '' }} style={s.secondaryBtn}>← Change file</button>
                      <button onClick={importCSV} disabled={importing || !colMap.name}
                        style={{ ...s.primaryBtn, flex: 1, opacity: importing || !colMap.name ? 0.4 : 1 }}>
                        {importing ? 'Importing…' : `Import ${csvRows.filter(r => r[colMap.name]?.trim()).length} companies →`}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── TECHNOPARK ── */}
            {tab === 'technopark' && (
              <>
                {tpLoading && (
                  <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    Loading Technopark directory…
                  </div>
                )}

                {!tpLoading && tpError && (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red, #b83232)', marginBottom: '12px' }}>{tpError}</p>
                    <button onClick={() => { setTpError(''); setTpData(null); loadTechnopark() }} style={{ ...s.secondaryBtn, fontSize: '10px' }}>Retry</button>
                  </div>
                )}

                {!tpLoading && tpData && (
                  <>
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <input
                        value={tpSearch}
                        onChange={e => setTpSearch(e.target.value)}
                        placeholder="Search companies…"
                        style={{ ...s.cellInput, border: '1px solid var(--border)', borderRadius: '6px', flex: '1 1 180px', minWidth: '0' }}
                      />
                      <select value={tpPark} onChange={e => setTpPark(e.target.value)}
                        style={{ ...s.select, flex: '0 0 150px' }}>
                        <option value="">All Phases</option>
                        {tpData.parks.map(p => (
                          <option key={p} value={p}>{p.replace('TECHNOPARK ', '')}</option>
                        ))}
                      </select>
                      <select value={tpBuilding} onChange={e => setTpBuilding(e.target.value)}
                        style={{ ...s.select, flex: '0 0 140px' }}>
                        <option value="">All Buildings</option>
                        {tpData.buildings.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    {/* Selection controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', flex: 1 }}>
                        {tpFiltered.length} companies · {tpFiltered.filter(c => c.already_added).length} already added
                      </span>
                      {tpSelected.size > 0 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', fontWeight: '600' }}>
                          {tpSelected.size} selected
                        </span>
                      )}
                      <button onClick={tpSelectAll} style={s.tpLinkBtn}>Select all new</button>
                      {tpSelected.size > 0 && <button onClick={tpClearSelection} style={s.tpLinkBtn}>Clear</button>}
                    </div>

                    {/* Company list */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                        {tpFiltered.length === 0 && (
                          <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                            No companies found
                          </div>
                        )}
                        {tpFiltered.map((c, i) => {
                          const checked = tpSelected.has(c.name)
                          return (
                            <div key={c.technopark_id}
                              onClick={() => !c.already_added && tpToggle(c.name)}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                padding: '10px 12px',
                                borderBottom: i < tpFiltered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                background: c.already_added ? 'rgba(74,124,89,0.04)' : checked ? 'rgba(168,100,72,0.05)' : 'transparent',
                                cursor: c.already_added ? 'default' : 'pointer',
                                transition: 'background 0.1s',
                              }}>
                              <div style={{ paddingTop: '2px', flexShrink: 0 }}>
                                {c.already_added
                                  ? <span style={{ fontSize: '12px', color: '#4a7c59' }}>✓</span>
                                  : <input type="checkbox" checked={checked} onChange={() => tpToggle(c.name)}
                                      onClick={e => e.stopPropagation()}
                                      style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
                                }
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '600', color: c.already_added ? '#4a7c59' : 'var(--text)' }}>
                                    {c.name}
                                  </span>
                                  {c.already_added && (
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', background: 'rgba(74,124,89,0.10)', color: '#4a7c59', border: '1px solid rgba(74,124,89,0.2)', borderRadius: '3px', padding: '1px 5px', letterSpacing: '0.06em' }}>
                                      IN PIPELINE
                                    </span>
                                  )}
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1px 5px' }}>
                                    {c.building}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '3px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  {c.website && (
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                                      🌐 {c.website.replace('https://', '')}
                                    </span>
                                  )}
                                  {c.contact_name && (
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                                      👤 {c.contact_name}{c.contact_title ? ` · ${c.contact_title}` : ''}
                                    </span>
                                  )}
                                  {c.contact_name && c.already_added && (
                                    <button
                                      onClick={e => { e.stopPropagation(); tpImportLead(c) }}
                                      disabled={tpLeadImporting.has(c.technopark_id)}
                                      style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', color: 'var(--accent)', background: 'rgba(168,100,72,0.07)', border: '1px solid rgba(168,100,72,0.2)', borderRadius: '3px', padding: '1px 6px', cursor: 'pointer', letterSpacing: '0.04em', opacity: tpLeadImporting.has(c.technopark_id) ? 0.5 : 1 }}>
                                      {tpLeadImporting.has(c.technopark_id) ? '…' : '+ Lead'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Status message */}
                    {tpAddMsg && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', padding: '8px 12px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        {tpAddMsg}
                      </div>
                    )}

                    {/* Footer */}
                    <div style={s.footer}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                        {tpData.total} total companies in Technopark
                      </span>
                      <button
                        onClick={tpAddSelected}
                        disabled={tpSelected.size === 0 || tpAdding}
                        style={{ ...s.primaryBtn, opacity: (tpSelected.size === 0 || tpAdding) ? 0.4 : 1 }}>
                        {tpAdding ? tpAddMsg || 'Working…' : `Add ${tpSelected.size || 0} + Autofill →`}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── PASTE ── */}
            {tab === 'paste' && (
              <>
                <p style={s.hint}>One company per line. Optionally add a website separated by a <strong>tab</strong>.</p>
                <textarea
                  value={pasteText}
                  onChange={e => { setPasteText(e.target.value); setPasteRows([]) }}
                  placeholder={'Stripe\nTwilio\thttps://twilio.com\nBeagle Security\thttps://beaglesecurity.com'}
                  rows={7}
                  style={{ ...s.cellInput, width: '100%', resize: 'vertical', fontSize: '12px', marginBottom: '10px', boxSizing: 'border-box', borderColor: 'var(--border)' }}
                />
                {pasteRows.length === 0 ? (
                  <button onClick={parsePaste} disabled={!pasteText.trim()}
                    style={{ ...s.secondaryBtn, opacity: pasteText.trim() ? 1 : 0.4 }}>
                    Preview {pasteText.trim().split(/\n/).filter(l => l.trim()).length} lines →
                  </button>
                ) : (
                  <>
                    <div style={s.table}>
                      <div style={s.tableHead}>
                        <span style={{ flex: 2, ...s.th }}>Name</span>
                        <span style={{ flex: 2, ...s.th }}>Website</span>
                      </div>
                      <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        {pasteRows.map((r, i) => (
                          <div key={i} style={s.tableRow}>
                            <span style={{ flex: 2, fontSize: '12px', color: 'var(--text)', padding: '0 8px' }}>{r.name}</span>
                            <span style={{ flex: 2, fontSize: '12px', color: 'var(--text-muted)', padding: '0 8px' }}>{r.website || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', margin: '8px 0 14px', letterSpacing: '0.04em' }}>{pasteRows.length} companies parsed</p>
                    <div style={s.footer}>
                      <button onClick={() => setPasteRows([])} style={s.secondaryBtn}>← Edit</button>
                      <button onClick={importPaste} disabled={importing}
                        style={{ ...s.primaryBtn, flex: 1, opacity: importing ? 0.4 : 1 }}>
                        {importing ? 'Importing…' : `Import ${pasteRows.length} companies →`}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(29,27,27,0.5)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  modal: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(29,27,27,0.14)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: '1px dashed var(--border-dash)', flexShrink: 0 },
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' },
  title: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '400', color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1 },
  closeBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', cursor: 'pointer', padding: '5px 10px' },
  tabs: { display: 'flex', gap: '4px', padding: '12px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  tab: { padding: '5px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '5px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '400', letterSpacing: '0.04em', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' },
  tabActive: { background: '#1d1b1b', borderColor: '#1d1b1b', color: '#fdfdfd', fontWeight: '600' },
  body: { padding: '20px 24px 24px', overflowY: 'auto', flex: 1 },
  hint: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '14px' },
  table: { border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' },
  tableHead: { display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 0', alignItems: 'center' },
  tableRow: { display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', minHeight: '40px' },
  th: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 8px' },
  cellInput: { padding: '8px', background: 'transparent', border: '1px solid transparent', borderRadius: '5px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', outline: 'none', transition: 'border-color 0.15s' },
  fillBtn: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.04em', color: 'var(--accent)', background: 'rgba(168,100,72,0.08)', border: '1px solid rgba(168,100,72,0.25)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', whiteSpace: 'nowrap' },
  removeBtn: { width: '28px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '11px', flexShrink: 0, textAlign: 'center' },
  filledBanner: { fontFamily: 'var(--font-mono)', padding: '9px 14px', background: 'rgba(74,124,89,0.07)', borderTop: '1px solid rgba(74,124,89,0.15)', fontSize: '11px', fontWeight: '500', color: '#4a7c59' },
  addRowBtn: { background: 'none', border: 'none', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', cursor: 'pointer', padding: '4px 0', marginBottom: '14px' },
  footer: { display: 'flex', gap: '10px', marginTop: '4px' },
  primaryBtn: { padding: '10px 18px', background: '#1d1b1b', border: 'none', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: '#fdfdfd', cursor: 'pointer' },
  secondaryBtn: { padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '400', letterSpacing: '0.04em', color: 'var(--text-secondary)', cursor: 'pointer' },
  dropzone: { border: '1px dashed var(--border-dash)', borderRadius: '8px', padding: '40px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: '12px', transition: 'border-color 0.15s' },
  label: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.06em', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' },
  select: { width: '100%', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text)', outline: 'none', cursor: 'pointer', letterSpacing: '0.02em' },
  successCircle: { width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(74,124,89,0.10)', border: '1px solid rgba(74,124,89,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontFamily: 'var(--font-mono)', fontSize: '16px', color: '#4a7c59' },
  tpLinkBtn: { background: 'none', border: 'none', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--accent)', cursor: 'pointer', padding: '2px 0', letterSpacing: '0.04em', fontWeight: '600' },
}
