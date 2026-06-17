import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

// ── Radar animation ────────────────────────────────────────────
function RadarCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let angle = 0
    let raf

    const dots = Array.from({ length: 12 }, () => ({
      r: Math.random() * 110 + 20,
      a: Math.random() * Math.PI * 2,
      size: Math.random() * 2 + 1,
      alpha: 0,
    }))

    function draw() {
      const W = canvas.width, H = canvas.height
      const cx = W / 2, cy = H / 2
      ctx.clearRect(0, 0, W, H)

      // Rings
      ;[0.25, 0.5, 0.75, 1].forEach(f => {
        ctx.beginPath()
        ctx.arc(cx, cy, f * 140, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(168,100,72,0.12)'
        ctx.lineWidth = 1
        ctx.stroke()
      })

      // Cross hairs
      ctx.strokeStyle = 'rgba(168,100,72,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx, cy - 145); ctx.lineTo(cx, cy + 145); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx - 145, cy); ctx.lineTo(cx + 145, cy); ctx.stroke()

      // Sweep gradient
      const grad = ctx.createConicalGradient ? null : null
      // Sweep using arc fill
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)
      const sweep = ctx.createLinearGradient(0, 0, 140, 0)
      sweep.addColorStop(0, 'rgba(168,100,72,0.0)')
      sweep.addColorStop(1, 'rgba(168,100,72,0.18)')
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, 140, -0.6, 0)
      ctx.closePath()
      ctx.fillStyle = sweep
      ctx.fill()
      ctx.restore()

      // Sweep line
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(140, 0)
      ctx.strokeStyle = 'rgba(168,100,72,0.6)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()

      // Dots — light up when sweep passes
      dots.forEach(dot => {
        const dotAngle = dot.a % (Math.PI * 2)
        const sweepAngle = angle % (Math.PI * 2)
        const diff = (sweepAngle - dotAngle + Math.PI * 2) % (Math.PI * 2)
        if (diff < 0.15) dot.alpha = 1
        else dot.alpha = Math.max(0, dot.alpha - 0.012)

        if (dot.alpha > 0) {
          const x = cx + Math.cos(dot.a) * dot.r
          const y = cy + Math.sin(dot.a) * dot.r
          ctx.beginPath()
          ctx.arc(x, y, dot.size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(168,100,72,${dot.alpha})`
          ctx.fill()
        }
      })

      // Center dot
      ctx.beginPath()
      ctx.arc(cx, cy, 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(168,100,72,0.8)'
      ctx.fill()

      angle += 0.018
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <canvas ref={canvasRef} width={300} height={300}
      style={{ opacity: 0.85 }} />
  )
}

// ── Feature card ───────────────────────────────────────────────
function FeatureCard({ icon, title, desc }) {
  return (
    <div style={{
      padding: '28px', borderRadius: '12px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(8px)',
      transition: 'border-color 0.2s, background 0.2s',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(168,100,72,0.3)'
        e.currentTarget.style.background = 'rgba(168,100,72,0.04)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
      }}
    >
      <div style={{ fontSize: '22px', marginBottom: '14px' }}>{icon}</div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600', color: '#e7e7e7', marginBottom: '8px', letterSpacing: '0.02em' }}>{title}</p>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>{desc}</p>
    </div>
  )
}

// ── Plan card ──────────────────────────────────────────────────
function PlanCard({ label, badge, price, features, cta, accent }) {
  return (
    <div style={{
      flex: 1, padding: '36px 32px', borderRadius: '16px',
      background: accent ? 'rgba(168,100,72,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${accent ? 'rgba(168,100,72,0.35)' : 'rgba(255,255,255,0.08)'}`,
      display: 'flex', flexDirection: 'column', gap: '24px',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600', color: '#e7e7e7' }}>{label}</span>
          {badge && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: '600', color: '#a86448', background: 'rgba(168,100,72,0.12)', padding: '2px 8px', borderRadius: '3px', border: '1px solid rgba(168,100,72,0.25)' }}>{badge}</span>}
        </div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: '#fdfdfd', letterSpacing: '-0.04em' }}>{price}</p>
      </div>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {features.map(f => (
          <li key={f} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ color: '#a86448', fontSize: '12px', flexShrink: 0, marginTop: '1px' }}>—</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{f}</span>
          </li>
        ))}
      </ul>
      <Link to="/signup" style={{
        display: 'block', textAlign: 'center',
        padding: '12px', borderRadius: '8px',
        background: accent ? '#a86448' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${accent ? '#a86448' : 'rgba(255,255,255,0.12)'}`,
        fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600',
        color: accent ? '#fdfdfd' : 'rgba(255,255,255,0.7)',
        textDecoration: 'none', transition: 'opacity 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        {cta}
      </Link>
    </div>
  )
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  return (
    <div style={{ background: '#080808', minHeight: '100vh', color: '#fdfdfd' }}>

      {/* Nav */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? 'rgba(8,8,8,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'all 0.2s',
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 32px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RadarIcon />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: '600', color: '#fdfdfd', letterSpacing: '-0.02em' }}>sonar</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link to="/login" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', padding: '8px 14px', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fdfdfd'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
            >Sign in</Link>
            <Link to="/signup" style={{
              fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600',
              color: '#fdfdfd', textDecoration: 'none',
              padding: '8px 18px', borderRadius: '8px',
              background: '#a86448', border: '1px solid #a86448',
              transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >Get started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', paddingTop: '60px' }}>
        {/* Dot grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        }} />
        {/* Glow */}
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(168,100,72,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 32px', gap: '48px', maxWidth: '900px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '20px', border: '1px solid rgba(168,100,72,0.3)', background: 'rgba(168,100,72,0.06)', marginBottom: '32px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a86448', display: 'inline-block' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#a86448', letterSpacing: '0.08em' }}>B2B INTELLIGENCE PLATFORM</span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 8vw, 96px)', fontWeight: '400', letterSpacing: '-0.05em', lineHeight: 1, color: '#fdfdfd', marginBottom: '24px' }}>
              Find the signal<br />
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>in your market.</span>
            </h1>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'rgba(255,255,255,0.45)', maxWidth: '480px', margin: '0 auto', lineHeight: 1.8, letterSpacing: '0.01em' }}>
              Sonar maps your market, enriches company data, and surfaces the prospects most likely to convert — automatically.
            </p>
          </div>

          <RadarCanvas />

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/signup" style={{
              fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600',
              padding: '14px 32px', borderRadius: '10px',
              background: '#a86448', color: '#fdfdfd',
              textDecoration: 'none', border: '1px solid #a86448',
              transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >Start for free →</Link>
            <Link to="/login" style={{
              fontFamily: 'var(--font-mono)', fontSize: '13px',
              padding: '14px 32px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)',
              textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)',
              transition: 'color 0.15s, border-color 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fdfdfd'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
            >Sign in</Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '120px 32px' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', textAlign: 'center', marginBottom: '64px' }}>What Sonar does</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden' }}>
          {[
            { icon: '◎', title: 'Company Discovery', desc: 'Find companies in your target market using Google Maps, Technopark directories, and LinkedIn.' },
            { icon: '⬡', title: 'AI Enrichment', desc: 'Auto-fill websites, HQ, size, industry, compliance signals, and company type with one click.' },
            { icon: '◈', title: 'Lead Intelligence', desc: 'Identify decision makers, scrape LinkedIn contacts, and track outreach status per lead.' },
            { icon: '◐', title: 'ICP Targeting', desc: 'Define your ideal customer profile and score companies automatically against your criteria.' },
          ].map(f => (
            <div key={f.title} style={{ padding: '32px 28px', background: '#080808' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,100,72,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = '#080808'}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', color: '#a86448', marginBottom: '16px' }}>{f.icon}</div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '600', color: '#e7e7e7', marginBottom: '8px' }}>{f.title}</p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 32px 120px' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', textAlign: 'center', marginBottom: '16px' }}>Plans</p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: '400', letterSpacing: '-0.04em', color: '#fdfdfd', textAlign: 'center', marginBottom: '64px' }}>Built for solo and team.</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <PlanCard
            label="Solo"
            price="Free"
            features={[
              'Full company enrichment',
              'LinkedIn scraping',
              'AI website analysis',
              'Google Maps enrichment',
              'ICP targeting',
              'Lead management',
            ]}
            cta="Start solo →"
          />
          <PlanCard
            label="Team"
            badge="Coming soon"
            price="Custom"
            accent
            features={[
              'Everything in Solo',
              'Invite team members',
              'Admin controls',
              'Role-based access',
              'Shared pipeline',
              'Priority support',
            ]}
            cta="Get started →"
          />
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
          <RadarIcon />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.4)' }}>sonar</span>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>
          © 2026 Sonar · <a href="/privacy" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Privacy</a> · <a href="/terms" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>Terms</a>
        </p>
      </footer>
    </div>
  )
}

function RadarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="#a86448" strokeWidth="1.2" strokeOpacity="0.4" />
      <circle cx="10" cy="10" r="6" stroke="#a86448" strokeWidth="1.2" strokeOpacity="0.6" />
      <circle cx="10" cy="10" r="3" stroke="#a86448" strokeWidth="1.2" />
      <line x1="10" y1="10" x2="18" y2="10" stroke="#a86448" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="10" r="1.5" fill="#a86448" />
    </svg>
  )
}
