import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import {
  IconBrightnessDown, IconBrightnessUp, IconCaretRightFilled,
  IconCaretUpFilled, IconChevronUp, IconMicrophone, IconMoon,
  IconPlayerSkipForward, IconPlayerTrackNext, IconPlayerTrackPrev,
  IconTable, IconVolume, IconVolume2, IconVolume3, IconSearch,
  IconWorld, IconCommand, IconCaretLeftFilled, IconCaretDownFilled,
} from '@tabler/icons-react'

// ── KBtn ─────────────────────────────────────────────────────────────
function KBtn({ children, style = {}, childStyle = {}, backlit = true }) {
  return (
    <div style={{
      transform: 'translateZ(0)',
      borderRadius: 4,
      padding: 0.5,
      willChange: 'transform',
      background: backlit ? 'rgba(255,255,255,0.2)' : 'transparent',
      boxShadow: backlit ? '0 20px 25px -5px rgba(255,255,255,0.4)' : 'none',
      ...style,
    }}>
      <div style={{
        display: 'flex',
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 3.5,
        background: '#0A090D',
        boxShadow: '0px -0.5px 2px 0 #0D0D0F inset, -0.5px 0px 2px 0 #0D0D0F inset',
      }}>
        <div style={{
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 5,
          color: backlit ? '#fff' : '#e5e5e5',
          ...childStyle,
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── SpeakerGrid ──────────────────────────────────────────────────────
function SpeakerGrid() {
  return (
    <div style={{
      marginTop: 8,
      display: 'flex',
      height: 160,
      gap: 2,
      padding: '0 0.5px',
      backgroundImage: 'radial-gradient(circle, #08080A 0.5px, transparent 0.5px)',
      backgroundSize: '3px 3px',
    }} />
  )
}

// ── Trackpad ─────────────────────────────────────────────────────────
function Trackpad() {
  return (
    <div style={{
      margin: '4px auto',
      height: 128,
      width: '40%',
      borderRadius: 12,
      boxShadow: '0px 0px 1px 1px rgba(0,0,0,0.12) inset',
    }} />
  )
}

// ── OptionKey SVG ────────────────────────────────────────────────────
function OptionKey({ size = 6 }) {
  return (
    <svg fill="none" viewBox="0 0 32 32" width={size} height={size}
         xmlns="http://www.w3.org/2000/svg">
      <rect stroke="currentColor" strokeWidth={2} x="18" y="5" width="10" height="2" />
      <polygon stroke="currentColor" strokeWidth={2}
               points="10.6,5 4,5 4,7 9.4,7 18.4,27 28,27 28,25 19.6,25" />
      <rect width="32" height="32" stroke="none" />
    </svg>
  )
}

// ── Keypad ───────────────────────────────────────────────────────────
function Keypad() {
  const row = { display: 'flex', width: '100%', flexShrink: 0, gap: 2, marginBottom: 2 }
  const icon = { width: 6, height: 6 }
  const sub  = { display: 'flex', width: '100%' }
  const jEnd = { justifyContent: 'flex-end', paddingRight: 4 }
  const jStr = { justifyContent: 'flex-start', paddingLeft: 4 }

  return (
    <div style={{
      margin: '0 4px',
      height: '100%',
      transform: 'translateZ(0)',
      borderRadius: 6,
      background: '#050505',
      padding: 4,
      willChange: 'transform',
    }}>
      {/* Row 1 — Fn keys */}
      <div style={row}>
        <KBtn style={{ width: 40 }} childStyle={{ alignItems: 'flex-start', justifyContent: 'flex-end', paddingBottom: 2, paddingLeft: 4 }}>esc</KBtn>
        <KBtn><IconBrightnessDown style={icon} /><span style={{ marginTop: 2 }}>F1</span></KBtn>
        <KBtn><IconBrightnessUp style={icon} /><span style={{ marginTop: 2 }}>F2</span></KBtn>
        <KBtn><IconTable style={icon} /><span style={{ marginTop: 2 }}>F3</span></KBtn>
        <KBtn><IconSearch style={icon} /><span style={{ marginTop: 2 }}>F4</span></KBtn>
        <KBtn><IconMicrophone style={icon} /><span style={{ marginTop: 2 }}>F5</span></KBtn>
        <KBtn><IconMoon style={icon} /><span style={{ marginTop: 2 }}>F6</span></KBtn>
        <KBtn><IconPlayerTrackPrev style={icon} /><span style={{ marginTop: 2 }}>F7</span></KBtn>
        <KBtn><IconPlayerSkipForward style={icon} /><span style={{ marginTop: 2 }}>F8</span></KBtn>
        <KBtn><IconPlayerTrackNext style={icon} /><span style={{ marginTop: 2 }}>F9</span></KBtn>
        <KBtn><IconVolume3 style={icon} /><span style={{ marginTop: 2 }}>F10</span></KBtn>
        <KBtn><IconVolume2 style={icon} /><span style={{ marginTop: 2 }}>F11</span></KBtn>
        <KBtn><IconVolume style={icon} /><span style={{ marginTop: 2 }}>F12</span></KBtn>
        <KBtn>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'linear-gradient(to bottom, #1a1a1a 20%, #000 50%, #1a1a1a 95%)', padding: 1 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#000' }} />
          </div>
        </KBtn>
      </div>

      {/* Row 2 — Numbers */}
      <div style={row}>
        {[['~','`'],['!','1'],['@','2'],['#','3'],['$','4'],['%','5'],['^','6'],['&','7'],['*','8'],['(','9'],[')',')'],['—','_'],['+','=']].map(([top,bot],i) => (
          <KBtn key={i}><span style={{ display:'block' }}>{top}</span><span style={{ display:'block' }}>{bot}</span></KBtn>
        ))}
        <KBtn style={{ width: 40 }} childStyle={{ alignItems: 'flex-end', justifyContent: 'flex-end', paddingBottom: 2, paddingRight: 4 }}>delete</KBtn>
      </div>

      {/* Row 3 — QWERTY */}
      <div style={row}>
        <KBtn style={{ width: 40 }} childStyle={{ alignItems: 'flex-start', justifyContent: 'flex-end', paddingBottom: 2, paddingLeft: 4 }}>tab</KBtn>
        {['Q','W','E','R','T','Y','U','I','O','P'].map(k => <KBtn key={k}><span>{k}</span></KBtn>)}
        <KBtn><span>{'{'}</span><span>{'['}</span></KBtn>
        <KBtn><span>{'}'}</span><span>{']'}</span></KBtn>
        <KBtn><span>{'|'}</span><span>{'\\'}</span></KBtn>
      </div>

      {/* Row 4 — ASDF */}
      <div style={row}>
        <KBtn style={{ width: 44 }} childStyle={{ alignItems: 'flex-start', justifyContent: 'flex-end', paddingBottom: 2, paddingLeft: 4 }}>caps lock</KBtn>
        {['A','S','D','F','G','H','J','K','L'].map(k => <KBtn key={k}><span>{k}</span></KBtn>)}
        <KBtn><span>:</span><span>;</span></KBtn>
        <KBtn><span>"</span><span>'</span></KBtn>
        <KBtn style={{ width: 46 }} childStyle={{ alignItems: 'flex-end', justifyContent: 'flex-end', paddingBottom: 2, paddingRight: 4 }}>return</KBtn>
      </div>

      {/* Row 5 — ZXCV */}
      <div style={row}>
        <KBtn style={{ width: 58 }} childStyle={{ alignItems: 'flex-start', justifyContent: 'flex-end', paddingBottom: 2, paddingLeft: 4 }}>shift</KBtn>
        {['Z','X','C','V','B','N','M'].map(k => <KBtn key={k}><span>{k}</span></KBtn>)}
        <KBtn><span>{'<'}</span><span>{','}</span></KBtn>
        <KBtn><span>{'>'}</span><span>{'.'}</span></KBtn>
        <KBtn><span>{'?'}</span><span>{'/'}</span></KBtn>
        <KBtn style={{ width: 58 }} childStyle={{ alignItems: 'flex-end', justifyContent: 'flex-end', paddingBottom: 2, paddingRight: 4 }}>shift</KBtn>
      </div>

      {/* Row 6 — Bottom */}
      <div style={{ ...row, marginBottom: 0 }}>
        <KBtn childStyle={{ height: '100%', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
          <div style={{ ...sub, ...jEnd }}><span>fn</span></div>
          <div style={{ ...sub, ...jStr }}><IconWorld style={icon} /></div>
        </KBtn>
        <KBtn childStyle={{ height: '100%', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
          <div style={{ ...sub, ...jEnd }}><IconChevronUp style={icon} /></div>
          <div style={{ ...sub, ...jStr }}><span>control</span></div>
        </KBtn>
        <KBtn childStyle={{ height: '100%', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
          <div style={{ ...sub, ...jEnd }}><OptionKey /></div>
          <div style={{ ...sub, ...jStr }}><span>option</span></div>
        </KBtn>
        <KBtn style={{ width: 32 }} childStyle={{ height: '100%', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
          <div style={{ ...sub, ...jEnd }}><IconCommand style={icon} /></div>
          <div style={{ ...sub, ...jStr }}><span>command</span></div>
        </KBtn>
        {/* Spacebar */}
        <KBtn style={{ width: 131 }} />
        <KBtn style={{ width: 32 }} childStyle={{ height: '100%', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
          <div style={{ ...sub, ...jStr }}><IconCommand style={icon} /></div>
          <div style={{ ...sub, ...jStr }}><span>command</span></div>
        </KBtn>
        <KBtn childStyle={{ height: '100%', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 4 }}>
          <div style={{ ...sub, ...jStr }}><OptionKey /></div>
          <div style={{ ...sub, ...jStr }}><span>option</span></div>
        </KBtn>
        {/* Arrow cluster */}
        <div style={{ marginTop: 2, display: 'flex', height: 24, width: 78, flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', borderRadius: 4, padding: 0.5 }}>
          <KBtn style={{ height: 12, width: 24 }}><IconCaretUpFilled style={icon} /></KBtn>
          <div style={{ display: 'flex' }}>
            <KBtn style={{ height: 12, width: 24 }}><IconCaretLeftFilled style={icon} /></KBtn>
            <KBtn style={{ height: 12, width: 24 }}><IconCaretDownFilled style={icon} /></KBtn>
            <KBtn style={{ height: 12, width: 24 }}><IconCaretRightFilled style={icon} /></KBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Lid ──────────────────────────────────────────────────────────────
function Lid({ scaleX, scaleY, rotate, translate, children }) {
  return (
    <div style={{ position: 'relative', perspective: 800 }}>
      {/* Static closed lid — visible at start */}
      <div style={{
        transform: 'perspective(800px) rotateX(-25deg) translateZ(0px)',
        transformOrigin: 'bottom',
        transformStyle: 'preserve-3d',
        position: 'relative',
        height: 192,
        width: 512,
        borderRadius: 16,
        background: '#010101',
        padding: 8,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8,
          background: '#010101',
          boxShadow: '0px 2px 0px 2px #171717 inset',
        }}>
          {/* Sonar logo mark on closed lid */}
          <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#fff" strokeWidth="1" opacity="0.3"/>
            <circle cx="8" cy="8" r="4" stroke="#fff" strokeWidth="1" opacity="0.6"/>
            <circle cx="8" cy="8" r="1.5" fill="#fff"/>
            <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#fff" strokeWidth="1" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Animated opening lid — reveals screen content */}
      <motion.div style={{
        scaleX,
        scaleY,
        rotateX: rotate,
        translateY: translate,
        transformStyle: 'preserve-3d',
        transformOrigin: 'top',
        position: 'absolute',
        inset: 0,
        height: 384,
        width: 512,
        borderRadius: 16,
        background: '#010101',
        padding: 8,
      }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 8, background: '#272729' }} />
        {/* Screen content */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 8,
          overflow: 'hidden', background: '#f5f5f5',
        }}>
          {children}
        </div>
      </motion.div>
    </div>
  )
}

// ── MacbookScroll (public export) ─────────────────────────────────────
export function MacbookScroll({ children, title }) {
  const ref = useRef(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (window.innerWidth < 768) setIsMobile(true)
  }, [])

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  // Exact Aceternity transform values
  const scaleX     = useTransform(scrollYProgress, [0, 0.3], [1.2, isMobile ? 1 : 1.5])
  const scaleY     = useTransform(scrollYProgress, [0, 0.3], [0.6, isMobile ? 1 : 1.5])
  const translate  = useTransform(scrollYProgress, [0, 1], [0, 1500])
  const rotate     = useTransform(scrollYProgress, [0.1, 0.12, 0.3], [-28, -28, 0])
  const textY      = useTransform(scrollYProgress, [0, 0.3], [0, 100])
  const textOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])

  return (
    <div ref={ref} style={{
      display: 'flex',
      minHeight: '200vh',
      flexShrink: 0,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '0 0 320px',
      perspective: '800px',
      background: '#0B0B0F',
    }}>
      {/* Title */}
      {title && (
        <motion.h2 style={{
          translateY: textY,
          opacity: textOpacity,
          marginBottom: 80,
          textAlign: 'center',
          fontSize: 30,
          fontWeight: 700,
          color: '#fff',
          fontFamily: 'inherit',
        }}>
          {title}
        </motion.h2>
      )}

      {/* Lid (screen) */}
      <Lid scaleX={scaleX} scaleY={scaleY} rotate={rotate} translate={translate}>
        {children}
      </Lid>

      {/* Base / keyboard area */}
      <div style={{
        position: 'relative',
        zIndex: -10,
        height: 352,
        width: 512,
        overflow: 'hidden',
        borderRadius: 16,
        background: '#272729',
      }}>
        {/* Hinge strip above keyboard */}
        <div style={{ position: 'relative', height: 40, width: '100%' }}>
          <div style={{
            position: 'absolute',
            left: 0, right: 0,
            margin: '0 auto',
            height: 16,
            width: '80%',
            background: '#050505',
          }} />
        </div>

        {/* Speakers + Keyboard */}
        <div style={{ position: 'relative', display: 'flex' }}>
          <div style={{ margin: '0 auto', height: '100%', width: '10%', overflow: 'hidden' }}>
            <SpeakerGrid />
          </div>
          <div style={{ margin: '0 auto', height: '100%', width: '80%' }}>
            <Keypad />
          </div>
          <div style={{ margin: '0 auto', height: '100%', width: '10%', overflow: 'hidden' }}>
            <SpeakerGrid />
          </div>
        </div>

        <Trackpad />

        {/* Bottom gradient notch */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          margin: '0 auto',
          height: 8, width: 80,
          borderRadius: '12px 12px 0 0',
          background: 'linear-gradient(to top, #272729, #050505)',
        }} />
      </div>
    </div>
  )
}
