import { Link } from 'react-router-dom'

const BG   = '#f0eeea'
const INK  = '#111111'
const MID  = '#888888'
const LINE = '#d0cdc8'
const YLW  = '#e8f400'   // amber-yellow accent section
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif"

const navLink = {
  fontFamily: FONT, fontSize: 11, fontWeight: 500,
  letterSpacing: '0.08em', color: INK,
  textDecoration: 'none', textTransform: 'uppercase',
  transition: 'opacity 0.15s',
}

export default function Landing() {
  return (
    <div style={{ background: BG, color: INK, fontFamily: FONT, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: BG,
        borderBottom: `1px solid ${LINE}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 48,
      }}>
        <Link to="/" style={{ ...navLink, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textDecoration: 'none', color: INK }}>
          SONAR©
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {[['Features', '#features'], ['Plans', '#plans']].map(([label, href]) => (
            <a key={label} href={href} style={navLink}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.4'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >{label}</a>
          ))}
          <Link to="/login" style={navLink}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.4'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >Sign in</Link>
          <Link to="/signup" style={{
            ...navLink, fontSize: 11,
            background: INK, color: BG,
            padding: '7px 16px', borderRadius: 4,
            letterSpacing: '0.06em',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >Get started</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ borderBottom: `1px solid ${LINE}`, padding: '40px 24px 48px' }}>
        <h1 style={{
          fontFamily: FONT,
          fontSize: 'clamp(56px, 10.5vw, 148px)',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: 0.95,
          color: INK,
          margin: 0,
          textTransform: 'none',
        }}>
          Find the signal<br />in your market.
        </h1>
      </section>

      {/* ── WHAT IS SONAR ── */}
      <section style={{ borderBottom: `1px solid ${LINE}` }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${LINE}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 11, color: MID, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>① What is Sonar</span>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 0,
        }}>
          <div style={{ padding: '40px 24px', borderRight: `1px solid ${LINE}` }}>
            <p style={{ fontSize: 'clamp(18px, 2.2vw, 28px)', fontWeight: 500, lineHeight: 1.35, letterSpacing: '-0.02em', color: INK, margin: 0 }}>
              A non-agency tool for founders, sales teams, and growth operators focusing on B2B signal intelligence — from first signal to closed deal.
            </p>
          </div>
          <div style={{ padding: '40px 24px' }}>
            <p style={{ fontSize: 14, color: MID, lineHeight: 1.75, margin: '0 0 24px' }}>
              Independent in thinking, but seamlessly built around your ICP. Sonar discovers companies, enriches every data point, and scores them automatically.
            </p>
            <p style={{ fontSize: 14, color: MID, lineHeight: 1.75, margin: 0 }}>
              Radically signal-oriented — always with a clear view of which accounts deserve your attention most.
            </p>
            <div style={{ marginTop: 32 }}>
              <Link to="/signup" style={{
                fontFamily: FONT, fontSize: 11, fontWeight: 700,
                color: INK, textDecoration: 'underline',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>Start free →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${LINE}`,
        }}>
          <span style={{ fontSize: 11, color: MID, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>② Our features</span>
        </div>

        {[
          { label: 'A', name: 'DISCOVER', desc: 'Search 50M+ companies by industry, location, size, and tech stack. Surface targets that match your ICP in seconds.' },
          { label: 'B', name: 'ENRICH',   desc: 'AI reads websites, LinkedIn, and Maps to fill every data gap — headcount, tech, decision-makers, contact info.' },
          { label: 'C', name: 'TARGET',   desc: 'Define your ideal customer profile, score every company against it, and let Sonar surface the best fits first.' },
          { label: 'D', name: 'MANAGE',   desc: 'Track leads, log activity, and manage your pipeline without switching tools. Everything in one place.' },
        ].map(({ label, name, desc }) => (
          <div key={name} style={{
            display: 'grid', gridTemplateColumns: '56px 1fr 1fr',
            borderBottom: `1px solid ${LINE}`,
            minHeight: 96,
          }}>
            <div style={{
              padding: '20px 0 20px 24px',
              borderRight: `1px solid ${LINE}`,
              display: 'flex', alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 12, color: MID, fontWeight: 500, letterSpacing: '0.06em' }}>{label})</span>
            </div>
            <div style={{
              padding: '20px 24px',
              borderRight: `1px solid ${LINE}`,
              display: 'flex', alignItems: 'center',
            }}>
              <span style={{
                fontFamily: FONT,
                fontSize: 'clamp(32px, 5.5vw, 80px)',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                color: INK,
              }}>{name}</span>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center' }}>
              <p style={{ fontSize: 13, color: MID, lineHeight: 1.7, margin: 0, maxWidth: 360 }}>{desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ── PLANS ── */}
      <section id="plans" style={{ background: YLW, borderBottom: `1px solid ${LINE}` }}>
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid rgba(0,0,0,0.12)`,
        }}>
          <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>③ Plans</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {/* Solo */}
          <div style={{ padding: '40px 32px', borderRight: `1px solid rgba(0,0,0,0.12)` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: INK }}>Solo</span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Free</span>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.55)', lineHeight: 1.65, marginBottom: 28, maxWidth: 280 }}>
              Everything to build your own pipeline and prospect independently.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Company discovery', 'AI enrichment', 'Lead management', 'ICP targeting'].map(f => (
                <li key={f} style={{ fontSize: 13, color: 'rgba(0,0,0,0.55)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'rgba(0,0,0,0.3)' }}>—</span>{f}
                </li>
              ))}
            </ul>
            <Link to="/signup" style={{
              display: 'inline-block',
              fontFamily: FONT, fontSize: 11, fontWeight: 700,
              color: INK, textDecoration: 'none',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              border: `1px solid rgba(0,0,0,0.3)`,
              padding: '10px 20px', borderRadius: 4,
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >Get started →</Link>
          </div>

          {/* Team */}
          <div style={{ padding: '40px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: INK }}>Team</span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>Custom</span>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.55)', lineHeight: 1.65, marginBottom: 28, maxWidth: 280 }}>
              Collaborate, manage access, and scale your outreach together.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Everything in Solo', 'Invite members', 'Role-based access', 'Admin controls'].map(f => (
                <li key={f} style={{ fontSize: 13, color: 'rgba(0,0,0,0.55)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'rgba(0,0,0,0.3)' }}>—</span>{f}
                </li>
              ))}
            </ul>
            <Link to="/signup" style={{
              display: 'inline-block',
              fontFamily: FONT, fontSize: 11, fontWeight: 700,
              color: BG, textDecoration: 'none',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              background: INK,
              padding: '10px 20px', borderRadius: 4,
              transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >Get started →</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: INK }}>SONAR©</span>
        <div style={{ display: 'flex', gap: 24 }}>
          {[['Privacy', '/privacy'], ['Terms', '/terms']].map(([l, h]) => (
            <Link key={l} to={h} style={{ fontSize: 11, color: MID, textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = INK}
              onMouseLeave={e => e.currentTarget.style.color = MID}
            >{l}</Link>
          ))}
        </div>
        <span style={{ fontSize: 11, color: MID, letterSpacing: '0.04em' }}>© 2026</span>
      </footer>

    </div>
  )
}
