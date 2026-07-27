import { useState, useEffect } from 'react'
import { getLeadTasks, createTask, updateTask, deleteTask } from '../services/api'

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)"
const SANS = "var(--font-sans, 'Host Grotesk', sans-serif)"

const PRIORITY_CFG = {
  high: { color: '#E7000B', bg: 'rgba(231,0,11,0.08)', border: 'rgba(231,0,11,0.25)' },
  medium: { color: '#a86448', bg: 'rgba(168,100,72,0.08)', border: 'rgba(168,100,72,0.25)' },
  low: { color: '#7a8a5b', bg: 'rgba(122,138,91,0.08)', border: 'rgba(122,138,91,0.25)' },
}

function dueBadge(due_date) {
  if (!due_date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(due_date + 'T00:00:00')
  const diff = Math.round((due - today) / 86400000)
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: '#E7000B' }
  if (diff === 0) return { label: 'Due today', color: '#a86448' }
  if (diff === 1) return { label: 'Due tomorrow', color: '#a86448' }
  return {
    label: `Due ${due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    color: 'var(--text-muted)',
  }
}

export default function TaskList({ leadId }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!leadId) return
    getLeadTasks(leadId)
      .then((r) => setTasks(r.data.tasks || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [leadId])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const r = await createTask(leadId, {
        title: newTitle.trim(),
        due_date: newDue || null,
        priority: newPriority,
      })
      setTasks((prev) => [...prev, r.data.task])
      setNewTitle('')
      setNewDue('')
      setNewPriority('medium')
      setAdding(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(task) {
    const updated = { completed: !task.completed }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t)))
    try {
      await updateTask(task.id, updated)
    } catch (e) {
      console.error(e)
    }
  }

  async function handleDelete(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try {
      await deleteTask(id)
    } catch (e) {
      console.error(e)
    }
  }

  const open = tasks.filter((t) => !t.completed)
  const done = tasks.filter((t) => t.completed)

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <p
          style={{
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Tasks {open.length > 0 && <span style={{ color: '#a86448' }}>· {open.length}</span>}
        </p>
        <button
          onClick={() => setAdding((a) => !a)}
          style={{
            fontFamily: MONO,
            fontSize: 9,
            fontWeight: 600,
            padding: '2px 8px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 3,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <form
          onSubmit={handleAdd}
          style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title…"
            style={{
              fontFamily: SANS,
              fontSize: 13,
              padding: '7px 10px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              style={{
                fontFamily: MONO,
                fontSize: 11,
                padding: '5px 8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: 'var(--text)',
                outline: 'none',
                flex: 1,
              }}
            />
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              style={{
                fontFamily: MONO,
                fontSize: 11,
                padding: '5px 8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: 'var(--text)',
                outline: 'none',
              }}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              type="submit"
              disabled={saving || !newTitle.trim()}
              style={{
                fontFamily: MONO,
                fontSize: 10,
                fontWeight: 600,
                padding: '5px 12px',
                background: 'var(--text)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: 5,
                cursor: saving ? 'default' : 'pointer',
              }}
            >
              {saving ? '…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {/* Open tasks */}
      {loading && (
        <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)' }}>Loading…</p>
      )}
      {!loading && open.length === 0 && !adding && (
        <p
          style={{
            fontFamily: MONO,
            fontSize: 10,
            color: 'var(--text-muted)',
            fontStyle: 'italic',
            margin: '4px 0',
          }}
        >
          No open tasks
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {open.map((task) => (
          <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
        ))}
      </div>

      {/* Completed */}
      {done.length > 0 && (
        <div style={{ marginTop: 12, opacity: 0.5 }}>
          <p
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 600,
              color: 'var(--text-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: '0 0 6px',
            }}
          >
            Completed ({done.length})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {done.slice(0, 3).map((task) => (
              <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, onToggle, onDelete }) {
  const pcfg = PRIORITY_CFG[task.priority] || PRIORITY_CFG.medium
  const due = dueBadge(task.due_date)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task)}
        style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          border: `1.5px solid ${task.completed ? pcfg.color : 'var(--border-strong)'}`,
          background: task.completed ? pcfg.color : 'transparent',
          cursor: 'pointer',
          flexShrink: 0,
          marginTop: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {task.completed && (
          <span style={{ color: 'var(--bg)', fontSize: 9, fontWeight: 700 }}>✓</span>
        )}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 12,
            color: task.completed ? 'var(--text-muted)' : 'var(--text)',
            margin: 0,
            textDecoration: task.completed ? 'line-through' : 'none',
            lineHeight: 1.4,
          }}
        >
          {task.title}
        </p>
        <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 8,
              fontWeight: 600,
              padding: '1px 5px',
              background: pcfg.bg,
              border: `1px solid ${pcfg.border}`,
              borderRadius: 3,
              color: pcfg.color,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {task.priority}
          </span>
          {due && (
            <span
              style={{ fontFamily: MONO, fontSize: 8, color: due.color, letterSpacing: '0.04em' }}
            >
              {due.label}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(task.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 12,
          padding: '0 2px',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
