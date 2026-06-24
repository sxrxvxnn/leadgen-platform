/**
 * Navbar — sticky frosted glass nav.
 *
 * Design: ~56px tall, `#fdfdfdb8` bg with backdrop-blur(16px), 1px bottom border
 * `#1d1b1b1a`. Logo is a 2×2 squares mark + "runner" in Geist Mono.
 * Nav links centered in Geist Mono. "Get Started" CTA uses dark pill button
 * with a small 4×4 dot-grid icon on the right side.
 *
 * Scroll behaviour: border fades in and shadow strengthens after 20px scroll.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const NAV_LINKS = [
  { label: 'Product',   href: '#product' },
  { label: 'Security',  href: '#security' },
  { label: 'Pricing',   href: '#pricing' },
  { label: 'Usecases',  href: '#usecases' },
  { label: 'FAQ',       href: '#faq' },
  { label: 'Guides',    href: '#guides' },
  { label: 'Changelog', href: '#changelog' },
  { label: 'About',     href: '#about' },
]

function RunnerLogo() {
  return (
    <a href="#" className="flex items-center gap-2 no-underline">
      {/* 2×2 squares logomark */}
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0">
        <rect x="0" y="0" width="8" height="8" rx="1.5" fill="#1d1b1b" />
        <rect x="10" y="0" width="8" height="8" rx="1.5" fill="#1d1b1b" />
        <rect x="0" y="10" width="8" height="8" rx="1.5" fill="#1d1b1b" />
        <rect x="10" y="10" width="8" height="8" rx="1.5" fill="#1d1b1b" />
      </svg>
      <span
        className="font-mono text-[13px] font-medium tracking-[-0.02em]"
        style={{ color: '#1d1b1b' }}
      >
        runner
      </span>
    </a>
  )
}

function DotGridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
      {[0,4,8,12].map(y =>
        [0,4,8,12].map(x => (
          <rect
            key={`${x}-${y}`}
            x={x} y={y}
            width="2" height="2"
            rx="0.5"
            fill="rgba(231,231,231,0.6)"
          />
        ))
      )}
    </svg>
  )
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50"
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <nav
        className="w-full transition-all duration-300"
        style={{
          background: scrolled
            ? 'rgba(253,253,253,0.90)'
            : 'rgba(253,253,253,0.72)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${scrolled ? 'rgba(29,27,27,0.12)' : 'rgba(29,27,27,0.07)'}`,
          boxShadow: scrolled ? '0 1px 12px rgba(29,27,27,0.06)' : 'none',
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-[54px] flex items-center justify-between gap-4">

          {/* Logo */}
          <RunnerLogo />

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                className="font-mono text-[12px] px-3 py-1.5 rounded-md transition-colors duration-150 font-normal"
                style={{ color: '#6e6e6e' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#1d1b1b')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6e6e6e')}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <a
              href="#get-started"
              className="hidden sm:flex items-center gap-2.5 font-mono text-[12px] font-medium px-4 py-[9px] rounded-lg transition-all duration-150 select-none"
              style={{
                background: '#1d1b1b',
                color: '#e7e7e7',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#2d2b2b'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#1d1b1b'
              }}
            >
              Get Started
              <DotGridIcon />
            </a>

            {/* Mobile hamburger */}
            <button
              className="lg:hidden flex flex-col gap-1 p-2"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              <span className={`block h-[1.5px] w-5 bg-primary transition-all duration-200 ${mobileOpen ? 'rotate-45 translate-y-[4.5px]' : ''}`} style={{ background: '#1d1b1b' }} />
              <span className={`block h-[1.5px] w-5 transition-all duration-200 ${mobileOpen ? 'opacity-0' : ''}`} style={{ background: '#1d1b1b' }} />
              <span className={`block h-[1.5px] w-5 bg-primary transition-all duration-200 ${mobileOpen ? '-rotate-45 -translate-y-[4.5px]' : ''}`} style={{ background: '#1d1b1b' }} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden border-t overflow-hidden"
            style={{ borderColor: 'rgba(29,27,27,0.1)', background: 'rgba(253,253,253,0.97)' }}
          >
            <div className="px-6 py-4 flex flex-col gap-1">
              {NAV_LINKS.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  className="font-mono text-[13px] py-2.5 px-2 rounded-md"
                  style={{ color: '#1d1b1b' }}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#get-started"
                className="mt-3 flex items-center justify-center gap-2 font-mono text-[12px] font-medium py-3 rounded-lg"
                style={{ background: '#1d1b1b', color: '#e7e7e7' }}
              >
                Get Started
              </a>
            </div>
          </motion.div>
        )}
      </nav>
    </motion.header>
  )
}
