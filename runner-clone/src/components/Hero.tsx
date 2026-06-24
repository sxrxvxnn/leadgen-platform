/**
 * Hero — asymmetric two-column layout.
 *
 * Left: Display-serif headline "The AI App / that Does the Work."
 *   - Font: Fraunces (Exposure substitute), ~68px, weight 400, tracking -0.13em
 * Top-right: Small context panel "RUNNER CONNECTS TO THE TOOLS…" + CTA + trial text
 * Below headline: 4 pill tabs for use-case demos
 * Bottom: Mac browser mockup showing the Runner command center UI
 *
 * Ambient glow: radial gradient in warm terracotta from top center.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'

const TABS = [
  { id: 'loops',    label: 'Track Open Loops',  index: '01' },
  { id: 'sales',    label: 'Free Sales Call',   index: '01' },
  { id: 'interview',label: 'Interview Prep',    index: '' },
  { id: 'data',     label: 'Finish Data Prep',  index: '' },
]

const MOCK_SIDEBAR = [
  'Command center open loops',
  'Board, hiring, and family sweep',
  'End-of-week exec handoff',
]

const MOCK_RESULTS: Record<string, {
  query: string
  items: { app: string; color: string; text: string; sub: string }[]
  summary: string
}> = {
  loops: {
    query: 'Show me every open loop across work and life',
    items: [
      { app: 'Work Email',     color: '#4285f4', text: 'Filter work tasks, customer threads, review notes, and prioritized follow-ups', sub: '3 items need a reply' },
      { app: 'Personal Email', color: '#ea4335', text: 'Check current tasks, personal scheduling, taxes, and home obligations',         sub: '1 item needs attention' },
      { app: 'Work Calendar',  color: '#34a853', text: 'Review upcoming meetings, prep tasks, travel time, and internal reviews',      sub: '4 meetings this week' },
      { app: 'Work Calendar 2',color: '#34a853', text: 'Check the shared company calendar for interviews, updates, and corporate calls',sub: '' },
      { app: 'iMessage',       color: '#0a84ff', text: 'Find tasks with quick asks, family decisions, and home-related obligations',    sub: '2 pending responses' },
      { app: 'WhatsApp',       color: '#25d366', text: 'Search group chats for decisions that must become action items',               sub: '' },
      { app: 'Slack',          color: '#e01e5a', text: 'Find the first time you want to start a new Skinncraft thread',                sub: '' },
    ],
    summary: 'Here is your command center view. You have 14 open loops across 3 threads, 2 calendars, 2 files, and 3 messages to action.',
  },
  sales: {
    query: 'Prep me for my 3pm call with Acme Corp',
    items: [
      { app: 'CRM',       color: '#a86448', text: 'Last touch: demo call Feb 12 — positive signal, budget approved Q2',      sub: '2 follow-ups sent' },
      { app: 'Gmail',     color: '#ea4335', text: 'Latest thread: pricing proposal sent, awaiting procurement sign-off',      sub: '1 thread' },
      { app: 'Notion',    color: '#1d1b1b', text: 'Account notes: champion is Sarah M., infra team has 12 engineers',         sub: 'Updated 3 days ago' },
      { app: 'Calendar',  color: '#34a853', text: 'Call at 3:00 PM — 30 mins, zoom link in invite, 3 attendees',             sub: 'In 2 hours' },
    ],
    summary: 'Prep complete. Acme champion is Sarah Martinez. Budget is approved. Key objection last call: migration timeline. Suggested talking point ready.',
  },
  interview: {
    query: 'Help me prep for my interview at Stripe in 1 hour',
    items: [
      { app: 'Drive',     color: '#4285f4', text: 'Resume loaded — highlight: scaled infra to 10M users, 3 patents',   sub: 'Updated last week' },
      { app: 'Notion',    color: '#1d1b1b', text: 'Stripe research: stack is Sorbet + Go, interviewer is on Payments team', sub: '12 notes' },
      { app: 'Calendar',  color: '#34a853', text: 'Interview at 11:30am — Zoom link ready, 3 rounds scheduled',             sub: 'In 58 minutes' },
    ],
    summary: 'Interview prep complete. 3 STAR stories queued, company deep-dive ready, Zoom link copied. Good luck!',
  },
  data: {
    query: 'Finish the Q3 data prep deck I started yesterday',
    items: [
      { app: 'Sheets',    color: '#34a853', text: 'Q3 data spreadsheet found — 847 rows, last edited by you 18h ago',   sub: 'Google Sheets' },
      { app: 'Drive',     color: '#4285f4', text: 'Draft deck found: "Q3 Review v3" — missing slides 8–12',             sub: '6 slides done, 4 to go' },
      { app: 'Mixpanel',  color: '#7856ff', text: 'Pulling DAU/MAU, retention cohorts, and revenue by segment',          sub: 'Fetching live data...' },
    ],
    summary: 'Pulled all data sources. Slides 8–12 drafted with charts from Mixpanel. Deck updated in Drive — ready to review.',
  },
}

const APP_COLORS: Record<string, string> = {
  'Work Email': '#4285f4', 'Personal Email': '#ea4335',
  'Work Calendar': '#34a853', 'Work Calendar 2': '#34a853',
  iMessage: '#0a84ff', WhatsApp: '#25d366', Slack: '#e01e5a',
  CRM: '#a86448', Gmail: '#ea4335', Notion: '#1d1b1b', Calendar: '#34a853',
  Drive: '#4285f4', Sheets: '#34a853', Mixpanel: '#7856ff',
}

function AppDot({ name }: { name: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  const color = APP_COLORS[name] || '#6e6e6e'
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded text-[8px] font-bold text-white flex-shrink-0"
      style={{ background: color }}
    >
      {initials}
    </span>
  )
}

function BrowserMockup({ activeTab }: { activeTab: string }) {
  const data = MOCK_RESULTS[activeTab] || MOCK_RESULTS.loops

  return (
    <motion.div
      key={activeTab}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative rounded-xl overflow-hidden shadow-2xl"
      style={{
        background: '#fafaf8',
        border: '1px solid rgba(196,193,189,0.5)',
        boxShadow: '0 24px 80px rgba(29,27,27,0.14), 0 4px 16px rgba(29,27,27,0.06)',
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-4 h-9 border-b"
        style={{ background: '#f0eee8', borderColor: 'rgba(196,193,189,0.6)' }}
      >
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div
          className="flex-1 mx-4 h-5 rounded-md flex items-center justify-center font-mono text-[10px]"
          style={{ background: 'rgba(29,27,27,0.06)', color: '#a1a1a1' }}
        >
          runner — {data.query.substring(0, 44)}…
        </div>
      </div>

      {/* App body */}
      <div className="flex h-[380px] md:h-[440px]">

        {/* Sidebar */}
        <div
          className="w-44 flex-shrink-0 border-r flex flex-col py-3"
          style={{ background: '#f5f4f0', borderColor: 'rgba(196,193,189,0.5)' }}
        >
          <div className="px-3 pb-2 mb-1">
            <span
              className="font-mono text-[10px] px-2 py-1 rounded-md cursor-pointer"
              style={{ background: '#1d1b1b', color: '#e7e7e7' }}
            >
              + New Session
            </span>
          </div>
          <div className="flex flex-col gap-0.5 px-2">
            {MOCK_SIDEBAR.map((item, i) => (
              <button
                key={item}
                className="text-left px-2 py-1.5 rounded-md font-mono text-[10px] leading-snug transition-colors"
                style={{
                  background: i === 0 ? 'rgba(29,27,27,0.07)' : 'transparent',
                  color: i === 0 ? '#1d1b1b' : '#6e6e6e',
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Main pane */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Command bar */}
          <div
            className="flex items-center justify-between px-4 h-9 border-b font-mono text-[11px] flex-shrink-0"
            style={{ borderColor: 'rgba(196,193,189,0.4)', color: '#6e6e6e' }}
          >
            <span>Command center open loops ›</span>
            <span className="text-[10px]" style={{ color: '#a1a1a1' }}>⌘K</span>
          </div>

          {/* Query bubble */}
          <div className="px-4 pt-4 pb-2">
            <div
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-[11px]"
              style={{ background: 'rgba(168,100,72,0.08)', color: '#824b2f', border: '1px solid rgba(168,100,72,0.15)' }}
            >
              <span className="opacity-60">↗</span>
              {data.query}
            </div>
          </div>

          {/* Results list */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
            {data.items.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.25 }}
                className="flex items-start gap-2.5 py-1.5"
              >
                <AppDot name={item.app} />
                <div className="min-w-0">
                  <span className="font-mono text-[10px] font-medium" style={{ color: '#1d1b1b' }}>
                    {item.app}
                  </span>
                  <p className="font-mono text-[9.5px] leading-relaxed mt-0.5" style={{ color: '#6e6e6e' }}>
                    {item.text}
                  </p>
                  {item.sub && (
                    <span
                      className="font-mono text-[8.5px] mt-0.5 inline-block"
                      style={{ color: '#a86448' }}
                    >
                      {item.sub}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Summary */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: data.items.length * 0.06 + 0.1, duration: 0.3 }}
              className="mt-3 px-3 py-2.5 rounded-lg font-mono text-[10px] leading-relaxed"
              style={{
                background: 'rgba(29,27,27,0.04)',
                border: '1px solid rgba(29,27,27,0.07)',
                color: '#464242',
              }}
            >
              <span className="font-medium" style={{ color: '#1d1b1b' }}>Today — </span>
              {data.summary}
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function Hero() {
  const [activeTab, setActiveTab] = useState('loops')

  return (
    <section
      className="relative min-h-screen pt-[54px] overflow-hidden"
      style={{ background: '#fdfdfd' }}
    >
      {/* Ambient top glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(168,100,72,0.10), transparent 70%)',
        }}
      />

      <div className="relative max-w-[1300px] mx-auto px-6 lg:px-10 pt-14 pb-0">

        {/* ── Top row: headline + context panel ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-12 items-start mb-10">

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1
              className="font-display leading-none"
              style={{
                fontSize: 'clamp(44px, 6vw, 76px)',
                fontWeight: 400,
                letterSpacing: '-0.05em',
                color: '#1d1b1b',
                fontFeatureSettings: '"ss01"',
              }}
            >
              The AI App
              <br />
              that Does the Work.
            </h1>
          </motion.div>

          {/* Context panel */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="lg:pt-2 flex flex-col gap-4"
          >
            <p
              className="font-mono text-[10px] font-medium tracking-[0.1em] uppercase leading-relaxed"
              style={{ color: '#a1a1a1' }}
            >
              Runner connects to the tools you already use to get more done.
            </p>
            <a
              href="#get-started"
              className="flex items-center gap-2.5 font-mono text-[12px] font-medium px-4 py-2.5 rounded-lg w-fit transition-all duration-150"
              style={{ background: '#1d1b1b', color: '#e7e7e7' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#2d2b2b' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1d1b1b' }}
            >
              Get Started
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="rgba(231,231,231,0.8)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <p className="font-mono text-[10px]" style={{ color: '#a1a1a1' }}>
              7 day free trial · No credit card required
            </p>
          </motion.div>
        </div>

        {/* ── Tab row ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-wrap gap-2 mb-8"
        >
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-full font-mono text-[11px] transition-all duration-200 border"
              style={{
                background: activeTab === tab.id ? '#1d1b1b' : 'rgba(255,255,255,0.7)',
                color: activeTab === tab.id ? '#e7e7e7' : '#6e6e6e',
                borderColor: activeTab === tab.id ? '#1d1b1b' : 'rgba(196,193,189,0.8)',
              }}
            >
              {tab.label}
              {tab.index && (
                <span
                  className="text-[9px] font-mono px-1 py-0.5 rounded"
                  style={{
                    background: activeTab === tab.id ? 'rgba(255,255,255,0.12)' : 'rgba(196,193,189,0.4)',
                    color: activeTab === tab.id ? 'rgba(231,231,231,0.7)' : '#a1a1a1',
                  }}
                >
                  {tab.index}
                </span>
              )}
            </button>
          ))}
        </motion.div>

        {/* ── Browser mockup ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="pb-0"
        >
          <BrowserMockup activeTab={activeTab} />
        </motion.div>
      </div>

      {/* Bottom fade into next section */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #fdfdfd)' }}
      />
    </section>
  )
}
