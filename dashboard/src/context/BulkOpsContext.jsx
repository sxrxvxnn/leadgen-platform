import { createContext, useContext, useRef, useState } from 'react'
import { bulkAutofillCompanies, bulkAnalyzeCompanies, bulkMapsEnrich } from '../services/api'

const BulkOpsContext = createContext(null)

const INIT = { running: false, msg: '', filledCount: 0, total: 0 }

export function BulkOpsProvider({ children }) {
  const [autofill, setAutofill] = useState(INIT)
  const [analyze,  setAnalyze]  = useState(INIT)
  const [maps,     setMaps]     = useState(INIT)

  // Companies.jsx registers this while mounted so live results flow straight in.
  // When it's null (tab switched away) updates are buffered in pendingUpdates.
  const liveUpdate = useRef(null)
  const pending    = useRef({}) // { [companyId]: mergedFields }

  function dispatch(result) {
    if (!result?.id || !result?.update || !Object.keys(result.update).length) return
    if (liveUpdate.current) {
      liveUpdate.current(result)
    } else {
      pending.current[result.id] = { ...(pending.current[result.id] || {}), ...result.update }
    }
  }

  // Companies.jsx calls this on mount/unmount
  function registerLive(cb) { liveUpdate.current = cb }

  // Returns buffered updates accumulated while Companies was unmounted, then clears buffer
  function drainPending() {
    const snap = { ...pending.current }
    pending.current = {}
    return snap
  }

  async function runAutofill(companyIds) {
    if (autofill.running) return
    setAutofill({ running: true, msg: `Starting autofill for ${companyIds.length} companies…`, filledCount: 0, total: companyIds.length })
    let filled = 0
    try {
      await bulkAutofillCompanies(companyIds, (completed, total, result) => {
        setAutofill(p => ({ ...p, msg: `Filling… ${completed ?? '?'}/${total ?? p.total}`, total: total ?? p.total }))
        if (result?.success && result.update && Object.keys(result.update).length) {
          filled++
          setAutofill(p => ({ ...p, filledCount: filled }))
          dispatch(result)
        }
      })
      setAutofill({ running: false, msg: `Done — ${filled} of ${companyIds.length} companies updated`, filledCount: filled, total: companyIds.length })
    } catch (e) {
      setAutofill({ running: false, msg: 'Autofill failed — ' + e.message, filledCount: 0, total: 0 })
    } finally {
      setTimeout(() => setAutofill(p => p.running ? p : INIT), 6000)
    }
  }

  async function runAnalyze(companyIds) {
    if (analyze.running) return
    setAnalyze({ running: true, msg: `Analyzing ${companyIds.length} companies…`, filledCount: 0, total: companyIds.length })
    let filled = 0
    try {
      await bulkAnalyzeCompanies(companyIds, (completed, total, result) => {
        setAnalyze(p => ({ ...p, msg: `Analyzing… ${completed ?? '?'}/${total ?? p.total}`, total: total ?? p.total }))
        if (result?.success && result.update && Object.keys(result.update).length) {
          filled++
          setAnalyze(p => ({ ...p, filledCount: filled }))
          dispatch(result)
        }
      })
      setAnalyze({ running: false, msg: `Done — ${filled} of ${companyIds.length} analyzed`, filledCount: filled, total: companyIds.length })
    } catch (e) {
      setAnalyze({ running: false, msg: 'Analyze failed — ' + e.message, filledCount: 0, total: 0 })
    } finally {
      setTimeout(() => setAnalyze(p => p.running ? p : INIT), 6000)
    }
  }

  async function runMapsEnrich(companyIds, mapsKey) {
    if (maps.running) return
    setMaps({ running: true, msg: `Enriching ${companyIds.length} companies from Maps…`, filledCount: 0, total: companyIds.length })
    let filled = 0
    try {
      await bulkMapsEnrich(companyIds, mapsKey, (completed, total, result) => {
        setMaps(p => ({ ...p, msg: `Maps enriching… ${completed ?? '?'}/${total ?? p.total}`, total: total ?? p.total }))
        if (result?.success && result.update && Object.keys(result.update).length) {
          filled++
          setMaps(p => ({ ...p, filledCount: filled }))
          dispatch(result)
        }
      })
      setMaps({ running: false, msg: `Done — ${filled} of ${companyIds.length} enriched from Maps`, filledCount: filled, total: companyIds.length })
    } catch (e) {
      setMaps({ running: false, msg: 'Maps enrich failed — ' + (e.message || 'unknown error'), filledCount: 0, total: 0 })
    } finally {
      setTimeout(() => setMaps(p => p.running ? p : INIT), 6000)
    }
  }

  return (
    <BulkOpsContext.Provider value={{ autofill, analyze, maps, runAutofill, runAnalyze, runMapsEnrich, registerLive, drainPending }}>
      {children}
    </BulkOpsContext.Provider>
  )
}

export function useBulkOps() { return useContext(BulkOpsContext) }
