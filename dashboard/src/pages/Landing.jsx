import { Link } from 'react-router-dom'

const BG   = '#fffcfc'
const INK  = '#01011b'
const PLUM = '#31263b'
const MID  = '#717a94'
const LINE = '#dbd7da'
const SURF = '#ecedf2'
const ACC  = '#6f63b7'
const SANS = "'IBM Plex Sans', 'DM Sans', sans-serif"
const SERIF = "'Cormorant Garamond', Georgia, serif"

function NavLink({ href, children, to }) {
  const style = {
    fontFamily: SANS, fontSize: 14, fontWeight: 500,
    color: PLUM, textDecoration: 'none', transition: 'color 0.15s',
  }
  if (to) return (
    <Link to={to} style={style}
      onMouseEnter={e => e.currentTarget.style.color = INK}
      onMouseLeave={e => e.currentTarget.style.color = PLUM}
    >{children}</Link>
  )
  return (
    <a href={href} style={style}
      onMouseEnter={e => e.currentTarget.style.color = INK}
      onMouseLeave={e => e.currentTarget.style.color = PLUM}
    >{children}</a>
  )
}

function OutlineBtn({ to, children, dark }) {
  const base = {
    fontFamily: SANS, fontSize: 14, fontWeight: 500,
    padding: '9px 20px', borderRadius: 3,
    textDecoration: 'none', display: 'inline-block',
    transition: 'all 0.15s', cursor: 'pointer',
    border: `1px solid ${dark ? PLUM : LINE}`,
    background: dark ? PLUM : '#ffffff',
    color: dark ? BG : INK,
  }
  return (
    <Link to={to} style={base}
      onMouseEnter={e => {
        e.currentTarget.style.background = dark ? INK : PLUM
        e.currentTarget.style.color = BG
        e.currentTarget.style.borderColor = dark ? INK : PLUM
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = dark ? PLUM : '#ffffff'
        e.currentTarget.style.color = dark ? BG : INK
        e.currentTarget.style.borderColor = dark ? PLUM : LINE
      }}
    >{children}</Link>
  )
}

export default function Landing() {
  return (
    <div style={{ background: BG, color: INK, fontFamily: SANS, minHeight: '100vh' }}>

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: BG,
        borderBottom: `1px solid ${LINE}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 56,
      }}>
        <Link to="/" style={{ fontFamily: SANS, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: INK, textDecoration: 'none' }}>
          Sonar
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <NavLink href="#features">Features</NavLink>
          <NavLink href="#plans">Plans</NavLink>
          <NavLink to="/login">Sign in</NavLink>
          <OutlineBtn to="/signup" dark>Get started</OutlineBtn>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ borderBottom: `1px solid ${LINE}`, padding: '80px 40px 96px', maxWidth: 1200, margin: '0 auto' }}>
        <p style={{ fontFamily: SANS, fontSize: 12, fontWeight: 500, letterSpacing: '0.08em', color: MID, textTransform: 'uppercase', marginBottom: 40 }}>
          B2B signal intelligence
        </p>
        <h1 style={{ margin: 0, lineHeight: 1.05 }}>
          <span style={{
            display: 'block',
            fontFamily: SERIF,
            fontSize: 'clamp(52px, 8.5vw, 116px)',
            fontWeight: 300,
            fontStyle: 'italic',
            letterSpacing: '-0.03em',
            color: INK,
          }}>
            Find the signal
          </span>
          <span style={{
            display: 'block',
            fontFamily: SANS,
            fontSize: 'clamp(40px, 6.5vw, 88px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: PLUM,
          }}>
            in your market.
          </span>
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 16, color: MID, lineHeight: 1.7, maxWidth: 480, marginTop: 32, marginBottom: 40 }}>
          From first signal to closed deal — discover, enrich, score, and manage B2B prospects in one place.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <OutlineBtn to="/signup" dark>Start for free</OutlineBtn>
          <OutlineBtn to="/login">Sign in →</OutlineBtn>
        </div>
      </section>

      {/* ── WHAT IS SONAR ── */}
      <section style={{ borderBottom: `1px solid ${LINE}`, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ padding: '16px 40px', borderBottom: `1px solid ${LINE}` }}>
          <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '0.08em' }}>① What is Sonar</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          <div style={{ padding: '48px 40px', borderRight: `1px solid ${LINE}` }}>
            <p style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 2.5vw, 34px)', fontWeight: 300, fontStyle: 'italic', lineHeight: 1.4, letterSpacing: '-0.01em', color: INK }}>
              A non-agency tool for founders, sales teams, and growth operators focusing on B2B signal intelligence.
            </p>
          </div>
          <div style={{ padding: '48px 40px' }}>
            <p style={{ fontSize: 15, color: MID, lineHeight: 1.75, marginBottom: 20 }}>
              Independent in thinking, but seamlessly built around your ICP. Sonar discovers companies, enriches every data point, and scores them automatically.
            </p>
            <p style={{ fontSize: 15, color: MID, lineHeight: 1.75, marginBottom: 32 }}>
              Always with a clear view of which accounts deserve your attention most.
            </p>
            <OutlineBtn to="/signup">Start free →</OutlineBtn>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ borderBottom: `1px solid ${LINE}`, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ padding: '16px 40px', borderBottom: `1px solid ${LINE}` }}>
          <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '0.08em' }}>② Features</span>
        </div>

        {[
          { label: 'A', name: 'Discover', serif: 'Find the right companies', desc: 'Search 50M+ companies by industry, location, size, and tech stack. Surface targets that match your ICP in seconds.' },
          { label: 'B', name: 'Enrich',   serif: 'Fill every data gap', desc: 'AI reads websites, LinkedIn, and Maps to fill every detail — headcount, tech stack, decision-makers, contact info.' },
          { label: 'C', name: 'Target',   serif: 'Score and prioritise', desc: 'Define your ideal customer profile, score every company against it, and surface the best fits first.' },
          { label: 'D', name: 'Manage',   serif: 'One place for your pipeline', desc: 'Track leads, log activity, and manage your pipeline without switching tools.' },
        ].map(({ label, name, serif, desc }) => (
          <div key={name} style={{
            display: 'grid', gridTemplateColumns: '48px 1fr 1fr',
            borderBottom: `1px solid ${LINE}`,
          }}>
            <div style={{ padding: '24px 0 24px 40px', borderRight: `1px solid ${LINE}`, display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: MID }}>{label})</span>
            </div>
            <div style={{ padding: '24px 32px', borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: ACC, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{name}</span>
              <span style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3vw, 40px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.01em', color: INK, lineHeight: 1.15 }}>{serif}</span>
            </div>
            <div style={{ padding: '24px 32px', display: 'flex', alignItems: 'center' }}>
              <p style={{ fontSize: 14, color: MID, lineHeight: 1.7, margin: 0, maxWidth: 360 }}>{desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ── PLANS ── */}
      <section id="plans" style={{ background: SURF, borderBottom: `1px solid ${LINE}`, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ padding: '16px 40px', borderBottom: `1px solid ${LINE}` }}>
          <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: MID, textTransform: 'uppercase', letterSpacing: '0.08em' }}>③ Plans</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {/* Solo */}
          <div style={{ padding: '48px 40px', borderRight: `1px solid ${LINE}` }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: ACC, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Solo — Free</span>
            </div>
            <h3 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: INK, marginBottom: 16, lineHeight: 1 }}>
              For individual operators.
            </h3>
            <p style={{ fontSize: 14, color: MID, lineHeight: 1.65, marginBottom: 28 }}>
              Everything to build your own pipeline and prospect independently.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Company discovery', 'AI enrichment', 'Lead management', 'ICP targeting'].map(f => (
                <li key={f} style={{ fontSize: 14, color: MID, display: 'flex', gap: 10 }}>
                  <span style={{ color: ACC }}>—</span>{f}
                </li>
              ))}
            </ul>
            <OutlineBtn to="/signup">Get started</OutlineBtn>
          </div>

          {/* Team */}
          <div style={{ padding: '48px 40px' }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: ACC, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Team — Custom</span>
            </div>
            <h3 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 4vw, 52px)', fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: INK, marginBottom: 16, lineHeight: 1 }}>
              For sales teams.
            </h3>
            <p style={{ fontSize: 14, color: MID, lineHeight: 1.65, marginBottom: 28 }}>
              Collaborate, manage access, and scale your outreach together.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Everything in Solo', 'Invite members', 'Role-based access', 'Admin controls'].map(f => (
                <li key={f} style={{ fontSize: 14, color: MID, display: 'flex', gap: 10 }}>
                  <span style={{ color: ACC }}>—</span>{f}
                </li>
              ))}
            </ul>
            <OutlineBtn to="/signup" dark>Get started</OutlineBtn>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, maxWidth: 1200, margin: '0 auto' }}>
        <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: INK }}>Sonar</span>
        <div style={{ display: 'flex', gap: 24 }}>
          {[['Privacy', '/privacy'], ['Terms', '/terms']].map(([l, h]) => (
            <Link key={l} to={h} style={{ fontSize: 13, color: MID, textDecoration: 'none', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = INK}
              onMouseLeave={e => e.currentTarget.style.color = MID}
            >{l}</Link>
          ))}
        </div>
        <span style={{ fontSize: 13, color: MID }}>© 2026 Sonar</span>
      </footer>

    </div>
  )
}
