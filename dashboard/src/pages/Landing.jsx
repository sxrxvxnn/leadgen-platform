import { Link } from 'react-router-dom'
import './Landing.css'

export default function Landing() {
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
          <Link to="/signup" className="lp-btn">Get started free</Link>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-grid">

            {/* Left: copy */}
            <div>
              <div className="lp-hero-eyebrow">
                <span className="lp-pill">B2B Lead Intelligence</span>
              </div>
              <h1>Find the lead<br />before your<br />competitor does.</h1>
              <p className="lp-hero-sub">
                Sonar discovers B2B companies, enriches every data point with AI — website, LinkedIn, headcount, contacts — and scores them against your ICP. From first search to outreach-ready lead, in one platform.
              </p>
              <div className="lp-hero-ctas">
                <Link to="/signup" className="lp-btn">Start for free</Link>
                <a href="#how-it-works" className="lp-btn-ghost">See how it works</a>
              </div>
            </div>

            {/* Right: enrichment pipeline mock */}
            <div className="lp-signal-feed" role="img" aria-label="Lead enrichment pipeline preview">
              <div className="lp-sf-header">
                <span className="lp-sf-title">Enrichment pipeline</span>
                <span className="lp-sf-status">
                  <span className="lp-status-dot"></span>
                  live
                </span>
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
                <span className="lp-sf-foot-cta">View pipeline →</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── BUILT FOR ─────────────────────────────────────────────────────── */}
      <div className="lp-logo-strip">
        <div className="lp-logo-strip-inner">
          <span className="lp-strip-label">Built for</span>
          <div className="lp-strip-divider"></div>
          <div className="lp-logo-names">
            <span className="lp-logo-name">Founders</span>
            <span className="lp-logo-name">Sales teams</span>
            <span className="lp-logo-name">Growth operators</span>
            <span className="lp-logo-name">Solo closers</span>
            <span className="lp-logo-name">B2B agencies</span>
            <span className="lp-logo-name">SDR teams</span>
          </div>
        </div>
      </div>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" style={{ background: 'var(--color-parchment)' }}>
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-pill">Features</span>
            <h2>From search<br />to outreach-ready.</h2>
          </div>
          <div className="lp-features-grid">

            <div className="lp-feature-card">
              <svg className="lp-feature-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <circle cx="18" cy="18" r="12" stroke="currentColor" strokeWidth="1.5"/>
                <line x1="27" y1="27" x2="36" y2="36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="14" y1="18" x2="22" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="18" y1="14" x2="18" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <h3>Company Discovery</h3>
              <p className="lp-feature-body">Search millions of B2B companies by industry, location, size, and keyword. Filter by sector — SaaS, Fintech, Healthtech, Cybersecurity and more — and add matching targets straight to your pipeline.</p>
              <Link to="/signup" className="lp-feature-link">Start discovering <span>→</span></Link>
            </div>

            <div className="lp-feature-card">
              <svg className="lp-feature-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <rect x="4" y="8" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M4 14h32" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="20" cy="26" r="4" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M17 26h-4M27 26h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <h3>AI Enrichment</h3>
              <p className="lp-feature-body">Our AI reads company websites, LinkedIn pages, and Google Maps to fill every blank — description, headcount, industry classification, tech stack signals, and decision-maker profiles. One click, complete record.</p>
              <Link to="/signup" className="lp-feature-link">See enrichment <span>→</span></Link>
            </div>

            <div className="lp-feature-card">
              <svg className="lp-feature-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="1.5" opacity="0.25"/>
                <circle cx="20" cy="20" r="9"  stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
                <circle cx="20" cy="20" r="3.5" fill="currentColor"/>
                <line x1="22.5" y1="17.5" x2="30" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <h3>ICP Scoring</h3>
              <p className="lp-feature-body">Define your ideal customer profile once — industry, company size, location, and custom criteria. Sonar automatically scores every company in your pipeline so you always work the highest-fit accounts first.</p>
              <Link to="/signup" className="lp-feature-link">Build your ICP <span>→</span></Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ background: 'var(--color-bone-mist)' }}>
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-pill">How it works</span>
            <h2>Set up in minutes.<br />Pipeline by end of day.</h2>
          </div>
          <div className="lp-steps-track">

            <div className="lp-step">
              <div className="lp-step-num-wrap"><div className="lp-step-number">01</div></div>
              <div className="lp-step-title">Build your ICP</div>
              <p className="lp-step-body">Define your ideal customer — industry, company size, location, and role keywords. Sonar uses this to score every company it finds.</p>
            </div>

            <div className="lp-connector-col"><div className="lp-connector-line"></div></div>

            <div className="lp-step">
              <div className="lp-step-num-wrap"><div className="lp-step-number">02</div></div>
              <div className="lp-step-title">Discover and enrich</div>
              <p className="lp-step-body">Search the company directory or use the Maps explorer. Add targets to your pipeline, then let AI fill in website data, LinkedIn profiles, and verified contact emails automatically.</p>
            </div>

            <div className="lp-connector-col"><div className="lp-connector-line"></div></div>

            <div className="lp-step">
              <div className="lp-step-num-wrap"><div className="lp-step-number">03</div></div>
              <div className="lp-step-title">Reach out and close</div>
              <p className="lp-step-body">Your leads arrive with verified emails, LinkedIn profiles, job titles, and ICP scores. Export a clean list or open LinkedIn profiles in batch — ready to reach out immediately.</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── CHROME EXTENSION ──────────────────────────────────────────────── */}
      <section id="extension" style={{ background: 'var(--color-parchment)', borderTop: '1px solid var(--color-fog-border)' }}>
        <div className="lp-container">
          <div className="lp-ext-grid">
            <div className="lp-ext-copy">
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
                <a href="/sonar-extension.zip" download className="lp-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  Download extension
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M7 1v8M3.5 6l3.5 3.5L10.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 11h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </a>
                <ol className="lp-ext-steps">
                  <li><span className="lp-ext-step-num">1</span>Download and <strong>unzip</strong> the file</li>
                  <li><span className="lp-ext-step-num">2</span>Open <code>chrome://extensions</code> in Chrome</li>
                  <li><span className="lp-ext-step-num">3</span>Toggle on <strong>Developer mode</strong> (top right)</li>
                  <li><span className="lp-ext-step-num">4</span>Click <strong>Load unpacked</strong> → select the unzipped folder</li>
                  <li><span className="lp-ext-step-num">5</span>Pin Sonar to your toolbar and sign in</li>
                </ol>
              </div>
            </div>
            <div className="lp-ext-preview">
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
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT WE FIND ──────────────────────────────────────────────────── */}
      <section id="what-we-find" style={{ background: 'var(--color-parchment)' }}>
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-pill">Data intelligence</span>
            <h2>Every data point<br />your team needs.</h2>
          </div>
          <div className="lp-signals-grid">
            {[
              { emoji: '🌐', label: 'Website Intelligence',    desc: 'AI reads company websites to extract descriptions, industry signals, and tech stack clues — no manual research.' },
              { emoji: '👤', label: 'LinkedIn Enrichment',     desc: 'Pull company LinkedIn pages, decision-maker profiles, headcount, and job titles into every record automatically.' },
              { emoji: '📧', label: 'Verified Email Finder',   desc: 'Hunter.io integration finds and verifies professional email addresses for every contact you want to reach.' },
              { emoji: '📍', label: 'Maps Intelligence',       desc: 'Discover local and regional businesses via Google Maps and enrich their details — ideal for territory-based sales.' },
              { emoji: '🎯', label: 'ICP Score',               desc: 'Every company gets an automatic fit score against your saved ICP criteria so your best-fit accounts rise to the top.' },
              { emoji: '🏭', label: 'Industry Classification', desc: 'AI classifies every company into the right sector — SaaS, Fintech, Healthtech, Cybersecurity, and more — on enrichment.' },
            ].map(({ emoji, label, desc }) => (
              <div key={label} className="lp-signal-tile">
                <span className="lp-tile-emoji">{emoji}</span>
                <div>
                  <div className="lp-tile-label">{label}</div>
                  <div className="lp-tile-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ background: 'var(--color-bone-mist)' }}>
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-pill">Pricing</span>
            <h2>Start free.<br />Scale when you're ready.</h2>
          </div>
          <div className="lp-pricing-grid">

            <div className="lp-pricing-card">
              <div className="lp-pricing-tier">Solo</div>
              <div className="lp-pricing-price">Free</div>
              <div className="lp-pricing-period">forever, no card needed</div>
              <div className="lp-pricing-divider"></div>
              <ul className="lp-pricing-features">
                <li>Company discovery &amp; directory</li>
                <li>AI website enrichment</li>
                <li>LinkedIn enrichment</li>
                <li>ICP profile &amp; scoring</li>
                <li>Lead management</li>
                <li>Email finder (Hunter)</li>
                <li>CSV export</li>
              </ul>
              <Link to="/signup" className="lp-btn">Get started free</Link>
            </div>

            <div className="lp-pricing-card lp-pricing-card-featured">
              <span className="lp-recommended-badge">Most popular</span>
              <div className="lp-pricing-tier">Team</div>
              <div className="lp-pricing-price">Custom</div>
              <div className="lp-pricing-period">contact us for team pricing</div>
              <div className="lp-pricing-divider"></div>
              <ul className="lp-pricing-features">
                <li>Everything in Solo</li>
                <li>Invite team members</li>
                <li>Role-based access control</li>
                <li>Admin dashboard</li>
                <li>Shared pipeline &amp; leads</li>
                <li>Priority support</li>
              </ul>
              <a href="mailto:sonarleads@proton.me" className="lp-btn">Contact us</a>
            </div>

            <div className="lp-pricing-card">
              <div className="lp-pricing-tier">Enterprise</div>
              <div className="lp-pricing-price">Custom</div>
              <div className="lp-pricing-period">for larger sales orgs</div>
              <div className="lp-pricing-divider"></div>
              <ul className="lp-pricing-features">
                <li>Everything in Team</li>
                <li>Unlimited seats</li>
                <li>Custom ICP workflows</li>
                <li>Dedicated onboarding</li>
                <li>API access</li>
                <li>SLA &amp; dedicated support</li>
              </ul>
              <a href="mailto:sonarleads@proton.me" className="lp-btn">Talk to us</a>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span className="lp-footer-logo">Sonar</span>
          <div className="lp-footer-links">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <a href="mailto:sonarleads@proton.me">Contact</a>
          </div>
          <p className="lp-footer-fine">© 2026 Sonar. Built for founders who close.</p>
        </div>
      </footer>

    </div>
  )
}
