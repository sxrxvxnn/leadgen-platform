import { createContext, useContext, useRef, useState } from 'react'
import {
  bulkAutofillCompanies,
  bulkAutofillCompaniesAsync,
  bulkAnalyzeCompanies,
  bulkMapsEnrich,
  notifyEnrichmentComplete,
  getJob,
} from '../services/api'

const BulkOpsContext = createContext(null)

const INIT = {
  running: false,
  msg: '',
  filledCount: 0,
  total: 0,
  startedAt: null,
  recentActivity: [],
  jobId: null,
}

export function BulkOpsProvider({ children }) {
  const [autofill, setAutofill] = useState(INIT)
  const [analyze, setAnalyze] = useState(INIT)
  const [maps, setMaps] = useState(INIT)

  // Companies.jsx registers this while mounted so live results flow straight in.
  const liveUpdate = useRef(null)
  const pending = useRef({})

  // Cancel refs — shared across async loops
  const cancelRef = useRef(false) // checked at each loop iteration
  const abortRef = useRef(null) // AbortController for in-flight fetch
  const pollRef = useRef(null) // interval id for background job polling

  function dispatch(result) {
    if (!result?.id || !result?.update || !Object.keys(result.update).length) return
    if (liveUpdate.current) {
      liveUpdate.current(result)
    } else {
      pending.current[result.id] = { ...(pending.current[result.id] || {}), ...result.update }
    }
  }

  function registerLive(cb) {
    liveUpdate.current = cb
  }

  function drainPending() {
    const snap = { ...pending.current }
    pending.current = {}
    return snap
  }

  function cancelAutofill() {
    cancelRef.current = true
    if (abortRef.current) {
      try {
        abortRef.current.abort()
      } catch {}
    }
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setAutofill((p) => ({
      ...p,
      running: false,
      msg: `Cancelled — ${p.filledCount} of ${p.total} companies processed`,
    }))
    setTimeout(() => setAutofill((p) => (p.running ? p : INIT)), 6000)
  }

  async function runAutofill(companyIds) {
    if (autofill.running) return
    const CHUNK = 40
    const total = companyIds.length
    cancelRef.current = false
    setAutofill({
      running: true,
      msg: `Starting autofill for ${total} companies…`,
      filledCount: 0,
      total,
    })
    let filled = 0
    let globalCompleted = 0
    try {
      for (let i = 0; i < companyIds.length; i += CHUNK) {
        if (cancelRef.current) break
        const chunk = companyIds.slice(i, i + CHUNK)
        const controller = new AbortController()
        abortRef.current = controller
        await bulkAutofillCompanies(
          chunk,
          (_, __, result) => {
            if (cancelRef.current) return
            globalCompleted++
            setAutofill((p) => ({ ...p, msg: `Filling… ${globalCompleted}/${total}` }))
            if (result?.success && result.update && Object.keys(result.update).length) {
              filled++
              setAutofill((p) => ({ ...p, filledCount: filled }))
              dispatch(result)
            }
          },
          controller.signal
        )
      }
      if (!cancelRef.current) {
        setAutofill({
          running: false,
          msg: `Done — ${filled} of ${total} companies updated`,
          filledCount: filled,
          total,
        })
      }
    } catch (e) {
      if (cancelRef.current || e.name === 'AbortError') return
      setAutofill({
        running: false,
        msg: 'Autofill failed — ' + e.message,
        filledCount: 0,
        total: 0,
      })
    } finally {
      setTimeout(() => setAutofill((p) => (p.running ? p : INIT)), 6000)
    }
  }

  const ASYNC_ENRICH_THRESHOLD = 10

  async function runAutoEnrich(companyIds) {
    if (autofill.running) return
    const total = companyIds.length
    const startedAt = Date.now()
    cancelRef.current = false

    // ── Large batch: hand off to background worker ──────────────────────────
    if (total > ASYNC_ENRICH_THRESHOLD) {
      setAutofill({
        running: true,
        msg: `Queuing ${total} companies for background enrichment…`,
        filledCount: 0,
        total,
        startedAt,
        recentActivity: [],
        jobId: null,
      })
      try {
        const res = await bulkAutofillCompaniesAsync(companyIds)
        const jobId = res?.data?.job_id || null
        setAutofill((p) => ({
          ...p,
          running: true,
          msg: `${total} companies queued — enriching in background`,
          jobId,
        }))
        if (jobId) {
          pollRef.current = setInterval(async () => {
            if (cancelRef.current) {
              clearInterval(pollRef.current)
              pollRef.current = null
              return
            }
            try {
              const jr = await getJob(jobId)
              const { status, completed, total: jTotal } = jr.data || {}
              setAutofill((p) => ({
                ...p,
                filledCount: completed || 0,
                total: jTotal || total,
                msg:
                  status === 'completed'
                    ? `Done — ${completed}/${jTotal || total} companies enriched`
                    : `Background enrichment: ${completed || 0}/${jTotal || total}…`,
              }))
              if (status === 'completed' || status === 'failed') {
                clearInterval(pollRef.current)
                pollRef.current = null
                const durMin = Math.round((Date.now() - startedAt) / 60000)
                setAutofill((p) => ({ ...p, running: false }))
                try {
                  notifyEnrichmentComplete({
                    count: completed,
                    total: jTotal || total,
                    duration_min: durMin,
                  })
                } catch {}
                setTimeout(() => setAutofill((p) => (p.running ? p : INIT)), 15000)
              }
            } catch {
              clearInterval(pollRef.current)
              pollRef.current = null
              setAutofill((p) => ({
                ...p,
                running: false,
                msg: 'Background enrichment — check results in a few minutes',
              }))
              setTimeout(() => setAutofill((p) => (p.running ? p : INIT)), 12000)
            }
          }, 8000)
        } else {
          setAutofill((p) => ({ ...p, running: false }))
          setTimeout(() => setAutofill((p) => (p.running ? p : INIT)), 12000)
        }
      } catch (e) {
        setAutofill({
          running: false,
          msg: 'Queue failed — ' + e.message,
          filledCount: 0,
          total: 0,
          startedAt: null,
          recentActivity: [],
          jobId: null,
        })
        setTimeout(() => setAutofill((p) => (p.running ? p : INIT)), 8000)
      }
      return
    }

    // ── Small batch: sequential in-browser with live progress + ETA ─────────
    setAutofill({
      running: true,
      msg: `Auto-enriching ${total} ${total === 1 ? 'company' : 'companies'}…`,
      filledCount: 0,
      total,
      startedAt,
      recentActivity: [],
      jobId: null,
    })
    let filled = 0
    let done = 0
    try {
      for (const id of companyIds) {
        if (cancelRef.current) break
        done++
        if (total > 1) setAutofill((p) => ({ ...p, msg: `Enriching ${done}/${total}…` }))
        const controller = new AbortController()
        abortRef.current = controller
        await bulkAutofillCompanies(
          [id],
          (_, __, result) => {
            if (cancelRef.current) return
            if (result?.success && result.update && Object.keys(result.update).length) {
              filled++
              const name = result.update.name || result.id || ''
              const fields = Object.keys(result.update)
                .filter((k) => k !== 'name')
                .slice(0, 3)
              setAutofill((p) => ({
                ...p,
                filledCount: filled,
                recentActivity: [
                  { name, fields, ts: Date.now() },
                  ...(p.recentActivity || []),
                ].slice(0, 5),
              }))
              dispatch(result)
            } else if (result?.success === false && result?.message) {
              setAutofill((p) => ({ ...p, msg: `⚠ ${result.message}` }))
            }
          },
          controller.signal
        )
      }
      if (!cancelRef.current) {
        const durMin = Math.round((Date.now() - startedAt) / 60000)
        setAutofill((p) => ({
          ...p,
          running: false,
          msg: `Done — ${filled} of ${total} ${total === 1 ? 'company' : 'companies'} enriched`,
        }))
        if (filled > 0) {
          try {
            notifyEnrichmentComplete({ count: filled, total, duration_min: durMin })
          } catch {}
        }
      }
    } catch (e) {
      if (cancelRef.current || e.name === 'AbortError') return
      setAutofill({
        running: false,
        msg: 'Auto-enrich failed — ' + e.message,
        filledCount: 0,
        total: 0,
        startedAt: null,
        recentActivity: [],
        jobId: null,
      })
    } finally {
      setTimeout(() => setAutofill((p) => (p.running ? p : INIT)), 8000)
    }
  }

  async function runAnalyze(companyIds) {
    if (analyze.running) return
    const CHUNK = 40
    const total = companyIds.length
    setAnalyze({ running: true, msg: `Analyzing ${total} companies…`, filledCount: 0, total })
    let filled = 0
    let globalCompleted = 0
    try {
      for (let i = 0; i < companyIds.length; i += CHUNK) {
        const chunk = companyIds.slice(i, i + CHUNK)
        await bulkAnalyzeCompanies(chunk, (_, __, result) => {
          globalCompleted++
          setAnalyze((p) => ({ ...p, msg: `Analyzing… ${globalCompleted}/${total}` }))
          if (result?.success && result.update && Object.keys(result.update).length) {
            filled++
            setAnalyze((p) => ({ ...p, filledCount: filled }))
            dispatch(result)
          }
        })
      }
      setAnalyze({
        running: false,
        msg: `Done — ${filled} of ${total} analyzed`,
        filledCount: filled,
        total,
      })
    } catch (e) {
      setAnalyze({ running: false, msg: 'Analyze failed — ' + e.message, filledCount: 0, total: 0 })
    } finally {
      setTimeout(() => setAnalyze((p) => (p.running ? p : INIT)), 6000)
    }
  }

  async function runMapsEnrich(companyIds) {
    if (maps.running) return
    const CHUNK = 40
    const total = companyIds.length
    setMaps({
      running: true,
      msg: `Enriching ${total} companies from Maps…`,
      filledCount: 0,
      total,
    })
    let filled = 0
    let globalCompleted = 0
    try {
      for (let i = 0; i < companyIds.length; i += CHUNK) {
        const chunk = companyIds.slice(i, i + CHUNK)
        await bulkMapsEnrich(chunk, (_, __, result) => {
          globalCompleted++
          setMaps((p) => ({ ...p, msg: `Maps enriching… ${globalCompleted}/${total}` }))
          if (result?.success && result.update && Object.keys(result.update).length) {
            filled++
            setMaps((p) => ({ ...p, filledCount: filled }))
            dispatch(result)
          }
        })
      }
      setMaps({
        running: false,
        msg: `Done — ${filled} of ${total} enriched from Maps`,
        filledCount: filled,
        total,
      })
    } catch (e) {
      setMaps({
        running: false,
        msg: 'Maps enrich failed — ' + (e.message || 'unknown error'),
        filledCount: 0,
        total: 0,
      })
    } finally {
      setTimeout(() => setMaps((p) => (p.running ? p : INIT)), 6000)
    }
  }

  return (
    <BulkOpsContext.Provider
      value={{
        autofill,
        analyze,
        maps,
        runAutofill,
        runAutoEnrich,
        runAnalyze,
        runMapsEnrich,
        cancelAutofill,
        registerLive,
        drainPending,
      }}
    >
      {children}
    </BulkOpsContext.Provider>
  )
}

export function useBulkOps() {
  return useContext(BulkOpsContext)
}
