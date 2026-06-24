/**
 * Pricing — three tiers + Teams & Enterprise row.
 *
 * Standard $50/mo, Pro $100/mo, Ultra $200/mo — each in a card with
 * dashed border separating price from features list.
 * Teams & Enterprise is a full-width row below with a CTA.
 *
 * Cards sit inside a bordered container with dashed internal dividers.
 * "Get Started" and "Give it a run →" CTAs match the dark-button style.
 */

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface Plan {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  highlighted?: boolean
}

const PLANS: Plan[] = [
  {
    name: 'Standard',
    price: '$50',
    period: '/month',
    description: 'Everyday productivity boost',
    features: [
      'Everyday productivity boost',
      'Unlimited Connectors',
      'Multiple Workspaces',
      'Custom Workflows & Automations',
    ],
    cta: 'Start free trial',
  },
  {
    name: 'Pro',
    price: '$100',
    period: '/month',
    description: '5x more usage than Standard',
    features: [
      '5x more usage than Standard',
      'Unlimited Connectors',
      'Multiple Workspaces',
      'Custom Workflows & Automations',
      'Browser Automation',
      'Team Memory',
    ],
    cta: 'Start free trial',
    highlighted: false,
  },
  {
    name: 'Ultra',
    price: '$200',
    period: '/month',
    description: '14x more usage than Standard',
    features: [
      '14x more usage than Standard',
      'Unlimited Connectors',
      'Multiple Workspaces',
      'Custom Workflows & Automations',
      'Browser Automation',
      'Team Memory',
      'Best for daily use, get the most out of Runner',
    ],
    cta: 'Start free trial',
  },
]

function CheckMark() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className="flex-shrink-0 mt-0.5"
    >
      <rect width="12" height="12" rx="2" fill="#1d1b1b" fillOpacity="0.06" />
      <path d="M3 6l2.5 2.5L9 4" stroke="#1d1b1b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Pricing() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      ref={ref}
      id="pricing"
      className="py-20 lg:py-28"
      style={{ background: '#fdfdfd' }}
    >
      <div className="max-w-[1300px] mx-auto px-6 lg:px-10">

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          className="mb-10"
        >
          <h2
            className="font-display"
            style={{
              fontSize: 'clamp(36px, 5vw, 64px)',
              fontWeight: 400,
              letterSpacing: '-0.05em',
              color: '#1d1b1b',
            }}
          >
            Pricing
          </h2>
        </motion.div>

        {/* Pricing container */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-2xl overflow-hidden"
          style={{ border: '1px dashed rgba(196,193,189,0.8)' }}
        >
          {/* Three plan columns */}
          <div className="grid grid-cols-1 md:grid-cols-3">
            {PLANS.map((plan, i) => (
              <div
                key={plan.name}
                className={`p-8 flex flex-col ${i < 2 ? 'md:border-r border-dashed' : ''} ${i === 0 || i === 1 || i === 2 ? 'border-b md:border-b-0' : ''}`}
                style={{
                  borderColor: 'rgba(196,193,189,0.6)',
                  borderStyle: 'dashed',
                }}
              >
                {/* Plan name */}
                <p
                  className="font-display text-[20px] mb-6"
                  style={{ fontWeight: 400, letterSpacing: '-0.02em', color: '#1d1b1b' }}
                >
                  {plan.name}
                </p>

                {/* Price box */}
                <div
                  className="px-5 py-5 rounded-xl mb-6"
                  style={{ background: '#f5f5f2' }}
                >
                  <span
                    className="font-display"
                    style={{
                      fontSize: '36px',
                      fontWeight: 400,
                      letterSpacing: '-0.04em',
                      color: '#1d1b1b',
                    }}
                  >
                    {plan.price}
                  </span>
                  <span className="font-mono text-[12px]" style={{ color: '#6e6e6e' }}>
                    {plan.period}
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-3 flex-1">
                  {plan.features.map(feat => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <CheckMark />
                      <span className="text-[13px] leading-snug" style={{ color: '#464242' }}>
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  className="mt-8 w-full py-3 rounded-xl font-mono text-[12px] font-medium transition-all duration-150"
                  style={{ background: '#1d1b1b', color: '#e7e7e7' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#2d2b2b' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#1d1b1b' }}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Teams & Enterprise row */}
          <div
            className="border-t"
            style={{ borderColor: 'rgba(196,193,189,0.6)', borderStyle: 'dashed' }}
          >
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 p-8 items-center">
              <div>
                <h3
                  className="font-display mb-2"
                  style={{ fontSize: '20px', fontWeight: 400, letterSpacing: '-0.02em', color: '#1d1b1b' }}
                >
                  Teams &amp; Enterprise
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: '#6e6e6e' }}>
                  Deploy Runner for your team. Dedicated AI Workspace. Custom onboarding and workshop to add AI to
                  your team's daily workflow. 95% of teams on Runner uses AI daily in their workflow within 3 months.
                </p>
              </div>
              <div className="flex-shrink-0">
                <button
                  className="flex items-center gap-3 px-6 py-3 rounded-xl font-mono text-[12px] transition-all duration-150 min-w-[200px] justify-between"
                  style={{ background: '#f5f5f2', color: '#1d1b1b', border: '1px solid rgba(196,193,189,0.6)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#eeece8' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f2' }}
                >
                  Give it a run
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M10 5l3 3-3 3" stroke="#1d1b1b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Empty bottom row (as seen in design) */}
          <div
            className="h-16 border-t"
            style={{ borderColor: 'rgba(196,193,189,0.6)', borderStyle: 'dashed' }}
          />
        </motion.div>
      </div>
    </section>
  )
}
