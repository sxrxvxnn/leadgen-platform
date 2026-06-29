import { useEffect, useRef } from 'react'

// Keyboard typing and UI click sounds via Web Audio API — no files needed.
// Inspired by Aceternity's keyboard component tactile feel.

// Keys that should NOT trigger a typing sound
const SKIP_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift', 'Tab', 'CapsLock', 'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'])

// Elements whose clicks should play the click sound
function isClickable(el) {
  if (!el) return false
  const tag = el.tagName?.toLowerCase()
  if (tag === 'button' || tag === 'a' || tag === 'select' || tag === 'label') return true
  const role = el.getAttribute?.('role')
  if (role === 'button' || role === 'tab' || role === 'menuitem' || role === 'option') return true
  if (el.onclick || el.getAttribute?.('data-clickable')) return true
  // Walk up a couple levels for nested icon/text inside buttons
  return false
}

function findClickableAncestor(el, depth = 0) {
  if (!el || depth > 4) return null
  if (isClickable(el)) return el
  return findClickableAncestor(el.parentElement, depth + 1)
}

function createCtx() {
  try { return new (window.AudioContext || window.webkitAudioContext)() } catch { return null }
}

// ── Mechanical key click (short noise burst + bandpass) ──────────────────────
function playKeyClick(ctx, vol = 0.35) {
  if (!ctx) return
  try {
    const bufLen = ctx.sampleRate * 0.025  // 25ms of noise
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1)

    const src = ctx.createBufferSource()
    src.buffer = buf

    // Bandpass around 2-4kHz for that "click" character
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2800 + Math.random() * 600
    bp.Q.value = 1.4

    const gain = ctx.createGain()
    const now = ctx.currentTime
    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028)

    src.connect(bp)
    bp.connect(gain)
    gain.connect(ctx.destination)
    src.start(now)
    src.stop(now + 0.03)
  } catch {}
}

// ── UI button click (low thud) ───────────────────────────────────────────────
function playClickThud(ctx, vol = 0.25) {
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime

    osc.frequency.setValueAtTime(160, now)
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.04)
    osc.type = 'sine'

    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.07)
  } catch {}
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useSoundEffects({ enabled = true } = {}) {
  const ctxRef = useRef(null)

  // Lazily init AudioContext on first user gesture (browser requirement)
  function getCtx() {
    if (!ctxRef.current) ctxRef.current = createCtx()
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume()
    return ctxRef.current
  }

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e) {
      if (SKIP_KEYS.has(e.key)) return
      // Skip when in a contenteditable that isn't an input — avoids double-firing in rich editors
      const tag = document.activeElement?.tagName?.toLowerCase()
      const isTypable = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable
      if (!isTypable) return
      playKeyClick(getCtx())
    }

    function onClick(e) {
      const target = findClickableAncestor(e.target)
      if (!target) return
      playClickThud(getCtx())
    }

    document.addEventListener('keydown', onKeyDown, { passive: true })
    document.addEventListener('click', onClick, { passive: true })

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('click', onClick)
    }
  }, [enabled])

  return {
    playKey: () => playKeyClick(getCtx()),
    playClick: () => playClickThud(getCtx()),
  }
}
