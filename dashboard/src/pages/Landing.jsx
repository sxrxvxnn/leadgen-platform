import { Link } from 'react-router-dom'

// ── design tokens ──────────────────────────────────────────────────────────
const T = {
  bg:      '#0b0b0b',
  surface: '#111111',
  border:  'rgba(255,255,255,0.08)',
  text:    '#f0f0f0',
  muted:   '#7a7a7a',
  dim:     '#444444',
  accent:  '#c8784a',
  font:    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono:    "'SFMono-Regular', 'Consolas', 'Menlo', monospace",
}

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke={T.text} strokeWidth="1" strokeOpacity="0.25" />
        <circle cx="8" cy="8" r="4" stroke={T.text} strokeWidth="1" strokeOpacity="0.5" />
        <circle cx="8" cy="8" r="1.5" fill={T.text} />
      </svg>
      <span style={{ fontFamily: T.font, fontSize: 14, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>
        sonar
      </span>
    </div>
  )
}

const FEATURES = [
  {
    n: '01',
    title: 'Company Discovery',
    body: 'Search 50M+ companies by industry, location, size, and tech stack. Surface targets that match your ICP in seconds.',
  },
  {
    n: '02',
    title: 'AI Enrichment',
    body: 'Fill gaps in company and contact data automatically. AI reads websites, LinkedIn, and Maps to complete every field.',
  },
  {
    n: '03',
    title: 'Lead Intelligence',
    body: 'Track decision-makers, scrape contact details, and build outreach-ready lead lists without switching tools.',
  },
  {
    n: '04',
    title: 'ICP Targeting',
    body: 'Define your ideal customer profile, score every company against it, and let Sonar surface the best fits first.',
  },
]

export default function Landing() {
  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.text, fontFamily: T.font }}>

      {/* Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 52,
        borderBottom: `1px solid ${T.border}`,
        background: 'rgba(11,11,11,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/login" style={{
            fontFamily: T.font, fontSize: 13, fontWeight: 500,
            color: T.muted, textDecoration: 'none',
            padding: '7px 14px', borderRadius: 8,
            transition: 'color 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = T.text}
            onMouseLeave={e => e.currentTarget.style.color = T.muted}
          >
            Sign in
          </Link>
          <Link to="/signup" style={{
            fontFamily: T.font, fontSize: 13, fontWeight: 600,
            color: '#0b0b0b', background: T.text,
            textDecoration: 'none', padding: '7px 16px',
            borderRadius: 8, transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        paddingTop: 160, paddingBottom: 96,
        paddingLeft: 32, paddingRight: 32,
        maxWidth: 960, margin: '0 auto',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 12px', borderRadius: 100,
          border: `1px solid ${T.border}`,
          marginBottom: 40,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.accent, display: 'inline-block' }} />
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, letterSpacing: '0.06em' }}>
            B2B SIGNAL INTELLIGENCE
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(40px, 6.5vw, 80px)',
          fontWeight: 600,
          letterSpacing: '-0.04em',
          lineHeight: 1.05,
          color: T.text,
          margin: '0 0 24px',
          maxWidth: 760,
        }}>
          Find the signal<br />in your market.
        </h1>

        <p style={{
          fontSize: 18, color: T.muted, lineHeight: 1.65,
          maxWidth: 480, margin: '0 0 48px',
          fontWeight: 400,
        }}>
          Discover companies, enrich leads, and identify your ideal customers — automatically.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/signup" style={{
            fontFamily: T.font, fontSize: 14, fontWeight: 600,
            color: '#0b0b0b', background: T.text,
            textDecoration: 'none', padding: '12px 24px',
            borderRadius: 10, transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Get started free
          </Link>
          <Link to="/login" style={{
            fontFamily: T.font, fontSize: 14, fontWeight: 500,
            color: T.muted,
            textDecoration: 'none', padding: '12px 24px',
            border: `1px solid ${T.border}`,
            borderRadius: 10, transition: 'color 0.15s, border-color 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border }}
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Divider */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ height: 1, background: T.border }} />
      </div>

      {/* Features */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '80px 32px' }}>
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.dim, letterSpacing: '0.08em', marginBottom: 48, textTransform: 'uppercase' }}>
          What Sonar does
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 1,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          background: T.border,
        }}>
          {FEATURES.map((f) => (
            <div key={f.n} style={{
              padding: '32px 28px',
              background: T.surface,
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: T.dim, letterSpacing: '0.1em', display: 'block', marginBottom: 20 }}>
                {f.n}
              </span>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 10, letterSpacing: '-0.02em' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.7, margin: 0 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '0 32px 96px' }}>
        <div style={{ height: 1, background: T.border, marginBottom: 80 }} />
        <p style={{ fontFamily: T.mono, fontSize: 11, color: T.dim, letterSpacing: '0.08em', marginBottom: 48, textTransform: 'uppercase' }}>
          Plans
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>

          {/* Solo */}
          <div style={{
            padding: '36px 32px',
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            background: T.surface,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 600, color: T.text, letterSpacing: '-0.03em' }}>Solo</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>FREE</span>
            </div>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.65, marginBottom: 28 }}>
              Everything you need to build your own pipeline independently.
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32, padding: 0 }}>
              {['Company discovery', 'AI enrichment', 'Lead management', 'ICP targeting'].map(item => (
                <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: T.muted }}>
                  <span style={{ color: T.dim }}>—</span> {item}
                </li>
              ))}
            </ul>
            <Link to="/signup" style={{
              display: 'block', textAlign: 'center',
              fontFamily: T.font, fontSize: 13, fontWeight: 600,
              color: T.text, textDecoration: 'none',
              padding: '11px 0',
              border: `1px solid rgba(255,255,255,0.15)`,
              borderRadius: 8, transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
            >
              Get started
            </Link>
          </div>

          {/* Team */}
          <div style={{
            padding: '36px 32px',
            border: `1px solid rgba(200,120,74,0.3)`,
            borderRadius: 12,
            background: 'rgba(200,120,74,0.04)',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 20, right: 20,
              padding: '3px 10px', borderRadius: 100,
              border: `1px solid rgba(200,120,74,0.4)`,
              fontFamily: T.mono, fontSize: 10, color: T.accent, letterSpacing: '0.06em',
            }}>
              POPULAR
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 600, color: T.text, letterSpacing: '-0.03em' }}>Team</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>CUSTOM</span>
            </div>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.65, marginBottom: 28 }}>
              Collaborate, manage access, and scale your outreach as a team.
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32, padding: 0 }}>
              {['Everything in Solo', 'Invite members', 'Role-based access', 'Admin controls'].map(item => (
                <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: T.muted }}>
                  <span style={{ color: T.accent }}>—</span> {item}
                </li>
              ))}
            </ul>
            <Link to="/signup" style={{
              display: 'block', textAlign: 'center',
              fontFamily: T.font, fontSize: 13, fontWeight: 600,
              color: '#0b0b0b', background: T.accent,
              textDecoration: 'none', padding: '11px 0',
              borderRadius: 8, transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: `1px solid ${T.border}`,
        padding: '24px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16,
      }}>
        <Logo />
        <div style={{ display: 'flex', gap: 24 }}>
          {[['Privacy', '/privacy'], ['Terms', '/terms']].map(([label, href]) => (
            <Link key={label} to={href} style={{
              fontFamily: T.font, fontSize: 12, color: T.dim,
              textDecoration: 'none', transition: 'color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.color = T.muted}
              onMouseLeave={e => e.currentTarget.style.color = T.dim}
            >
              {label}
            </Link>
          ))}
        </div>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.dim }}>© 2026 Sonar</span>
      </footer>

    </div>
  )
}
