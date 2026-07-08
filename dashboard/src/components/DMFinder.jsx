import React, { useState, useEffect, useRef } from 'react'
import { runDmScan, getJob } from '../services/api'

export default function DMFinder({ companies, onClose }) {
  const [queue, setQueue] = useState(
    companies.map((c) => {
      const slug = c.linkedin_url ? c.linkedin_url.split('/company/')[1]?.split('/')[0] : null
      return {
        id: c.id,
        name: c.name,
        status: 'pending',
        peopleUrl: slug ? 'https://www.linkedin.com/company/' + slug + '/people/' : null,
        hasLinkedIn: !!c.linkedin_url,
        // auto-scan state
        scanJobId: null,
        scanStatus: null, // null | 'queued' | 'running' | 'completed' | 'failed'
        scanLeads: null, // number of leads inserted
        scanError: null,
      }
    })
  )
  const [filter, setFilter] = useState('all')
  const pollTimers = useRef({})

  // Clear all polling timers on unmount
  useEffect(() => {
    return () => Object.values(pollTimers.current).forEach(clearInterval)
  }, [])

  function markOpened(id) {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status: 'opened' } : q)))
  }
  function markDone(id) {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status: 'done' } : q)))
  }

  function updateScan(id, patch) {
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  function startPolling(companyId, jobId) {
    if (pollTimers.current[companyId]) clearInterval(pollTimers.current[companyId])
    pollTimers.current[companyId] = setInterval(async () => {
      try {
        const r = await getJob(jobId)
        const job = r.data
        if (!job) return
        updateScan(companyId, { scanStatus: job.status, scanLeads: job.completed })
        if (job.status === 'completed' || job.status === 'failed') {
          clearInterval(pollTimers.current[companyId])
          delete pollTimers.current[companyId]
          if (job.status === 'completed') {
            updateScan(companyId, { status: 'done', scanError: null })
          } else {
            updateScan(companyId, {
              scanError: job.error_message ? job.error_message.slice(-120) : 'Scan failed',
            })
          }
        }
      } catch {}
    }, 6000)
  }

  async function handleAutoScan(item) {
    updateScan(item.id, { scanStatus: 'queued', scanJobId: null, scanLeads: null, scanError: null })
    try {
      const r = await runDmScan(item.id)
      const jobId = r.data?.job_id
      if (!jobId) throw new Error('No job_id returned')
      updateScan(item.id, { scanJobId: jobId, scanStatus: 'queued' })
      startPolling(item.id, jobId)
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to start scan'
      updateScan(item.id, { scanStatus: 'failed', scanError: msg })
    }
  }

  const pending = queue.filter((q) => q.status === 'pending').length
  const opened = queue.filter((q) => q.status === 'opened').length
  const done = queue.filter((q) => q.status === 'done').length
  const shown = filter === 'all' ? queue : queue.filter((q) => q.status === filter)
  const pct = queue.length ? Math.round((done / queue.length) * 100) : 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(29,27,27,0.5)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(29,27,27,0.14)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px dashed var(--border-dash)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '20px',
            }}
          >
            <div>
              <p style={s.eyebrow}>Batch DM Finder</p>
              <h2 style={s.title}>Find Decision Makers</h2>
              <p style={s.subtitle}>
                Auto Scan runs the Playwright pipeline on the worker · or open each page manually
                via the extension
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                padding: '5px 10px',
                letterSpacing: '0.04em',
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1px',
              background: '#c4c1bd',
              border: '1px solid #c4c1bd',
              borderRadius: '6px',
              overflow: 'hidden',
              marginBottom: '14px',
            }}
          >
            {[
              { label: 'Total', value: queue.length, color: 'var(--text)' },
              { label: 'Pending', value: pending, color: 'var(--text-muted)' },
              { label: 'Opened', value: opened, color: 'var(--accent)' },
              { label: 'Done', value: done, color: '#4a7c59' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{ background: 'var(--bg)', padding: '14px 16px', textAlign: 'center' }}
              >
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '28px',
                    fontWeight: '400',
                    letterSpacing: '-0.04em',
                    color,
                    lineHeight: 1,
                    marginBottom: '4px',
                  }}
                >
                  {value}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    fontWeight: '600',
                    letterSpacing: '0.12em',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div
            style={{
              height: '3px',
              background: 'var(--surface)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: pct + '%',
                background: '#4a7c59',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '12px 28px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {['all', 'pending', 'opened', 'done'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 12px',
                background: filter === f ? 'var(--text)' : 'transparent',
                border: `1px solid ${filter === f ? 'var(--text)' : 'var(--border)'}`,
                borderRadius: '5px',
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: filter === f ? '600' : '400',
                letterSpacing: '0.04em',
                color: filter === f ? '#FFFFFF' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Company list */}
        <div
          style={{
            overflowY: 'auto',
            flex: 1,
            padding: '12px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {shown.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '20px',
                  fontWeight: '400',
                  letterSpacing: '-0.03em',
                  color: 'var(--text-secondary)',
                }}
              >
                Nothing here.
              </p>
            </div>
          )}
          {shown.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '13px 16px',
                background: 'var(--surface)',
                border: `1px solid ${item.status === 'done' ? 'rgba(74,124,89,0.22)' : item.status === 'opened' ? 'rgba(168,100,72,0.22)' : 'var(--border)'}`,
                borderRadius: '6px',
                flexWrap: 'wrap',
              }}
            >
              {/* Status dot */}
              <div
                style={{
                  width: '22px',
                  textAlign: 'center',
                  flexShrink: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color:
                    item.status === 'done'
                      ? '#4a7c59'
                      : item.status === 'opened'
                        ? 'var(--accent)'
                        : 'rgba(196,193,189,0.6)',
                  paddingTop: '1px',
                }}
              >
                {item.status === 'done' ? '✓' : item.status === 'opened' ? '◉' : '○'}
              </div>

              {/* Name + URL */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '14px',
                    fontWeight: '400',
                    letterSpacing: '-0.02em',
                    color: 'var(--text)',
                    marginBottom: '2px',
                    lineHeight: 1.2,
                  }}
                >
                  {item.name}
                </p>
                {item.peopleUrl ? (
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {item.peopleUrl.replace('https://www.linkedin.com', '')}
                  </p>
                ) : (
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: 'var(--red)',
                    }}
                  >
                    No LinkedIn URL — add it on Companies page
                  </p>
                )}
                {/* Scan status line */}
                {item.scanStatus && (
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      marginTop: '5px',
                      color:
                        item.scanStatus === 'completed'
                          ? '#4a7c59'
                          : item.scanStatus === 'failed'
                            ? '#e07070'
                            : 'var(--accent)',
                    }}
                  >
                    {item.scanStatus === 'queued' && '⏳ Queued — waiting for worker…'}
                    {item.scanStatus === 'running' && '⚙ Scanning LinkedIn…'}
                    {item.scanStatus === 'completed' &&
                      `✓ Done — ${item.scanLeads ?? 0} lead${item.scanLeads === 1 ? '' : 's'} added`}
                    {item.scanStatus === 'failed' && `✗ ${item.scanError || 'Scan failed'}`}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                {/* Auto Scan button */}
                {item.hasLinkedIn &&
                  item.scanStatus !== 'queued' &&
                  item.scanStatus !== 'running' && (
                    <button
                      onClick={() => handleAutoScan(item)}
                      style={{
                        padding: '6px 12px',
                        background: 'rgba(231,0,11,0.08)',
                        border: '1px solid rgba(231,0,11,0.25)',
                        borderRadius: '6px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: '600',
                        letterSpacing: '0.04em',
                        color: '#E7000B',
                        cursor: 'pointer',
                      }}
                    >
                      ⚡ Auto Scan
                    </button>
                  )}
                {(item.scanStatus === 'queued' || item.scanStatus === 'running') && (
                  <span
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(168,100,72,0.06)',
                      border: '1px solid rgba(168,100,72,0.2)',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: 'var(--accent)',
                    }}
                  >
                    Scanning…
                  </span>
                )}

                {/* Manual buttons */}
                {item.status !== 'done' && item.peopleUrl && (
                  <a
                    href={item.peopleUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => markOpened(item.id)}
                    style={{
                      padding: '6px 14px',
                      background: item.status === 'opened' ? 'var(--accent)' : 'var(--text)',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      fontWeight: '600',
                      letterSpacing: '0.04em',
                      color: '#FFFFFF',
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}
                  >
                    {item.status === 'opened' ? 'Reopen →' : 'Open →'}
                  </a>
                )}
                {item.status === 'opened' && (
                  <button
                    onClick={() => markDone(item.id)}
                    style={{
                      padding: '6px 14px',
                      background: 'transparent',
                      border: '1px solid rgba(74,124,89,0.35)',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      fontWeight: '600',
                      letterSpacing: '0.04em',
                      color: '#4a7c59',
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Done
                  </button>
                )}
                {item.status === 'done' && !item.scanStatus && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      fontWeight: '600',
                      letterSpacing: '0.04em',
                      color: '#4a7c59',
                    }}
                  >
                    Extracted ✓
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 28px',
            borderTop: '1px dashed var(--border-dash)',
            background: 'rgba(168,100,72,0.03)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              fontWeight: '600',
              letterSpacing: '0.14em',
              color: 'var(--accent)',
              textTransform: 'uppercase',
              marginBottom: '5px',
            }}
          >
            How to use
          </p>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              lineHeight: 1.7,
            }}
          >
            <strong style={{ color: '#E7000B' }}>⚡ Auto Scan</strong> — runs Playwright pipeline on
            the EC2 worker, inserts verified leads automatically (takes 5–20 min) ·
            <strong style={{ color: 'var(--text)' }}> Open →</strong> manual: open LinkedIn people
            page → extension extracts leads → <strong style={{ color: '#4a7c59' }}>✓ Done</strong>
          </p>
        </div>
      </div>
    </div>
  )
}

const s = {
  eyebrow: {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.14em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    marginBottom: '6px',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '24px',
    fontWeight: '400',
    letterSpacing: '-0.04em',
    color: 'var(--text)',
    lineHeight: 1,
    marginBottom: '6px',
  },
  subtitle: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-muted)',
    lineHeight: 1.6,
  },
}
