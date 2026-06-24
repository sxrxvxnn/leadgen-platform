/**
 * Footer — full-bleed dark section with background image overlay.
 *
 * Top: large CTA area with "Start Finishing." headline (display serif)
 * and "Get Started" button over a grainy dark image (hands holding baton).
 * Simulated with a gradient + noise overlay.
 *
 * Bottom: 4-column link grid (Product, For Apps, Workflows, Legal) +
 * security certification badges (SOC2 Type 1, CASA Tier 2, SOC2 Type 2,
 * GDPR). Social icons row. Copyright line.
 *
 * Background: `#1d1b1b` dark base, with runner logo in cream.
 */

import { motion } from 'framer-motion'

const FOOTER_LINKS = {
  Product: [
    'Homepage', 'Workflows', 'Apps', 'Changelog', 'Blog', 'About',
  ],
  'For Apps': [
    'Gmail', 'Google Calendar', 'Drive', 'Slack', 'HubSpot', 'Notion',
  ],
  Workflows: [
    'Board Prep', 'Analytics Review', 'Project Status', 'Feedback Analysis', 'Scheduling', 'Morning Brief',
  ],
  Legal: [
    'Privacy Policy', 'Terms & Conditions',
  ],
}

function SecurityBadge({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: color }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2L3 4.5V8c0 2.8 2 5.3 5 6 3-0.7 5-3.2 5-6V4.5L8 2z" fill="rgba(255,255,255,0.9)" />
        </svg>
      </div>
      <div>
        <p className="font-mono text-[11px] font-medium text-white">{title}</p>
        <p className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{subtitle}</p>
      </div>
    </div>
  )
}

function SocialIcon({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <a
      href="#"
      aria-label={label}
      className="w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150 hover:opacity-70"
      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
    >
      {children}
    </a>
  )
}

export default function Footer() {
  return (
    <footer style={{ background: '#1d1b1b' }}>

      {/* CTA hero band */}
      <div
        className="relative overflow-hidden"
        style={{ minHeight: '340px' }}
      >
        {/* Simulated background — grainy dark gradient (baton-pass photo) */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #2a2624 0%, #1a1614 40%, #252220 70%, #1d1b1b 100%)',
          }}
        />
        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: '256px 256px',
          }}
        />
        {/* Abstract line art (simulating the baton pass illustration) */}
        <svg
          className="absolute right-10 bottom-0 opacity-20"
          width="320"
          height="280"
          viewBox="0 0 320 280"
          fill="none"
        >
          <path d="M60 240 Q100 180 160 160 Q200 145 240 120 Q280 95 300 60" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6" />
          <path d="M40 260 Q90 200 150 175 Q190 158 230 135 Q270 110 295 75" stroke="white" strokeWidth="1" fill="none" opacity="0.3" />
          <circle cx="240" cy="120" r="3" fill="white" opacity="0.5" />
          <circle cx="160" cy="160" r="2" fill="white" opacity="0.4" />
        </svg>

        <div className="relative z-10 max-w-[1300px] mx-auto px-6 lg:px-10 py-20 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2
              className="font-display"
              style={{
                fontSize: 'clamp(36px, 5.5vw, 72px)',
                fontWeight: 400,
                letterSpacing: '-0.05em',
                color: '#fdfdfd',
                lineHeight: 1,
              }}
            >
              Start Finishing.
            </h2>
            <p className="font-mono text-[12px] mt-4" style={{ color: 'rgba(231,231,231,0.5)' }}>
              Busy founders save 6+ hours per week with Runner.
            </p>
          </motion.div>

          <motion.a
            href="#get-started"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex items-center gap-2.5 font-mono text-[12px] font-medium px-6 py-3.5 rounded-xl transition-all duration-150 flex-shrink-0"
            style={{ background: '#fdfdfd', color: '#1d1b1b' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Get Started
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 4l3 3-3 3" stroke="#1d1b1b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.a>
        </div>
      </div>

      {/* Link columns + security */}
      <div
        className="border-t"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="max-w-[1300px] mx-auto px-6 lg:px-10 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-12">

            {/* Logo column */}
            <div className="col-span-2 md:col-span-4 lg:col-span-1">
              <a href="#" className="flex items-center gap-2 mb-4">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="0" y="0" width="8" height="8" rx="1.5" fill="#fdfdfd" />
                  <rect x="10" y="0" width="8" height="8" rx="1.5" fill="#fdfdfd" />
                  <rect x="0" y="10" width="8" height="8" rx="1.5" fill="#fdfdfd" />
                  <rect x="10" y="10" width="8" height="8" rx="1.5" fill="#fdfdfd" />
                </svg>
                <span className="font-mono text-[13px] font-medium" style={{ color: '#fdfdfd' }}>runner</span>
              </a>
              <p className="font-mono text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                The AI App that Does the Work.
              </p>
            </div>

            {/* Link columns */}
            {(Object.entries(FOOTER_LINKS) as [string, string[]][]).map(([col, links]) => (
              <div key={col}>
                <p
                  className="font-mono text-[10px] uppercase tracking-widest mb-4"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  {col}
                </p>
                <ul className="space-y-2.5">
                  {links.map(link => (
                    <li key={link}>
                      <a
                        href="#"
                        className="font-mono text-[12px] transition-colors duration-150"
                        style={{ color: 'rgba(255,255,255,0.55)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Security badges */}
          <div
            className="border-t pt-10 mb-8"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <p
              className="font-mono text-[10px] uppercase tracking-widest mb-4"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              Security &amp; Compliance
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SecurityBadge title="SOC 2 Type 1" subtitle="Certified" color="#4a7c59" />
              <SecurityBadge title="CASA Tier 2" subtitle="Certified" color="#5b8db8" />
              <SecurityBadge title="SOC 2 Type 2" subtitle="Audit in progress" color="#7a6a5a" />
              <SecurityBadge title="GDPR" subtitle="In progress" color="#6e5b8a" />
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="border-t pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            <p className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              © {new Date().getFullYear()} Runner. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              {/* Instagram */}
              <SocialIcon label="Instagram">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
              </SocialIcon>
              {/* X / Twitter */}
              <SocialIcon label="X / Twitter">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </SocialIcon>
              {/* LinkedIn */}
              <SocialIcon label="LinkedIn">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </SocialIcon>
              {/* YouTube */}
              <SocialIcon label="YouTube">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </SocialIcon>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
