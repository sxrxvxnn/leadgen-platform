/**
 * Testimonials — "You're in good company with Runner"
 *
 * Grid layout: 2 rows of 4 people on desktop.
 * Each card: circular avatar (initials + unique color), name, role/company,
 * italic quote.
 * Subtle entrance animation staggered from left to right.
 * Warm cream background matching the section design.
 */

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface Testimonial {
  name: string
  role: string
  company: string
  quote: string
  color: string
  initials: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Christina',
    role: 'VP, Vice President',
    company: '',
    quote: '"Starting my day with a Morning Briefing from Runner is the single most valuable thing because it\'s where the energy I put into it comes back to me — compounding from there."',
    color: '#c4927a',
    initials: 'CH',
  },
  {
    name: 'Mike',
    role: 'Co-founder, Sanalitics',
    company: '',
    quote: '"Runner pulls together content from every tool I use. Board prep takes minutes, not hours."',
    color: '#7a9e7e',
    initials: 'MI',
  },
  {
    name: 'Laura',
    role: 'Notus, Notus',
    company: '',
    quote: '"Follow-through used to die in my inbox. Now Runner closes the loop before I even ask."',
    color: '#9e7a7a',
    initials: 'LA',
  },
  {
    name: 'Mark',
    role: 'Product Leadership, Rivai Labs',
    company: '',
    quote: '"It actually does the work. Drafts, updates, briefings — all from the tools we already live in."',
    color: '#7a8a9e',
    initials: 'MA',
  },
  {
    name: 'Sarah',
    role: 'Owner, Roca Moca',
    company: '',
    quote: '"Runner has quickly become an extension of my brain — holding context, handling the busy work, and letting me show up fully for every client."',
    color: '#b59e7a',
    initials: 'SA',
  },
  {
    name: 'Tom',
    role: 'Business Advisor',
    company: '',
    quote: '"My Morning Brief from Runner is the single most valuable thing because it\'s where the energy I put into it comes back to me."',
    color: '#9e7ab5',
    initials: 'TO',
  },
  {
    name: 'Thomas',
    role: 'Account Executive',
    company: '',
    quote: '"Runner is the first app I open in the morning portfolio because it\'s where the energy I put into it comes back to me — compounding from there."',
    color: '#7a9eb5',
    initials: 'TH',
  },
  {
    name: 'Daniel',
    role: 'VP of Agency Services, Blendin',
    company: '',
    quote: '"Runner\'s memory actually holds everything over time, data flows seamlessly between connected apps, and I can focus on the most valuable points in my day."',
    color: '#9e9e7a',
    initials: 'DA',
  },
]

function Avatar({ t }: { t: Testimonial }) {
  return (
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-white font-mono text-[14px] font-medium mb-4"
      style={{ background: t.color }}
    >
      {t.initials}
    </div>
  )
}

export default function Testimonials() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      ref={ref}
      className="py-20 lg:py-28"
      style={{ background: '#fdfdfd' }}
    >
      <div className="max-w-[1300px] mx-auto px-6 lg:px-10">

        {/* Heading */}
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          className="font-display text-center mb-14"
          style={{
            fontSize: 'clamp(24px, 3.5vw, 44px)',
            fontWeight: 400,
            letterSpacing: '-0.04em',
            color: '#1d1b1b',
          }}
        >
          You're in good company with Runner.
        </motion.h2>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px"
          style={{ background: 'rgba(196,193,189,0.4)', borderRadius: '16px', overflow: 'hidden' }}>
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="p-6 flex flex-col"
              style={{ background: '#fdfdfd' }}
            >
              <Avatar t={t} />
              <p
                className="font-mono text-[11px] font-medium mb-0.5"
                style={{ color: '#1d1b1b' }}
              >
                {t.name}
              </p>
              <p
                className="font-mono text-[10px] mb-4"
                style={{ color: '#a1a1a1' }}
              >
                {t.role}
              </p>
              <p
                className="text-[13px] leading-relaxed flex-1"
                style={{ color: '#464242' }}
              >
                {t.quote}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
