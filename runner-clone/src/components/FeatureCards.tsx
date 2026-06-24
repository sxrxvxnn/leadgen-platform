/**
 * FeatureCards — "You talk, Runner runs"
 *
 * Three-column grid showing core value propositions:
 * 01 Runner does the Work, 02 One App All Your Tools, 03 Runner Remembers.
 *
 * Each card has: numbered eyebrow, icon, title, body copy.
 * Mini demo rows in cards 01 and 02 show app/task integrations.
 * Cards have a warm cream background, dashed border, subtle shadow.
 * Scroll-triggered fade-up via Framer Motion.
 */

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const CARD_TASKS = [
  { icon: '✦', label: 'Pull comps & price listings' },
  { icon: '✦', label: 'Complete pricing analysis' },
  { icon: '✦', label: 'Send analysis to clients' },
]

const APP_INTEGRATIONS = [
  { name: 'HubSpot',  color: '#ff7a59' },
  { name: 'Notion',   color: '#1d1b1b' },
  { name: 'Linear',   color: '#5e6ad2' },
  { name: 'Gmail',    color: '#ea4335' },
  { name: 'Slack',    color: '#e01e5a' },
  { name: 'GitHub',   color: '#24292f' },
]

function AppIcon({ name, color }: { name: string; color: string }) {
  const initials = name.substring(0, 2).toUpperCase()
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded text-[9px] font-bold text-white flex-shrink-0"
      style={{ background: color }}
      title={name}
    >
      {initials}
    </span>
  )
}

const CARDS = [
  {
    num: '01',
    title: 'Runner does the Work',
    body: 'Runner is the first AI tool to ask you to take actions yourself. It pulls the information it needs and does the work for you.',
    demo: (
      <div className="mt-4 space-y-2">
        {CARD_TASKS.map(t => (
          <div
            key={t.label}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(196,193,189,0.5)' }}
          >
            <span className="text-[10px]" style={{ color: '#a86448' }}>{t.icon}</span>
            <span className="font-mono text-[11px]" style={{ color: '#1d1b1b' }}>{t.label}</span>
          </div>
        ))}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg mt-1"
          style={{ background: '#1d1b1b' }}
        >
          <span className="text-[9px] font-mono" style={{ color: 'rgba(231,231,231,0.5)' }}>MLS</span>
          <span className="font-mono text-[10px] ml-1" style={{ color: '#e7e7e7' }}>Approve next steps</span>
          <svg className="ml-auto" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 6h6M7 4l2 2-2 2" stroke="rgba(231,231,231,0.7)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    ),
  },
  {
    num: '02',
    title: 'One App, All Your Tools',
    body: 'Runner connects to 50+ of the most-used apps and services, enjoying data or giving data, running tasks, or gluing apps together.',
    demo: (
      <div className="mt-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {APP_INTEGRATIONS.map(app => (
            <div
              key={app.name}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md"
              style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(196,193,189,0.5)' }}
            >
              <AppIcon name={app.name} color={app.color} />
              <span className="font-mono text-[10px]" style={{ color: '#464242' }}>{app.name}</span>
            </div>
          ))}
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(168,100,72,0.06)', border: '1px solid rgba(168,100,72,0.12)' }}
        >
          <span className="font-mono text-[10px]" style={{ color: '#a86448' }}>+ 44 more integrations</span>
        </div>
      </div>
    ),
  },
  {
    num: '03',
    title: 'Runner Remembers',
    body: 'Personal and team memory means Runner gets better the more you use it. It learns your contacts, your preferences, your priorities.',
    demo: (
      <div className="mt-4 space-y-2">
        {[
          { key: 'Preferred CRM', val: 'HubSpot' },
          { key: 'Follow-up style', val: 'Short & direct' },
          { key: 'Key contact', val: 'Sarah @ Acme' },
          { key: 'Work hours', val: '9am – 6pm EST' },
        ].map(row => (
          <div key={row.key} className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(196,193,189,0.4)' }}
          >
            <span className="font-mono text-[10px]" style={{ color: '#6e6e6e' }}>{row.key}</span>
            <span className="font-mono text-[10px] font-medium" style={{ color: '#1d1b1b' }}>{row.val}</span>
          </div>
        ))}
      </div>
    ),
  },
]

export default function FeatureCards() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      ref={ref}
      className="py-20 lg:py-28"
      style={{ background: '#fdfdfd' }}
    >
      <div className="max-w-[1300px] mx-auto px-6 lg:px-10">

        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          className="mb-14"
        >
          <h2
            className="font-display"
            style={{
              fontSize: 'clamp(32px, 4vw, 52px)',
              fontWeight: 400,
              letterSpacing: '-0.04em',
              color: '#1d1b1b',
            }}
          >
            You talk, Runner runs.
          </h2>
        </motion.div>

        {/* Three cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px"
          style={{ background: 'rgba(196,193,189,0.5)', borderRadius: '16px', overflow: 'hidden' }}>
          {CARDS.map((card, i) => (
            <motion.div
              key={card.num}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="p-6 flex flex-col"
              style={{ background: '#fdfdfd' }}
            >
              {/* Number eyebrow */}
              <span
                className="font-mono text-[10px] font-medium mb-5 block"
                style={{ color: '#a1a1a1', letterSpacing: '0.08em' }}
              >
                {card.num}
              </span>

              {/* Title */}
              <h3
                className="font-display mb-2"
                style={{ fontSize: '20px', fontWeight: 400, letterSpacing: '-0.03em', color: '#1d1b1b' }}
              >
                {card.title}
              </h3>

              {/* Body */}
              <p className="text-[13px] leading-relaxed" style={{ color: '#464242' }}>
                {card.body}
              </p>

              {/* Demo */}
              {card.demo}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
