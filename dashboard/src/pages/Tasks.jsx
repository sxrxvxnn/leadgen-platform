import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { getAllTasks, updateTask, deleteTask, createStandaloneTask } from '../services/api'

const MONO    = "var(--font-mono, 'IBM Plex Mono', monospace)"
const SANS    = "var(--font-sans, 'Host Grotesk', sans-serif)"
const DISPLAY = "var(--font-display, 'Barlow Condensed', sans-serif)"

const PRIORITY_CFG = {
  high:   { color: '#E7000B', bg: 'rgba(231,0,11,0.08)',   border: 'rgba(231,0,11,0.25)' },
  medium: { color: '#a86448', bg: 'rgba(168,100,72,0.08)', border: 'rgba(168,100,72,0.25)' },
  low:    { color: '#7a8a5b', bg: 'rgba(122,138,91,0.08)', border: 'rgba(122,138,91,0.25)' },
}

function getDueGroup(due_date) {
  if (!due_date) return 'no_date'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due   = new Date(due_date + 'T00:00:00')
  const diff  = Math.round((due - today) / 86400000)
  if (diff < 0)  return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 7)  return 'this_week'
  return 'upcoming'
}

const GROUP_META = {
  overdue:   { label: 'Overdue',    color: '#E7000B' },
  today:     { label: 'Due Today',  color: '#a86448' },
  this_week: { label: 'This Week',  color: 'var(--text)' },
  upcoming:  { label: 'Upcoming',   color: 'var(--text-muted)' },
  no_date:   { label: 'No Due Date',color: 'var(--text-muted)' },
}

const GROUP_ORDER = ['overdue', 'today', 'this_week', 'upcoming', 'no_date']

function formatDue(due_date) {
  if (!due_date) return null
  return new Date(due_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Tasks() {
  const navigate  = useNavigate()
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showDone, setShowDone] = useState(false)
  const [showForm,  setShowForm]  = useState(false)
  const [taskForm,  setTaskForm]  = useState({ title: '', due_date: '', priority: 'medium', notes: '' })
  const [creating,  setCreating]  = useState(false)

  useEffect(() => { load() }, [showDone])

  async function load() {
    setLoading(true)
    try {
      const r = await getAllTasks(showDone)
      setTasks(r.data.tasks || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleToggle(task) {
    const updated = { completed: !task.completed }
    setTasks(prev => prev.filter(t => t.id !== task.id))
    try { await updateTask(task.id, updated) } catch (e) { console.error(e) }
  }

  async function handleDelete(id) {
    setTasks(prev => prev.filter(t => t.id !== id))
    try { await deleteTask(id) } catch (e) { console.error(e) }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!taskForm.title.trim()) return
    setCreating(true)
    try {
      await createStandaloneTask({
        title:    taskForm.title.trim(),
        due_date: taskForm.due_date || null,
        priority: taskForm.priority,
        body:     taskForm.notes,
      })
      setShowForm(false)
      setTaskForm({ title: '', due_date: '', priority: 'medium', notes: '' })
      await load()
    } catch (e) { console.error(e) }
    finally { setCreating(false) }
  }

  // Group tasks
  const groups = GROUP_ORDER.reduce((acc, key) => {
    acc[key] = tasks.filter(t => getDueGroup(t.due_date) === key)
    return acc
  }, {})

  const total = tasks.length
  const overdue = groups.overdue?.length || 0

  return (
    <>
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ padding: '28px 36px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 4px' }}>Tasks</p>
          <h1 style={{ fontFamily: DISPLAY, fontSize: 28, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0, lineHeight: 1 }}>
            {showDone ? 'Completed' : 'Open Tasks'}
            {!showDone && overdue > 0 && (
              <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: '#E7000B', marginLeft: 12 }}>{overdue} overdue</span>
            )}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowDone(false)}
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', padding: '7px 14px', background: !showDone ? 'var(--text)' : 'var(--surface)', color: !showDone ? 'var(--bg)' : 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer' }}
          >
            Open
          </button>
          <button
            onClick={() => setShowDone(true)}
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', padding: '7px 14px', background: showDone ? 'var(--text)' : 'var(--surface)', color: showDone ? 'var(--bg)' : 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer' }}
          >
            Completed
          </button>
          <button
            onClick={() => setShowForm(true)}
            style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', padding: '7px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', marginLeft: 8 }}
          >
            + New Task
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 36px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ height: 52, background: 'var(--surface)', borderRadius: 6, opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ) : total === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 0' }}>
            <p style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 400, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {showDone ? 'No completed tasks' : 'No open tasks'}
            </p>
            <p style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              {showDone ? 'Complete some tasks and they\'ll appear here.' : 'Open a lead in the Leads page and add tasks from the drawer.'}
            </p>
            <button
              onClick={() => navigate('/leads')}
              style={{ marginTop: 16, fontFamily: MONO, fontSize: 11, fontWeight: 600, padding: '8px 18px', background: 'var(--text)', color: 'var(--bg)', border: 'none', borderRadius: 5, cursor: 'pointer' }}
            >
              Go to Leads →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {GROUP_ORDER.map(groupKey => {
              const group = groups[groupKey]
              if (!group || group.length === 0) return null
              const meta = GROUP_META[groupKey]
              return (
                <motion.div key={groupKey} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: meta.color, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
                      {meta.label}
                    </p>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1px 6px' }}>
                      {group.length}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {group.map(task => (
                      <TaskCard key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} navigate={navigate} />
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
    <NewTaskModal
      show={showForm}
      onClose={() => { setShowForm(false); setTaskForm({ title: '', due_date: '', priority: 'medium', notes: '' }) }}
      form={taskForm}
      onChange={(field, val) => setTaskForm(f => ({ ...f, [field]: val }))}
      onSubmit={handleCreate}
      creating={creating}
    />
    </>
  )
}

function NewTaskModal({ show, onClose, form, onChange, onSubmit, creating }) {
  if (!show) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(8,9,10,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
        padding: '28px 28px 24px', width: '100%', maxWidth: 440,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <p style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>New Task</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Title *</label>
            <input
              autoFocus
              value={form.title}
              onChange={e => onChange('title', e.target.value)}
              placeholder="e.g. Follow up with prospect"
              required
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: SANS, fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => onChange('due_date', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: MONO, fontSize: 11, color: 'var(--text)', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Priority</label>
              <select
                value={form.priority}
                onChange={e => onChange('priority', e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: MONO, fontSize: 11, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => onChange('notes', e.target.value)}
              placeholder="Optional notes..."
              rows={3}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, fontFamily: MONO, fontSize: 11, color: 'var(--text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="submit"
              disabled={creating || !form.title.trim()}
              style={{ flex: 1, padding: '10px', background: creating ? 'var(--border)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 5, fontFamily: MONO, fontSize: 11, fontWeight: 600, cursor: creating || !form.title.trim() ? 'default' : 'pointer', letterSpacing: '0.04em', opacity: !form.title.trim() ? 0.5 : 1 }}
            >
              {creating ? 'Creating…' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '10px 16px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 5, fontFamily: MONO, fontSize: 11, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TaskCard({ task, onToggle, onDelete, navigate }) {
  const pcfg = PRIORITY_CFG[task.priority] || PRIORITY_CFG.medium
  const lead = task.leads
  const due  = formatDue(task.due_date)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7,
      transition: 'border-color 0.12s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task)}
        style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
          border: `1.5px solid ${task.completed ? pcfg.color : 'var(--border-strong)'}`,
          background: task.completed ? pcfg.color : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {task.completed && <span style={{ color: 'var(--bg)', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
      </button>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: task.completed ? 'var(--text-muted)' : 'var(--text)', margin: 0, textDecoration: task.completed ? 'line-through' : 'none' }}>
          {task.title}
        </p>
        {lead && (
          <button
            onClick={() => navigate('/leads')}
            style={{ fontFamily: MONO, fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginTop: 3 }}
          >
            {lead.name}{lead.company ? ` · ${lead.company}` : ''}
          </button>
        )}
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {due && <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)' }}>{due}</span>}
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, padding: '2px 6px', background: pcfg.bg, border: `1px solid ${pcfg.border}`, borderRadius: 3, color: pcfg.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {task.priority}
        </span>
        <button
          onClick={() => onDelete(task.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
