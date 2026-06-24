/**
 * FAQ — accordion with left "FAQ" heading and right question list.
 *
 * Large serif "FAQ" on the left, accordion items on the right.
 * Items separated by dashed dividers. Expand/collapse with smooth height
 * animation via Framer Motion. Only one item open at a time.
 *
 * Background: slightly warmer cream `#f5f5f2`.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface FAQItem {
  q: string
  a: string
}

const FAQ_ITEMS: FAQItem[] = [
  {
    q: 'What is Runner?',
    a: "Runner is a desktop AI assistant that connects to the apps you already use and actually does the work. Gmail, Calendar, Slack, Drive, GitHub, Notion, your local files. It drafts the reply, preps the meeting, files the follow-up, pulls the data. Your day ends with things finished, not suggested.",
  },
  {
    q: 'Which apps and tools does Runner work with?',
    a: "Runner connects to 50+ tools including Gmail, Google Calendar, Google Drive, Google Docs, Google Sheets, Slack, HubSpot, Notion, Linear, GitHub, Airtable, Asana, Dropbox, Intercom, Trello, Calendly, Mixpanel, Sentry, Shopify, Zendesk, PostHog, Supabase, QuickBooks, and more. New integrations ship every week.",
  },
  {
    q: 'Does Runner run on my computer? Which operating systems are supported?',
    a: "Runner is a desktop application available for macOS. Windows support is on our roadmap. Runner can access your local files, Downloads folder, Desktop, and any locally-installed apps alongside cloud services.",
  },
  {
    q: 'How does Runner keep my data private and secure?',
    a: "Runner is SOC 2 Type 1 certified and CASA Tier 2 certified. SOC 2 Type 2 audit is in progress, as is GDPR compliance. Runner operates on a minimal-access principle — it only requests the permissions it needs for the specific task at hand and never stores sensitive data beyond session context.",
  },
  {
    q: 'Can I control what Runner does before it acts?',
    a: "Yes — by default, Runner asks for your approval before taking any action (sending emails, creating tasks, updating CRM records, etc.). As you build trust with Runner, you can enable auto-pilot mode for specific workflows to let it run without interruption.",
  },
  {
    q: 'What is the Workflow Library?',
    a: "The Workflow Library is a curated collection of pre-built automation templates contributed by the Runner community. Templates include Board Prep for Founders, Qualify Inbound Leads, Morning Briefings, Meeting Follow-Ups, and many more. Import a workflow in one click and customise it for your needs.",
  },
  {
    q: 'Is there a free trial?',
    a: "Yes — every plan starts with a 7-day free trial. No credit card required. You can explore all features and integrations before committing to a paid plan.",
  },
  {
    q: 'What is the difference between Standard, Pro, and Ultra?',
    a: "Standard ($50/mo) is great for everyday productivity with unlimited connectors and custom workflows. Pro ($100/mo) adds 5x more usage, browser automation, and team memory. Ultra ($200/mo) provides 14x usage — optimised for teams that run Runner throughout every workday.",
  },
]

function FAQRow({ item, isOpen, onToggle }: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div
      className="border-b"
      style={{ borderColor: 'rgba(196,193,189,0.6)', borderStyle: 'dashed' }}
    >
      <button
        className="w-full flex items-start justify-between gap-6 py-5 text-left"
        onClick={onToggle}
      >
        <span
          className="font-mono text-[13px] font-medium leading-snug"
          style={{ color: '#1d1b1b' }}
        >
          {item.q}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="flex-shrink-0 mt-0.5"
          style={{ color: '#a1a1a1' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <p
              className="text-[13px] leading-relaxed pb-5"
              style={{ color: '#464242' }}
            >
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <section
      id="faq"
      className="py-20 lg:py-28"
      style={{ background: '#f5f5f2' }}
    >
      <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12 lg:gap-20">

          {/* Left: FAQ heading */}
          <div className="lg:pt-1">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="font-display sticky top-24"
              style={{
                fontSize: 'clamp(48px, 7vw, 96px)',
                fontWeight: 400,
                letterSpacing: '-0.06em',
                color: '#1d1b1b',
              }}
            >
              FAQ
            </motion.h2>
          </div>

          {/* Right: accordion */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            {/* Top border */}
            <div
              className="border-t mb-0"
              style={{ borderColor: 'rgba(196,193,189,0.6)', borderStyle: 'dashed' }}
            />
            {FAQ_ITEMS.map((item, i) => (
              <FAQRow
                key={i}
                item={item}
                isOpen={openIdx === i}
                onToggle={() => setOpenIdx(openIdx === i ? null : i)}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
