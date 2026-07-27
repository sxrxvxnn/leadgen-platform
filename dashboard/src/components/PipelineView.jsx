import { updateLead } from '../services/api'

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)"
const SANS = "var(--font-sans, 'Host Grotesk', sans-serif)"
const DISPLAY = "var(--font-display, 'Barlow Condensed', sans-serif)"

const STAGES = [
  {
    key: 'new',
    label: 'New',
    color: '#4a7c59',
    bg: 'rgba(74,124,89,0.08)',
    border: 'rgba(74,124,89,0.22)',
  },
  {
    key: 'contacted',
    label: 'Contacted',
    color: '#a86448',
    bg: 'rgba(168,100,72,0.08)',
    border: 'rgba(168,100,72,0.22)',
  },
  {
    key: 'qualified',
    label: 'Qualified',
    color: '#5b8db8',
    bg: 'rgba(91,141,184,0.08)',
    border: 'rgba(91,141,184,0.22)',
  },
  {
    key: 'disqualified',
    label: 'Disqualified',
    color: '#a1a1a1',
    bg: 'rgba(161,161,161,0.06)',
    border: 'rgba(161,161,161,0.22)',
  },
]

const DECISION_MAKER_RE =
  /\b(ceo|cto|ciso|coo|cfo|founder|co-founder|president|vice president|vp|director|head of|chief|managing director|md|owner|general manager|svp|evp)\b/i
const SECURITY_RE =
  /\b(ciso|cybersecurity|infosec|security analyst|security engineer|security architect|soc analyst|devsecops)\b/i

function scoreColor(s) {
  if (s == null) return 'var(--text-muted)'
  if (s >= 70) return '#4a7c59'
  if (s >= 40) return '#a86448'
  return '#a1a1a1'
}

function LeadCard({ lead, onClick, onStageChange }) {
  const isDM = DECISION_MAKER_RE.test(lead.title || '')
  const isSec = SECURITY_RE.test(lead.title || '')

  return (
    <div
      onClick={() => onClick(lead)}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderLeft: lead.starred ? '3px solid var(--accent)' : '1px solid var(--border)',
        borderRadius: 6,
        padding: '12px 14px',
        cursor: 'pointer',
        marginBottom: 8,
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'
        e.currentTarget.style.borderColor = 'var(--border-strong)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = lead.starred ? 'var(--accent)' : 'var(--border)'
      }}
    >
      {/* Tags row */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
        {isDM && (
          <span
            style={{
              fontFamily: MONO,
              fontSize: 7,
              fontWeight: 700,
              padding: '1px 5px',
              background: 'rgba(91,141,184,0.10)',
              color: '#5b8db8',
              border: '1px solid rgba(91,141,184,0.3)',
              borderRadius: 3,
              letterSpacing: '0.08em',
            }}
          >
            DM
          </span>
        )}
        {isSec && (
          <span
            style={{
              fontFamily: MONO,
              fontSize: 7,
              fontWeight: 700,
              padding: '1px 5px',
              background: 'rgba(231,0,11,0.07)',
              color: '#E7000B',
              border: '1px solid rgba(231,0,11,0.22)',
              borderRadius: 3,
              letterSpacing: '0.08em',
            }}
          >
            SEC
          </span>
        )}
        {lead.icp_score != null && (
          <span
            style={{
              fontFamily: MONO,
              fontSize: 7,
              fontWeight: 700,
              padding: '1px 5px',
              background: 'transparent',
              color: scoreColor(lead.icp_score),
              border: `1px solid ${scoreColor(lead.icp_score)}40`,
              borderRadius: 3,
              letterSpacing: '0.06em',
            }}
          >
            {lead.icp_score}
          </span>
        )}
      </div>

      {/* Name */}
      <p
        style={{
          fontFamily: SANS,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text)',
          margin: '0 0 2px',
        }}
      >
        {lead.name || '—'}
      </p>
      <p
        style={{
          fontFamily: SANS,
          fontSize: 11,
          color: 'var(--text-secondary)',
          margin: '0 0 6px',
          lineHeight: 1.3,
        }}
      >
        {lead.title || '—'}
      </p>
      {lead.company && (
        <p
          style={{ fontFamily: MONO, fontSize: 10, color: 'var(--text-muted)', margin: '0 0 8px' }}
        >
          {lead.company}
        </p>
      )}

      {/* Footer: email badge + move arrows */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {lead.email ? (
            <span
              style={{
                fontFamily: MONO,
                fontSize: 8,
                padding: '2px 5px',
                background: 'rgba(74,124,89,0.08)',
                color: '#4a7c59',
                border: '1px solid rgba(74,124,89,0.25)',
                borderRadius: 3,
              }}
            >
              Email
            </span>
          ) : (
            <span
              style={{
                fontFamily: MONO,
                fontSize: 8,
                padding: '2px 5px',
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                borderRadius: 3,
              }}
            >
              No email
            </span>
          )}
          {lead.connection_status && lead.connection_status !== 'Not Requested' && (
            <span
              style={{
                fontFamily: MONO,
                fontSize: 8,
                padding: '2px 5px',
                background: 'rgba(91,141,184,0.08)',
                color: '#5b8db8',
                border: '1px solid rgba(91,141,184,0.22)',
                borderRadius: 3,
                maxWidth: 80,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {lead.connection_status}
            </span>
          )}
        </div>
        {/* Quick move buttons */}
        <div style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
          {STAGES.filter((s) => s.key !== lead.status)
            .slice(0, 2)
            .map((s) => (
              <button
                key={s.key}
                onClick={() => onStageChange(lead.id, s.key)}
                title={`Move to ${s.label}`}
                style={{
                  fontFamily: MONO,
                  fontSize: 8,
                  fontWeight: 600,
                  padding: '2px 5px',
                  background: 'transparent',
                  border: `1px solid ${s.border}`,
                  borderRadius: 3,
                  color: s.color,
                  cursor: 'pointer',
                }}
              >
                {s.label.slice(0, 4)}
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}

export default function PipelineView({ leads, onLeadClick, onLeadsUpdate }) {
  async function handleStageChange(leadId, status) {
    onLeadsUpdate((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)))
    try {
      await updateLead(leadId, { status })
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        overflowX: 'auto',
        minHeight: 'calc(100vh - 300px)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {STAGES.map((stage, si) => {
        const stageLeads = leads.filter((l) => (l.status || 'new') === stage.key)
        return (
          <div
            key={stage.key}
            style={{
              flex: '1 0 240px',
              minWidth: 240,
              maxWidth: 320,
              borderRight: si < STAGES.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Column header */}
            <div
              style={{
                padding: '14px 16px 12px',
                borderBottom: '1px solid var(--border)',
                background: stage.bg,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: stage.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    color: stage.color,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  {stage.label}
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    marginLeft: 'auto',
                  }}
                >
                  {stageLeads.length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
              {stageLeads.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 32 }}>
                  <p
                    style={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.08em',
                    }}
                  >
                    No leads
                  </p>
                </div>
              ) : (
                stageLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={onLeadClick}
                    onStageChange={handleStageChange}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
