import { Link } from 'react-router-dom'
import './Landing.css'

export default function Landing() {
  return (
    <div className="lp">

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-logo">SonarLeads</Link>
          <ul className="lp-nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How it works</a></li>
            <li><a href="#signals">Signals</a></li>
            <li><a href="#pricing">Pricing</a></li>
          </ul>
          <Link to="/signup" className="lp-btn">Get early access</Link>
        </div>
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-grid">

            {/* Left: copy */}
            <div>
              <div className="lp-hero-eyebrow">
                <span className="lp-pill">B2B Signal Intelligence</span>
              </div>
              <h1>Find the deal<br />before it's<br />a deal.</h1>
              <p className="lp-hero-sub">
                SonarLeads surfaces buying signals across the web, turns them into prioritized leads, and guides your team from first intent to closed revenue — without an agency in the middle.
              </p>
              <div className="lp-hero-ctas">
                <Link to="/signup" className="lp-btn">Start for free</Link>
                <a href="#how-it-works" className="lp-btn-ghost">See how it works</a>
              </div>
            </div>

            {/* Right: mock signal feed */}
            <div className="lp-signal-feed" role="img" aria-label="Signal feed preview">
              <div className="lp-sf-header">
                <span className="lp-sf-title">Live signal feed</span>
                <span className="lp-sf-status">
                  <span className="lp-status-dot"></span>
                  monitoring
                </span>
              </div>

              <div className="lp-signal-row">
                <div className="lp-signal-accent" style={{ background: 'var(--color-amethyst)' }}></div>
                <div className="lp-signal-main">
                  <span className="lp-signal-company">Vercel Inc.</span>
                  <span className="lp-signal-badge">Funding Round · Series D</span>
                </div>
                <div className="lp-signal-right">
                  <div className="lp-strength-track"><div className="lp-strength-fill" style={{ width: '92%' }}></div></div>
                  <span className="lp-signal-time">2m ago</span>
                </div>
              </div>

              <div className="lp-signal-row">
                <div className="lp-signal-accent" style={{ background: 'var(--color-wisteria)' }}></div>
                <div className="lp-signal-main">
                  <span className="lp-signal-company">Linear App</span>
                  <span className="lp-signal-badge">Tech Stack Switch</span>
                </div>
                <div className="lp-signal-right">
                  <div className="lp-strength-track"><div className="lp-strength-fill" style={{ width: '76%' }}></div></div>
                  <span className="lp-signal-time">14m ago</span>
                </div>
              </div>

              <div className="lp-signal-row">
                <div className="lp-signal-accent" style={{ background: 'var(--color-twilight-plum)' }}></div>
                <div className="lp-signal-main">
                  <span className="lp-signal-company">Notion Labs</span>
                  <span className="lp-signal-badge">Growth Hiring · 12 roles</span>
                </div>
                <div className="lp-signal-right">
                  <div className="lp-strength-track"><div className="lp-strength-fill" style={{ width: '84%' }}></div></div>
                  <span className="lp-signal-time">31m ago</span>
                </div>
              </div>

              <div className="lp-sf-footer">
                <span className="lp-sf-foot-label">3 new signals · 24h window</span>
                <span className="lp-sf-foot-cta">View all →</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── LOGO STRIP ────────────────────────────────────────────────────── */}
      <div className="lp-logo-strip">
        <div className="lp-logo-strip-inner">
          <span className="lp-strip-label">Trusted by teams at</span>
          <div className="lp-strip-divider"></div>
          <div className="lp-logo-names">
            <span className="lp-logo-name">Intercom</span>
            <span className="lp-logo-name">Lattice</span>
            <span className="lp-logo-name">Deel</span>
            <span className="lp-logo-name">Rippling</span>
            <span className="lp-logo-name">Brex</span>
            <span className="lp-logo-name">Watershed</span>
          </div>
        </div>
      </div>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" style={{ background: 'var(--color-parchment)' }}>
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-pill">Features</span>
            <h2>From signal<br />to signed.</h2>
          </div>
          <div className="lp-features-grid">

            <div className="lp-feature-card">
              <svg className="lp-feature-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <circle cx="20" cy="20" r="17" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
                <circle cx="20" cy="20" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
                <circle cx="20" cy="20" r="3.5" fill="currentColor"/>
                <line x1="22.5" y1="17.5" x2="31" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <h3>Signal Detection</h3>
              <p className="lp-feature-body">Track job changes, funding rounds, tech stack switches, and 40+ intent signals across LinkedIn, G2, Crunchbase, and the open web.</p>
              <a href="#" className="lp-feature-link">Learn more <span>→</span></a>
            </div>

            <div className="lp-feature-card">
              <svg className="lp-feature-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <rect x="4"  y="24" width="8"  height="12" rx="1.5" fill="currentColor" opacity="0.25"/>
                <rect x="16" y="14" width="8"  height="22" rx="1.5" fill="currentColor" opacity="0.55"/>
                <rect x="28" y="4"  width="8"  height="32" rx="1.5" fill="currentColor"/>
                <path d="M8 20 L20 10 L32 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
              </svg>
              <h3>Lead Prioritization</h3>
              <p className="lp-feature-body">Every signal is scored and ranked by deal-fit. Your team works the hottest accounts first — automatically, not manually.</p>
              <a href="#" className="lp-feature-link">Learn more <span>→</span></a>
            </div>

            <div className="lp-feature-card">
              <svg className="lp-feature-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path d="M6 7h28a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H13l-7 7V9a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <line x1="13" y1="17" x2="27" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="13" y1="22" x2="21" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <h3>Outreach Sequencing</h3>
              <p className="lp-feature-body">Turn signals into personalized first lines and multi-step sequences. Send from your own inbox, not a shared pool.</p>
              <a href="#" className="lp-feature-link">Learn more <span>→</span></a>
            </div>

          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ background: 'var(--color-bone-mist)' }}>
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-pill">How it works</span>
            <h2>Set up in a morning.<br />Pipeline by afternoon.</h2>
          </div>
          <div className="lp-steps-track">

            <div className="lp-step">
              <div className="lp-step-num-wrap"><div className="lp-step-number">01</div></div>
              <div className="lp-step-title">Connect your ICP</div>
              <p className="lp-step-body">Define your ideal customer profile: industry, size, tech stack, growth signals. SonarLeads builds the target universe.</p>
            </div>

            <div className="lp-connector-col"><div className="lp-connector-line"></div></div>

            <div className="lp-step">
              <div className="lp-step-num-wrap"><div className="lp-step-number">02</div></div>
              <div className="lp-step-title">Signals come to you</div>
              <p className="lp-step-body">Our engine monitors 40+ data sources continuously. When an account shows intent, you're the first to know.</p>
            </div>

            <div className="lp-connector-col"><div className="lp-connector-line"></div></div>

            <div className="lp-step">
              <div className="lp-step-num-wrap"><div className="lp-step-number">03</div></div>
              <div className="lp-step-title">Close the deal</div>
              <p className="lp-step-body">Reach out with context-rich, personalized messaging. Track replies, book meetings, and move pipeline — all in one place.</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── SIGNAL TYPES ──────────────────────────────────────────────────── */}
      <section id="signals" style={{ background: 'var(--color-parchment)' }}>
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-pill">Signal intelligence</span>
            <h2>Every buying trigger,<br />captured.</h2>
          </div>
          <div className="lp-signals-grid">
            {[
              { emoji: '🔔', label: 'Job Changes',        desc: 'New decision-makers joining target accounts — the highest-intent moment to reach out.' },
              { emoji: '💰', label: 'Funding Rounds',     desc: 'Companies with fresh capital are actively building — and buying. Get there first.' },
              { emoji: '🛠', label: 'Tech Stack Switches', desc: 'When a team evaluates or adopts new tools, they\'re open to changing their entire stack.' },
              { emoji: '📈', label: 'Growth Hiring',      desc: 'Rapid headcount growth signals expansion, new budgets, and new use cases to solve.' },
              { emoji: '🌐', label: 'Web Intent',         desc: 'Track visits to competitor sites, pricing pages, and review sites like G2 and Capterra.' },
              { emoji: '⭐', label: 'Review Activity',    desc: 'Companies posting or reading reviews are actively in an evaluation cycle — timing is everything.' },
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
            <h2>Simple pricing for<br />serious pipelines.</h2>
          </div>
          <div className="lp-pricing-grid">

            <div className="lp-pricing-card">
              <div className="lp-pricing-tier">Starter</div>
              <div className="lp-pricing-price"><sup>$</sup>49</div>
              <div className="lp-pricing-period">per month</div>
              <div className="lp-pricing-divider"></div>
              <ul className="lp-pricing-features">
                <li>500 signals per month</li>
                <li>1 seat included</li>
                <li>CSV export</li>
                <li>Email support</li>
              </ul>
              <Link to="/signup" className="lp-btn">Get started</Link>
            </div>

            <div className="lp-pricing-card lp-pricing-card-featured">
              <span className="lp-recommended-badge">Recommended</span>
              <div className="lp-pricing-tier">Growth</div>
              <div className="lp-pricing-price"><sup>$</sup>149</div>
              <div className="lp-pricing-period">per month</div>
              <div className="lp-pricing-divider"></div>
              <ul className="lp-pricing-features">
                <li>2,500 signals per month</li>
                <li>5 seats included</li>
                <li>CRM sync</li>
                <li>Outreach sequences</li>
                <li>Priority support</li>
              </ul>
              <Link to="/signup" className="lp-btn">Get started</Link>
            </div>

            <div className="lp-pricing-card">
              <div className="lp-pricing-tier">Scale</div>
              <div className="lp-pricing-price"><sup>$</sup>399</div>
              <div className="lp-pricing-period">per month</div>
              <div className="lp-pricing-divider"></div>
              <ul className="lp-pricing-features">
                <li>Unlimited signals</li>
                <li>Unlimited seats</li>
                <li>Custom ICP builder</li>
                <li>Dedicated CSM</li>
                <li>API access</li>
              </ul>
              <Link to="/signup" className="lp-btn">Get started</Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <span className="lp-footer-logo">SonarLeads</span>
          <div className="lp-footer-links">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <a href="mailto:sonarleads@proton.me">Contact</a>
          </div>
          <p className="lp-footer-fine">© 2026 SonarLeads. Built for founders who close.</p>
        </div>
      </footer>

    </div>
  )
}
