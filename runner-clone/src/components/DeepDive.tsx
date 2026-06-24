/**
 * DeepDive — features 04, 05, 06 in a 3-column grid.
 *
 * 04 Browser Automation — Runner has a built-in Chrome that searches
 *    the web to find what it needs.
 * 05 You are in control — permission before actions, optional auto-pilot.
 * 06 Workflow Library — pre-built community workflows.
 *
 * Each card has an illustration/mockup on top, then text below.
 * Cards sit on a soft cream background with dashed borders.
 */

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

function BrowserCard() {
  return (
    <div
      className="rounded-xl overflow-hidden mb-5"
      style={{
        background: '#f0eee8',
        border: '1px solid rgba(196,193,189,0.6)',
        height: '180px',
      }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-1.5 px-3 h-7 border-b"
        style={{ background: '#e8e5df', borderColor: 'rgba(196,193,189,0.5)' }}
      >
        <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
        <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
        <span className="w-2 h-2 rounded-full bg-[#28c840]" />
        <span
          className="ml-2 flex-1 h-4 rounded text-[9px] font-mono flex items-center px-2"
          style={{ background: 'rgba(255,255,255,0.5)', color: '#a1a1a1' }}
        >
          runner is browsing…
        </span>
      </div>
      {/* Browser content skeleton */}
      <div className="p-3 space-y-1.5">
        {[80, 60, 90, 50, 70].map((w, i) => (
          <div
            key={i}
            className="h-2 rounded-full"
            style={{
              width: `${w}%`,
              background: 'rgba(29,27,27,0.08)',
            }}
          />
        ))}
        <div className="flex gap-2 mt-2">
          {['🔗 Source 1', '🔗 Source 2'].map(s => (
            <span
              key={s}
              className="font-mono text-[8px] px-2 py-0.5 rounded"
              style={{ background: 'rgba(168,100,72,0.1)', color: '#a86448' }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ControlCard() {
  return (
    <div
      className="rounded-xl overflow-hidden mb-5"
      style={{
        background: '#f5f5f2',
        border: '1px solid rgba(196,193,189,0.6)',
        height: '180px',
        padding: '16px',
      }}
    >
      <p className="font-mono text-[10px] mb-3" style={{ color: '#a1a1a1' }}>Approve next steps</p>
      {[
        { label: 'Review product context and blueprints', checked: true },
        { label: 'Draft article for documentation', checked: false },
      ].map(item => (
        <div
          key={item.label}
          className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2"
          style={{
            background: item.checked ? 'rgba(40,200,64,0.08)' : 'rgba(255,255,255,0.8)',
            border: `1px solid ${item.checked ? 'rgba(40,200,64,0.2)' : 'rgba(196,193,189,0.5)'}`,
          }}
        >
          <span
            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
            style={{
              background: item.checked ? '#28c840' : 'transparent',
              border: item.checked ? '1px solid #28c840' : '1px solid rgba(196,193,189,0.8)',
            }}
          >
            {item.checked && (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="font-mono text-[10px]" style={{ color: '#1d1b1b' }}>{item.label}</span>
        </div>
      ))}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg mt-1"
        style={{ background: '#1d1b1b' }}
      >
        <span className="font-mono text-[10px]" style={{ color: '#e7e7e7' }}>Run without asking →</span>
      </div>
    </div>
  )
}

function WorkflowCard() {
  const items = ['AI Board Prep for Founders', 'Qualify Inbound Leads', 'Morning Briefing', 'Meeting Follow-Up']
  return (
    <div
      className="rounded-xl overflow-hidden mb-5"
      style={{
        background: '#f5f5f2',
        border: '1px solid rgba(196,193,189,0.6)',
        height: '180px',
      }}
    >
      {/* Grid of tiles */}
      <div className="grid grid-cols-2 gap-px p-0.5 h-full" style={{ background: 'rgba(196,193,189,0.4)' }}>
        {items.map((item, i) => (
          <div
            key={item}
            className="flex items-end p-3"
            style={{ background: i % 2 === 0 ? '#f5f5f2' : '#eeece8' }}
          >
            <span className="font-mono text-[9px] leading-snug" style={{ color: '#6e6e6e' }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const FEATURES = [
  {
    num: '04',
    title: 'Browser Automation',
    body: "Runner has a built-in Chrome browser that searches the web to find what it needs. It opens web pages and infiltrates filled in the background while you keep going.",
    card: <BrowserCard />,
  },
  {
    num: '05',
    title: 'You are in control',
    body: "Runner asks your permission before it takes an action for you. As you trust Runner more, you can have configurations off and go on auto-pilot.",
    card: <ControlCard />,
  },
  {
    num: '06',
    title: 'Workflow Library',
    body: "Runner's growing list of workflows means you can learn from the community and get inspired for what to automate next.",
    card: <WorkflowCard />,
  },
]

export default function DeepDive() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section
      ref={ref}
      className="pb-20 lg:pb-28"
      style={{ background: '#fdfdfd' }}
    >
      <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px"
          style={{ background: 'rgba(196,193,189,0.5)', borderRadius: '16px', overflow: 'hidden' }}>
          {FEATURES.map((feat, i) => (
            <motion.div
              key={feat.num}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="p-6 flex flex-col"
              style={{ background: '#fdfdfd' }}
            >
              <span
                className="font-mono text-[10px] font-medium mb-5 block"
                style={{ color: '#a1a1a1', letterSpacing: '0.08em' }}
              >
                {feat.num}
              </span>

              {feat.card}

              <h3
                className="font-display mb-2"
                style={{ fontSize: '20px', fontWeight: 400, letterSpacing: '-0.03em', color: '#1d1b1b' }}
              >
                {feat.title}
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: '#464242' }}>
                {feat.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
