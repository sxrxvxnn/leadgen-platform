import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import './Landing.css'
import LegalModal from '../components/LegalModal'
import { FlipWords } from '../components/ui/FlipWords'
import { BackgroundBeams } from '../components/ui/BackgroundBeams'
import { TracingBeam } from '../components/ui/TracingBeam'
import { MovingBorderButton } from '../components/ui/MovingBorder'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay },
})

export default function Landing() {
  const [legal, setLegal] = useState(null)

  return (
    <div className="lp">

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-logo">Sonar</Link>
          <ul className="lp-nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How it works</a></li>
            <li><a href="#extension">Extension</a></li>
            <li><a href="#pricing">Pricing</a></li>
          </ul>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link to="/login" className="lp-btn-ghost">Sign in</Link>
            <Link to="/signup" className="lp-btn">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="lp-hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <BackgroundBeams style={{ zIndex: 0 }} />
        <div className="lp-container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="lp-hero-grid">

            {/* Left: copy */}
            <div>
              <motion.h1 {...fadeUp(0)}>
                <FlipWords
                  words={['Find the lead', 'Close the deal', 'Build the pipeline', 'Score the fit']}
                  duration={3200}
                />
                <br />before your<br />competitor does.
              </motion.h1>
              <motion.p className="lp-hero-sub" {...fadeUp(0.12)}>
                Sonar discovers B2B companies, enriches every data point with AI — website, LinkedIn, headcount, contacts — and scores them against your ICP. From first search to outreach-ready lead, in one platform.
              </motion.p>
              <motion.div className="lp-hero-ctas" {...fadeUp(0.22)}>
                <MovingBorderButton
                  as={Link}
                  to="/signup"
                  borderRadius="3px"
                  style={{ display: 'inline-block' }}
                  innerStyle={{
                    padding: '10px 20px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    fontSize: '14px',
                    color: 'var(--color-ink-violet)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Start for free
                </MovingBorderButton>
                <a href="#how-it-works" className="lp-btn-ghost">See how it works</a>
              </motion.div>
            </div>

            {/* Right: enrichment pipeline mock */}
            <motion.div
              className="lp-signal-feed"
              role="img"
              aria-label="Lead enrichment pipeline preview"
              {...fadeUp(0.18)}
            >
              <div className="lp-sf-header">
                <span className="lp-sf-title">Enrichment pipeline</span>
              </div>

              <div className="lp-signal-row">
                <div className="lp-signal-accent" style={{ background: 'var(--color-amethyst)' }}></div>
                <div className="lp-signal-main">
                  <span className="lp-signal-company">Beagle Security</span>
                  <span className="lp-signal-badge">ICP Match · Score 94</span>
                </div>
                <div className="lp-signal-right">
                  <div className="lp-strength-track"><div className="lp-strength-fill" style={{ width: '94%' }}></div></div>
                  <span className="lp-signal-time">just now</span>
                </div>
              </div>

              <div className="lp-signal-row">
                <div className="lp-signal-accent" style={{ background: 'var(--color-wisteria)' }}></div>
                <div className="lp-signal-main">
                  <span className="lp-signal-company">CloudOps Ltd</span>
                  <span className="lp-signal-badge">Email found · Hunter verified</span>
                </div>
                <div className="lp-signal-right">
                  <div className="lp-strength-track"><div className="lp-strength-fill" style={{ width: '78%' }}></div></div>
                  <span className="lp-signal-time">4m ago</span>
                </div>
              </div>

              <div className="lp-signal-row">
                <div className="lp-signal-accent" style={{ background: 'var(--color-twilight-plum)' }}></div>
                <div className="lp-signal-main">
                  <span className="lp-signal-company">ScaleAI Corp</span>
                  <span className="lp-signal-badge">LinkedIn enriched · 3 contacts</span>
                </div>
                <div className="lp-signal-right">
                  <div className="lp-strength-track"><div className="lp-strength-fill" style={{ width: '86%' }}></div></div>
                  <span className="lp-signal-time">11m ago</span>
                </div>
              </div>

              <div className="lp-sf-footer">
                <span className="lp-sf-foot-label">3 companies enriched · auto pipeline</span>
                <Link to="/companies" className="lp-sf-foot-cta">View pipeline →</Link>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── BUILT FOR ─────────────────────────────────────────────────────── */}
      <div className="lp-logo-strip">
        <div className="lp-logo-strip-inner">
          <span className="lp-strip-label">Built for</span>
          <div className="lp-strip-divider"></div>
          <div className="lp-logo-names">
            {['Founders', 'Sales teams', 'Growth operators', 'Solo closers', 'B2B agencies', 'SDR teams'].map((n, i) => (
              <motion.span
                key={n}
                className="lp-logo-name"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
              >{n}</motion.span>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" style={{ background: 'var(--color-parchment)' }}>
        <div className="lp-container">
          <motion.div className="lp-section-header" {...fadeUp()}>
            <span className="lp-pill">Features</span>
            <h2>From search<br />to outreach-ready.</h2>
          </motion.div>
          <div className="lp-features-grid">

            {[
              {
                icon: (
                  <svg className="lp-feature-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                    <circle cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="1.5"/>
                    <line x1="27" y1="27" x2="36" y2="36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="14" y1="18" x2="22" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="18" y1="14" x2="18" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                ),
                title: 'Company Discovery',
                body: 'Search millions of B2B companies by industry, location, size, and keyword. Filter by sector — SaaS, Fintech, Healthtech, Cybersecurity and more — and add matching targets straight to your pipeline.',
                link: 'Start discovering',
              },
              {
                icon: (
                  <svg className="lp-feature-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                    <rect x="4" y="8" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M4 14h32" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="20" cy="26" r="4" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M17 26h-4M27 26h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                ),
                title: 'AI Enrichment',
                body: 'Our AI reads company websites, LinkedIn pages, and Google Maps to fill every blank — description, headcount, industry classification, tech stack signals, and decision-maker profiles. One click, complete record.',
                link: 'See enrichment',
              },
              {
                icon: (
                  <svg className="lp-feature-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                    <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="1.5" opacity="0.25"/>
                    <circle cx="20" cy="20" r="9"  stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
                    <circle cx="20" cy="20" r="3.5" fill="currentColor"/>
                    <line x1="22.5" y1="17.5" x2="30" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                ),
                title: 'ICP Scoring',
                body: 'Define your ideal customer profile once — industry, company size, location, and custom criteria. Sonar automatically scores every company in your pipeline so you always work the highest-fit accounts first.',
                link: 'Build your ICP',
              },
            ].map(({ icon, title, body, link }, i) => (
              <motion.div
                key={title}
                className="lp-feature-card"
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                {icon}
                <h3>{title}</h3>
                <p className="lp-feature-body">{body}</p>
                <Link to="/signup" className="lp-feature-link">{link} <span>→</span></Link>
              </motion.div>
            ))}

          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ background: 'var(--color-bone-mist)' }}>
        <div className="lp-container">
          <motion.div className="lp-section-header" {...fadeUp()}>
            <span className="lp-pill">How it works</span>
            <h2>Set up in minutes.<br />Pipeline by end of day.</h2>
          </motion.div>
          <TracingBeam style={{ paddingLeft: 40 }}>
            <div className="lp-steps-track">

              <motion.div className="lp-step" {...fadeUp(0.05)}>
                <div className="lp-step-num-wrap"><div className="lp-step-number">01</div></div>
                <div className="lp-step-title">Build your ICP</div>
                <p className="lp-step-body">Define your ideal customer — industry, company size, location, and role keywords. Sonar uses this to score every company it finds.</p>
              </motion.div>

              <div className="lp-connector-col"><div className="lp-connector-line"></div></div>

              <motion.div className="lp-step" {...fadeUp(0.1)}>
                <div className="lp-step-num-wrap"><div className="lp-step-number">02</div></div>
                <div className="lp-step-title">Discover and enrich</div>
                <p className="lp-step-body">Search the company directory or use the Maps explorer. Add targets to your pipeline, then let AI fill in website data, LinkedIn profiles, and verified contact emails automatically.</p>
              </motion.div>

              <div className="lp-connector-col"><div className="lp-connector-line"></div></div>

              <motion.div className="lp-step" {...fadeUp(0.15)}>
                <div className="lp-step-num-wrap"><div className="lp-step-number">03</div></div>
                <div className="lp-step-title">Reach out and close</div>
                <p className="lp-step-body">Your leads arrive with verified emails, LinkedIn profiles, job titles, and ICP scores. Export a clean list or open LinkedIn profiles in batch — ready to reach out immediately.</p>
              </motion.div>

            </div>
          </TracingBeam>
        </div>
      </section>

      {/* ── CHROME EXTENSION ──────────────────────────────────────────────── */}
      <section id="extension" style={{ background: 'var(--color-parchment)', borderTop: '1px solid var(--color-fog-border)' }}>
        <div className="lp-container">
          <div className="lp-ext-grid">
            <motion.div className="lp-ext-copy" {...fadeUp()}>
              <span className="lp-pill" style={{ marginBottom: '20px', display: 'inline-flex' }}>Chrome extension</span>
              <h2 style={{ marginTop: '20px' }}>Extract leads<br />straight from<br />LinkedIn.</h2>
              <p className="lp-hero-sub" style={{ fontSize: '17px', marginTop: '24px', marginBottom: '36px' }}>
                Install the Sonar extension and pull people and companies from any LinkedIn page — profiles, company pages, search results, Sales Navigator — directly into your pipeline. No copy-paste, no CSV.
              </p>
              <ul className="lp-ext-features">
                <li><span className="lp-ext-dash">—</span>Extract from LinkedIn people search &amp; Sales Nav</li>
                <li><span className="lp-ext-dash">—</span>Scrape full profiles: bio, experience, job title</li>
                <li><span className="lp-ext-dash">—</span>Auto-scroll to load all results before extracting</li>
                <li><span className="lp-ext-dash">—</span>Works on company pages, people pages &amp; search</li>
                <li><span className="lp-ext-dash">—</span>One click — leads appear in your dashboard instantly</li>
              </ul>
              <div className="lp-ext-actions">
                <MovingBorderButton
                  as="a"
                  href="/sonar-extension.zip"
                  download
                  borderRadius="3px"
                  style={{ display: 'inline-block' }}
                  innerStyle={{
                    padding: '10px 20px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    fontSize: '14px',
                    color: 'var(--color-ink-violet)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Download extension
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M7 1v8M3.5 6l3.5 3.5L10.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 11h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </MovingBorderButton>
                <ol className="lp-ext-steps">
                  <li><span className="lp-ext-step-num">1</span>Download and <strong>unzip</strong> the file</li>
                  <li><span className="lp-ext-step-num">2</span>Open <code>chrome://extensions</code> in Chrome</li>
                  <li><span className="lp-ext-step-num">3</span>Toggle on <strong>Developer mode</strong> (top right)</li>
                  <li><span className="lp-ext-step-num">4</span>Click <strong>Load unpacked</strong> → select the unzipped folder</li>
                  <li><span className="lp-ext-step-num">5</span>Pin Sonar to your toolbar and sign in</li>
                </ol>
              </div>
            </motion.div>
            <motion.div className="lp-ext-preview" {...fadeUp(0.12)}>
              <div className="lp-ext-mock">
                <div className="lp-ext-mock-bar">
                  <div className="lp-ext-mock-logo">
                    <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
                      <circle cx="8" cy="8" r="7" stroke="#fffcfc" strokeWidth="1.2" opacity="0.3"/>
                      <circle cx="8" cy="8" r="4" stroke="#fffcfc" strokeWidth="1.2" opacity="0.65"/>
                      <circle cx="8" cy="8" r="1.5" fill="#fffcfc"/>
                      <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#fffcfc" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <span className="lp-ext-mock-brand">Sonar</span>
                  <span className="lp-ext-mock-dot"></span>
                </div>
                <div className="lp-ext-mock-body">
                  <div className="lp-ext-mock-strip">
                    <span className="lp-ext-mock-label">Leads synced</span>
                    <span className="lp-ext-mock-count">47</span>
                  </div>
                  <div className="lp-ext-mock-badge">
                    <span className="lp-ext-mock-badge-dot"></span>
                    <span className="lp-ext-mock-badge-text">PEOPLE PAGE — READY</span>
                  </div>
                  <button className="lp-ext-mock-btn-ghost">
                    <span>Auto-scroll to load all profiles</span>
                    <span>↓</span>
                  </button>
                  <button className="lp-ext-mock-btn">
                    <span>Extract leads from page</span>
                    <span>→</span>
                  </button>
                </div>
                <div className="lp-ext-mock-footer">
                  <span className="lp-ext-mock-link">Open dashboard →</span>
                  <span className="lp-ext-mock-link">Sign out</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── WHAT WE FIND ──────────────────────────────────────────────────── */}
      <section id="what-we-find" style={{ background: 'var(--color-parchment)' }}>
        <div className="lp-container">
          <motion.div className="lp-section-header" {...fadeUp()}>
            <span className="lp-pill">Data intelligence</span>
            <h2>Every data point<br />your team needs.</h2>
          </motion.div>
          <div className="lp-signals-grid">
            {[
              { emoji: '🌐', label: 'Website Intelligence',    desc: 'AI reads company websites to extract descriptions, industry signals, and tech stack clues — no manual research.' },
              { emoji: '👤', label: 'LinkedIn Enrichment',     desc: 'Pull company LinkedIn pages, decision-maker profiles, headcount, and job titles into every record automatically.' },
              { emoji: '📧', label: 'Verified Email Finder',   desc: 'Hunter.io integration finds and verifies professional email addresses for every contact you want to reach.' },
              { emoji: '📍', label: 'Maps Intelligence',       desc: 'Discover local and regional businesses via Google Maps and enrich their details — ideal for territory-based sales.' },
              { emoji: '🎯', label: 'ICP Score',               desc: 'Every company gets an automatic fit score against your saved ICP criteria so your best-fit accounts rise to the top.' },
              { emoji: '🏭', label: 'Industry Classification', desc: 'AI classifies every company into the right sector — SaaS, Fintech, Healthtech, Cybersecurity, and more — on enrichment.' },
            ].map(({ emoji, label, desc }, i) => (
              <motion.div
                key={label}
                className="lp-signal-tile"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 }}
              >
                <span className="lp-tile-emoji">{emoji}</span>
                <div>
                  <div className="lp-tile-label">{label}</div>
                  <div className="lp-tile-desc">{desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ background: 'var(--color-bone-mist)' }}>
        <div className="lp-container">
          <motion.div className="lp-section-header" {...fadeUp()}>
            <span className="lp-pill">Pricing</span>
            <h2>Start free.<br />Scale when you're ready.</h2>
          </motion.div>
          <div className="lp-pricing-grid">

            {[
              {
                tier: 'Solo', price: 'Free', period: 'forever, no card needed',
                features: ['Company discovery & directory', 'AI website enrichment', 'LinkedIn enrichment', 'ICP profile & scoring', 'Lead management', 'Email finder (Hunter)', 'CSV export'],
                cta: <Link to="/signup" className="lp-btn">Get started free</Link>,
                featured: false,
              },
              {
                tier: 'Team', price: 'Custom', period: 'contact us for team pricing',
                features: ['Everything in Solo', 'Invite team members', 'Role-based access control', 'Admin dashboard', 'Shared pipeline & leads', 'Priority support'],
                cta: <a href="mailto:sonarleads@proton.me" className="lp-btn">Contact us</a>,
                featured: true,
              },
              {
                tier: 'Enterprise', price: 'Custom', period: 'for larger sales orgs',
                features: ['Everything in Team', 'Unlimited seats', 'Custom ICP workflows', 'Dedicated onboarding', 'API access', 'SLA & dedicated support'],
                cta: <a href="mailto:sonarleads@proton.me" className="lp-btn">Talk to us</a>,
                featured: false,
              },
            ].map(({ tier, price, period, features, cta, featured }, i) => (
              <motion.div
                key={tier}
                className={`lp-pricing-card${featured ? ' lp-pricing-card-featured' : ''}`}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
              >
                {featured && <span className="lp-recommended-badge">Most popular</span>}
                <div className="lp-pricing-tier">{tier}</div>
                <div className="lp-pricing-price">{price}</div>
                <div className="lp-pricing-period">{period}</div>
                <div className="lp-pricing-divider"></div>
                <ul className="lp-pricing-features">
                  {features.map(f => <li key={f}>{f}</li>)}
                </ul>
                {cta}
              </motion.div>
            ))}

          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span className="lp-footer-logo">Sonar</span>
          <div className="lp-footer-links">
            <button onClick={() => setLegal('privacy')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Privacy</button>
            <button onClick={() => setLegal('terms')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Terms</button>
            <a href="mailto:sonarleads@proton.me">Contact</a>
          </div>
          <p className="lp-footer-fine">© 2026 Sonar. Built for founders who close.</p>
        </div>
      </footer>

      {legal && <LegalModal type={legal} onClose={() => setLegal(null)} />}

    </div>
  )
}
