import React, { useState, useRef } from 'react'
import { prefillCompany, bulkCreateCompanies } from '../services/api'

const TABS = [
  { key: 'manual', label: 'Manual Entry' },
  { key: 'csv',    label: 'Import CSV' },
  { key: 'paste',  label: 'Paste List' },
]

let _id = 0
const newRow = () => ({ id: ++_id, name: '', website: '', status: 'idle', filled: null })

export default function BulkAddModal({ onClose, onRefresh }) {
  const [tab, setTab] = useState('manual')
  const [rows, setRows] = useState([newRow(), newRow(), newRow()])
  const [fillTarget, setFillTarget] = useState(null)
  const [fillingAll, setFillingAll] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  // CSV state
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [colMap, setColMap] = useState({ name: '', website: '' })
  const fileRef = useRef(null)

  // Paste state
  const [pasteText, setPasteText] = useState('')
  const [pasteRows, setPasteRows] = useState([])

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
      }
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'filled', filled, website: filled.website || r.website } : r))
    } catch {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error' } : r))
    } finally {
      setFillTarget(null)
    }
  }

  async function fillAll() {
    setFillingAll(true)
    for (const row of rows) {
      if (row.name.trim() && row.status === 'idle') await fillRow(row)
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
        name:    headers.find(h => /name|company/i.test(h)) || '',
        website: headers.find(h => /website|url|web|domain/i.test(h)) || '',
      })
    }
    reader.readAsText(file)
  }

  async function importCSV() {
    if (!colMap.name) return
    const companies = csvRows
      .filter(r => r[colMap.name]?.trim())
      .map(r => ({
        name:    r[colMap.name].trim(),
        website: colMap.website ? (r[colMap.website]?.trim() || null) : null,
      }))
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
      setResult({ inserted: res.data.inserted, skipped: res.data.skipped })
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

  const validManualCount = rows.filter(r => r.name.trim()).length
  const filledCount = rows.filter(r => r.status === 'filled').length
  const pendingFill = rows.filter(r => r.name.trim() && r.status === 'idle')

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

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
            <button key={t.key} onClick={() => setTab(t.key)}
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
              <p style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text)', marginBottom: '6px' }}>Import complete</p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '28px' }}>
                {result.inserted} added · {result.skipped} skipped (duplicates or errors)
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button onClick={resetAll} style={s.secondaryBtn}>Add More</button>
                <button onClick={onClose} style={s.primaryBtn}>Done</button>
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
                          {row.status === 'loading' && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>…</span>}
                          {row.status === 'filled' && <span style={{ fontSize: '11px', color: '#4a7c59', fontWeight: '500' }}>✓ done</span>}
                          {row.status === 'error' && <span style={{ fontSize: '11px', color: 'var(--red)' }}>not found</span>}
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
                      <p style={{ fontSize: '24px', marginBottom: '10px' }}>📄</p>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text)', marginBottom: '4px' }}>Drop or click to upload CSV</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>CSV, TSV, or TXT · first row must be headers</p>
                    </div>
                    <p style={s.hint}>Required column: <strong>name</strong> or <strong>company</strong>. Optional: <strong>website</strong> or <strong>url</strong>.</p>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={s.label}>Name column *</label>
                        <select value={colMap.name} onChange={e => setColMap(p => ({ ...p, name: e.target.value }))} style={s.select}>
                          <option value="">— select —</option>
                          {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={s.label}>Website column (optional)</label>
                        <select value={colMap.website} onChange={e => setColMap(p => ({ ...p, website: e.target.value }))} style={s.select}>
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
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 14px' }}>
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

            {/* ── PASTE ── */}
            {tab === 'paste' && (
              <>
                <p style={s.hint}>One company per line. Optionally add a website separated by a <strong>tab</strong>.</p>
                <textarea
                  value={pasteText}
                  onChange={e => { setPasteText(e.target.value); setPasteRows([]) }}
                  placeholder={'Stripe\nTwilio\thttps://twilio.com\nBeagle Security\thttps://beaglesecurity.com'}
                  rows={7}
                  style={{ ...s.cellInput, width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', marginBottom: '10px', boxSizing: 'border-box', borderColor: 'var(--border)' }}
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
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 14px' }}>{pasteRows.length} companies parsed</p>
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
  overlay: { position: 'fixed', inset: 0, background: 'rgba(29,27,27,0.4)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  modal: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(29,27,27,0.12)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', flexShrink: 0 },
  eyebrow: { fontSize: '9px', fontWeight: '600', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' },
  title: { fontSize: '18px', fontFamily: "'DM Serif Display', serif", fontWeight: '400', color: 'var(--text)', letterSpacing: '-0.3px' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '15px', cursor: 'pointer', padding: '4px' },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', flexShrink: 0 },
  tab: { padding: '10px 14px', background: 'none', border: 'none', borderBottom: '2px solid transparent', fontSize: '12px', fontWeight: '400', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  tabActive: { borderBottomColor: 'var(--accent)', color: 'var(--text)', fontWeight: '500' },
  body: { padding: '20px 24px 24px', overflowY: 'auto', flex: 1 },
  hint: { fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '14px' },
  table: { border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px' },
  tableHead: { display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '8px 0', alignItems: 'center' },
  tableRow: { display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', minHeight: '40px' },
  th: { fontSize: '9px', fontWeight: '600', letterSpacing: '1.5px', color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 8px' },
  cellInput: { padding: '8px', background: 'transparent', border: '1px solid transparent', borderRadius: '5px', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' },
  fillBtn: { fontSize: '10px', fontWeight: '600', color: 'var(--accent)', background: 'rgba(168,100,72,0.08)', border: '1px solid rgba(168,100,72,0.25)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  removeBtn: { width: '28px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', flexShrink: 0, textAlign: 'center' },
  filledBanner: { padding: '9px 14px', background: 'rgba(74,124,89,0.07)', borderTop: '1px solid rgba(74,124,89,0.15)', fontSize: '11px', fontWeight: '500', color: '#4a7c59' },
  addRowBtn: { background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0', marginBottom: '14px' },
  footer: { display: 'flex', gap: '10px', marginTop: '4px' },
  primaryBtn: { padding: '10px 18px', background: 'var(--text)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit' },
  secondaryBtn: { padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' },
  dropzone: { border: '2px dashed var(--border)', borderRadius: '12px', padding: '40px 24px', textAlign: 'center', cursor: 'pointer', marginBottom: '12px', transition: 'border-color 0.15s' },
  label: { fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' },
  select: { width: '100%', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '12px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', cursor: 'pointer' },
  successCircle: { width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(74,124,89,0.12)', border: '1px solid rgba(74,124,89,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '20px', color: '#4a7c59' },
}
