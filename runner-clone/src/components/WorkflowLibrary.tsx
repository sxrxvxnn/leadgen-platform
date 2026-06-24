/**
 * WorkflowLibrary — "Get Inspired by our Workflow Library"
 *
 * Horizontally scrollable card row with 6 workflow template cards.
 * Each card has a coloured tile, workflow name, description snippet,
 * a list of connected app icons, and a "Use template" button.
 *
 * Cards scroll with snap on mobile, free-flow on desktop.
 * "Browse all" link at section level.
 */

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface WorkflowTemplate {
  title: string
  description: string
  apps: { name: string; color: string }[]
  category: string
  cardBg: string
}

const WORKFLOWS: WorkflowTemplate[] = [
  {
    title: 'AI Board Prep for Founders',
    description: 'Pulls financials, KPIs, project status, and team updates into a structured board deck — automatically.',
    apps: [
      { name: 'GD', color: '#fbbc04' },
      { name: 'NS', color: '#1d1b1b' },
      { name: 'LI', color: '#5e6ad2' },
      { name: 'SL', color: '#e01e5a' },
    ],
    category: 'Founders',
    cardBg: '#f0ebe4',
  },
  {
    title: 'Founder Intro Double Opt-In',
    description: 'Manages warm intro workflows — gets consent from both sides, drafts the intro email, and logs everything in your CRM.',
    apps: [
      { name: 'GM', color: '#ea4335' },
      { name: 'HS', color: '#ff7a59' },
      { name: 'NS', color: '#1d1b1b' },
    ],
    category: 'Networking',
    cardBg: '#e8edf4',
  },
  {
    title: 'Draft Memo from Slack, Notes, and Docs',
    description: 'Takes scattered notes from Slack threads, Notion pages, and Google Docs and turns them into a polished memo.',
    apps: [
      { name: 'SL', color: '#e01e5a' },
      { name: 'NS', color: '#1d1b1b' },
      { name: 'GD', color: '#4285f4' },
    ],
    category: 'Writing',
    cardBg: '#ede8f0',
  },
  {
    title: 'Gmail + Calendar + Drive Follow-Through',
    description: 'Scans every thread with an outstanding commitment, creates tasks, sets follow-up reminders, and files docs.',
    apps: [
      { name: 'GM', color: '#ea4335' },
      { name: 'GC', color: '#4285f4' },
      { name: 'GD', color: '#fbbc04' },
    ],
    category: 'Productivity',
    cardBg: '#e8f4ec',
  },
  {
    title: 'Qualify Inbound Leads',
    description: 'Enriches form submissions with LinkedIn + Clearbit data, scores the lead, routes to the right rep, and drafts the first reply.',
    apps: [
      { name: 'HS', color: '#ff7a59' },
      { name: 'LI', color: '#5e6ad2' },
      { name: 'SL', color: '#e01e5a' },
      { name: 'GM', color: '#ea4335' },
    ],
    category: 'Sales',
    cardBg: '#f4ece8',
  },
  {
    title: 'Meeting Follow-Up Automation',
    description: 'After every meeting, extracts action items, assigns owners, creates Linear/Asana tasks, and sends a follow-up email.',
    apps: [
      { name: 'GC', color: '#4285f4' },
      { name: 'LN', color: '#5e6ad2' },
      { name: 'GM', color: '#ea4335' },
      { name: 'SL', color: '#e01e5a' },
    ],
    category: 'Meetings',
    cardBg: '#e8f0f4',
  },
]

function WorkflowCard({ wf, index, inView }: { wf: WorkflowTemplate; index: number; inView: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="flex-shrink-0 rounded-2xl overflow-hidden flex flex-col cursor-pointer group"
      style={{
        width: '280px',
        background: wf.cardBg,
        border: '1px solid rgba(196,193,189,0.5)',
      }}
      whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(29,27,27,0.10)' }}
    >
      {/* Color tile top */}
      <div
        className="h-[140px] relative overflow-hidden"
        style={{ background: wf.cardBg }}
      >
        {/* Abstract pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 280 140" fill="none">
          <circle cx="200" cy="20" r="80" fill="rgba(29,27,27,0.3)" />
          <circle cx="40" cy="120" r="60" fill="rgba(29,27,27,0.15)" />
        </svg>
        <div className="absolute bottom-3 left-4">
          <span
            className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.5)', color: '#464242' }}
          >
            {wf.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1" style={{ background: '#ffffff' }}>
        <h3
          className="font-display mb-2 leading-snug"
          style={{ fontSize: '16px', fontWeight: 400, letterSpacing: '-0.02em', color: '#1d1b1b' }}
        >
          {wf.title}
        </h3>
        <p className="text-[12px] leading-relaxed mb-4 flex-1" style={{ color: '#6e6e6e' }}>
          {wf.description}
        </p>

        {/* Apps row */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {wf.apps.map(app => (
              <span
                key={app.name}
                className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white"
                style={{ background: app.color }}
              >
                {app.name}
              </span>
            ))}
          </div>
          <span
            className="font-mono text-[10px] flex items-center gap-1 transition-all duration-200 group-hover:gap-2"
            style={{ color: '#a86448' }}
          >
            Use template
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5h6M5.5 3l2 2-2 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </motion.div>
  )
}

export default function WorkflowLibrary() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <section
      ref={ref}
      className="py-20 lg:py-28 overflow-hidden"
      style={{ background: '#fdfdfd' }}
    >
      <div className="max-w-[1300px] mx-auto px-6 lg:px-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10"
        >
          <div>
            <p
              className="font-mono text-[10px] uppercase tracking-[0.15em] mb-2"
              style={{ color: '#a1a1a1' }}
            >
              Workflows
            </p>
            <h2
              className="font-display"
              style={{
                fontSize: 'clamp(24px, 3.5vw, 44px)',
                fontWeight: 400,
                letterSpacing: '-0.04em',
                color: '#1d1b1b',
              }}
            >
              Get Inspired by our Workflow Library.
            </h2>
            <p className="text-[13px] mt-2" style={{ color: '#6e6e6e' }}>
              Sometimes you just don't know what's possible. We got you.
            </p>
          </div>
          <a
            href="#workflows"
            className="font-mono text-[12px] flex items-center gap-1.5 self-end flex-shrink-0 transition-opacity hover:opacity-70"
            style={{ color: '#6e6e6e' }}
          >
            Browse all workflows
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 6h6M7 4l2 2-2 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>
      </div>

      {/* Scrollable card row — starts at container left, overflows right */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 cursor-grab active:cursor-grabbing"
        style={{
          paddingLeft: 'max(24px, calc((100vw - 1300px)/2 + 40px))',
          paddingRight: '40px',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {WORKFLOWS.map((wf, i) => (
          <div key={wf.title} style={{ scrollSnapAlign: 'start' }}>
            <WorkflowCard wf={wf} index={i} inView={inView} />
          </div>
        ))}
      </div>
    </section>
  )
}
