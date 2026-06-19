import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import './Landing.css'
import LegalModal from '../components/LegalModal'
import { FlipWords } from '../components/ui/FlipWords'
import { BackgroundBeams } from '../components/ui/BackgroundBeams'
import { InfiniteMarquee } from '../components/ui/InfiniteMarquee'
import { WobbleCard, BentoCard } from '../components/ui/WobbleCard'
import { SectionReveal } from '../components/ui/SectionReveal'
import { FloatingNavbar } from '../components/ui/FloatingNavbar'
import { AnimatedButton } from '../components/ui/AnimatedButton'
import Globe, { LANDING_MARKERS } from '../components/Globe'
import Globe3D from '../components/ui/3d-globe'
import { MacbookScroll } from '../components/ui/MacbookScroll'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-48px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay },
})

const TESTIMONIALS = [
  { quote: "Sonar cut our prospecting time by 70%. We went from 2 hours of manual research per lead to instant enriched records ready to reach out.", name: "Arjun Mehta", role: "Head of Sales, NovaSpark AI" },
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
    body: 'Filter by industry, location, headcount, and keyword. Sector presets for SaaS, Fintech, Healthtech, Cybersecurity, and more. Add matching companies straight to your workspace in one click.',
    visual: (
      <div className="lp-tab-visual">
        <div className="lp-tv-header"><span className="lp-tv-dot y"></span><span className="lp-tv-label">Company Directory</span></div>
        {[
          { name: 'NovaSpark AI', tag: 'Cybersecurity', score: 94 },
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
        <div className="lp-tv-header"><span className="lp-tv-dot g"></span><span className="lp-tv-label">Enrichment queue — live</span></div>
        {[
          { step: 'Website AI', status: 'done', detail: 'SaaS · 12-50 employees' },
          { step: 'LinkedIn', status: 'done', detail: '3 decision makers found' },
          { step: 'Hunter.io', status: 'done', detail: 'cto@novaspark.io · verified' },
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
    body: 'Define your ideal customer — industry, size, location, role keywords — once. Sonar scores every company in your workspace automatically so you always work the highest-fit leads first.',
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
    heading: 'From discovery to outreach in seconds.',
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

const LEARN_MORE_CONTENT = {
  'Advanced Company Discovery': {
    headline: 'Discover any B2B company in seconds',
    body: 'Search across millions of companies filtered by industry vertical, headcount range, location, and keyword signals. Pre-built sector filters for SaaS, Fintech, Healthtech, Cybersecurity, and Manufacturing mean you can go from zero to qualified target list in under a minute. Results are ranked by match strength against your ICP.',
  },
  'Secure Data Handling': {
    headline: 'Your data never leaves your control',
    body: 'Every record is stored in Supabase with Row Level Security — only your account can query your data. All API calls travel over HTTPS. Your LinkedIn session cookie is sent only to your own Vercel backend, never to third-party servers. We never sell or share your prospect data.',
  },
  'Seamless Integration': {
    headline: 'Pull leads from anywhere with one click',
    body: 'The Chrome extension works on any LinkedIn page — company profiles, people search, Sales Navigator results. Hunter.io and Apollo.io are pre-wired to verify emails and enrich contact data automatically. No API keys to configure, no CSV exports needed.',
  },
  'Custom ICP Scoring': {
    headline: 'Always work your best accounts first',
    body: 'Define your ideal customer profile once — industry, headcount range, location, and role keywords. Sonar scores every company in your workspace from 0–100 on ICP fit and re-scores automatically when you update the criteria. The highest-fit accounts always appear at the top of your workspace.',
  },
}

export default function Landing() {
  const [legal, setLegal] = useState(null)
  const [activeTab, setActiveTab] = useState('discovery')
  const [openFaq, setOpenFaq] = useState(null)
  const [learnMoreOpen, setLearnMoreOpen] = useState(null)

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
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
              words={['Find the lead.', 'Close the deal.', 'Build the list.', 'Score the fit.']}
              duration={3200}
            />
            <br />Before your<br />competitor does.
          </motion.h1>

          <motion.p className="lp-hero-sub lp-hero-sub-center" {...fadeUp(0.16)}>
            Sonar discovers B2B companies, enriches every data point with AI, and scores them against your ICP. From first search to outreach-ready lead — in one platform.
          </motion.p>

          <motion.div className="lp-hero-ctas lp-hero-ctas-center" {...fadeUp(0.22)}>
            <AnimatedButton variant="shimmer" href="/signup" as="a" style={{ borderRadius: 9999 }}>
              Get started for free
            </AnimatedButton>
            <a href="#how-it-works" className="lp-btn-ghost lp-btn-ghost-inline">
              See how it works <span style={{ marginLeft: 4 }}>↓</span>
            </a>
          </motion.div>

          <motion.p className="lp-hero-fine" {...fadeUp(0.28)}>
            Free plan — no credit card required.
          </motion.p>

        </div>
      </section>

      {/* ── MACBOOK SCROLL ───────────────────────────────────────────────── */}
      <MacbookScroll title={<span>Your pipeline.<br />On autopilot.</span>}>
        <div className="lp-preview-bar">
          <span className="lp-preview-bar-dot r"></span>
          <span className="lp-preview-bar-dot y"></span>
          <span className="lp-preview-bar-dot g"></span>
          <span className="lp-preview-bar-label">sonarleads.vercel.app / dashboard</span>
        </div>
        <div className="lp-preview-body">
          <div className="lp-preview-row">
            <span className="lp-preview-accent" style={{ background: '#FFFF00' }}></span>
            <span className="lp-preview-name">NovaSpark AI</span>
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
            <span>4 companies enriched · auto-synced</span>
            <span className="lp-preview-cta">View all →</span>
          </div>
        </div>
      </MacbookScroll>

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
      <section className="lp-section lp-section-alt" style={{ padding: 0 }}>
        <SectionReveal
          title={
            <div className="lp-section-header" style={{ marginBottom: 0 }}>
              <span className="lp-pill">The problem</span>
              <h2>Manually building your<br />prospect list is exhausting.</h2>
            </div>
          }
          cardBg="#FFFFFF"
          borderColor="#E5E7EB"
        >
          <div className="lp-problem-grid" style={{ padding: '8px 0' }}>
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
              <motion.div key={title} {...fadeUp(i * 0.1)}>
                <WobbleCard>
                  <div className="lp-problem-card">
                    <span className="lp-problem-icon">{icon}</span>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </WobbleCard>
              </motion.div>
            ))}
          </div>
        </SectionReveal>
      </section>

      {/* ── SOLUTION BENTO ───────────────────────────────────────────────── */}
      <section className="lp-section lp-section-dark" id="features" style={{ padding: 0 }}>
        <SectionReveal
          title={
            <div className="lp-section-header" style={{ marginBottom: 0 }}>
              <span className="lp-pill lp-pill-dark">Solution</span>
              <h2 style={{ color: '#F5F5F5' }}>Empower your sales team<br />with AI intelligence.</h2>
              <p className="lp-section-sub" style={{ color: '#6A7282' }}>Purpose-built for B2B outreach — from discovery to deal-ready lead, everything automated.</p>
            </div>
          }
          cardBg="#0d0d0d"
          borderColor="#2a2a2a"
        >
          {/* Row 1: large (2/3) + small (1/3) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <motion.div style={{ gridColumn: '1 / 3' }} {...fadeUp(0)}>
              <BentoCard bg="linear-gradient(135deg, #9D174D 0%, #7f1d1d 100%)" minHeight={300}>
                <div style={{ maxWidth: 340 }}>
                  <h2 style={{ color: 'white', fontSize: 'clamp(22px, 2.5vw, 32px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.02em' }}>
                    Find your perfect customers at scale
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.65, margin: 0 }}>
                    Search 10M+ B2B companies by industry, size, and location. Every company gets an automatic ICP fit score — your best accounts always surface first.
                  </p>
                </div>
              </BentoCard>
            </motion.div>

            <motion.div style={{ gridColumn: '3 / 4' }} {...fadeUp(0.08)}>
              <BentoCard bg="linear-gradient(135deg, #4f46e5 0%, #312e81 100%)" minHeight={300}>
                <h2 style={{ color: 'white', fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.02em' }}>
                  Zero-trust data security.
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.65, margin: 0 }}>
                  All data encrypted over HTTPS. Your LinkedIn cookie stays on your own backend. Row Level Security ensures only you see your records.
                </p>
              </BentoCard>
            </motion.div>
          </div>

          {/* Row 2: full-width */}
          <motion.div {...fadeUp(0.16)}>
            <BentoCard bg="linear-gradient(135deg, #1d4ed8 0%, #312e81 100%)" minHeight={300}>
              <div style={{ maxWidth: 480 }}>
                <h2 style={{ color: 'white', fontSize: 'clamp(22px, 2.5vw, 32px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.02em' }}>
                  Your entire outreach stack, connected.
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.65, margin: 0 }}>
                  Chrome extension pulls leads from any LinkedIn page. Hunter.io verifies emails, Apollo supplements data — everything flows automatically into your workspace with zero copy-paste.
                </p>
              </div>
            </BentoCard>
          </motion.div>
        </SectionReveal>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="lp-section lp-section-dark" id="how-it-works" style={{ padding: 0 }}>
        <SectionReveal
          title={
            <div className="lp-section-header" style={{ marginBottom: 0 }}>
              <span className="lp-pill lp-pill-dark">How it works</span>
              <h2 style={{ color: '#F5F5F5' }}>Just 3 steps to get started.</h2>
            </div>
          }
          cardBg="#0d0d0d"
          borderColor="#2a2a2a"
        >
          {/* Row 1: narrow (1/3) + wide (2/3) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <motion.div style={{ gridColumn: '1 / 2' }} {...fadeUp(0)}>
              <BentoCard bg="linear-gradient(135deg, #9D0010 0%, #5c0008 100%)" minHeight={340}>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: '#E7000B', textTransform: 'uppercase' }}>01</span>
                </div>
                <h3 style={{ color: 'white', fontSize: 'clamp(20px, 2vw, 28px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 14, letterSpacing: '-0.02em' }}>Build your ICP</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.65, margin: 0 }}>
                  Define your ideal customer — industry, company size, location, and role keywords. Sonar uses this profile to score every company it discovers.
                </p>
              </BentoCard>
            </motion.div>

            <motion.div style={{ gridColumn: '2 / 4' }} {...fadeUp(0.08)}>
              <BentoCard bg="linear-gradient(135deg, #E7000B 0%, #b30009 100%)" minHeight={340}>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>02</span>
                </div>
                <div style={{ maxWidth: 420 }}>
                  <h3 style={{ color: 'white', fontSize: 'clamp(22px, 2.5vw, 32px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 14, letterSpacing: '-0.02em' }}>Discover and enrich</h3>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.65, margin: 0 }}>
                    Search the company directory or use the Maps explorer. Add targets to your workspace, then let AI fill website data, LinkedIn profiles, and verified emails automatically.
                  </p>
                </div>
              </BentoCard>
            </motion.div>
          </div>

          {/* Row 2: full width */}
          <motion.div {...fadeUp(0.16)}>
            <BentoCard bg="linear-gradient(135deg, #1a0404 0%, #0d0202 100%)" minHeight={240}>
              <div style={{ maxWidth: 540 }}>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', color: '#E7000B', textTransform: 'uppercase' }}>03</span>
                </div>
                <h3 style={{ color: 'white', fontSize: 'clamp(22px, 2.5vw, 32px)', fontWeight: 700, lineHeight: 1.2, marginBottom: 14, letterSpacing: '-0.02em' }}>Reach out and close</h3>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.65, margin: 0 }}>
                  Your leads arrive with verified emails, LinkedIn profiles, job titles, and ICP scores. Export a clean list or open LinkedIn profiles in batch — ready to reach out immediately.
                </p>
              </div>
            </BentoCard>
          </motion.div>
        </SectionReveal>
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
                <div className="lp-hl-role">Head of Sales, NovaSpark AI</div>
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
            <h2>Everything your workspace needs.</h2>
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
              <WobbleCard key={i} style={{ flexShrink: 0, height: 'auto' }} innerStyle={{ height: 'auto' }}>
                <div className="lp-tcard">
                  <p className="lp-tcard-quote">"{t.quote}"</p>
                  <div className="lp-tcard-author">
                    <div className="lp-tcard-avatar">{t.name[0]}</div>
                    <div>
                      <div className="lp-tcard-name">{t.name}</div>
                      <div className="lp-tcard-role">{t.role}</div>
                    </div>
                  </div>
                </div>
              </WobbleCard>
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
              <Globe3D style={{ width: '100%' }} />
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
                Install the Sonar extension and pull people and companies from any LinkedIn page — profiles, company pages, search results, Sales Navigator — directly into your workspace. No copy-paste, no CSV.
              </p>
              <ul className="lp-ext-features">
                <li><span className="lp-ext-dash">—</span>Extract from LinkedIn people search &amp; Sales Nav</li>
                <li><span className="lp-ext-dash">—</span>Scrape full profiles: bio, experience, job title</li>
                <li><span className="lp-ext-dash">—</span>Auto-scroll to load all results before extracting</li>
                <li><span className="lp-ext-dash">—</span>Works on company pages, people pages &amp; search</li>
                <li><span className="lp-ext-dash">—</span>One click — leads appear in your dashboard instantly</li>
              </ul>
              <div className="lp-ext-actions">
                <AnimatedButton variant="shimmer" href="/sonar-extension.zip" as="a" download style={{ borderRadius: 9999 }}>
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
      <section className="lp-section lp-section-dark" id="what-we-find" style={{ padding: 0 }}>
        <SectionReveal
          title={
            <div className="lp-section-header" style={{ marginBottom: 0 }}>
              <span className="lp-pill lp-pill-dark">Data intelligence</span>
              <h2 style={{ color: '#F5F5F5' }}>Every data point<br />your team needs.</h2>
            </div>
          }
          cardBg="#0d0d0d"
          borderColor="#2a2a2a"
        >
          {/* 3-col bento grid — alternating 2/3 + 1/3 pattern */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>

            {/* Row 1: 2/3 + 1/3 */}
            <motion.div style={{ gridColumn: '1 / 3' }} {...fadeUp(0)}>
              <BentoCard bg="linear-gradient(135deg, #C90008 0%, #8a0006 100%)" minHeight={260}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  <div style={{ color: 'rgba(255,255,255,0.85)', flexShrink: 0, marginTop: 3 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: 20, marginBottom: 10, letterSpacing: '-0.01em' }}>Website Intelligence</div>
                    <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.65 }}>AI reads company websites to extract descriptions, industry signals, and tech stack clues — no manual research.</div>
                  </div>
                </div>
              </BentoCard>
            </motion.div>

            <motion.div style={{ gridColumn: '3 / 4' }} {...fadeUp(0.07)}>
              <BentoCard bg="linear-gradient(135deg, #1a0505 0%, #0a0000 100%)" minHeight={260}>
                <div style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 18, marginBottom: 10, letterSpacing: '-0.01em' }}>LinkedIn Enrichment</div>
                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.65 }}>Pull company LinkedIn pages, decision-maker profiles, headcount, and job titles into every record automatically.</div>
              </BentoCard>
            </motion.div>

            {/* Row 2: 1/3 + 2/3 */}
            <motion.div style={{ gridColumn: '1 / 2' }} {...fadeUp(0.12)}>
              <BentoCard bg="linear-gradient(135deg, #0d0202 0%, #180303 100%)" minHeight={260}>
                <div style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 18, marginBottom: 10, letterSpacing: '-0.01em' }}>Verified Email Finder</div>
                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.65 }}>Hunter.io integration finds and verifies professional email addresses for every contact you want to reach.</div>
              </BentoCard>
            </motion.div>

            <motion.div style={{ gridColumn: '2 / 4' }} {...fadeUp(0.16)}>
              <BentoCard bg="linear-gradient(135deg, #9D0010 0%, #4c0008 100%)" minHeight={260}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  <div style={{ color: 'rgba(255,255,255,0.85)', flexShrink: 0, marginTop: 3 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: 20, marginBottom: 10, letterSpacing: '-0.01em' }}>Maps Intelligence</div>
                    <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.65 }}>Discover local and regional businesses via Google Maps and enrich their details — ideal for territory-based sales.</div>
                  </div>
                </div>
              </BentoCard>
            </motion.div>

            {/* Row 3: 2/3 + 1/3 */}
            <motion.div style={{ gridColumn: '1 / 3' }} {...fadeUp(0.20)}>
              <BentoCard bg="linear-gradient(135deg, #B8000A 0%, #7a0007 100%)" minHeight={220}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  <div style={{ color: 'rgba(255,255,255,0.85)', flexShrink: 0, marginTop: 3 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                  </div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: 20, marginBottom: 10, letterSpacing: '-0.01em' }}>ICP Score</div>
                    <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.65 }}>Every company gets an automatic fit score against your saved ICP criteria so your best-fit accounts rise to the top.</div>
                  </div>
                </div>
              </BentoCard>
            </motion.div>

            <motion.div style={{ gridColumn: '3 / 4' }} {...fadeUp(0.24)}>
              <BentoCard bg="linear-gradient(135deg, #160202 0%, #0a0101 100%)" minHeight={220}>
                <div style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                </div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 18, marginBottom: 10, letterSpacing: '-0.01em' }}>Industry Classification</div>
                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.65 }}>AI classifies every company into the right sector — SaaS, Fintech, Healthtech, Cybersecurity — on enrichment.</div>
              </BentoCard>
            </motion.div>

          </div>
        </SectionReveal>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section className="lp-section lp-section-dark" id="pricing" style={{ padding: 0 }}>
        <SectionReveal
          title={
            <div className="lp-section-header" style={{ marginBottom: 0 }}>
              <span className="lp-pill lp-pill-dark">Pricing</span>
              <h2 style={{ color: '#F5F5F5' }}>Start free.<br />Scale when you're ready.</h2>
            </div>
          }
          cardBg="#0d0d0d"
          borderColor="#2a2a2a"
        >
          {/* Row 1: Solo (1/3) + Team featured (2/3) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <motion.div style={{ gridColumn: '1 / 2' }} {...fadeUp(0)}>
              <BentoCard bg="linear-gradient(135deg, #160303 0%, #0a0101 100%)" minHeight={480}>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 16 }}>Solo</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 64, fontWeight: 800, color: 'white', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 6 }}>Free</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>forever, no card needed</div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', marginBottom: 24 }} />
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', flex: 1 }}>
                    {['Company discovery & directory', 'AI website enrichment', 'LinkedIn enrichment', 'ICP profile & scoring', 'Lead management', 'Email finder (Hunter)', 'CSV export'].map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 11, color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.4 }}>
                        <span style={{ color: '#E7000B', flexShrink: 0, marginTop: 1 }}>—</span>{f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup" style={{ display: 'block', background: '#E7000B', color: 'white', textAlign: 'center', padding: '14px 24px', borderRadius: 9999, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>Get started free</Link>
                </div>
              </BentoCard>
            </motion.div>

            <motion.div style={{ gridColumn: '2 / 4' }} {...fadeUp(0.08)}>
              <BentoCard bg="linear-gradient(135deg, #E7000B 0%, #9D0000 100%)" minHeight={480}>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>Team</div>
                    <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 9999 }}>Most popular</span>
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 64, fontWeight: 800, color: 'white', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 6 }}>Custom</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 24 }}>contact us for team pricing</div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', marginBottom: 24 }} />
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', flex: 1, columns: 2, columnGap: 32 }}>
                    {['Everything in Solo', 'Invite team members', 'Role-based access control', 'Admin dashboard', 'Shared workspace & leads', 'Priority support'].map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 11, color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.4, breakInside: 'avoid' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0, marginTop: 1 }}>—</span>{f}
                      </li>
                    ))}
                  </ul>
                  <a href="mailto:sonarleads@proton.me" style={{ display: 'block', background: 'white', color: '#E7000B', textAlign: 'center', padding: '14px 24px', borderRadius: 9999, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>Contact us</a>
                </div>
              </BentoCard>
            </motion.div>
          </div>

          {/* Row 2: Enterprise full width */}
          <motion.div {...fadeUp(0.16)}>
            <BentoCard bg="linear-gradient(135deg, #9D0010 0%, #5c0008 100%)" minHeight={280}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 14 }}>Enterprise</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 64, fontWeight: 800, color: 'white', lineHeight: 1, letterSpacing: '-0.03em', marginBottom: 6 }}>Custom</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 24 }}>for larger sales orgs</div>
                  <a href="mailto:sonarleads@proton.me" style={{ display: 'inline-block', background: 'white', color: '#9D0010', padding: '14px 32px', borderRadius: 9999, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'none' }}>Talk to us</a>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {['Everything in Team', 'Unlimited seats', 'Custom ICP workflows', 'Dedicated onboarding', 'API access', 'SLA & dedicated support'].map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 11, color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.4 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0, marginTop: 1 }}>—</span>{f}
                    </li>
                  ))}
                </ul>
              </div>
            </BentoCard>
          </motion.div>
        </SectionReveal>
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

      {/* ── LEARN MORE MODAL ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {learnMoreOpen && LEARN_MORE_CONTENT[learnMoreOpen] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setLearnMoreOpen(null)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 9000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={e => e.stopPropagation()}
              style={{
                background: '#FFFFFF',
                maxWidth: 480,
                width: '90%',
                borderRadius: 16,
                padding: '32px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                position: 'relative',
              }}
            >
              <button
                onClick={() => setLearnMoreOpen(null)}
                style={{
                  position: 'absolute', top: 16, right: 16,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 20, lineHeight: 1, color: '#6B7280',
                  padding: '4px 8px', borderRadius: 6,
                  transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#0A0A0A'; e.currentTarget.style.background = '#F3F4F6' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = 'none' }}
              >
                ×
              </button>
              <div style={{ borderLeft: '4px solid #E7000B', paddingLeft: 16, marginBottom: 20 }}>
                <h3 style={{ fontFamily: "'Host Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: '#0A0A0A', margin: 0, lineHeight: 1.3 }}>
                  {LEARN_MORE_CONTENT[learnMoreOpen].headline}
                </h3>
              </div>
              <p style={{ fontFamily: "'Host Grotesk', sans-serif", fontSize: 14, lineHeight: 1.75, color: '#6B7280', margin: 0 }}>
                {LEARN_MORE_CONTENT[learnMoreOpen].body}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
