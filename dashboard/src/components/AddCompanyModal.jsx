import React, { useState } from 'react'
import { prefillCompany, createCompany } from '../services/api'

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

  async function handleFind() {
    if (!name.trim()) return
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
        size: li.employee_count ? `${li.employee_count} employees` : '',
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
      await createCompany({
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
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Save failed.'
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
              <input autoFocus type="text" placeholder="e.g. Beagle Security" value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFind()}
                style={s.input} />
            </div>
            <div style={s.fieldRow}>
              <label style={s.label}>Website <span style={s.optional}>— optional, leave blank to auto-search</span></label>
              <input type="text" placeholder="https://company.com" value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFind()}
                style={s.input} />
            </div>
            {error && <p style={s.errorMsg}>{error}</p>}
            <p style={s.hint}>We'll find the website → extract LinkedIn URL → scrape followers, location, and employee count.</p>
            <button onClick={handleFind} disabled={!name.trim()}
              style={{ ...s.primaryBtn, opacity: name.trim() ? 1 : 0.4, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>
              Find & Fill →
            </button>
          </div>
        )}

        {/* LOADING */}
        {step === 'loading' && (
          <div style={{ ...s.body, textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '6px' }}>Looking up <strong>{name}</strong>…</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Searching website → extracting LinkedIn → scraping public data</p>
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
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>For associated members, visit the People tab with the extension:</p>
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
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(74,124,89,0.12)', border: '1px solid rgba(74,124,89,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '18px' }}>✓</div>
            <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>{form.name} saved</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>Company added to your list.</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={handleReset} style={s.secondaryBtn}>Add Another</button>
              <button onClick={onClose} style={s.primaryBtn}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(29,27,27,0.4)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  modal: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '540px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(29,27,27,0.12)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 0', flexShrink: 0 },
  eyebrow: { fontSize: '9px', fontWeight: '600', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' },
  title: { fontSize: '18px', fontWeight: '600', color: 'var(--text)', fontFamily: "'DM Serif Display', serif", letterSpacing: '-0.3px' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '15px', cursor: 'pointer', padding: '4px', flexShrink: 0 },
  body: { padding: '16px 24px 20px', overflowY: 'auto' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginBottom: '12px' },
  fieldRow: { display: 'flex', flexDirection: 'column', gap: '5px' },
  labelRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  label: { fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)' },
  required: { color: 'var(--accent)', fontWeight: '600' },
  optional: { fontSize: '10px', fontWeight: '400', color: 'var(--text-muted)' },
  input: { width: '100%', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '7px', fontSize: '13px', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border-color 0.15s' },
  hint: { fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '14px' },
  banner: { fontSize: '12px', fontWeight: '500', color: '#4a7c59', padding: '9px 12px', background: 'rgba(74,124,89,0.08)', border: '1px solid rgba(74,124,89,0.2)', borderRadius: '8px', marginBottom: '14px' },
  foundBadge: { fontSize: '9px', fontWeight: '600', color: '#4a7c59', background: 'rgba(74,124,89,0.10)', border: '1px solid rgba(74,124,89,0.22)', padding: '1px 6px', borderRadius: '3px' },
  emptyBadge: { fontSize: '9px', fontWeight: '500', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: '3px' },
  visitLink: { color: 'var(--accent)', fontSize: '13px', textDecoration: 'none', padding: '6px 8px', border: '1px solid rgba(168,100,72,0.3)', borderRadius: '5px' },
  extensionNote: { padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '12px' },
  peopleLinkBtn: { display: 'inline-block', fontSize: '11px', fontWeight: '500', color: 'var(--accent)', border: '1px solid rgba(168,100,72,0.3)', padding: '4px 10px', borderRadius: '5px', textDecoration: 'none' },
  errorMsg: { fontSize: '12px', color: 'var(--red)', margin: '8px 0' },
  actions: { display: 'flex', gap: '10px', marginTop: '4px' },
  primaryBtn: { padding: '10px 18px', background: 'var(--text)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: 'var(--bg)', cursor: 'pointer', fontFamily: 'inherit' },
  secondaryBtn: { padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '400' },
}
