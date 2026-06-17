import Navbar from '../components/Navbar'

const SECTIONS = [
  { id: 'acceptance',   num: '01', label: 'Acceptance' },
  { id: 'description',  num: '02', label: 'The Service' },
  { id: 'accounts',     num: '03', label: 'Accounts' },
  { id: 'acceptable',   num: '04', label: 'Acceptable Use' },
  { id: 'data',         num: '05', label: 'Your Data' },
  { id: 'linkedin',     num: '06', label: 'LinkedIn Data' },
  { id: 'ip',           num: '07', label: 'Intellectual Property' },
  { id: 'disclaimers',  num: '08', label: 'Disclaimers' },
  { id: 'liability',    num: '09', label: 'Liability' },
  { id: 'termination',  num: '10', label: 'Termination' },
  { id: 'changes',      num: '11', label: 'Changes' },
  { id: 'contact',      num: '12', label: 'Contact' },
]

export default function Terms() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Hero */}
      <div style={{ position: 'relative', padding: '64px 48px 48px', borderBottom: '1px dashed var(--border-dash)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 90% at 5% 50%, var(--accent-dimmer) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <p style={s.eyebrow}>Legal</p>
          <h1 style={s.heroTitle}>Terms of Service.</h1>
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
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '6px', textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, transition: 'background 0.15s, color 0.15s' }}
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

          <Section id="acceptance" title="Acceptance of Terms">
            <p>By accessing or using LeadGen Engine ("the Service", "the Platform") at <strong>leadgenengineplatform.vercel.app</strong>, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.</p>
            <p>These Terms constitute a legally binding agreement between you ("User", "you") and Shravan Omanakuttan ("we", "us", "our"), the operator of LeadGen Engine.</p>
          </Section>

          <Section id="description" title="The Service">
            <p>LeadGen Engine is a B2B sales intelligence and lead management platform that enables users to:</p>
            <ul style={s.list}>
              <li>Discover, import, and manage B2B company and contact records</li>
              <li>Enrich lead data via third-party integrations (LinkedIn, Google Maps, Hunter.io, Apollo.io)</li>
              <li>Track outreach pipelines and manage sales workflows</li>
              <li>Sync leads from LinkedIn Lead Gen Form campaigns</li>
              <li>Analyse company profiles and identify ideal customer profiles</li>
            </ul>
            <p>We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time with reasonable notice.</p>
          </Section>

          <Section id="accounts" title="Accounts & Registration">
            <p>You must create an account to use LeadGen Engine. You agree to:</p>
            <ul style={s.list}>
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain the security of your password and account credentials</li>
              <li>Notify us immediately of any unauthorised access to your account</li>
              <li>Take responsibility for all activity that occurs under your account</li>
            </ul>
            <p>You must be at least 18 years old and have the legal authority to enter into these Terms. Accounts registered on behalf of an organisation represent that you have authority to bind that organisation.</p>
          </Section>

          <Section id="acceptable" title="Acceptable Use">
            <p>You agree to use the Service only for lawful B2B sales and marketing purposes. You must not:</p>
            <ul style={s.list}>
              <li>Use the Service to scrape, harvest, or collect data in violation of any third party's terms of service</li>
              <li>Use lead data to send unsolicited bulk communications (spam) in violation of applicable law</li>
              <li>Attempt to gain unauthorised access to any part of the Service or its infrastructure</li>
              <li>Use the Service to store or process sensitive personal data including health, financial, or biometric information</li>
              <li>Resell, sublicense, or redistribute access to the Service without prior written consent</li>
              <li>Use the Service to engage in any activity that violates LinkedIn's terms of service or API usage policies</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the Service</li>
            </ul>
            <p>We reserve the right to suspend or terminate accounts that violate these restrictions without prior notice.</p>
          </Section>

          <Section id="data" title="Your Data">
            <p>You retain ownership of all company, contact, and lead data you upload or create within LeadGen Engine ("User Data"). By using the Service, you grant us a limited licence to store, process, and display your User Data solely for the purpose of providing the Service.</p>
            <p>You are responsible for ensuring you have the right to upload and process any data you add to the platform, including compliance with applicable data protection laws (including India's DPDP Act 2023 and GDPR where applicable).</p>
            <p>We will not sell, share, or use your User Data for purposes beyond operating and improving the Service. On account termination, your data will be deleted within 30 days upon request.</p>
          </Section>

          <Section id="linkedin" title="LinkedIn API Data">
            <p>LeadGen Engine integrates with LinkedIn's APIs subject to the <a href="https://www.linkedin.com/legal/l/api-terms-of-use" target="_blank" rel="noreferrer" style={s.link}>LinkedIn API Terms of Use</a>. By connecting LinkedIn to your account, you agree that:</p>
            <ul style={s.list}>
              <li>You authorise LeadGen Engine to access LinkedIn data on your behalf within the scope you approve</li>
              <li>LinkedIn data retrieved through our integration may only be used for your own sales and marketing activities</li>
              <li>You will not use LinkedIn data obtained through the Service to build competing products or data sets</li>
              <li>LinkedIn data is subject to LinkedIn's own terms and privacy policies in addition to ours</li>
              <li>You can disconnect LinkedIn access at any time via your LinkedIn account settings</li>
            </ul>
          </Section>

          <Section id="ip" title="Intellectual Property">
            <p>The LeadGen Engine platform, including its design, code, branding, and content (excluding User Data), is owned by Shravan Omanakuttan and protected by applicable intellectual property laws.</p>
            <p>You are granted a limited, non-exclusive, non-transferable licence to use the Service for its intended purpose during your subscription or access period. This licence does not include the right to copy, modify, or create derivative works of the Service.</p>
            <p>Feedback, suggestions, or ideas you submit regarding the Service may be used by us without any obligation or compensation to you.</p>
          </Section>

          <Section id="disclaimers" title="Disclaimers">
            <p>The Service is provided <strong>"as is"</strong> and <strong>"as available"</strong> without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.</p>
            <p>We do not warrant that:</p>
            <ul style={s.list}>
              <li>The Service will be uninterrupted, error-free, or completely secure</li>
              <li>Data enrichment results from third-party APIs will be accurate or complete</li>
              <li>LinkedIn profile or company data obtained through the Service will be current or correct</li>
              <li>The Service will meet your specific business requirements</li>
            </ul>
          </Section>

          <Section id="liability" title="Limitation of Liability">
            <p>To the maximum extent permitted by applicable law, Shravan Omanakuttan and LeadGen Engine shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or business opportunities, arising from your use of the Service.</p>
            <p>Our total liability to you for any claims arising from these Terms or your use of the Service shall not exceed the amount you paid us in the twelve months preceding the claim, or ₹5,000 (Indian Rupees five thousand), whichever is greater.</p>
          </Section>

          <Section id="termination" title="Termination">
            <p>Either party may terminate these Terms at any time. You may close your account by contacting us. We may suspend or terminate your access immediately if you breach these Terms or if we are required to do so by law.</p>
            <p>On termination, your right to use the Service ceases immediately. Sections covering intellectual property, disclaimers, liability, and governing law survive termination.</p>
          </Section>

          <Section id="changes" title="Changes to These Terms">
            <p>We may update these Terms from time to time. Material changes will be communicated via the platform or by email at least 14 days before taking effect. Continued use of the Service after changes constitutes acceptance of the updated Terms.</p>
            <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts of Kerala, India.</p>
          </Section>

          <Section id="contact" title="Contact" last>
            <p>For questions about these Terms, contact us at:</p>
            <div style={{ marginTop: '16px', padding: '20px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '14px' }}>Shravan Omanakuttan</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>LeadGen Engine</span>
              <a href="mailto:leadgenengineplatform@proton.me" style={{ ...s.link, fontSize: '13px', marginTop: '4px' }}>leadgenengineplatform@proton.me</a>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Kerala, India</span>
            </div>
            <p style={{ marginTop: '16px' }}>
              See also our <a href="/privacy" style={s.link}>Privacy Policy</a>.
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

const s = {
  eyebrow: { fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 10px' },
  heroTitle: { fontSize: '42px', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', margin: '0 0 10px', letterSpacing: '-0.5px' },
  heroSub: { fontSize: '15px', color: 'var(--text-secondary)', margin: 0 },
  sectionTitle: { fontSize: '17px', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px', fontFamily: 'var(--font-display)' },
  body: { fontSize: '14px', color: 'var(--text-soft)', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: '10px' },
  list: { paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' },
  link: { color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 },
}
