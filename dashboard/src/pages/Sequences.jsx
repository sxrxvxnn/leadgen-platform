import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const STEP_TYPES = [
  { id: 'email',    label: 'Email',    icon: '✉' },
  { id: 'wait',     label: 'Wait',     icon: '⏱' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'in' },
  { id: 'call',     label: 'Call',     icon: '📞' },
]

const STATUS_COLOR = { draft: '#888', active: '#4a7c59', paused: '#b07d2e' }
const STATUS_BG    = { draft: '#88888818', active: '#4a7c5918', paused: '#b07d2e18' }

function StepCard({ step, index, onChange, onRemove }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{index + 1}</div>
        {index < 99 && <div style={{ width: 1, height: 24, background: 'var(--border)' }} />}
      </div>
      <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {STEP_TYPES.map(t => (
            <button key={t.id} onClick={() => onChange({ ...step, type: t.id })}
              style={{ padding: '5px 12px', borderRadius: 6, border: step.type === t.id ? '1.5px solid #E7000B' : '1px solid var(--border)', background: step.type === t.id ? '#E7000B18' : 'transparent', color: step.type === t.id ? '#E7000B' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {t.icon} {t.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={onRemove} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Remove</button>
        </div>

        {step.type === 'wait' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Wait</span>
            <input type="number" min={1} max={30} value={step.delay_days}
              onChange={e => onChange({ ...step, delay_days: parseInt(e.target.value) || 1 })}
              style={{ width: 60, padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>days before next step</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {step.type === 'email' && (
              <input type="text" placeholder="Subject line…" value={step.subject || ''}
                onChange={e => onChange({ ...step, subject: e.target.value })}
                style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
            )}
            <textarea rows={step.type === 'email' ? 5 : 3}
              placeholder={step.type === 'email' ? 'Email body… Use {{name}}, {{company}}, {{title}} for personalization.' : step.type === 'linkedin' ? 'LinkedIn message…' : 'Call notes or script…'}
              value={step.body || ''}
              onChange={e => onChange({ ...step, body: e.target.value })}
              style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
            {step.type !== 'wait' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>Send after</span>
                <input type="number" min={0} max={30} value={step.delay_days}
                  onChange={e => onChange({ ...step, delay_days: parseInt(e.target.value) || 0 })}
                  style={{ width: 50, padding: '4px 8px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', outline: 'none' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>days</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SequenceCard({ seq, onEdit, onDelete, onToggle }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{seq.name}</span>
            <span style={{ padding: '2px 8px', borderRadius: 20, background: STATUS_BG[seq.status], color: STATUS_COLOR[seq.status], fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{seq.status}</span>
          </div>
          {seq.description && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{seq.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => onToggle(seq)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>
            {seq.status === 'active' ? 'Pause' : 'Activate'}
          </button>
          <button onClick={() => onEdit(seq)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Edit</button>
          <button onClick={() => onDelete(seq.id)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: '#e07070', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>Delete</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {(seq.steps || []).map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ padding: '3px 10px', borderRadius: 20, background: 'var(--bg)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              {STEP_TYPES.find(t => t.id === step.type)?.icon} {step.type === 'wait' ? `Wait ${step.delay_days}d` : step.type}
            </span>
            {i < seq.steps.length - 1 && <span style={{ color: 'var(--border)', fontSize: 10 }}>→</span>}
          </div>
        ))}
        {(!seq.steps || seq.steps.length === 0) && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>No steps yet</span>}
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {[
          { label: 'Steps', value: seq.steps?.length || 0 },
          { label: 'Enrolled', value: seq.enrolled_count || 0 },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{m.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const BLANK_STEP = { type: 'email', delay_days: 0, subject: '', body: '' }

export default function Sequences() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [sequences, setSequences] = useState([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', steps: [{ ...BLANK_STEP }] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [token])

  async function load() {
    try {
      setLoading(true)
      const res = await api.get('/sequences')
      setSequences(res.data.sequences || [])
    } catch {
      setError('Failed to load sequences')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', description: '', steps: [{ ...BLANK_STEP }] })
    setShowBuilder(true)
  }

  function openEdit(seq) {
    setEditing(seq)
    setForm({ name: seq.name, description: seq.description || '', steps: seq.steps?.length ? seq.steps : [{ ...BLANK_STEP }] })
    setShowBuilder(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await api.patch(`/sequences/${editing.id}`, form)
      } else {
        await api.post('/sequences', form)
      }
      setShowBuilder(false)
      await load()
    } catch {
      setError('Failed to save sequence')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this sequence?')) return
    await api.delete(`/sequences/${id}`)
    await load()
  }

  async function handleToggle(seq) {
    const next = seq.status === 'active' ? 'paused' : 'active'
    await api.patch(`/sequences/${seq.id}`, { status: next })
    await load()
  }

  function updateStep(i, val) {
    const steps = [...form.steps]
    steps[i] = val
    setForm(f => ({ ...f, steps }))
  }

  function removeStep(i) {
    setForm(f => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }))
  }

  function addStep() {
    setForm(f => ({ ...f, steps: [...f.steps, { ...BLANK_STEP }] }))
  }

  const s = {
    page: { minHeight: '100vh', background: 'var(--bg)', paddingTop: 64 },
    inner: { maxWidth: 900, margin: '0 auto', padding: '40px 24px' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
    title: { fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 },
    subtitle: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 },
    btn: { padding: '10px 20px', background: '#E7000B', border: 'none', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' },
    input: { width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' },
    label: { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 },
  }

  if (showBuilder) {
    return (
      <div style={s.page}>
        <Navbar />
        <div style={{ ...s.inner, maxWidth: 700 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
            <button onClick={() => setShowBuilder(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', padding: 0 }}>← Back</button>
            <h1 style={{ ...s.title, margin: 0 }}>{editing ? 'Edit Sequence' : 'New Sequence'}</h1>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 2 }}>
                <label style={s.label}>Sequence name</label>
                <input style={s.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cold Outreach — Series B SaaS" required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={s.label}>Description (optional)</label>
                <input style={s.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Target audience, goal…" />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <label style={{ ...s.label, margin: 0 }}>Steps ({form.steps.length})</label>
                <button type="button" onClick={addStep} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', cursor: 'pointer' }}>+ Add step</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.steps.map((step, i) => (
                  <StepCard key={i} step={step} index={i} onChange={v => updateStep(i, v)} onRemove={() => removeStep(i)} />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" disabled={saving} style={{ ...s.btn, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save sequence'}</button>
              <button type="button" onClick={() => setShowBuilder(false)} style={{ ...s.btn, background: 'var(--surface)', color: 'var(--text)' }}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <Navbar />
      <div style={s.inner}>
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Sequences</h1>
            <p style={s.subtitle}>Multi-step outreach campaigns — email, LinkedIn, calls</p>
          </div>
          <button style={s.btn} onClick={openNew}>+ New sequence</button>
        </div>

        {error && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#e07070', marginBottom: 16 }}>{error}</p>}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2].map(i => <div key={i} style={{ height: 140, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', opacity: 0.5 }} />)}
          </div>
        ) : sequences.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉</div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>No sequences yet. Create your first outreach campaign.</p>
            <button style={s.btn} onClick={openNew}>Create sequence</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sequences.map(seq => (
              <SequenceCard key={seq.id} seq={seq} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
