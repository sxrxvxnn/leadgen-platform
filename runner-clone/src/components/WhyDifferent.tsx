/**
 * WhyDifferent — "Everything that makes Runner different (and better!)"
 *
 * Two-column layout:
 * - Left: sticky text panel with heading, description, numbered feature list
 * - Right: cycling app screenshots that change as features are highlighted
 *
 * Features: Concurrent Runners, Local + Cloud, Memory Across Sessions,
 * Integrations, Browser Automation, Workflow Library.
 *
 * Right panel shows an animated app mock that swaps based on active feature
 * as the user scrolls (intersection observer to track which feature is active).
 */

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const FEATURES = [
  {
    num: '1',
    title: 'Concurrent Runners',
    body: 'Run multiple tasks in parallel. Draft follow-ups while pulling analytics while updating your CRM. Receipts for everything.',
    mock: {
      title: 'Parallel tasks running',
      items: [
        { label: 'Draft follow-up email to Acme',  status: 'running', progress: 72 },
        { label: 'Update HubSpot CRM contacts',    status: 'done',    progress: 100 },
        { label: 'Pull Mixpanel DAU for last 30d', status: 'running', progress: 44 },
        { label: 'Send Slack digest to #marketing', status: 'queued',  progress: 0 },
      ],
    },
  },
  {
    num: '2',
    title: 'Local + Cloud',
    body: "Works across your local machine and cloud services. Manages files, apps, and workflows wherever they live. Your data stays yours.",
    mock: {
      title: 'Data sources connected',
      items: [
        { label: '~/Desktop — 2.4 GB',           status: 'done',    progress: 100 },
        { label: 'Google Drive — 34 GB',          status: 'done',    progress: 100 },
        { label: 'Dropbox — 12 GB',               status: 'running', progress: 68 },
        { label: 'iCloud — syncing',              status: 'running', progress: 31 },
      ],
    },
  },
  {
    num: '3',
    title: 'Memory Across Sessions',
    body: "Runner remembers what matters across sessions; your contacts, your preferences, your unfinished work. Context that compounds over time.",
    mock: {
      title: 'Runner knows you',
      items: [
        { label: 'Prefers bullet-point summaries', status: 'done',    progress: 100 },
        { label: 'Works 9am–6pm Eastern',          status: 'done',    progress: 100 },
        { label: 'Sarah @ Acme = top priority',   status: 'done',    progress: 100 },
        { label: 'CRM is HubSpot',                status: 'done',    progress: 100 },
      ],
    },
  },
  {
    num: '4',
    title: 'Deep Integrations',
    body: 'Native integrations with 50+ apps — not shallow webhooks. Runner reads, writes, and acts inside your tools at a deep level.',
    mock: {
      title: 'Active integrations',
      items: [
        { label: 'Gmail — full read/write',        status: 'done', progress: 100 },
        { label: 'HubSpot — CRM + deals',          status: 'done', progress: 100 },
        { label: 'Linear — issues + projects',     status: 'done', progress: 100 },
        { label: 'GitHub — PRs + issues',          status: 'done', progress: 100 },
      ],
    },
  },
  {
    num: '5',
    title: 'Browser Automation',
    body: 'Built-in Chrome browser lets Runner research the web, fill forms, and extract data without leaving your workflow.',
    mock: {
      title: 'Browser running in background',
      items: [
        { label: 'Opening openTable for reservation', status: 'running', progress: 55 },
        { label: 'Entering party of 4, Thu Apr 3',   status: 'queued',  progress: 0 },
        { label: 'Selecting 7:30 PM slot',           status: 'queued',  progress: 0 },
        { label: 'Completing reservation form',      status: 'queued',  progress: 0 },
      ],
    },
  },
  {
    num: '6',
    title: 'Workflow Library',
    body: "A growing library of community-built automations. Import and customise in one click. Or build your own and share it.",
    mock: {
      title: 'Workflow templates',
      items: [
        { label: 'AI Board Prep for Founders',      status: 'done', progress: 100 },
        { label: 'Qualify Inbound Leads',           status: 'done', progress: 100 },
        { label: 'Gmail + Calendar Follow-Through', status: 'done', progress: 100 },
        { label: 'Morning Briefing',                status: 'done', progress: 100 },
      ],
    },
  },
]

function MockScreen({ feature }: { feature: typeof FEATURES[0] }) {
  const statusColor = (s: string) =>
    s === 'done' ? '#28c840' : s === 'running' ? '#a86448' : '#c4c1bd'

  return (
    <motion.div
      key={feature.num}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: '#f5f5f2',
        border: '1px solid rgba(196,193,189,0.6)',
        boxShadow: '0 16px 48px rgba(29,27,27,0.08)',
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center gap-2 px-4 h-10 border-b"
        style={{ background: '#eeece8', borderColor: 'rgba(196,193,189,0.5)' }}
      >
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="font-mono text-[11px] ml-2" style={{ color: '#a1a1a1' }}>
          {feature.mock.title}
        </span>
      </div>

      {/* Content */}
      <div className="p-5 space-y-3">
        {feature.mock.items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: statusColor(item.status) }}
                />
                <span className="font-mono text-[11px]" style={{ color: '#1d1b1b' }}>{item.label}</span>
              </div>
              <span
                className="font-mono text-[10px]"
                style={{ color: statusColor(item.status) }}
              >
                {item.status === 'done' ? '✓' : item.status === 'running' ? `${item.progress}%` : '—'}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(196,193,189,0.4)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: statusColor(item.status) }}
                initial={{ width: 0 }}
                animate={{ width: `${item.progress}%` }}
                transition={{ delay: i * 0.08 + 0.1, duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

export default function WhyDifferent() {
  const [active, setActive] = useState(0)
  const sectionRef = useRef<HTMLDivElement>(null)
  const featureRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = featureRefs.current.indexOf(entry.target as HTMLDivElement)
            if (idx !== -1) setActive(idx)
          }
        })
      },
      { threshold: 0.5 }
    )
    featureRefs.current.forEach(el => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ background: '#fdfdfd' }}
    >
      {/* Ambient gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 30% 50%, rgba(168,100,72,0.06), transparent 60%)',
        }}
      />

      <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 py-20 lg:py-28">

          {/* Left — sticky text */}
          <div>
            <div className="sticky top-20">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55 }}
              >
                <h2
                  className="font-display mb-5"
                  style={{
                    fontSize: 'clamp(28px, 3.5vw, 48px)',
                    fontWeight: 400,
                    letterSpacing: '-0.04em',
                    color: '#1d1b1b',
                  }}
                >
                  Everything that makes Runner different.{' '}
                  <em style={{ color: '#a86448', fontStyle: 'italic' }}>(and better!)</em>
                </h2>
                <p className="text-[14px] leading-relaxed mb-10" style={{ color: '#464242' }}>
                  Runner doesn't just suggest. It acts — streamlining your workflows and ensuring that tasks are completed efficiently and effectively. It takes care of the details so you can focus on what truly matters.
                </p>
              </motion.div>

              {/* Feature list */}
              <div className="space-y-0">
                {FEATURES.map((feat, i) => (
                  <div
                    key={feat.num}
                    ref={el => { featureRefs.current[i] = el }}
                    className="border-t py-5 cursor-pointer transition-all duration-200"
                    style={{ borderColor: 'rgba(196,193,189,0.5)' }}
                    onClick={() => setActive(i)}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className="font-mono text-[11px] flex-shrink-0 mt-0.5 transition-colors duration-200"
                        style={{ color: active === i ? '#a86448' : '#c4c1bd' }}
                      >
                        {feat.num}
                      </span>
                      <div>
                        <h3
                          className="font-mono text-[13px] font-medium mb-1 transition-colors duration-200"
                          style={{ color: active === i ? '#1d1b1b' : '#6e6e6e' }}
                        >
                          {feat.title}
                        </h3>
                        {active === i && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-[13px] leading-relaxed"
                            style={{ color: '#6e6e6e' }}
                          >
                            {feat.body}
                          </motion.p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="border-t" style={{ borderColor: 'rgba(196,193,189,0.5)' }} />
              </div>
            </div>
          </div>

          {/* Right — animated screenshot */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-md sticky top-24">
              <AnimatePresence mode="wait">
                <MockScreen key={active} feature={FEATURES[active]} />
              </AnimatePresence>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
