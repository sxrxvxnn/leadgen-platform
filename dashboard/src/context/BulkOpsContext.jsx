import { createContext, useContext, useRef, useState } from 'react'
import {
  bulkAutofillCompanies,
  bulkAutofillCompaniesAsync,
  bulkAnalyzeCompanies,
  bulkMapsEnrich,
} from '../services/api'

const BulkOpsContext = createContext(null)

const INIT = { running: false, msg: '', filledCount: 0, total: 0 }

export function BulkOpsProvider({ children }) {
  const [autofill, setAutofill] = useState(INIT)
  const [analyze, setAnalyze] = useState(INIT)
  const [maps, setMaps] = useState(INIT)

  // Companies.jsx registers this while mounted so live results flow straight in.
  // When it's null (tab switched away) updates are buffered in pendingUpdates.
  const liveUpdate = useRef(null)
  const pending = useRef({}) // { [companyId]: mergedFields }

  function dispatch(result) {
    if (!result?.id || !result?.update || !Object.keys(result.update).length) return
    if (liveUpdate.current) {
      liveUpdate.current(result)
    } else {
      pending.current[result.id] = { ...(pending.current[result.id] || {}), ...result.update }
    }
  }

  // Companies.jsx calls this on mount/unmount
  function registerLive(cb) {
    liveUpdate.current = cb
  }

  // Returns buffered updates accumulated while Companies was unmounted, then clears buffer
  function drainPending() {
    const snap = { ...pending.current }
    pending.current = {}
    return snap
  }

  async function runAutofill(companyIds) {
    if (autofill.running) return
    const CHUNK = 40
    const total = companyIds.length
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
        const chunk = companyIds.slice(i, i + CHUNK)
        await bulkAutofillCompanies(chunk, (_, __, result) => {
          globalCompleted++
          setAutofill((p) => ({ ...p, msg: `Filling… ${globalCompleted}/${total}` }))
          if (result?.success && result.update && Object.keys(result.update).length) {
            filled++
            setAutofill((p) => ({ ...p, filledCount: filled }))
            dispatch(result)
          }
        })
      }
      setAutofill({
        running: false,
        msg: `Done — ${filled} of ${total} companies updated`,
        filledCount: filled,
        total,
      })
    } catch (e) {
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

  // Sequential enrichment — one company at a time for maximum accuracy.
  // Batches > 10: dispatched to SQS/EC2 worker so it survives page reloads.
  // Batches ≤ 10: runs in-browser with live progress (immediate feedback).
  const ASYNC_ENRICH_THRESHOLD = 10
  async function runAutoEnrich(companyIds) {
    if (autofill.running) return
    const total = companyIds.length

    // ── Large batch: hand off to background worker ──────────────────────────
    if (total > ASYNC_ENRICH_THRESHOLD) {
      setAutofill({
        running: true,
        msg: `Queuing ${total} companies for background enrichment…`,
        filledCount: 0,
        total,
      })
      try {
        await bulkAutofillCompaniesAsync(companyIds)
        setAutofill({
          running: false,
          msg: `${total} companies queued — enriching in background, reload to see results`,
          filledCount: 0,
          total,
        })
      } catch (e) {
        setAutofill({
          running: false,
          msg: 'Queue failed — ' + e.message,
          filledCount: 0,
          total: 0,
        })
      } finally {
        setTimeout(() => setAutofill((p) => (p.running ? p : INIT)), 12000)
      }
      return
    }

    // ── Small batch: sequential in-browser with live progress ───────────────
    setAutofill({
      running: true,
      msg: `Auto-enriching ${total} ${total === 1 ? 'company' : 'companies'}…`,
      filledCount: 0,
      total,
    })
    let filled = 0
    let done = 0
    try {
      for (const id of companyIds) {
        done++
        if (total > 1) setAutofill((p) => ({ ...p, msg: `Enriching ${done}/${total}…` }))
        await bulkAutofillCompanies([id], (_, __, result) => {
          if (result?.success && result.update && Object.keys(result.update).length) {
            filled++
            setAutofill((p) => ({ ...p, filledCount: filled }))
            dispatch(result)
          } else if (result?.success === false && result?.message) {
            setAutofill((p) => ({ ...p, msg: `⚠ ${result.message}` }))
          }
        })
      }
      setAutofill({
        running: false,
        msg: `Done — ${filled} of ${total} ${total === 1 ? 'company' : 'companies'} enriched`,
        filledCount: filled,
        total,
      })
    } catch (e) {
      setAutofill({
        running: false,
        msg: 'Auto-enrich failed — ' + e.message,
        filledCount: 0,
        total: 0,
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
