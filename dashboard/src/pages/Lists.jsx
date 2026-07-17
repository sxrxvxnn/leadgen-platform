import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'https://leadgenengineplatform-api.vercel.app'
const SANS = "var(--font-sans,'Host Grotesk',sans-serif)"
const MONO = "var(--font-mono,'IBM Plex Mono',monospace)"

function ListCard({ list, onOpen, onDelete }) {
  const [hov, setHov] = useState(false)
  const typeColor = list.type === 'people' ? 'var(--blue)' : 'var(--accent)'
  const typeBg = list.type === 'people' ? 'var(--blue-dim)' : 'var(--accent-dim)'

  return (
    <div
      onClick={() => onOpen(list)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'var(--surface-raised)' : 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
        borderColor: hov ? 'var(--border-strong)' : 'var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: typeBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {list.type === 'people' ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={typeColor}
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={typeColor}
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <path d="M9 22V12h6v10" />
              </svg>
            )}
          </div>
          <div>
            <p
              style={{
                fontFamily: SANS,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text)',
                margin: 0,
              }}
            >
              {list.name}
            </p>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                color: typeColor,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {list.type || 'companies'}
            </span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(list.id)
          }}
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: hov ? 1 : 0,
            transition: 'opacity 0.15s',
          }}
          title="Delete list"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <p
            style={{
              fontFamily: MONO,
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            {(list.count || 0).toLocaleString()}
          </p>
          <p style={{ fontFamily: SANS, fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
            {list.type === 'people' ? 'contacts' : 'companies'}
          </p>
        </div>
        {list.updated_at && (
          <div style={{ marginLeft: 'auto' }}>
            <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>
              {new Date(list.updated_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        )}
      </div>
      {list.description && (
        <p
          style={{
            fontFamily: SANS,
            fontSize: 12,
            color: 'var(--text-muted)',
            margin: '10px 0 0',
            lineHeight: 1.5,
          }}
        >
          {list.description}
        </p>
      )}
    </div>
  )
}

function CreateListModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('companies')
  const [desc, setDesc] = useState('')

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          width: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <h2
          style={{
            fontFamily: SANS,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text)',
            margin: '0 0 18px',
          }}
        >
          Create new list
        </h2>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              fontFamily: SANS,
              fontSize: 12,
              color: 'var(--text-muted)',
              display: 'block',
              marginBottom: 6,
            }}
          >
            List name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kerala SaaS Q3"
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              fontFamily: SANS,
              fontSize: 13,
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              fontFamily: SANS,
              fontSize: 12,
              color: 'var(--text-muted)',
              display: 'block',
              marginBottom: 6,
            }}
          >
            Type
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['companies', 'people'].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: `1px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`,
                  background: type === t ? 'var(--accent-dimmer)' : 'transparent',
                  color: type === t ? 'var(--accent-light)' : 'var(--text-secondary)',
                  fontFamily: SANS,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              fontFamily: SANS,
              fontSize: 12,
              color: 'var(--text-muted)',
              display: 'block',
              marginBottom: 6,
            }}
          >
            Description (optional)
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What's this list for?"
            rows={2}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              fontFamily: SANS,
              fontSize: 13,
              outline: 'none',
              resize: 'vertical',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontFamily: SANS,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => name.trim() && onCreate({ name: name.trim(), type, description: desc })}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: 'none',
              background: name.trim() ? 'var(--accent)' : 'var(--surface-raised)',
              color: name.trim() ? '#fff' : 'var(--text-muted)',
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: 500,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Create List
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Lists() {
  const { session } = useAuth()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [activeList, setActiveList] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!session?.access_token) return
    fetchLists()
  }, [session])

  async function fetchLists() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/lists`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setLists(data.lists || data || [])
    } catch (_) {
      setLists([])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(payload) {
    try {
      const res = await fetch(`${API}/api/lists`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      setLists((prev) => [data, ...prev])
      setShowCreate(false)
    } catch (_) {}
  }

  async function handleDelete(id) {
    if (!confirm('Delete this list?')) return
    try {
      await fetch(`${API}/api/lists/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      setLists((prev) => prev.filter((l) => l.id !== id))
    } catch (_) {}
  }

  const filtered = lists.filter(
    (l) => !search || l.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div
      style={{
        padding: '0',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: SANS,
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Lists
          </h1>
          <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>
            {lists.length} list{lists.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lists..."
            style={{
              paddingLeft: 30,
              paddingRight: 12,
              height: 32,
              width: 200,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              fontFamily: SANS,
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '7px 14px',
            borderRadius: 6,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontFamily: SANS,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New List
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div
              style={{
                width: 20,
                height: 20,
                border: '2px solid var(--accent-dim)',
                borderTop: '2px solid var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 80,
              gap: 14,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: 'var(--accent-dimmer)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-light)"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: 15,
                  fontWeight: 500,
                  color: 'var(--text)',
                  margin: '0 0 6px',
                }}
              >
                No lists yet
              </p>
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  margin: '0 0 20px',
                }}
              >
                Save companies and people into lists to organize your prospecting
              </p>
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Create your first list
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            {filtered.map((list) => (
              <ListCard key={list.id} list={list} onOpen={setActiveList} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateListModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}

      {activeList && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={() => setActiveList(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 28,
              width: 480,
              maxHeight: '70vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  fontFamily: SANS,
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                {activeList.name}
              </h2>
              <button
                onClick={() => setActiveList(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: 20,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            <p
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: 'var(--text-muted)',
                margin: '0 0 12px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {(activeList.count || 0).toLocaleString()}{' '}
              {activeList.type === 'people' ? 'contacts' : 'companies'}
            </p>
            {activeList.description && (
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  margin: '0 0 16px',
                  lineHeight: 1.6,
                }}
              >
                {activeList.description}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontFamily: SANS,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Add to Sequence
              </button>
              <button
                onClick={() => setActiveList(null)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontFamily: SANS,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
