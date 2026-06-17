import Navbar from '../components/Navbar'

const SECTIONS = [
  { id: 'introduction',   num: '01', label: 'Introduction' },
  { id: 'data-collected', num: '02', label: 'Data Collected' },
  { id: 'data-use',       num: '03', label: 'How We Use It' },
  { id: 'storage',        num: '04', label: 'Storage & Security' },
  { id: 'third-parties',  num: '05', label: 'Third Parties' },
  { id: 'linkedin',       num: '06', label: 'LinkedIn Data' },
  { id: 'your-rights',    num: '07', label: 'Your Rights' },
  { id: 'contact',        num: '08', label: 'Contact' },
]

export default function Privacy() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Hero */}
      <div style={{ position: 'relative', padding: '64px 48px 48px', borderBottom: '1px dashed var(--border-dash)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 90% at 5% 50%, var(--accent-dimmer) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <p style={s.eyebrow}>Legal</p>
          <h1 style={s.heroTitle}>Privacy Policy.</h1>
          <p style={s.heroSub}>Effective June 16, 2026 · Last updated June 16, 2026</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', maxWidth: '1100px', margin: '0 auto', padding: '0 48px 80px' }}>

        {/* Sticky sidebar */}
        <aside style={{ width: '200px', flexShrink: 0, paddingTop: '48px', paddingRight: '40px' }}>
          <div style={{ position: 'sticky', top: '86px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {SECTIONS.map(sec => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '7px 10px', borderRadius: '6px',
                  textDecoration: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: 500,
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              >
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minWidth: '20px' }}>{sec.num}</span>
                {sec.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, paddingTop: '48px', maxWidth: '680px' }}>

          <Section id="introduction" title="Introduction">
            <p>Sonar is a B2B sales intelligence and lead management platform operated by Shravan Omanakuttan. This Privacy Policy explains how we collect, use, store, and protect information when you use our platform at <strong>sonarleads.vercel.app</strong>.</p>
            <p>By using Sonar, you agree to the collection and use of information in accordance with this policy. We are committed to compliance with the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong> and applicable international privacy standards including the LinkedIn API Terms of Service.</p>
          </Section>

          <Section id="data-collected" title="Data Collected">
            <SubHeading>Account Information</SubHeading>
            <p>When you register, we collect your name, email address, and a hashed password used solely for authentication and account management.</p>

            <SubHeading>Company and Lead Data</SubHeading>
            <p>Our platform stores B2B company and contact information you add, import, or that is enriched through third-party integrations. This is business-professional data (company names, job titles, business email addresses, LinkedIn URLs) and does not include sensitive personal categories.</p>

            <SubHeading>LinkedIn Data</SubHeading>
            <p>Where you authorise LinkedIn API access, we may retrieve publicly available LinkedIn company profile data (follower counts, descriptions, industry, headquarters, employee range) and Lead Gen Form submissions from your own LinkedIn ad campaigns.</p>

            <SubHeading>Usage Analytics</SubHeading>
            <p>We collect anonymised product analytics (page views, feature interactions, error events) via PostHog to improve the platform. No personally identifiable information is shared beyond a pseudonymous user identifier.</p>

            <SubHeading>API Keys</SubHeading>
            <p>API keys you enter in Settings are stored locally in your browser's localStorage and are never transmitted to or stored on our servers.</p>
          </Section>

          <Section id="data-use" title="How We Use Your Information">
            <ul style={s.list}>
              <li>To provide, operate, and improve the Sonar platform</li>
              <li>To authenticate your account and maintain session security</li>
              <li>To sync and display lead data from your LinkedIn Lead Gen Form campaigns</li>
              <li>To enrich company and contact records via authorised third-party APIs</li>
              <li>To send transactional notifications related to your account</li>
              <li>To analyse anonymised usage patterns for product improvement</li>
            </ul>
            <p style={{ marginTop: '16px' }}>We do not sell, rent, or share your personal data with third parties for advertising purposes.</p>
          </Section>

          <Section id="storage" title="Storage & Security">
            <p>All user and company data is stored in <strong>Supabase</strong> (PostgreSQL), hosted on EU-West servers. We enforce Row Level Security (RLS) policies ensuring each user can only access their own data. All communications are encrypted in transit over HTTPS.</p>
            <p>We retain your data for as long as your account is active. You may request deletion at any time by contacting us.</p>
          </Section>

          <Section id="third-parties" title="Third-Party Services">
            <p style={{ marginBottom: '16px' }}>Sonar integrates with the following services, each governed by their own privacy policies:</p>
            <div style={s.table}>
              <div style={s.tableHead}>
                <span>Service</span><span>Purpose</span><span>Data Shared</span>
              </div>
              {[
                ['Supabase',          'Database & authentication',   'Account, lead & company records'],
                ['LinkedIn API',      'Lead sync & enrichment',      'Campaign lead data (authorised)'],
                ['Google Maps',       'Company discovery',           'Company name / location queries'],
                ['Hunter.io',         'Email verification',          'Domain / email address queries'],
                ['Apollo.io',         'Contact enrichment',          'Company name / domain queries'],
                ['PostHog',           'Product analytics',           'Pseudonymous usage events'],
                ['Vercel',            'Hosting & deployment',        'HTTP request logs (anonymised)'],
              ].map(([s, p, d]) => (
                <div key={s} style={tableRow}>
                  <span style={{ fontWeight: 500, color: 'var(--text)' }}>{s}</span>
                  <span>{p}</span>
                  <span>{d}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section id="linkedin" title="LinkedIn API Data Policy">
            <p>Sonar's use of LinkedIn API data complies with the <a href="https://www.linkedin.com/legal/l/api-terms-of-use" target="_blank" rel="noreferrer" style={s.link}>LinkedIn API Terms of Use</a>. Specifically:</p>
            <ul style={s.list}>
              <li>LinkedIn lead data is only accessed with the explicit authorisation of the account owner</li>
              <li>Lead data is used solely to populate the authorising user's pipeline within Sonar</li>
              <li>LinkedIn data is not sold, redistributed, or used beyond the authorised integration</li>
              <li>Users can revoke LinkedIn API access at any time via their LinkedIn account settings</li>
              <li>We do not store LinkedIn member passwords or access tokens beyond the active session</li>
            </ul>
          </Section>

          <Section id="your-rights" title="Your Rights">
            <p>Under the DPDP Act 2023 and applicable regulations, you have the right to:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              {[
                ['Access',           'Request a copy of personal data we hold about you'],
                ['Correction',       'Request correction of inaccurate personal data'],
                ['Erasure',          'Request deletion of your account and associated data'],
                ['Portability',      'Request an export of your data in machine-readable format'],
                ['Withdraw consent', 'Revoke any data processing consent at any time'],
              ].map(([right, desc]) => (
                <div key={right} style={{ display: 'flex', gap: '12px', padding: '12px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: '130px', fontSize: '13px' }}>{right}</span>
                  <span style={{ color: 'var(--text-soft)', fontSize: '13px' }}>{desc}</span>
                </div>
              ))}
            </div>
            <p style={{ marginTop: '16px' }}>To exercise any of these rights, contact us at the email below. We will respond within 30 days.</p>
          </Section>

          <Section id="contact" title="Contact" last>
            <p>For privacy-related questions, data requests, or concerns, contact our Data Protection Officer:</p>
            <div style={{
              marginTop: '16px',
              padding: '20px 24px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '14px' }}>Shravan Omanakuttan</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Data Protection Officer, Sonar</span>
              <a href="mailto:sonarleads@proton.me" style={{ ...s.link, fontSize: '13px', marginTop: '4px' }}>sonarleads@proton.me</a>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Kerala, India</span>
            </div>
            <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              See also our <a href="/terms" style={s.link}>Terms of Service</a>.
            </p>
          </Section>

        </main>
      </div>
    </div>
  )
}

function Section({ id, title, children, last }) {
  return (
    <section id={id} style={{ paddingBottom: '40px', marginBottom: last ? 0 : '40px', borderBottom: last ? 'none' : '1px solid var(--border-subtle)' }}>
      <h2 style={s.sectionTitle}>{title}</h2>
      <div style={s.body}>{children}</div>
    </section>
  )
}

function SubHeading({ children }) {
  return <h3 style={s.subheading}>{children}</h3>
}

const tableRow = {
  display: 'grid',
  gridTemplateColumns: '1fr 1.4fr 1.6fr',
  gap: '12px',
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: '13px',
  color: 'var(--text-secondary)',
  alignItems: 'start',
}

const s = {
  eyebrow: {
    fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px',
    textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '10px', margin: '0 0 10px',
  },
  heroTitle: {
    fontSize: '42px', fontWeight: 700, color: 'var(--text)',
    fontFamily: 'var(--font-display)', margin: '0 0 10px', letterSpacing: '-0.5px',
  },
  heroSub: {
    fontSize: '15px', color: 'var(--text-secondary)', margin: 0,
  },
  sectionTitle: {
    fontSize: '17px', fontWeight: 600, color: 'var(--text)',
    margin: '0 0 16px', fontFamily: 'var(--font-display)',
  },
  subheading: {
    fontSize: '13px', fontWeight: 600, color: 'var(--text-soft)',
    margin: '20px 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  body: {
    fontSize: '14px', color: 'var(--text-soft)', lineHeight: 1.75,
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  list: {
    paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px',
  },
  link: {
    color: 'var(--accent)', textDecoration: 'none', fontWeight: 500,
  },
  table: {
    border: '1px solid var(--border)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.4fr 1.6fr',
    gap: '12px',
    padding: '9px 14px',
    background: 'var(--surface)',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid var(--border)',
  },
}
