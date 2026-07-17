import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const API = import.meta.env.VITE_API_URL || 'https://leadgenengineplatform-api.vercel.app'
const SANS = "var(--font-sans,'Host Grotesk',sans-serif)"
const MONO = "var(--font-mono,'IBM Plex Mono',monospace)"

const SENIORITY_OPTIONS = [
  'C-Level',
  'VP',
  'Director',
  'Manager',
  'Senior',
  'Mid',
  'Junior',
  'Intern',
]
const DEPT_OPTIONS = [
  'Engineering',
  'Product',
  'Sales',
  'Marketing',
  'Finance',
  'HR',
  'Legal',
  'Operations',
  'Design',
  'Data',
  'Security',
  'Customer Success',
]

function Avatar({ name, size = 28 }) {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const colors = ['#5c4ee5', '#4553c8', '#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706']
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length]
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        fontWeight: 700,
        color: '#fff',
        fontFamily: SANS,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

function FilterSection({ title, options, selected, onToggle }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 4 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '10px 14px 6px',
          color: 'var(--text-soft)',
          fontFamily: SANS,
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        <span>{title}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: '0 10px' }}>
          {options.map((opt) => (
            <label
              key={opt}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 4px',
                cursor: 'pointer',
                fontFamily: SANS,
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggle(opt)}
                style={{ accentColor: 'var(--accent)', width: 13, height: 13 }}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function ContactRow({ contact, checked, onCheck }) {
  const [hov, setHov] = useState(false)
  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: checked
          ? 'rgba(92,78,229,0.10)'
          : hov
            ? 'var(--surface-raised)'
            : 'transparent',
        transition: 'background 0.1s',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <td style={{ padding: '10px 12px', width: 36 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          style={{ accentColor: 'var(--accent)', width: 13, height: 13 }}
        />
      </td>
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name={contact.name} size={30} />
          <div>
            <p
              style={{
                fontFamily: SANS,
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text)',
                margin: 0,
                whiteSpace: 'nowrap',
              }}
            >
              {contact.name}
            </p>
            {contact.linkedin_url && (
              <a
                href={contact.linkedin_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  color: 'var(--accent-light)',
                  textDecoration: 'none',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                LinkedIn →
              </a>
            )}
          </div>
        </div>
      </td>
      <td style={{ padding: '10px 12px' }}>
        <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          {contact.title || '—'}
        </p>
      </td>
      <td style={{ padding: '10px 12px' }}>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 12,
            color: 'var(--text-secondary)',
            margin: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {contact.company_name || '—'}
        </p>
      </td>
      <td style={{ padding: '10px 12px' }}>
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            style={{
              fontFamily: MONO,
              fontSize: 11,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {contact.email}
          </a>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td style={{ padding: '10px 12px' }}>
        {contact.phone ? (
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-secondary)' }}>
            {contact.phone}
          </span>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td style={{ padding: '10px 12px' }}>
        {contact.seniority ? (
          <span className="badge badge-purple">{contact.seniority}</span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
        )}
      </td>
      <td style={{ padding: '10px 16px' }}>
        {hov && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              title="Add to sequence"
              style={{
                padding: '4px 10px',
                borderRadius: 5,
                border: '1px solid var(--border)',
                background: 'var(--surface-raised)',
                color: 'var(--text-secondary)',
                fontFamily: SANS,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              + Sequence
            </button>
            {contact.email && (
              <button
                title="Send email"
                style={{
                  padding: '4px 10px',
                  borderRadius: 5,
                  border: '1px solid var(--accent-dim)',
                  background: 'var(--accent-dimmer)',
                  color: 'var(--accent-light)',
                  fontFamily: SANS,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Email
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}

export default function People() {
  const { session } = useAuth()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [depts, setDepts] = useState([])
  const [seniorities, setSeniorities] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const PER_PAGE = 50

  useEffect(() => {
    if (!session?.access_token) return
    fetchContacts()
  }, [session, page, search, depts, seniorities])

  async function fetchContacts() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, per_page: PER_PAGE })
      if (search) params.set('q', search)
      if (depts.length) params.set('departments', depts.join(','))
      if (seniorities.length) params.set('seniority', seniorities.join(','))
      const res = await fetch(`${API}/api/people?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setContacts(data.contacts || data.data || [])
      setTotal(data.total || 0)
    } catch (_) {
      setContacts([])
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allChecked = contacts.length > 0 && contacts.every((c) => selected.has(c.id))
  const toggleAll = () => {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(contacts.map((c) => c.id)))
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Filter panel */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
          <p
            style={{
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Filters
          </p>
        </div>
        <FilterSection
          title="Seniority"
          options={SENIORITY_OPTIONS}
          selected={seniorities}
          onToggle={(opt) =>
            setSeniorities((prev) =>
              prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
            )
          }
        />
        <FilterSection
          title="Department"
          options={DEPT_OPTIONS}
          selected={depts}
          onToggle={(opt) =>
            setDepts((prev) =>
              prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
            )
          }
        />
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
            background: 'var(--bg)',
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
              People
            </h1>
            <p style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>
              {total.toLocaleString()} contacts
            </p>
          </div>
          <div style={{ flex: 1 }} />
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg
              width="14"
              height="14"
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
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search people..."
              style={{
                paddingLeft: 32,
                paddingRight: 12,
                height: 34,
                width: 240,
                background: 'var(--surface)',
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
          {selected.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-secondary)' }}>
                {selected.size} selected
              </span>
              <button
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontFamily: SANS,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                + Add to Sequence
              </button>
              <button
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-secondary)',
                  fontFamily: SANS,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                + Add to List
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: 200,
              }}
            >
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
          ) : contacts.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: 300,
                gap: 12,
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
              <p style={{ fontFamily: SANS, fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
                No people found
              </p>
              <p style={{ fontFamily: SANS, fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Enrich companies to discover contacts
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 180 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 200 }} />
                <col style={{ width: 130 }} />
                <col style={{ width: 100 }} />
                <col />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 2 }}>
                  <th
                    style={{
                      padding: '9px 12px',
                      borderBottom: '1px solid var(--border)',
                      textAlign: 'left',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      style={{ accentColor: 'var(--accent)', width: 13, height: 13 }}
                    />
                  </th>
                  {['Name', 'Title', 'Company', 'Email', 'Phone', 'Seniority', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '9px 12px',
                        borderBottom: '1px solid var(--border)',
                        textAlign: 'left',
                        fontFamily: SANS,
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    checked={selected.has(c.id)}
                    onCheck={() => toggleSelect(c.id)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '10px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)' }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 5,
                  border: '1px solid var(--border)',
                  background: page <= 1 ? 'transparent' : 'var(--surface)',
                  color: page <= 1 ? 'var(--text-muted)' : 'var(--text)',
                  fontFamily: SANS,
                  fontSize: 12,
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 5,
                  border: '1px solid var(--border)',
                  background: page >= totalPages ? 'transparent' : 'var(--surface)',
                  color: page >= totalPages ? 'var(--text-muted)' : 'var(--text)',
                  fontFamily: SANS,
                  fontSize: 12,
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
