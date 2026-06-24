/**
 * Comparison — "What Makes Runner Different?"
 *
 * Shows side-by-side use-case scenarios: user prompt on the left,
 * generic AI response in the middle, Runner's actual execution on the right.
 *
 * Layout: sticky left label "When you say:" / prompt, then two columns
 * showing ChatGPT (limited) vs Runner (full execution with multi-app steps).
 *
 * Rows scroll vertically, alternating competitors: ChatGPT, Zapier,
 * Agent, WhatsApp Agent.
 */

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface Scenario {
  prompt: string
  competitor: { name: string; logo: string; response: string }
  runner: { steps: string[] }
}

const SCENARIOS: Scenario[] = [
  {
    prompt: 'Show me every\nopen loop across\nwork and life',
    competitor: {
      name: 'ChatGPT',
      logo: '⬡',
      response: '"To track open loops, create a list or task manager. Use apps like Todoist or Notion to capture items, review each morning, and process each week…"',
    },
    runner: {
      steps: [
        'Scanning Gmail inbox for unread + flagged threads…',
        'Checking Calendar for outstanding invites and follow-ups…',
        'Searching Slack for @mentions with no reply…',
        'Reviewing Google Drive for shared docs with open comments…',
        'Checking iMessage & WhatsApp for unanswered messages…',
        '✓ 14 open loops surfaced across 5 tools — summary ready.',
      ],
    },
  },
  {
    prompt: 'Every time a lead\nfills out our\ncontact form, I want\nto make sure we\nfollow up fast',
    competitor: {
      name: 'Zapier',
      logo: '⚡',
      response: '"Workflow needs to be setup in advance" — configure a Zap with a form trigger, set delay timer, write email template manually…',
    },
    runner: {
      steps: [
        'Watching HubSpot form submissions in real-time…',
        'Lead submitted: Acme Corp, Sarah Chen, VP Engineering',
        'Enriching with LinkedIn + Clearbit data…',
        'Drafting personalised follow-up using context from CRM…',
        'Notifying Slack #sales with enriched profile…',
        '✓ Lead qualified, draft sent, team notified in 12 seconds.',
      ],
    },
  },
  {
    prompt: 'Can you help me\nfind that file that\nMike sent me last\nweek, I think it\'s\nin my Downloads?',
    competitor: {
      name: 'Agent',
      logo: '🤖',
      response: '"Sorry, I don\'t have access to your computer." — cannot access local files, cannot search Downloads, cannot find attachments…',
    },
    runner: {
      steps: [
        'Searching Downloads folder for files from last 7 days…',
        'Cross-referencing Gmail for attachments from Mike…',
        'Found: "Q3-Proposal-Final.pdf" — sent by Mike Johnson, Thu',
        'Also found matching Slack DM from Mike with context…',
        'Opening file and extracting key sections…',
        '✓ File found, key points summarised, ready to action.',
      ],
    },
  },
  {
    prompt: 'Can you look\nthrough my Desktop\nto find the contract\nDoc for Acme',
    competitor: {
      name: 'WhatsApp Agent',
      logo: '💬',
      response: '"Sorry, I don\'t have access to your Desktop." — limited to chat interface, no file system access, no Drive integration…',
    },
    runner: {
      steps: [
        'Searching Desktop and recent Downloads…',
        'Checking Google Drive for "Acme" documents…',
        'Found: "Acme-MSA-v2.docx" — Drive, edited 3 days ago',
        'Found: "Acme_Contract_Signed.pdf" — Desktop, 2 weeks ago',
        'Extracting key terms: renewal date, SLA, payment terms…',
        '✓ Both files found — contract summary with key dates ready.',
      ],
    },
  },
]

function RunnerStep({ step, delay }: { step: string; delay: number }) {
  const isDone = step.startsWith('✓')
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-start gap-2 py-1.5"
    >
      <span
        className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5"
        style={{ background: isDone ? '#28c840' : '#a86448' }}
      />
      <span
        className="font-mono text-[11px] leading-relaxed"
        style={{ color: isDone ? '#1d1b1b' : '#464242' }}
      >
        {step}
      </span>
    </motion.div>
  )
}

function ScenarioRow({ scenario }: { scenario: Scenario }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <div
      ref={ref}
      className="grid grid-cols-1 lg:grid-cols-[240px_1fr_1fr] gap-px"
      style={{ background: 'rgba(196,193,189,0.4)' }}
    >
      {/* Left: When you say */}
      <motion.div
        className="p-6 lg:p-8"
        style={{ background: '#fdfdfd' }}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <p className="font-mono text-[9px] uppercase tracking-widest mb-4" style={{ color: '#a1a1a1' }}>
          When you say
        </p>
        <p
          className="font-display text-[18px] leading-snug"
          style={{
            fontWeight: 400,
            letterSpacing: '-0.03em',
            color: '#1d1b1b',
            whiteSpace: 'pre-line',
          }}
        >
          {scenario.prompt}
        </p>
      </motion.div>

      {/* Middle: Generic AI */}
      <motion.div
        className="p-6 lg:p-8"
        style={{ background: '#fafafa' }}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg font-mono text-[13px]"
            style={{ background: 'rgba(29,27,27,0.06)', color: '#6e6e6e' }}
          >
            {scenario.competitor.logo}
          </span>
          <span className="font-mono text-[11px] font-medium" style={{ color: '#6e6e6e' }}>
            {scenario.competitor.name}
          </span>
        </div>
        <p className="text-[12px] leading-relaxed italic" style={{ color: '#6e6e6e' }}>
          {scenario.competitor.response}
        </p>
      </motion.div>

      {/* Right: Runner execution */}
      <motion.div
        className="p-6 lg:p-8"
        style={{ background: '#fdfdfd' }}
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="0" y="0" width="8" height="8" rx="1.5" fill="#1d1b1b" />
            <rect x="10" y="0" width="8" height="8" rx="1.5" fill="#1d1b1b" />
            <rect x="0" y="10" width="8" height="8" rx="1.5" fill="#1d1b1b" />
            <rect x="10" y="10" width="8" height="8" rx="1.5" fill="#1d1b1b" />
          </svg>
          <span className="font-mono text-[11px] font-medium" style={{ color: '#1d1b1b' }}>
            Runner
          </span>
        </div>
        <div className="space-y-0">
          {scenario.runner.steps.map((step, i) => (
            <RunnerStep
              key={i}
              step={step}
              delay={inView ? i * 0.08 + 0.1 : 0}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default function Comparison() {
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
          className="mb-12"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] mb-3" style={{ color: '#a1a1a1' }}>
            Product
          </p>
          <h2
            className="font-display"
            style={{
              fontSize: 'clamp(28px, 3.5vw, 48px)',
              fontWeight: 400,
              letterSpacing: '-0.04em',
              color: '#1d1b1b',
            }}
          >
            What Makes Runner Different?
          </h2>
          <p className="text-[14px] mt-3 max-w-lg" style={{ color: '#6e6e6e' }}>
            Most AI tools tell you what to do next. Runner takes your goals and runs with them — across every tool you use.
          </p>
        </motion.div>

        {/* Column headers */}
        <div
          className="grid grid-cols-1 lg:grid-cols-[240px_1fr_1fr] mb-px"
          style={{ background: 'rgba(196,193,189,0.4)', borderRadius: '16px 16px 0 0', overflow: 'hidden' }}
        >
          <div className="p-4 lg:p-6" style={{ background: '#f5f5f2' }}>
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#a1a1a1' }}>Scenario</span>
          </div>
          <div className="p-4 lg:p-6" style={{ background: '#f5f5f2' }}>
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#a1a1a1' }}>Generic AI</span>
          </div>
          <div className="p-4 lg:p-6" style={{ background: '#f5f5f2' }}>
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#a86448' }}>Runner</span>
          </div>
        </div>

        {/* Scenario rows */}
        <div
          className="overflow-hidden"
          style={{ borderRadius: '0 0 16px 16px', border: '1px solid rgba(196,193,189,0.4)', borderTop: 'none' }}
        >
          {SCENARIOS.map((scenario, i) => (
            <div key={i} className={i < SCENARIOS.length - 1 ? 'border-b' : ''} style={{ borderColor: 'rgba(196,193,189,0.4)' }}>
              <ScenarioRow scenario={scenario} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
