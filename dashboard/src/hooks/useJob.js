import { useState, useEffect, useRef, useCallback } from 'react'
import { getJob } from '../services/api'

const POLL_INTERVAL_MS = 2000   // poll every 2 s while running
const TERMINAL = new Set(['completed', 'failed'])

/**
 * Poll a background job until it reaches a terminal state.
 *
 * Usage:
 *   const { job, isLoading, error, cancel } = useJob(jobId)
 *
 * job shape: { id, type, status, total, completed, errors, error_message, created_at }
 * progress:  job.completed / job.total  (0–1)
 */
export function useJob(jobId) {
  const [job,       setJob]       = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState(null)
  const timerRef = useRef(null)
  const cancelled = useRef(false)

  const cancel = useCallback(() => {
    cancelled.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    if (!jobId) return
    cancelled.current = false
    setIsLoading(true)
    setError(null)

    const poll = async () => {
      if (cancelled.current) return
      try {
        const { data } = await getJob(jobId)
        setJob(data)
        if (!TERMINAL.has(data.status) && !cancelled.current) {
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
        } else {
          setIsLoading(false)
        }
      } catch (e) {
        setError(e?.response?.data?.detail || e.message || 'Failed to fetch job status')
        setIsLoading(false)
      }
    }

    poll()
    return cancel
  }, [jobId, cancel])

  return { job, isLoading, error, cancel }
}

/**
 * Convenience component that renders a compact progress bar + status line.
 * Drop into any page after dispatching an async job.
 *
 * <JobProgress jobId={jobId} onDone={() => refetchCompanies()} />
 */
export function JobProgress({ jobId, onDone, label = 'Processing' }) {
  const { job, isLoading } = useJob(jobId)

  useEffect(() => {
    if (job?.status === 'completed' && onDone) onDone()
  }, [job?.status])

  if (!job) return null

  const pct = job.total > 0 ? Math.round((job.completed / job.total) * 100) : 0
  const done = job.status === 'completed'
  const failed = job.status === 'failed'

  return (
    <div style={{
      padding: '12px 16px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-soft)', fontWeight: 500 }}>
          {failed ? 'Failed' : done ? `${label} complete` : `${label}…`}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {job.completed}/{job.total}
          {job.errors > 0 && <span style={{ color: 'var(--danger, #c0392b)', marginLeft: 6 }}>{job.errors} err</span>}
        </span>
      </div>
      <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: failed ? 'var(--danger, #c0392b)' : 'var(--accent)',
          borderRadius: '2px',
          transition: 'width 0.4s ease',
        }} />
      </div>
      {failed && job.error_message && (
        <p style={{ fontSize: '12px', color: 'var(--danger, #c0392b)', margin: 0 }}>
          {job.error_message.slice(0, 200)}
        </p>
      )}
    </div>
  )
}
