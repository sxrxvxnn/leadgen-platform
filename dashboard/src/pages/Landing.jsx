import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import './Landing.css'
import LegalModal from '../components/LegalModal'
import { FlipWords } from '../components/ui/FlipWords'
import { BackgroundBeams } from '../components/ui/BackgroundBeams'
import { InfiniteMarquee } from '../components/ui/InfiniteMarquee'
import { CardSpotlight } from '../components/ui/CardSpotlight'
import { FloatingNavbar } from '../components/ui/FloatingNavbar'
import { AnimatedButton } from '../components/ui/AnimatedButton'
import Globe, { LANDING_MARKERS } from '../components/Globe'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-48px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay },
})

const TESTIMONIALS = [
  { quote: "Sonar cut our prospecting time by 70%. We went from 2 hours of manual research per lead to instant enriched records ready to reach out.", name: "Arjun Mehta", role: "Head of Sales, Beagle Security" },
  { quote: "The ICP scoring is what makes it different. Every morning I open Sonar and my best-fit leads are already ranked and ready.", name: "Priya Nair", role: "Founder, CloudOps Ltd" },
  { quote: "We used to miss SaaS companies in the 20–50 headcount range. Sonar finds them all and enriches them automatically.", name: "Liam Chen", role: "SDR Lead, Stackify" },
  { quote: "Installing the Chrome extension took 2 minutes. I pulled 80 qualified leads from LinkedIn in my first session.", name: "Sarah Kim", role: "AE, ScaleAI Corp" },
  { quote: "Finally a tool that combines discovery, enrichment, and scoring in one place. No more juggling 4 different tools.", name: "Marcus Weber", role: "RevOps, InnovateTech" },
  { quote: "The Hunter integration is seamless — every company record comes with verified emails. Our cold email reply rate is up 3x.", name: "Deepika Rao", role: "GTM Lead, Finverse" },
]

const FAQ_ITEMS = [
  {
    q: "What is Sonar?",
    a: "Sonar is a B2B lead intelligence platform that helps sales teams discover companies, enrich every record with AI, score them against your ICP, and reach out — all in one place.",
  },
  {
    q: "How does AI enrichment work?",
    a: "Sonar's AI reads company websites, LinkedIn pages, and Google Maps to fill every data point: description, headcount, industry, tech stack signals, and decision-maker profiles. One click, complete record.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. The Solo plan is free forever with no credit card required. You get access to company discovery, AI enrichment, ICP scoring, and lead management from day one.",
  },
  {
    q: "How does the Chrome extension work?",
    a: "Install the Sonar extension, open any LinkedIn page — profiles, company pages, or search results — and click Extract. Leads land in your dashboard instantly with all enrichment data attached.",
  },
  {
    q: "What data sources does Sonar use?",
    a: "Sonar combines website AI analysis, LinkedIn company data (via your session cookie), Hunter.io for verified emails, Google Maps for location-based discovery, and Apollo.io for supplemental enrichment.",
  },
  {
    q: "Is my data secure?",
    a: "All data is stored in Supabase with Row Level Security — only you can access your records. All communication is encrypted over HTTPS. Your LinkedIn cookie is only sent to your own backend, never shared.",
  },
]

const FEATURE_TABS = [
  {
    id: 'discovery',
    label: 'Company Discovery',
    heading: 'Search millions of B2B companies.',
    body: 'Filter by industry, location, headcount, and keyword. Sector presets for SaaS, Fintech, Healthtech, Cybersecurity, and more. Add matching companies straight to your pipeline in one click.',
    visual: (
      <div className="lp-tab-visual">
        <div className="lp-tv-header"><span className="lp-tv-dot y"></span><span className="lp-tv-label">Company Directory</span></div>
        {[
          { name: 'Beagle Security', tag: 'Cybersecurity', score: 94 },
          { name: 'CloudOps Ltd', tag: 'SaaS', score: 87 },
          { name: 'ScaleAI Corp', tag: 'AI/ML', score: 82 },
          { name: 'FinVerse', tag: 'Fintech', score: 79 },
        ].map((c, i) => (
          <motion.div key={c.name} className="lp-tv-row" initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
            <div className="lp-tv-row-name">{c.name}</div>
            <span className="lp-tv-row-tag">{c.tag}</span>
            <div className="lp-tv-row-score" style={{ '--s': c.score + '%' }}>{c.score}</div>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: 'enrichment',
    label: 'AI Enrichment',
    heading: 'One click fills every blank.',
    body: 'Our AI reads websites, LinkedIn pages, and Google Maps to extract descriptions, headcount, tech stack signals, industry classification, and verified decision-maker contacts automatically.',
    visual: (
      <div className="lp-tab-visual">
        <div className="lp-tv-header"><span className="lp-tv-dot g"></span><span className="lp-tv-label">Enrichment pipeline — live</span></div>
        {[
          { step: 'Website AI', status: 'done', detail: 'SaaS · 12-50 employees' },
          { step: 'LinkedIn', status: 'done', detail: '3 decision makers found' },
          { step: 'Hunter.io', status: 'done', detail: 'cto@beaglesec.io · verified' },
          { step: 'ICP Score', status: 'running', detail: 'Scoring…' },
        ].map((s, i) => (
          <motion.div key={s.step} className="lp-tv-row" initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
            <div className="lp-tv-row-name">{s.step}</div>
            <span className={`lp-tv-status ${s.status}`}>{s.status === 'done' ? '✓' : '…'}</span>
            <span className="lp-tv-row-tag">{s.detail}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: 'scoring',
    label: 'ICP Scoring',
    heading: 'Your best accounts rise to the top.',
    body: 'Define your ideal customer — industry, size, location, role keywords — once. Sonar scores every company in your pipeline automatically so you always work the highest-fit leads first.',
    visual: (
      <div className="lp-tab-visual">
        <div className="lp-tv-header"><span className="lp-tv-dot y"></span><span className="lp-tv-label">ICP Score breakdown</span></div>
        {[
          { label: 'Industry match', pct: 100 },
          { label: 'Company size', pct: 85 },
          { label: 'Location', pct: 90 },
          { label: 'Tech signals', pct: 70 },
        ].map((r, i) => (
          <motion.div key={r.label} className="lp-tv-score-row" initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
            <span className="lp-tv-score-label">{r.label}</span>
            <div className="lp-tv-bar-track"><motion.div className="lp-tv-bar-fill" initial={{ width: 0 }} whileInView={{ width: r.pct + '%' }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.2 + i * 0.1 }} /></div>
            <span className="lp-tv-score-num">{r.pct}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: 'export',
    label: 'Lead Export',
    heading: 'From pipeline to outreach in seconds.',
    body: 'Export any selection as a clean CSV, open LinkedIn profiles in batch, or send to your CRM. Every record arrives with verified emails, job titles, LinkedIn URLs, and ICP scores attached.',
    visual: (
      <div className="lp-tab-visual">
        <div className="lp-tv-header"><span className="lp-tv-dot g"></span><span className="lp-tv-label">Export · 24 leads selected</span></div>
        {[
          { label: 'CSV export', detail: '24 records · all fields', active: true },
          { label: 'Open LinkedIn', detail: 'Batch · 24 profiles' },
          { label: 'Copy emails', detail: '22 verified addresses' },
          { label: 'CRM sync', detail: 'Coming soon' },
        ].map((o, i) => (
          <motion.div key={o.label} className={`lp-tv-row${o.active ? ' active' : ''}`} initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
            <div className="lp-tv-row-name">{o.label}</div>
            <span className="lp-tv-row-tag">{o.detail}</span>
            {o.active && <span className="lp-tv-status done">→</span>}
          </motion.div>
        ))}
      </div>
    ),
  },
]

export default function Landing() {
  const [legal, setLegal] = useState(null)
  const [activeTab, setActiveTab] = useState('discovery')
  const [openFaq, setOpenFaq] = useState(null)

  const activeTabData = FEATURE_TABS.find(t => t.id === activeTab)

  return (
    <div className="lp">

      {/* ── FLOATING NAV ─────────────────────────────────────────────────── */}
      <FloatingNavbar
        logo="Sonar"
        items={[
          { label: 'Features',     href: '#features' },
          { label: 'How it works', href: '#how-it-works' },
          { label: 'Pricing',      href: '#pricing' },
        ]}
        cta={{ label: 'Get started →', href: '/signup' }}
      />

      {/* ── STATIC NAV ───────────────────────────────────────────────────── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-logo">
            <span className="lp-logo-mark">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.5"/>
                <circle cx="8" cy="8" r="4" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.85"/>
                <circle cx="8" cy="8" r="1.5" fill="#FFFFFF"/>
                <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </span>
            Sonar
          </Link>
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

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="lp-hero" style={{ position: 'relative', overflow: 'hidden' }}>
        <BackgroundBeams style={{ zIndex: 0 }} />
        <div className="lp-container lp-hero-center" style={{ position: 'relative', zIndex: 1 }}>

          {/* Announcement pill */}
          <motion.a href="#features" className="lp-announce" {...fadeUp(0)}>
            <span className="lp-announce-badge">NEW</span>
            <span>Introducing Sonar — AI-powered B2B lead intelligence</span>
            <span className="lp-announce-arrow">→</span>
          </motion.a>

          {/* Heading */}
          <motion.h1 className="lp-hero-h1" {...fadeUp(0.08)}>
            <FlipWords
              words={['Find the lead.', 'Close the deal.', 'Build the pipeline.', 'Score the fit.']}
              duration={3200}
            />
            <br />Before your<br />competitor does.
          </motion.h1>

          <motion.p className="lp-hero-sub lp-hero-sub-center" {...fadeUp(0.16)}>
            Sonar discovers B2B companies, enriches every data point with AI, and scores them against your ICP. From first search to outreach-ready lead — in one platform.
          </motion.p>

          <motion.div className="lp-hero-ctas lp-hero-ctas-center" {...fadeUp(0.22)}>
            <AnimatedButton variant="shimmer" href="/signup" as="a">
              Get started for free
            </AnimatedButton>
            <a href="#how-it-works" className="lp-btn-ghost lp-btn-ghost-inline">
              See how it works <span style={{ marginLeft: 4 }}>↓</span>
            </a>
          </motion.div>

          <motion.p className="lp-hero-fine" {...fadeUp(0.28)}>
            Free plan — no credit card required.
          </motion.p>

          {/* Hero preview */}
          <motion.div className="lp-hero-preview" {...fadeUp(0.34)}>
            <div className="lp-preview-bar">
              <span className="lp-preview-bar-dot r"></span>
              <span className="lp-preview-bar-dot y"></span>
              <span className="lp-preview-bar-dot g"></span>
              <span className="lp-preview-bar-label">sonarleads.vercel.app / dashboard</span>
            </div>
            <div className="lp-preview-body">
              <div className="lp-preview-row">
                <span className="lp-preview-accent" style={{ background: '#FFFF00' }}></span>
                <span className="lp-preview-name">Beagle Security</span>
                <span className="lp-preview-tag">ICP Match · 94</span>
                <div className="lp-preview-bar-score"><div style={{ width: '94%' }}></div></div>
              </div>
              <div className="lp-preview-row">
                <span className="lp-preview-accent" style={{ background: '#22C55E' }}></span>
                <span className="lp-preview-name">CloudOps Ltd</span>
                <span className="lp-preview-tag">Email verified</span>
                <div className="lp-preview-bar-score"><div style={{ width: '78%' }}></div></div>
              </div>
              <div className="lp-preview-row">
                <span className="lp-preview-accent" style={{ background: '#0082F3' }}></span>
                <span className="lp-preview-name">ScaleAI Corp</span>
                <span className="lp-preview-tag">LinkedIn enriched</span>
                <div className="lp-preview-bar-score"><div style={{ width: '86%' }}></div></div>
              </div>
              <div className="lp-preview-row">
                <span className="lp-preview-accent" style={{ background: '#A855F7' }}></span>
                <span className="lp-preview-name">FinVerse</span>
                <span className="lp-preview-tag">3 contacts found</span>
                <div className="lp-preview-bar-score"><div style={{ width: '71%' }}></div></div>
              </div>
              <div className="lp-preview-footer">
                <span>4 companies enriched · auto pipeline</span>
                <span className="lp-preview-cta">View all →</span>
              </div>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ── TRUSTED BY MARQUEE ───────────────────────────────────────────── */}
      <div className="lp-trusted">
        <div className="lp-trusted-label">TRUSTED BY LEADING SALES TEAMS</div>
        <InfiniteMarquee
          items={['Founders', 'SDR Teams', 'Sales Agencies', 'Growth Operators', 'Solo Closers', 'B2B Consultants', 'RevOps Teams', 'AEs']}
          speed={22}
          itemStyle={{ fontFamily: "'Host Grotesk', sans-serif", fontSize: 13, fontWeight: 600, color: '#3A3A3A', letterSpacing: '0.06em', textTransform: 'uppercase' }}
        />
      </div>

      {/* ── PROBLEM ──────────────────────────────────────────────────────── */}
      <section className="lp-section lp-section-alt">
        <div className="lp-container">
          <motion.div className="lp-section-header" {...fadeUp()}>
            <span className="lp-pill">The problem</span>
            <h2>Manually building your<br />pipeline is exhausting.</h2>
          </motion.div>
          <div className="lp-problem-grid">
            {[
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                title: 'Research Takes Hours',
                body: 'Sales reps spend 40% of their time on manual research — looking up company info, finding contacts, verifying emails — instead of actually selling.',
              },
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
                title: 'Missed Opportunities',
                body: 'Without ICP scoring, your team wastes cycles on low-fit accounts. The best opportunities get buried under noise and never reach the top of your queue.',
              },
              {
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
                title: 'Fragmented Data',
                body: 'Switching between Apollo, Hunter, LinkedIn, and your CRM means constant copy-paste, data gaps, and stale records by the time you reach out.',
              },
            ].map(({ icon, title, body }, i) => (
              <motion.div key={title} className="lp-problem-card" {...fadeUp(i * 0.1)}>
                <span className="lp-problem-icon">{icon}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOLUTION / FEATURES GRID ─────────────────────────────────────── */}
      <section className="lp-section" id="features">
        <div className="lp-container">
          <motion.div className="lp-section-header" {...fadeUp()}>
            <span className="lp-pill">Solution</span>
            <h2>Empower your sales team<br />with AI intelligence.</h2>
            <p className="lp-section-sub">Generic tools won't cut it. Sonar is purpose-built for B2B pipeline — from discovery to deal-ready lead, everything automated.</p>
          </motion.div>
          <div className="lp-solution-grid">
            {[
              {
                icon: (
                  <svg viewBox="0 0 32 32" fill="none" width="22" height="22">
                    <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="1.4"/>
                    <line x1="21" y1="21" x2="29" y2="29" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="11" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                ),
                title: 'Advanced Company Discovery',
                body: 'Search millions of B2B companies by industry, size, location and keyword. Sector filters for SaaS, Fintech, Healthtech and more.',
              },
              {
                icon: (
                  <svg viewBox="0 0 32 32" fill="none" width="22" height="22">
                    <rect x="3" y="6" width="26" height="20" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M3 11h26" stroke="currentColor" strokeWidth="1.4"/>
                    <circle cx="16" cy="20" r="3" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M13 20H9M23 20h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                ),
                title: 'Secure Data Handling',
                body: 'All data encrypted over HTTPS. LinkedIn cookie stays on your own backend. Row Level Security ensures only you see your records.',
              },
              {
                icon: (
                  <svg viewBox="0 0 32 32" fill="none" width="22" height="22">
                    <path d="M16 3L28 9V23L16 29L4 23V9L16 3Z" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M16 3V29M4 9L28 23M28 9L4 23" stroke="currentColor" strokeWidth="1.4" opacity="0.4"/>
                  </svg>
                ),
                title: 'Seamless Integration',
                body: 'Chrome extension pulls leads from any LinkedIn page. Hunter and Apollo integrate automatically for email verification and supplemental data.',
              },
              {
                icon: (
                  <svg viewBox="0 0 32 32" fill="none" width="22" height="22">
                    <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="1.4" opacity="0.3"/>
                    <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="1.4" opacity="0.6"/>
                    <circle cx="16" cy="16" r="2.5" fill="currentColor"/>
                    <line x1="18" y1="14" x2="24" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                ),
                title: 'Custom ICP Scoring',
                body: 'Define your ideal customer once. Sonar scores every company automatically so your best-fit accounts always surface to the top.',
              },
            ].map(({ icon, title, body }, i) => (
              <CardSpotlight key={title} style={{ borderRadius: 0 }} color="rgba(255,255,0,0.04)">
                <motion.div className="lp-solution-card" {...fadeUp(i * 0.09)}>
                  <div className="lp-solution-icon">{icon}</div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <a href="#" className="lp-solution-link">Learn more <span>→</span></a>
                </motion.div>
              </CardSpotlight>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="lp-section lp-section-alt" id="how-it-works">
        <div className="lp-container">
          <motion.div className="lp-section-header" {...fadeUp()}>
            <span className="lp-pill">How it works</span>
            <h2>Just 3 steps to get started.</h2>
          </motion.div>
          <div className="lp-steps">
            {[
              {
                num: '01',
                title: 'Build your ICP',
                body: 'Define your ideal customer — industry, company size, location, and role keywords. Sonar uses this profile to score every company it discovers.',
              },
              {
                num: '02',
                title: 'Discover and enrich',
                body: 'Search the company directory or use the Maps explorer. Add targets to your pipeline, then let AI fill website data, LinkedIn profiles, and verified emails automatically.',
              },
              {
                num: '03',
                title: 'Reach out and close',
                body: 'Your leads arrive with verified emails, LinkedIn profiles, job titles, and ICP scores. Export a clean list or open LinkedIn profiles in batch — ready to reach out immediately.',
              },
            ].map(({ num, title, body }, i) => (
              <motion.div key={num} className="lp-step-card" {...fadeUp(i * 0.1)}>
                <div className="lp-step-num">{num}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL HIGHLIGHT ─────────────────────────────────────────── */}
      <section className="lp-section lp-section-deep">
        <div className="lp-container">
          <motion.div className="lp-testimonial-hl" {...fadeUp()}>
            <svg className="lp-quote-mark" viewBox="0 0 40 32" fill="none">
              <path d="M0 20C0 13 4 8 12 5L14 8C10 10 8 13 8 16H14V32H0V20ZM22 20C22 13 26 8 34 5L36 8C32 10 30 13 30 16H36V32H22V20Z" fill="currentColor" opacity="0.18"/>
            </svg>
            <blockquote className="lp-hl-quote">
              Sonar cut our prospecting time by <span style={{ color: 'var(--lp-accent)' }}>70%</span>. We went from 2 hours of manual research per lead to instant enriched records ready to reach out.
            </blockquote>
            <div className="lp-hl-author">
              <div className="lp-hl-avatar">A</div>
              <div>
                <div className="lp-hl-name">Arjun Mehta</div>
                <div className="lp-hl-role">Head of Sales, Beagle Security</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURE TABS ─────────────────────────────────────────────────── */}
      <section className="lp-section" id="features-deep">
        <div className="lp-container">
          <motion.div className="lp-section-header" {...fadeUp()}>
            <span className="lp-pill">Platform</span>
            <h2>Everything your pipeline needs.</h2>
          </motion.div>
          <div className="lp-tabs-layout">
            {/* Left: tab list */}
            <div className="lp-tabs-list">
              {FEATURE_TABS.map(t => (
                <button
                  key={t.id}
                  className={`lp-tab-btn${activeTab === t.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  <span className="lp-tab-indicator"></span>
                  <span className="lp-tab-label">{t.label}</span>
                </button>
              ))}
            </div>
            {/* Right: content */}
            <div className="lp-tabs-content">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <h3 className="lp-tabs-heading">{activeTabData.heading}</h3>
                  <p className="lp-tabs-body">{activeTabData.body}</p>
                  {activeTabData.visual}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="lp-section lp-section-alt">
        <div className="lp-container">
          <motion.div className="lp-section-header" {...fadeUp()}>
            <span className="lp-pill">Testimonials</span>
            <h2>What our customers are saying.</h2>
          </motion.div>
        </div>
        <div className="lp-testimonials-track">
          <div className="lp-testimonials-inner">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <div key={i} className="lp-tcard">
                <p className="lp-tcard-quote">"{t.quote}"</p>
                <div className="lp-tcard-author">
                  <div className="lp-tcard-avatar">{t.name[0]}</div>
                  <div>
                    <div className="lp-tcard-name">{t.name}</div>
                    <div className="lp-tcard-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GLOBE + STATS ────────────────────────────────────────────────── */}
      <section className="lp-section lp-section-dark">
        <div className="lp-container">
          <motion.div className="lp-globe-section" {...fadeUp()}>
            <div className="lp-globe-copy">
              <span className="lp-pill lp-pill-dark">Global reach</span>
              <h2 style={{ marginTop: 20, color: '#F5F5F5' }}>Discover companies<br />from 140+ countries.</h2>
              <p className="lp-globe-sub" style={{ color: '#6A7282' }}>Sonar indexes B2B companies from across the globe, with deep enrichment for companies in India, APAC, Europe, and North America.</p>
              <div className="lp-globe-stats">
                {[
                  { num: '10M+', label: 'Companies indexed' },
                  { num: '140+', label: 'Countries covered' },
                  { num: '98%', label: 'Email accuracy' },
                ].map(({ num, label }) => (
                  <div key={label} className="lp-globe-stat">
                    <div className="lp-globe-stat-num">{num}</div>
                    <div className="lp-globe-stat-label">{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lp-globe-wrap">
              <Globe size={320} markers={LANDING_MARKERS} markerColor={[0.91, 0, 0.04]} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CHROME EXTENSION ─────────────────────────────────────────────── */}
      <section className="lp-section" id="extension">
        <div className="lp-container">
          <div className="lp-ext-grid">
            <motion.div className="lp-ext-copy" {...fadeUp()}>
              <span className="lp-pill" style={{ marginBottom: '20px', display: 'inline-flex' }}>Chrome extension</span>
              <h2 style={{ marginTop: '20px', color: 'var(--lp-text)' }}>Extract leads straight<br />from LinkedIn.</h2>
              <p className="lp-ext-sub">
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
                <AnimatedButton variant="shimmer" href="/sonar-extension.zip" as="a" download>
                  Download extension ↓
                </AnimatedButton>
                <ol className="lp-ext-steps">
                  <li><span className="lp-ext-step-num">1</span>Download and <strong>unzip</strong> the file</li>
                  <li><span className="lp-ext-step-num">2</span>Open <code>chrome://extensions</code> in Chrome</li>
                  <li><span className="lp-ext-step-num">3</span>Toggle on <strong>Developer mode</strong> (top right)</li>
                  <li><span className="lp-ext-step-num">4</span>Click <strong>Load unpacked</strong> → select folder</li>
                  <li><span className="lp-ext-step-num">5</span>Pin Sonar to your toolbar and sign in</li>
                </ol>
              </div>
            </motion.div>
            <motion.div className="lp-ext-preview" {...fadeUp(0.12)}>
              <div className="lp-ext-mock">
                <div className="lp-ext-mock-bar">
                  <div className="lp-ext-mock-logo">
                    <svg viewBox="0 0 14 14" fill="none" width="12" height="12">
                      <circle cx="7" cy="7" r="6" stroke="#121212" strokeWidth="1.2"/>
                      <circle cx="7" cy="7" r="3.2" stroke="#121212" strokeWidth="1.2"/>
                      <circle cx="7" cy="7" r="1" fill="#121212"/>
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

      {/* ── DATA INTELLIGENCE ────────────────────────────────────────────── */}
      <section className="lp-section lp-section-alt" id="what-we-find">
        <div className="lp-container">
          <motion.div className="lp-section-header" {...fadeUp()}>
            <span className="lp-pill">Data intelligence</span>
            <h2>Every data point<br />your team needs.</h2>
          </motion.div>
          <div className="lp-signals-grid">
            {[
              { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, label: 'Website Intelligence',    desc: 'AI reads company websites to extract descriptions, industry signals, and tech stack clues — no manual research.' },
              { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, label: 'LinkedIn Enrichment',     desc: 'Pull company LinkedIn pages, decision-maker profiles, headcount, and job titles into every record automatically.' },
              { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, label: 'Verified Email Finder',   desc: 'Hunter.io integration finds and verifies professional email addresses for every contact you want to reach.' },
              { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, label: 'Maps Intelligence',       desc: 'Discover local and regional businesses via Google Maps and enrich their details — ideal for territory-based sales.' },
              { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>, label: 'ICP Score',               desc: 'Every company gets an automatic fit score against your saved ICP criteria so your best-fit accounts rise to the top.' },
              { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>, label: 'Industry Classification', desc: 'AI classifies every company into the right sector — SaaS, Fintech, Healthtech, Cybersecurity, and more — on enrichment.' },
            ].map(({ icon, label, desc }, i) => (
              <motion.div
                key={label}
                className="lp-signal-tile"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 }}
              >
                <span className="lp-tile-icon">{icon}</span>
                <div>
                  <div className="lp-tile-label">{label}</div>
                  <div className="lp-tile-desc">{desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section className="lp-section" id="pricing">
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
                {...fadeUp(i * 0.1)}
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

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="lp-section lp-section-alt">
        <div className="lp-container">
          <motion.div className="lp-section-header" {...fadeUp()}>
            <span className="lp-pill">FAQ</span>
            <h2>Frequently asked questions.</h2>
          </motion.div>
          <div className="lp-faq">
            {FAQ_ITEMS.map((item, i) => (
              <motion.div key={i} className="lp-faq-item" {...fadeUp(i * 0.05)}>
                <button
                  className={`lp-faq-q${openFaq === i ? ' open' : ''}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{item.q}</span>
                  <span className="lp-faq-chevron">{openFaq === i ? '−' : '+'}</span>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      className="lp-faq-a"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p>{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
            <p className="lp-faq-footer">Still have questions? Email us at <a href="mailto:sonarleads@proton.me">sonarleads@proton.me</a></p>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
      <section className="lp-cta-banner">
        <div className="lp-container">
          <motion.div className="lp-cta-inner" {...fadeUp()}>
            <h2 className="lp-cta-heading">Ready to get started?</h2>
            <p className="lp-cta-sub">Start your free trial today.</p>
            <Link to="/signup" className="lp-cta-btn">Get started for free →</Link>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <span className="lp-footer-logo">
              <span className="lp-logo-mark lp-logo-mark-sm">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.5"/>
                  <circle cx="8" cy="8" r="4" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.85"/>
                  <circle cx="8" cy="8" r="1.5" fill="#FFFFFF"/>
                  <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              </span>
              Sonar
            </span>
            <p className="lp-footer-tagline">B2B lead intelligence platform.</p>
          </div>
          <div className="lp-footer-cols">
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Product</div>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#extension">Extension</a>
              <Link to="/signup">Sign up</Link>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Company</div>
              <a href="mailto:sonarleads@proton.me">Contact</a>
              <button onClick={() => setLegal('privacy')} className="lp-footer-btn">Privacy Policy</button>
              <button onClick={() => setLegal('terms')} className="lp-footer-btn">Terms of Service</button>
            </div>
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Resources</div>
              <a href="#how-it-works">How it works</a>
              <a href="#what-we-find">Data sources</a>
              <a href="#faq">FAQ</a>
            </div>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <div className="lp-footer-inner">
            <span className="lp-footer-fine">© 2026 Sonar. Built for founders who close.</span>
          </div>
        </div>
      </footer>

      {legal && <LegalModal type={legal} onClose={() => setLegal(null)} />}

    </div>
  )
}
