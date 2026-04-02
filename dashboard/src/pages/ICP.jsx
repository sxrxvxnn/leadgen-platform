import React, { useState, useEffect } from 'react'
import { getICPProfiles, createICPProfile, updateICPProfile, deleteICPProfile } from '../services/api'
import Navbar from '../components/Navbar'

const FIT_COLORS = {
  high: 'var(--green)',
  medium: 'var(--amber)',
  low: 'var(--red, #ff2d2d)',
}

function fitLabel(score) {
  if (score >= 70) return { label: 'HIGH FIT', color: FIT_COLORS.high }
  if (score >= 40) return { label: 'MEDIUM FIT', color: FIT_COLORS.medium }
  return { label: 'LOW FIT', color: FIT_COLORS.low }
}

function TagList({ items, color }) {
  if (!items || items.length === 0) return React.createElement('span', { style: { fontSize: '12px', color: 'var(--gray-4)' } }, '—')
  return React.createElement(
    'div',
    { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
    items.map((item, i) =>
      React.createElement(
        'span',
        {
          key: i,
          style: {
            padding: '2px 10px',
            border: '1px solid ' + (color || 'var(--gray-3)'),
            borderRadius: '2px',
            fontSize: '10px',
            fontWeight: '600',
            letterSpacing: '0.5px',
            color: color || 'var(--gray-5)',
          }
        },
        item
      )
    )
  )
}

function ICPCard({ profile, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(profile.notes || '')
  const [score, setScore] = useState(profile.fit_score || 0)
  const fit = fitLabel(score)

  async function saveNotes() {
    try {
      await onUpdate(profile.id, { notes, fit_score: score })
      setEditing(false)
    } catch (e) {
      console.error(e)
    }
  }

  return React.createElement(
    'div',
    { style: card.wrapper },
    React.createElement(
      'div',
      { style: card.header },
      React.createElement(
        'div',
        null,
        React.createElement('p', { style: card.eyebrow }, 'ICP PROFILE'),
        React.createElement('h2', { style: card.name }, profile.company_name)
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
        React.createElement(
          'span',
          {
            style: {
              fontSize: '9px', fontWeight: '700', letterSpacing: '2px',
              padding: '4px 12px', border: '1px solid ' + fit.color,
              borderRadius: '2px', color: fit.color,
            }
          },
          fit.label + ' — ' + score + '/100'
        ),
        React.createElement(
          'button',
          { style: card.deleteBtn, onClick: () => onDelete(profile.id) },
          '✕'
        )
      )
    ),
    React.createElement(
      'div',
      { style: card.grid },
      React.createElement(
        'div',
        { style: card.gridItem },
        React.createElement('p', { style: card.gridLabel }, 'INDUSTRY'),
        React.createElement('p', { style: card.gridValue }, profile.industry || '—')
      ),
      React.createElement(
        'div',
        { style: card.gridItem },
        React.createElement('p', { style: card.gridLabel }, 'COMPANY SIZE'),
        React.createElement('p', { style: card.gridValue }, profile.company_size || '—')
      ),
      React.createElement(
        'div',
        { style: card.gridItem },
        React.createElement('p', { style: card.gridLabel }, 'HEADQUARTERS'),
        React.createElement('p', { style: card.gridValue }, profile.headquarters || '—')
      ),
      React.createElement(
        'div',
        { style: card.gridItem },
        React.createElement('p', { style: card.gridLabel }, 'WEBSITE'),
        profile.website
          ? React.createElement('a', { href: profile.website, style: card.link }, profile.website)
          : React.createElement('p', { style: card.gridValue }, '—')
      )
    ),
    React.createElement(
      'div',
      { style: card.section },
      React.createElement('p', { style: card.sectionLabel }, 'TARGET ROLES'),
      React.createElement(TagList, { items: profile.target_roles, color: 'var(--white)' })
    ),
    React.createElement(
      'div',
      { style: card.section },
      React.createElement('p', { style: card.sectionLabel }, 'PAIN POINTS'),
      React.createElement(TagList, { items: profile.pain_points, color: 'var(--amber)' })
    ),
    React.createElement(
      'div',
      { style: card.section },
      React.createElement('p', { style: card.sectionLabel }, 'TECH STACK'),
      React.createElement(TagList, { items: profile.tech_stack, color: 'var(--gray-4)' })
    ),
    React.createElement(
      'div',
      { style: card.section },
      React.createElement(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' } },
        React.createElement('p', { style: card.sectionLabel }, 'FIT SCORE & NOTES'),
        React.createElement(
          'button',
          { style: card.editBtn, onClick: () => editing ? saveNotes() : setEditing(true) },
          editing ? 'SAVE' : 'EDIT'
        )
      ),
      editing
        ? React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
              React.createElement('label', { style: card.gridLabel }, 'FIT SCORE (0-100)'),
              React.createElement('input', {
                type: 'number', min: 0, max: 100,
                value: score,
                onChange: (e) => setScore(Number(e.target.value)),
                style: card.scoreInput,
              })
            ),
            React.createElement('textarea', {
              value: notes,
              onChange: (e) => setNotes(e.target.value),
              placeholder: 'Add notes about this ICP...',
              style: card.textarea,
              rows: 3,
            })
          )
        : React.createElement(
            'p',
            { style: { fontSize: '13px', color: 'var(--gray-5)', lineHeight: 1.6 } },
            profile.notes || 'No notes yet. Click Edit to add context about this ICP.'
          )
    )
  )
}

export default function ICP() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    company_name: '',
    industry: '',
    company_size: '',
    headquarters: '',
    website: '',
    linkedin_url: '',
    target_roles: '',
    pain_points: '',
    tech_stack: '',
    fit_score: 50,
    fit_reason: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchProfiles() }, [])

  async function fetchProfiles() {
    try {
      const res = await getICPProfiles()
      setProfiles(res.data.profiles)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        target_roles: form.target_roles ? form.target_roles.split(',').map((s) => s.trim()).filter(Boolean) : [],
        pain_points: form.pain_points ? form.pain_points.split(',').map((s) => s.trim()).filter(Boolean) : [],
        tech_stack: form.tech_stack ? form.tech_stack.split(',').map((s) => s.trim()).filter(Boolean) : [],
        fit_score: Number(form.fit_score),
      }
      const res = await createICPProfile(payload)
      setProfiles((prev) => [res.data.profile, ...prev])
      setShowForm(false)
      setForm({ company_name: '', industry: '', company_size: '', headquarters: '', website: '', linkedin_url: '', target_roles: '', pain_points: '', tech_stack: '', fit_score: 50, fit_reason: '', notes: '' })
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this ICP profile?')) return
    try {
      await deleteICPProfile(id)
      setProfiles((prev) => prev.filter((p) => p.id !== id))
    } catch (e) { console.error(e) }
  }

  async function handleUpdate(id, data) {
    try {
      await updateICPProfile(id, data)
      setProfiles((prev) => prev.map((p) => p.id === id ? { ...p, ...data } : p))
    } catch (e) { console.error(e) }
  }

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.hero}>
        <div>
          <p style={s.eyebrow}>IDEAL CUSTOMER PROFILES</p>
          <h1 style={s.heroTitle}>
            {profiles.length}
            <span style={s.heroUnit}> profiles</span>
          </h1>
        </div>
        <button style={s.newBtn} onClick={() => setShowForm(!showForm)} data-hover="true">
          {showForm ? 'Cancel' : '+ New ICP'}
        </button>
      </div>

      <div style={s.container}>
        {/* Create form */}
        {showForm && (
          <div style={s.formCard}>
            <p style={s.formTitle}>CREATE ICP PROFILE</p>
            <form onSubmit={handleCreate} style={s.form}>
              <div style={s.formGrid}>
                {[
                  { key: 'company_name', label: 'COMPANY NAME *', ph: 'Acme Corp', required: true },
                  { key: 'industry', label: 'INDUSTRY', ph: 'SaaS / Fintech / Healthcare' },
                  { key: 'company_size', label: 'COMPANY SIZE', ph: '201-500 employees' },
                  { key: 'headquarters', label: 'HEADQUARTERS', ph: 'San Francisco, CA' },
                  { key: 'website', label: 'WEBSITE', ph: 'https://acme.com' },
                  { key: 'linkedin_url', label: 'LINKEDIN URL', ph: 'https://linkedin.com/company/acme' },
                ].map(({ key, label, ph, required }) => (
                  <div key={key} style={s.formField}>
                    <label style={s.formLabel}>{label}</label>
                    <input
                      type="text"
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      placeholder={ph}
                      required={required}
                      style={s.formInput}
                      data-hover="true"
                    />
                  </div>
                ))}
              </div>

              {[
                { key: 'target_roles', label: 'TARGET ROLES', ph: 'CTO, VP Engineering, Head of Security (comma separated)' },
                { key: 'pain_points', label: 'PAIN POINTS', ph: 'Security compliance, Manual processes, Scalability (comma separated)' },
                { key: 'tech_stack', label: 'TECH STACK', ph: 'AWS, React, Kubernetes (comma separated)' },
              ].map(({ key, label, ph }) => (
                <div key={key} style={{ ...s.formField, gridColumn: '1/-1' }}>
                  <label style={s.formLabel}>{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={ph}
                    style={s.formInput}
                    data-hover="true"
                  />
                </div>
              ))}

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <label style={s.formLabel}>FIT SCORE: {form.fit_score}/100</label>
                <input
                  type="range" min="0" max="100"
                  value={form.fit_score}
                  onChange={(e) => setForm({ ...form, fit_score: e.target.value })}
                  style={{ flex: 1, accentColor: 'var(--white)' }}
                />
              </div>

              <div style={s.formField}>
                <label style={s.formLabel}>NOTES</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Why is this an ideal customer? What makes them a good fit?"
                  style={{ ...s.formInput, resize: 'vertical', minHeight: '80px' }}
                  rows={3}
                />
              </div>

              <button type="submit" style={s.submitBtn} disabled={saving} data-hover="true">
                <span>{saving ? 'Creating...' : 'Create ICP Profile'}</span>
                <span>→</span>
              </button>
            </form>
          </div>
        )}

        {/* Profiles list */}
        {loading ? (
          <p style={s.empty}>Loading profiles...</p>
        ) : profiles.length === 0 ? (
          <div style={s.emptyState}>
            <p style={s.emptyTitle}>No ICP profiles yet</p>
            <p style={s.emptyText}>Create your first profile to define your ideal customer and track fit scores.</p>
          </div>
        ) : (
          <div style={s.profilesGrid}>
            {profiles.map((profile) => (
              <ICPCard
                key={profile.id}
                profile={profile}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: 'var(--black)' },
  hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '48px 32px 32px', borderBottom: '1px solid var(--gray-2)' },
  eyebrow: { fontSize: '11px', fontWeight: '600', letterSpacing: '4px', color: 'var(--gray-4)', marginBottom: '12px' },
  heroTitle: { fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: '900', letterSpacing: '-2px', color: 'var(--white)', lineHeight: 1 },
  heroUnit: { fontSize: 'clamp(20px, 2.5vw, 32px)', fontWeight: '300', color: 'var(--gray-4)', letterSpacing: '-1px' },
  newBtn: { padding: '12px 24px', background: 'var(--white)', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '700', color: 'var(--black)', cursor: 'none' },
  container: { padding: '32px' },
  formCard: { background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', padding: '28px', marginBottom: '32px' },
  formTitle: { fontSize: '10px', fontWeight: '700', letterSpacing: '3px', color: 'var(--gray-4)', marginBottom: '24px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  formField: { display: 'flex', flexDirection: 'column', gap: '8px' },
  formLabel: { fontSize: '9px', fontWeight: '700', letterSpacing: '2px', color: 'var(--gray-4)', textTransform: 'uppercase' },
  formInput: { padding: '11px 14px', background: 'var(--black)', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '13px', color: 'var(--white)', outline: 'none', fontFamily: 'inherit' },
  submitBtn: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'var(--white)', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '700', color: 'var(--black)', cursor: 'none', marginTop: '8px' },
  profilesGrid: { display: 'flex', flexDirection: 'column', gap: '24px' },
  empty: { padding: '40px 0', fontSize: '13px', color: 'var(--gray-4)' },
  emptyState: { padding: '80px 0', textAlign: 'center' },
  emptyTitle: { fontSize: '18px', fontWeight: '700', color: 'var(--gray-3)', marginBottom: '8px', letterSpacing: '-0.5px' },
  emptyText: { fontSize: '13px', color: 'var(--gray-4)', lineHeight: 1.6 },
}

const card = {
  wrapper: { background: 'var(--gray-1)', border: '1px solid var(--gray-2)', borderRadius: '4px', overflow: 'hidden' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 28px', borderBottom: '1px solid var(--gray-2)' },
  eyebrow: { fontSize: '9px', fontWeight: '700', letterSpacing: '3px', color: 'var(--gray-4)', marginBottom: '8px' },
  name: { fontSize: '24px', fontWeight: '900', letterSpacing: '-1px', color: 'var(--white)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0', borderBottom: '1px solid var(--gray-2)' },
  gridItem: { padding: '16px 28px', borderRight: '1px solid var(--gray-2)' },
  gridLabel: { fontSize: '9px', fontWeight: '700', letterSpacing: '2px', color: 'var(--gray-4)', marginBottom: '6px' },
  gridValue: { fontSize: '13px', color: 'var(--white)', fontWeight: '500' },
  link: { fontSize: '13px', color: 'var(--white)', borderBottom: '1px solid var(--gray-3)' },
  section: { padding: '20px 28px', borderBottom: '1px solid var(--gray-2)' },
  sectionLabel: { fontSize: '9px', fontWeight: '700', letterSpacing: '2px', color: 'var(--gray-4)', marginBottom: '12px' },
  deleteBtn: { background: 'none', border: 'none', color: 'var(--gray-4)', fontSize: '14px', cursor: 'pointer', fontWeight: '700', padding: '4px' },
  editBtn: { background: 'none', border: '1px solid var(--gray-3)', borderRadius: '3px', color: 'var(--gray-4)', fontSize: '9px', fontWeight: '700', letterSpacing: '2px', cursor: 'pointer', padding: '4px 12px', fontFamily: 'inherit' },
  scoreInput: { width: '80px', padding: '6px 10px', background: 'var(--black)', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '13px', color: 'var(--white)', outline: 'none', fontFamily: 'inherit' },
  textarea: { width: '100%', padding: '10px 14px', background: 'var(--black)', border: '1px solid var(--gray-2)', borderRadius: '4px', fontSize: '13px', color: 'var(--white)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6 },
}