import { useEffect, useRef } from 'react'

// Keyboard typing and UI click sounds via Web Audio API — no files needed.
// Inspired by Aceternity's keyboard component tactile feel.

// Keys that should NOT trigger a typing sound
const SKIP_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift', 'Tab', 'CapsLock', 'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'])

// Elements whose clicks should play the click sound
const CLICKABLE_TAGS = new Set(['button', 'a', 'select', 'label', 'summary'])
const CLICKABLE_ROLES = new Set(['button', 'tab', 'menuitem', 'option', 'checkbox', 'radio', 'switch', 'link'])

function isClickable(el) {
  if (!el) return false
  const tag = el.tagName?.toLowerCase()
  if (CLICKABLE_TAGS.has(tag)) return true
  const role = el.getAttribute?.('role')
  if (role && CLICKABLE_ROLES.has(role)) return true
  if (el.getAttribute?.('type') === 'checkbox' || el.getAttribute?.('type') === 'radio') return true
  // cursor: pointer is a reliable signal for React-handled click targets
  if (el.style?.cursor === 'pointer') return true
  try { if (window.getComputedStyle(el).cursor === 'pointer') return true } catch {}
  return false
}

function findClickableAncestor(el, depth = 0) {
  if (!el || depth > 6 || el === document.body) return null
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

// ── UI button click (punchy tap) ─────────────────────────────────────────────
function playClickThud(ctx, vol = 0.55) {
  if (!ctx) return
  try {
    const now = ctx.currentTime

    // Layer 1: sharp initial transient (noise burst)
    const bufLen = ctx.sampleRate * 0.012
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1)
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = buf
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(vol * 0.6, now)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015)
    noiseSrc.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noiseSrc.start(now)
    noiseSrc.stop(now + 0.016)

    // Layer 2: pitched body (sine sweep for the "thunk" feel)
    const osc = ctx.createOscillator()
    const oscGain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(220, now)
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.05)
    oscGain.gain.setValueAtTime(vol, now)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    osc.connect(oscGain)
    oscGain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.09)
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
