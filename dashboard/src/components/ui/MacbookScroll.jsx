import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import {
  IconBrightnessDown,
  IconBrightnessUp,
  IconCaretRightFilled,
  IconCaretUpFilled,
  IconChevronUp,
  IconMicrophone,
  IconMoon,
  IconPlayerSkipForward,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconTable,
  IconVolume,
  IconVolume2,
  IconVolume3,
  IconSearch,
  IconWorld,
  IconCommand,
  IconCaretLeftFilled,
  IconCaretDownFilled,
} from '@tabler/icons-react'

function OptionKey() {
  return (
    <svg
      fill="none"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      style={{ width: 6, height: 6 }}
    >
      <rect stroke="currentColor" strokeWidth={2} x="18" y="5" width="10" height="2" />
      <polygon
        stroke="currentColor"
        strokeWidth={2}
        points="10.6,5 4,5 4,7 9.4,7 18.4,27 28,27 28,25 19.6,25"
      />
      <rect width="32" height="32" stroke="none" />
    </svg>
  )
}

// style → overrides for inner key face (width, height, alignment, padding)
// childStyle → overrides for the content div inside the face
function KBtn({ style = {}, childStyle = {}, children, backlit = true }) {
  const faceBase = {
    display: 'flex',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3.5,
    background: '#0A090D',
    boxShadow: '0px -0.5px 2px 0 #0D0D0F inset, -0.5px 0px 2px 0 #0D0D0F inset',
  }
  const contentBase = {
    display: 'flex',
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 5,
    color: '#e5e7eb',
  }
  return (
    <div
      style={{
        transform: 'translateZ(0)',
        borderRadius: 4,
        padding: 0.5,
        willChange: 'transform',
        flexShrink: 0,
        ...(backlit
          ? {
              background: 'rgba(255,255,255,0.2)',
              boxShadow:
                '0 20px 25px -5px rgba(255,255,255,0.4), 0 8px 10px -6px rgba(255,255,255,0.4)',
            }
          : {}),
      }}
    >
      <div style={{ ...faceBase, ...style }}>
        <div style={{ ...contentBase, ...childStyle }}>{children}</div>
      </div>
    </div>
  )
}

function SpeakerGrid() {
  return (
    <div
      style={{
        marginTop: 8,
        display: 'flex',
        height: 160,
        gap: 2,
        paddingLeft: 0.5,
        paddingRight: 0.5,
        backgroundImage: 'radial-gradient(circle, #08080A 0.5px, transparent 0.5px)',
        backgroundSize: '3px 3px',
      }}
    />
  )
}

function Trackpad() {
  return (
    <div
      style={{
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: 4,
        marginBottom: 4,
        height: 128,
        width: '40%',
        borderRadius: 12,
        boxShadow: '0px 0px 1px 1px #00000020 inset',
      }}
    />
  )
}

function Keypad() {
  const ROW = { marginBottom: 2, display: 'flex', width: '100%', flexShrink: 0, gap: 2 }
  const ICO = { width: 6, height: 6 }

  // Modifier key face: wide, content bottom-left
  const MOD_L = {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingBottom: 2,
    paddingLeft: 4,
  }
  const MOD_R = {
    width: 40,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingBottom: 2,
    paddingRight: 4,
  }
  const CHILD_L = { alignItems: 'flex-start' }
  const CHILD_R = { alignItems: 'flex-end' }

  return (
    <div
      style={{
        marginLeft: 4,
        marginRight: 4,
        height: '100%',
        transform: 'translateZ(0)',
        borderRadius: 6,
        background: '#050505',
        padding: 0.5,
        willChange: 'transform',
      }}
    >
      {/* ── Row 1 — Fn ──────────────────────────────────────────────── */}
      <div style={ROW}>
        <KBtn style={MOD_L} childStyle={CHILD_L}>
          esc
        </KBtn>
        {[
          [IconBrightnessDown, 'F1'],
          [IconBrightnessUp, 'F2'],
          [IconTable, 'F3'],
          [IconSearch, 'F4'],
          [IconMicrophone, 'F5'],
          [IconMoon, 'F6'],
          [IconPlayerTrackPrev, 'F7'],
          [IconPlayerSkipForward, 'F8'],
          [IconPlayerTrackNext, 'F9'],
          [IconVolume3, 'F10'],
          [IconVolume2, 'F11'],
          [IconVolume, 'F12'],
        ].map(([Icon, label]) => (
          <KBtn key={label} childStyle={{ flexDirection: 'column' }}>
            <Icon style={ICO} />
            <span style={{ marginTop: 1, display: 'inline-block' }}>{label}</span>
          </KBtn>
        ))}
        {/* TouchID */}
        <KBtn>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'linear-gradient(to bottom, #1a1a1a 20%, #000 50%, #1a1a1a 95%)',
              padding: 1,
            }}
          >
            <div
              style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#000' }}
            />
          </div>
        </KBtn>
      </div>

      {/* ── Row 2 — Numbers ─────────────────────────────────────────── */}
      <div style={ROW}>
        <KBtn>
          <span style={{ display: 'block' }}>~</span>
          <span style={{ display: 'block' }}>`</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>!</span>
          <span style={{ display: 'block' }}>1</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>@</span>
          <span style={{ display: 'block' }}>2</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>#</span>
          <span style={{ display: 'block' }}>3</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>$</span>
          <span style={{ display: 'block' }}>4</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>%</span>
          <span style={{ display: 'block' }}>5</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>^</span>
          <span style={{ display: 'block' }}>6</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>&amp;</span>
          <span style={{ display: 'block' }}>7</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>*</span>
          <span style={{ display: 'block' }}>8</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>(</span>
          <span style={{ display: 'block' }}>9</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>)</span>
          <span style={{ display: 'block' }}>0</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>—</span>
          <span style={{ display: 'block' }}>_</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>+</span>
          <span style={{ display: 'block' }}>=</span>
        </KBtn>
        <KBtn style={MOD_R} childStyle={CHILD_R}>
          delete
        </KBtn>
      </div>

      {/* ── Row 3 — QWERTY ──────────────────────────────────────────── */}
      <div style={ROW}>
        <KBtn style={MOD_L} childStyle={CHILD_L}>
          tab
        </KBtn>
        {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((k) => (
          <KBtn key={k}>
            <span style={{ display: 'block' }}>{k}</span>
          </KBtn>
        ))}
        <KBtn>
          <span style={{ display: 'block' }}>{'{'}</span>
          <span style={{ display: 'block' }}>{'['}</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>{'}'}</span>
          <span style={{ display: 'block' }}>{']'}</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>|</span>
          <span style={{ display: 'block' }}>\</span>
        </KBtn>
      </div>

      {/* ── Row 4 — ASDF ────────────────────────────────────────────── */}
      <div style={ROW}>
        <KBtn
          style={{
            width: '2.8rem',
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            paddingBottom: 2,
            paddingLeft: 4,
          }}
          childStyle={CHILD_L}
        >
          caps lock
        </KBtn>
        {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((k) => (
          <KBtn key={k}>
            <span style={{ display: 'block' }}>{k}</span>
          </KBtn>
        ))}
        <KBtn>
          <span style={{ display: 'block' }}>:</span>
          <span style={{ display: 'block' }}>;</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>"</span>
          <span style={{ display: 'block' }}>'</span>
        </KBtn>
        <KBtn
          style={{
            width: '2.85rem',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            paddingBottom: 2,
            paddingRight: 4,
          }}
          childStyle={CHILD_R}
        >
          return
        </KBtn>
      </div>

      {/* ── Row 5 — ZXCV ────────────────────────────────────────────── */}
      <div style={ROW}>
        <KBtn
          style={{
            width: '3.65rem',
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            paddingBottom: 2,
            paddingLeft: 4,
          }}
          childStyle={CHILD_L}
        >
          shift
        </KBtn>
        {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map((k) => (
          <KBtn key={k}>
            <span style={{ display: 'block' }}>{k}</span>
          </KBtn>
        ))}
        <KBtn>
          <span style={{ display: 'block' }}>{'<'}</span>
          <span style={{ display: 'block' }}>{','}</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>{'>'}</span>
          <span style={{ display: 'block' }}>{'.'}</span>
        </KBtn>
        <KBtn>
          <span style={{ display: 'block' }}>{'?'}</span>
          <span style={{ display: 'block' }}>{'/'}</span>
        </KBtn>
        <KBtn
          style={{
            width: '3.65rem',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            paddingBottom: 2,
            paddingRight: 4,
          }}
          childStyle={CHILD_R}
        >
          shift
        </KBtn>
      </div>

      {/* ── Row 6 — Bottom ──────────────────────────────────────────── */}
      <div style={{ ...ROW, marginBottom: 0 }}>
        <KBtn style={MOD_L} childStyle={CHILD_L}>
          <div
            style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', paddingRight: 4 }}
          >
            <span>fn</span>
          </div>
          <div
            style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', paddingLeft: 4 }}
          >
            <IconWorld style={ICO} />
          </div>
        </KBtn>
        <KBtn style={MOD_L} childStyle={CHILD_L}>
          <div
            style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', paddingRight: 4 }}
          >
            <IconChevronUp style={ICO} />
          </div>
          <div
            style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', paddingLeft: 4 }}
          >
            <span>control</span>
          </div>
        </KBtn>
        <KBtn style={MOD_L} childStyle={CHILD_L}>
          <div
            style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', paddingRight: 4 }}
          >
            <OptionKey />
          </div>
          <div
            style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', paddingLeft: 4 }}
          >
            <span>option</span>
          </div>
        </KBtn>
        <KBtn
          style={{
            width: 32,
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            paddingBottom: 2,
            paddingLeft: 4,
          }}
          childStyle={CHILD_L}
        >
          <div
            style={{ display: 'flex', width: '100%', justifyContent: 'flex-end', paddingRight: 4 }}
          >
            <IconCommand style={ICO} />
          </div>
          <div
            style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', paddingLeft: 4 }}
          >
            <span>command</span>
          </div>
        </KBtn>
        {/* Space bar */}
        <KBtn style={{ width: '8.2rem' }} />
        <KBtn
          style={{
            width: 32,
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            paddingBottom: 2,
            paddingLeft: 4,
          }}
          childStyle={CHILD_L}
        >
          <div
            style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', paddingLeft: 4 }}
          >
            <IconCommand style={ICO} />
          </div>
          <div
            style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', paddingLeft: 4 }}
          >
            <span>command</span>
          </div>
        </KBtn>
        <KBtn
          style={{
            width: 40,
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
            paddingBottom: 2,
            paddingLeft: 4,
          }}
          childStyle={CHILD_L}
        >
          <div
            style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', paddingLeft: 4 }}
          >
            <OptionKey />
          </div>
          <div
            style={{ display: 'flex', width: '100%', justifyContent: 'flex-start', paddingLeft: 4 }}
          >
            <span>option</span>
          </div>
        </KBtn>
        {/* Arrow cluster */}
        <div
          style={{
            marginTop: 2,
            display: 'flex',
            height: 24,
            width: '4.9rem',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            borderRadius: 4,
            padding: 0.5,
          }}
        >
          <KBtn
            style={{ height: 12, width: 24 }}
            childStyle={{ height: '100%', justifyContent: 'center' }}
          >
            <IconCaretUpFilled style={ICO} />
          </KBtn>
          <div style={{ display: 'flex' }}>
            <KBtn
              style={{ height: 12, width: 24 }}
              childStyle={{ height: '100%', justifyContent: 'center' }}
            >
              <IconCaretLeftFilled style={ICO} />
            </KBtn>
            <KBtn
              style={{ height: 12, width: 24 }}
              childStyle={{ height: '100%', justifyContent: 'center' }}
            >
              <IconCaretDownFilled style={ICO} />
            </KBtn>
            <KBtn
              style={{ height: 12, width: 24 }}
              childStyle={{ height: '100%', justifyContent: 'center' }}
            >
              <IconCaretRightFilled style={ICO} />
            </KBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

function Lid({ scaleX, scaleY, rotate, translate, children }) {
  return (
    <div style={{ position: 'relative', perspective: '800px' }}>
      {/* Static closed lid — back face shown before scroll */}
      <div
        style={{
          transform: 'perspective(800px) rotateX(-25deg) translateZ(0px)',
          position: 'relative',
          height: 192 /* h-[12rem] */,
          width: 512 /* w-[32rem] */,
          borderRadius: 16,
          background: '#010101',
          padding: 8,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            background: '#010101',
          }}
        >
          {/* Sonar radar mark */}
          <svg width="30" height="30" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.55 }}>
            <circle cx="8" cy="8" r="7" stroke="white" strokeWidth="0.7" />
            <circle cx="8" cy="8" r="4" stroke="white" strokeWidth="0.7" />
            <circle cx="8" cy="8" r="1.4" fill="white" />
            <line
              x1="9.1"
              y1="6.9"
              x2="13"
              y2="3"
              stroke="white"
              strokeWidth="0.7"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Animated lid — expands, flattens, and translates down on scroll */}
      <motion.div
        style={{
          scaleX,
          scaleY,
          rotateX: rotate,
          translateY: translate,
          transformStyle: 'preserve-3d',
          transformOrigin: 'top',
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          height: 384 /* h-96 */,
          width: 512 /* w-[32rem] */,
          borderRadius: 16,
          background: '#010101',
          padding: 8,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius: 8,
            background: '#272729',
          }}
        />
        {/* Screen */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            bottom: 8,
            left: 8,
            overflow: 'hidden',
            borderRadius: 6,
            background: '#f5f5f7',
          }}
        >
          {children}
        </div>
      </motion.div>
    </div>
  )
}

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

  // Exact Aceternity animation values
  const scaleX = useTransform(scrollYProgress, [0, 0.3], [1.2, isMobile ? 1 : 1.5])
  const scaleY = useTransform(scrollYProgress, [0, 0.3], [0.6, isMobile ? 1 : 1.5])
  const translate = useTransform(scrollYProgress, [0, 1], [0, 1500])
  const rotate = useTransform(scrollYProgress, [0.1, 0.12, 0.3], [-28, -28, 0])
  const textTranslateY = useTransform(scrollYProgress, [0, 0.3], [0, 100])
  const textOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])

  return (
    // White background wrapper — exact Aceternity demo bg-white
    <div style={{ width: '100%', overflow: 'hidden', background: 'white' }}>
      <div
        ref={ref}
        style={{
          display: 'flex',
          minHeight: '200vh',
          flexShrink: 0,
          transform: isMobile ? 'scale(0.35)' : 'scale(1)',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: isMobile ? 0 : 320 /* md:py-80 = 20rem = 320px */,
          paddingBottom: isMobile ? 0 : 320,
          perspective: '800px',
        }}
      >
        {title && (
          <motion.h2
            style={{
              translateY: textTranslateY,
              opacity: textOpacity,
              marginBottom: 80,
              textAlign: 'center',
              fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
              fontSize: 'clamp(36px, 4vw, 60px)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
              lineHeight: 1.0,
              color: '#0a0a0a',
            }}
          >
            {title}
          </motion.h2>
        )}

        <Lid scaleX={scaleX} scaleY={scaleY} rotate={rotate} translate={translate}>
          {children}
        </Lid>

        {/* Keyboard base — z-index:-10 keeps it behind the animated lid */}
        <div
          style={{
            position: 'relative',
            zIndex: -10,
            height: 352 /* h-[22rem] */,
            width: 512 /* w-[32rem] */,
            overflow: 'hidden',
            borderRadius: 16,
            background: '#272729',
          }}
        >
          {/* Hinge groove */}
          <div style={{ position: 'relative', height: 40, width: '100%' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                marginLeft: 'auto',
                marginRight: 'auto',
                height: 16,
                width: '80%',
                background: '#050505',
              }}
            />
          </div>
          {/* Speakers + Keypad + Speakers */}
          <div style={{ position: 'relative', display: 'flex' }}>
            <div
              style={{
                marginLeft: 'auto',
                marginRight: 'auto',
                height: '100%',
                width: '10%',
                overflow: 'hidden',
              }}
            >
              <SpeakerGrid />
            </div>
            <div style={{ marginLeft: 'auto', marginRight: 'auto', height: '100%', width: '80%' }}>
              <Keypad />
            </div>
            <div
              style={{
                marginLeft: 'auto',
                marginRight: 'auto',
                height: '100%',
                width: '10%',
                overflow: 'hidden',
              }}
            >
              <SpeakerGrid />
            </div>
          </div>
          <Trackpad />
          {/* Bottom chin */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              marginLeft: 'auto',
              marginRight: 'auto',
              height: 8,
              width: 80,
              borderRadius: '12px 12px 0 0',
              background: 'linear-gradient(to top, #272729, #050505)',
            }}
          />
        </div>
      </div>
    </div>
  )
}
