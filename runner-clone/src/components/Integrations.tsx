/**
 * Integrations — "Runs on the tools you already love"
 *
 * Auto-scrolling marquee of app logos in 2 rows.
 * Row 1 scrolls left, row 2 scrolls right for a dynamic feel.
 * Apps shown as colored icon tiles with name labels.
 * Section has a light cream background.
 */

import { motion } from 'framer-motion'

interface App {
  name: string
  color: string
  bg: string
  initial: string
}

const APPS: App[] = [
  { name: 'Gmail',         color: '#ffffff', bg: '#ea4335', initial: 'Gm' },
  { name: 'Google Cal',    color: '#ffffff', bg: '#4285f4', initial: 'GC' },
  { name: 'Google Drive',  color: '#ffffff', bg: '#fbbc04', initial: 'GD' },
  { name: 'Google Docs',   color: '#ffffff', bg: '#4285f4', initial: 'GD' },
  { name: 'Google Sheets', color: '#ffffff', bg: '#34a853', initial: 'GS' },
  { name: 'Slack',         color: '#ffffff', bg: '#e01e5a', initial: 'Sl' },
  { name: 'HubSpot',       color: '#ffffff', bg: '#ff7a59', initial: 'HS' },
  { name: 'Notion',        color: '#ffffff', bg: '#1d1b1b', initial: 'No' },
  { name: 'Linear',        color: '#ffffff', bg: '#5e6ad2', initial: 'Li' },
  { name: 'GitHub',        color: '#ffffff', bg: '#24292f', initial: 'GH' },
  { name: 'Airtable',      color: '#ffffff', bg: '#2d7ff9', initial: 'At' },
  { name: 'Asana',         color: '#ffffff', bg: '#f06a6a', initial: 'As' },
  { name: 'Dropbox',       color: '#ffffff', bg: '#0061fe', initial: 'Db' },
  { name: 'Intercom',      color: '#ffffff', bg: '#1f8ded', initial: 'Ic' },
  { name: 'Trello',        color: '#ffffff', bg: '#0052cc', initial: 'Tr' },
  { name: 'Calendly',      color: '#ffffff', bg: '#006bff', initial: 'Ca' },
  { name: 'Mixpanel',      color: '#ffffff', bg: '#7856ff', initial: 'Mx' },
  { name: 'Sentry',        color: '#ffffff', bg: '#362d59', initial: 'Se' },
  { name: 'Shopify',       color: '#ffffff', bg: '#96bf48', initial: 'Sh' },
  { name: 'Zendesk',       color: '#ffffff', bg: '#03363d', initial: 'Zd' },
  { name: 'PostHog',       color: '#ffffff', bg: '#f76707', initial: 'PH' },
  { name: 'Supabase',      color: '#ffffff', bg: '#3ecf8e', initial: 'Sb' },
  { name: 'QuickBooks',    color: '#ffffff', bg: '#2ca01c', initial: 'QB' },
  { name: 'Granola',       color: '#ffffff', bg: '#a86448', initial: 'Gr' },
  { name: 'Zapier',        color: '#ffffff', bg: '#ff4a00', initial: 'Za' },
  { name: 'iMessage',      color: '#ffffff', bg: '#0a84ff', initial: 'iM' },
  { name: 'WhatsApp',      color: '#ffffff', bg: '#25d366', initial: 'WA' },
  { name: 'Loom',          color: '#ffffff', bg: '#625df5', initial: 'Lo' },
  { name: 'Figma',         color: '#ffffff', bg: '#f24e1e', initial: 'Fi' },
  { name: 'Webflow',       color: '#ffffff', bg: '#146ef5', initial: 'Wf' },
]

const ROW1 = APPS.slice(0, 15)
const ROW2 = APPS.slice(15)

function AppTile({ app }: { app: App }) {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-3 rounded-xl flex-shrink-0 select-none"
      style={{
        background: '#ffffff',
        border: '1px solid rgba(196,193,189,0.5)',
        boxShadow: '0 1px 4px rgba(29,27,27,0.04)',
        minWidth: '140px',
      }}
    >
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
        style={{ background: app.bg, color: app.color }}
      >
        {app.initial}
      </span>
      <span className="font-mono text-[11px] font-medium" style={{ color: '#1d1b1b' }}>
        {app.name}
      </span>
    </div>
  )
}

function MarqueeRow({ apps, reverse = false }: { apps: App[]; reverse?: boolean }) {
  const doubled = [...apps, ...apps]
  return (
    <div className="overflow-hidden">
      <div
        className="flex gap-3"
        style={{
          animation: `marquee ${reverse ? '40s' : '35s'} linear infinite ${reverse ? 'reverse' : 'normal'}`,
          display: 'flex',
          width: 'max-content',
        }}
      >
        {doubled.map((app, i) => (
          <AppTile key={`${app.name}-${i}`} app={app} />
        ))}
      </div>
    </div>
  )
}

export default function Integrations() {
  return (
    <section
      className="py-20 lg:py-24 overflow-hidden"
      style={{ background: '#f5f5f2' }}
    >
      <div className="max-w-[1300px] mx-auto px-6 lg:px-10 mb-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: '#a1a1a1' }}>
              Integrations
            </p>
            <h2
              className="font-display"
              style={{
                fontSize: 'clamp(26px, 3.5vw, 44px)',
                fontWeight: 400,
                letterSpacing: '-0.04em',
                color: '#1d1b1b',
              }}
            >
              Runs on the tools you already love.
            </h2>
          </div>
          <a
            href="#apps"
            className="font-mono text-[12px] self-end flex items-center gap-1.5 transition-opacity hover:opacity-70"
            style={{ color: '#6e6e6e' }}
          >
            See all 50+ apps
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 6h6M7 4l2 2-2 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>
      </div>

      {/* Marquee rows */}
      <div className="space-y-3">
        <MarqueeRow apps={ROW1} />
        <MarqueeRow apps={ROW2} reverse />
      </div>

      {/* Fade edges */}
      <div className="relative pointer-events-none" style={{ height: 0 }}>
        <div
          className="absolute inset-y-0 left-0 w-24 z-10"
          style={{ background: 'linear-gradient(to right, #f5f5f2, transparent)' }}
        />
        <div
          className="absolute inset-y-0 right-0 w-24 z-10"
          style={{ background: 'linear-gradient(to left, #f5f5f2, transparent)' }}
        />
      </div>
    </section>
  )
}
