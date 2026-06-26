import React, { useState, useRef, useEffect } from 'react'
import { prefillCompany, createCompany, deepEnrichCompany } from '../services/api'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const EMPTY_FORM = { name: '', website: '', linkedin_url: '', headquarters: '', followers: '', size: '', description: '' }

export default function AddCompanyModal({ onClose, onRefresh }) {
  const [name, setName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [step, setStep] = useState('input') // input | loading | form | saved | error
  const [form, setForm] = useState(EMPTY_FORM)
  const [linkedinPeopleUrl, setLinkedinPeopleUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [foundFields, setFoundFields] = useState([])

  const [suggestions, setSuggestions] = useState([])
  const [showSugg, setShowSugg] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef(null)
  const suggRef = useRef(null)

  function handleNameChange(e) {
    const val = e.target.value
    setName(val)
    setActiveIdx(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setSuggestions([]); setShowSugg(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/company-suggest?q=${encodeURIComponent(val.trim())}`)
        const data = await res.json()
        const list = Array.isArray(data) ? data : []
        setSuggestions(list.slice(0, 7))
        setShowSugg(list.length > 0)
      } catch { setSuggestions([]); setShowSugg(false) }
    }, 280)
  }

  function pickSuggestion(s) {
    setName(s.name)
    setWebsiteUrl(s.domain ? `https://${s.domain}` : '')
    setSuggestions([])
    setShowSugg(false)
    setActiveIdx(-1)
  }

  function handleNameKeyDown(e) {
    if (!showSugg || suggestions.length === 0) {
      if (e.key === 'Enter') handleFind()
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0) pickSuggestion(suggestions[activeIdx])
      else handleFind()
    }
    else if (e.key === 'Escape') { setShowSugg(false); setActiveIdx(-1) }
  }

  useEffect(() => {
    function handleClick(e) {
      if (suggRef.current && !suggRef.current.contains(e.target)) setShowSugg(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleFind() {
    if (!name.trim()) return
    setShowSugg(false)
    setStep('loading')
    setError('')
    try {
      const res = await prefillCompany(name.trim(), websiteUrl.trim())
      const d = res.data
      const li = d.linkedin_data || {}
      const found = []
      if (li.followers) found.push('followers')
      if (li.location) found.push('headquarters')
      if (li.employee_count) found.push('size')
      if (li.description) found.push('description')
      setFoundFields(found)
      setForm({
        name: d.name || name.trim(),
        website: d.website_url || '',
        linkedin_url: d.linkedin_url || '',
        headquarters: li.location || '',
        followers: li.followers || '',
        size: li.employee_count ? `${li.employee_count}` : '',
        description: li.description || '',
      })
      setLinkedinPeopleUrl(d.linkedin_people_url || '')
      setStep('form')
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Failed to find company info.')
      setStep('error')
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const created = await createCompany({
        name: form.name.trim(),
        website: form.website.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        headquarters: form.headquarters.trim() || null,
        followers: form.followers.trim() || null,
        size: form.size.trim() || null,
        description: form.description.trim() || null,
      })
      setStep('saved')
      onRefresh()
      // Trigger deep enrich silently in background — don't await or show errors
      const newId = created?.data?.company?.id || created?.data?.id
      if (newId) deepEnrichCompany(newId).catch(() => {})
    } catch (e) {
      const raw = e.response?.data?.detail || e.message || 'Save failed.'
      const msg = typeof raw === 'string' && raw.includes("'message'")
        ? (raw.match(/'message':\s*'([^']+)'/) || [])[1] || raw
        : raw
      setError(msg.includes('duplicate') || msg.includes('already') ? 'This company is already in your list.' : msg)
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setStep('input')
    setForm(EMPTY_FORM)
    setError('')
    setName('')
    setWebsiteUrl('')
    setFoundFields([])
    setSuggestions([])
    setShowSugg(false)
  }

  function field(key) {
    return (
      <input type="text" value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={s.input} />
    )
  }

  function badge(key) {
    return foundFields.includes(key)
      ? <span style={s.foundBadge}>✓ filled</span>
      : <span style={s.emptyBadge}>empty</span>
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>

        <div style={s.header}>
          <div>
            <p style={s.eyebrow}>New Company</p>
            <h2 style={s.title}>Add Company</h2>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* INPUT */}
        {(step === 'input' || step === 'error') && (
          <div style={s.body}>
            <div style={s.fieldRow}>
              <label style={s.label}>Company name <span style={s.required}>*</span></label>
              <div style={{ position: 'relative' }} ref={suggRef}>
                <input
                  autoFocus type="text" placeholder="e.g. Beagle Security" value={name}
                  onChange={handleNameChange}
                  onKeyDown={handleNameKeyDown}
                  onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                  style={s.input}
                />
                {showSugg && suggestions.length > 0 && (
                  <div style={s.dropdown}>
                    {suggestions.map((c, i) => (
                      <div key={c.domain || c.name} onMouseDown={() => pickSuggestion(c)}
                        style={{ ...s.suggItem, background: i === activeIdx ? 'var(--surface)' : 'transparent' }}>
                        {c.logo
                          ? <img src={c.logo} alt="" style={s.logo} onError={e => { e.target.style.display = 'none' }} />
                          : <div style={s.logoPlaceholder}>{c.name[0]}</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={s.suggName}>{c.name}</p>
                          {c.domain && <p style={s.suggDomain}>{c.domain}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={s.fieldRow}>
              <label style={s.label}>Website <span style={s.optional}>— auto-filled when you pick a suggestion</span></label>
              <input type="text" placeholder="https://company.com" value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFind()}
                style={s.input} />
            </div>
            {error && <p style={s.errorMsg}>{error}</p>}
            <p style={s.hint}>Type a company name → pick from suggestions → hit Find & Fill to enrich with LinkedIn data.</p>
            <button onClick={handleFind} disabled={!name.trim()}
              style={{ ...s.primaryBtn, opacity: name.trim() ? 1 : 0.4, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>
              Find & Fill →
            </button>
          </div>
        )}

        {/* LOADING */}
        {step === 'loading' && (
          <div style={{ ...s.body, textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: '400', letterSpacing: '-0.03em', color: 'var(--text)', marginBottom: '8px' }}>Looking up {name}…</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7 }}>Searching website → extracting LinkedIn → scraping public data</p>
          </div>
        )}

        {/* FORM */}
        {step === 'form' && (
          <div style={s.body}>
            {foundFields.length > 0 && (
              <div style={s.banner}>
                ✓ {foundFields.length} field{foundFields.length > 1 ? 's' : ''} auto-filled from LinkedIn — review before saving
              </div>
            )}

            <div style={s.grid}>
              <div style={{ gridColumn: '1 / -1', ...s.fieldRow }}>
                <label style={s.label}>Company name <span style={s.required}>*</span></label>
                {field('name')}
              </div>
              <div style={s.fieldRow}>
                <label style={s.label}>Website</label>
                {field('website')}
              </div>
              <div style={s.fieldRow}>
                <label style={s.label}>LinkedIn URL</label>
                {form.linkedin_url
                  ? <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="text" value={form.linkedin_url} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} style={{ ...s.input, flex: 1 }} />
                      <a href={form.linkedin_url} target="_blank" rel="noreferrer" style={s.visitLink}>↗</a>
                    </div>
                  : field('linkedin_url')
                }
              </div>
              <div style={s.fieldRow}>
                <div style={s.labelRow}>
                  <label style={s.label}>Headquarters</label>
                  {badge('headquarters')}
                </div>
                {field('headquarters')}
              </div>
              <div style={s.fieldRow}>
                <div style={s.labelRow}>
                  <label style={s.label}>Followers</label>
                  {badge('followers')}
                </div>
                {field('followers')}
              </div>
              <div style={s.fieldRow}>
                <div style={s.labelRow}>
                  <label style={s.label}>Employee count</label>
                  {badge('size')}
                </div>
                {field('size')}
              </div>
              <div style={{ gridColumn: '1 / -1', ...s.fieldRow }}>
                <div style={s.labelRow}>
                  <label style={s.label}>Description</label>
                  {badge('description')}
                </div>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} style={{ ...s.input, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            </div>

            {linkedinPeopleUrl && foundFields.length < 3 && (
              <div style={s.extensionNote}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', lineHeight: 1.6 }}>For associated members, visit the People tab with the extension:</p>
                <a href={linkedinPeopleUrl} target="_blank" rel="noreferrer" style={s.peopleLinkBtn}>Open People Tab →</a>
              </div>
            )}

            {error && <p style={s.errorMsg}>{error}</p>}

            <div style={s.actions}>
              <button onClick={handleReset} style={s.secondaryBtn}>← Back</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                style={{ ...s.primaryBtn, flex: 1, opacity: saving || !form.name.trim() ? 0.5 : 1, cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? 'Saving…' : 'Save Company →'}
              </button>
            </div>
          </div>
        )}

        {/* SAVED */}
        {step === 'saved' && (
          <div style={{ ...s.body, textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: '#4a7c59', textTransform: 'uppercase', marginBottom: '10px' }}>Saved</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '400', letterSpacing: '-0.04em', color: 'var(--text)', marginBottom: '6px' }}>{form.name}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '28px' }}>Company added to your list.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={handleReset} style={s.secondaryBtn}>Add Another</button>
              <button onClick={onClose} style={s.primaryBtn}>Done →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(29,27,27,0.5)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  modal: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(29,27,27,0.14)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  eyebrow: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase' },
  title: { fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '400', color: 'var(--text)', letterSpacing: '-0.04em', lineHeight: 1 },
  closeBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.04em', cursor: 'pointer', padding: '5px 10px', flexShrink: 0 },
  body: { padding: '18px 24px 20px', overflowY: 'auto' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginBottom: '12px' },
  fieldRow: { display: 'flex', flexDirection: 'column', gap: '5px' },
  labelRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  label: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '500', color: 'var(--text-secondary)', letterSpacing: '0.06em' },
  required: { color: 'var(--accent)', fontWeight: '600' },
  optional: { fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '400', color: 'var(--text-muted)' },
  input: { width: '100%', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s' },
  hint: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.7, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', marginBottom: '14px' },
  banner: { fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: '500', color: '#4a7c59', padding: '9px 12px', background: 'rgba(74,124,89,0.07)', border: '1px solid rgba(74,124,89,0.18)', borderRadius: '6px', marginBottom: '14px' },
  foundBadge: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', color: '#4a7c59', background: 'rgba(74,124,89,0.10)', border: '1px solid rgba(74,124,89,0.22)', padding: '1px 6px', borderRadius: '3px', letterSpacing: '0.04em' },
  emptyBadge: { fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '500', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: '3px', letterSpacing: '0.04em' },
  visitLink: { fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '10px', fontWeight: '600', textDecoration: 'none', padding: '5px 9px', border: '1px solid rgba(168,100,72,0.3)', borderRadius: '5px', letterSpacing: '0.04em' },
  extensionNote: { padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', marginBottom: '12px' },
  peopleLinkBtn: { display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: 'var(--accent)', border: '1px solid rgba(168,100,72,0.3)', padding: '4px 10px', borderRadius: '5px', textDecoration: 'none' },
  errorMsg: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', margin: '8px 0' },
  actions: { display: 'flex', gap: '10px', marginTop: '4px' },
  primaryBtn: { padding: '10px 18px', background: 'var(--text)', border: 'none', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.04em', color: '#FFFFFF', cursor: 'pointer' },
  secondaryBtn: { padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '400', letterSpacing: '0.04em', color: 'var(--text-secondary)', cursor: 'pointer' },
  // Autocomplete dropdown
  dropdown: { position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(29,27,27,0.12)', zIndex: 100, overflow: 'hidden' },
  suggItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', cursor: 'pointer', transition: 'background 0.1s' },
  logo: { width: '22px', height: '22px', borderRadius: '4px', objectFit: 'contain', flexShrink: 0, border: '1px solid var(--border)' },
  logoPlaceholder: { width: '22px', height: '22px', borderRadius: '4px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', color: 'var(--text-muted)', flexShrink: 0 },
  suggName: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  suggDomain: { fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.02em', marginTop: '1px' },
}
