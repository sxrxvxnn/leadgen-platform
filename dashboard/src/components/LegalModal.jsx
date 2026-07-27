import { useEffect } from 'react'

export default function LegalModal({ type, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(1,1,27,0.55)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fffcfc',
          border: '1px solid #dbd7da',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(1,1,27,0.18)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 28px',
            borderBottom: '1px solid #dbd7da',
            flexShrink: 0,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.14em',
                color: '#717a94',
                textTransform: 'uppercase',
                margin: '0 0 4px',
              }}
            >
              Legal
            </p>
            <h2
              style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 18,
                fontWeight: 700,
                color: '#01011b',
                margin: 0,
                letterSpacing: '-0.3px',
              }}
            >
              {type === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}
            </h2>
            <p
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                color: '#717a94',
                margin: '4px 0 0',
              }}
            >
              Effective June 16, 2026
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid #dbd7da',
              borderRadius: 6,
              color: '#717a94',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              padding: '6px 12px',
            }}
          >
            ESC ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '28px 28px 40px', flex: 1 }}>
          {type === 'privacy' ? <PrivacyContent /> : <TermsContent />}
        </div>
      </div>
    </div>
  )
}

const prose = { fontSize: 14, color: '#484655', lineHeight: 1.75, margin: '0 0 10px' }
const heading = {
  fontSize: 15,
  fontWeight: 600,
  color: '#01011b',
  margin: '28px 0 10px',
  fontFamily: "'IBM Plex Sans', sans-serif",
  letterSpacing: '-0.2px',
}
const sub = {
  fontSize: 12,
  fontWeight: 600,
  color: '#717a94',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  margin: '18px 0 6px',
  fontFamily: "'IBM Plex Mono', monospace",
}
const li = { fontSize: 14, color: '#484655', lineHeight: 1.75 }
const divider = { border: 'none', borderTop: '1px solid #ecedf2', margin: '24px 0' }
const link = { color: '#6f63b7', textDecoration: 'none', fontWeight: 500 }

function PrivacyContent() {
  return (
    <div>
      <p style={prose}>
        Sonar is a B2B sales intelligence platform operated by Shravan Omanakuttan. This policy
        explains how we collect, use, and protect your information.
      </p>
      <hr style={divider} />

      <h3 style={heading}>Data Collected</h3>
      <p style={{ ...sub, marginTop: 0 }}>Account</p>
      <p style={prose}>Name, email, and hashed password used for authentication only.</p>
      <p style={sub}>Company & Lead Data</p>
      <p style={prose}>
        B2B company names, job titles, business email addresses, and LinkedIn URLs that you add or
        import. No sensitive personal categories.
      </p>
      <p style={sub}>LinkedIn Data</p>
      <p style={prose}>
        Where you authorise API access — publicly available LinkedIn company profiles (follower
        count, description, industry, HQ, employee range) and Lead Gen Form submissions from your
        own campaigns.
      </p>
      <p style={sub}>Usage Analytics</p>
      <p style={prose}>
        Anonymised product events (page views, feature interactions) via PostHog. No PII beyond a
        pseudonymous user ID.
      </p>
      <p style={sub}>API Keys</p>
      <p style={prose}>
        Stored in your browser's localStorage only — never transmitted to or stored on our servers.
      </p>
      <hr style={divider} />

      <h3 style={heading}>How We Use It</h3>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        {[
          'Operate and improve the Sonar platform',
          'Authenticate your account and maintain session security',
          'Sync and display lead data from LinkedIn campaigns',
          'Enrich company and contact records via authorised third-party APIs',
          'Analyse anonymised usage patterns for product improvement',
        ].map((t) => (
          <li key={t} style={li}>
            {t}
          </li>
        ))}
      </ul>
      <p style={{ ...prose, marginTop: 12 }}>
        We do not sell, rent, or share your data with third parties for advertising.
      </p>
      <hr style={divider} />

      <h3 style={heading}>Third-Party Services</h3>
      <div style={{ border: '1px solid #dbd7da', borderRadius: 8, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.5fr 1.6fr',
            gap: 12,
            padding: '8px 14px',
            background: '#ecedf2',
            fontSize: 10,
            fontWeight: 600,
            color: '#717a94',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          <span>Service</span>
          <span>Purpose</span>
          <span>Data shared</span>
        </div>
        {[
          ['Supabase', 'Database & auth', 'Account, lead & company records'],
          ['LinkedIn API', 'Lead sync & enrichment', 'Campaign lead data (authorised)'],
          ['Google Maps', 'Company discovery', 'Company name / location queries'],
          ['Hunter.io', 'Email verification', 'Domain / email queries'],
          ['Apollo.io', 'Contact enrichment', 'Company name / domain queries'],
          ['PostHog', 'Product analytics', 'Pseudonymous usage events'],
          ['Vercel', 'Hosting', 'HTTP request logs (anonymised)'],
        ].map(([s, p, d]) => (
          <div
            key={s}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.5fr 1.6fr',
              gap: 12,
              padding: '9px 14px',
              borderTop: '1px solid #ecedf2',
              fontSize: 13,
              color: '#484655',
              alignItems: 'start',
            }}
          >
            <span style={{ fontWeight: 600, color: '#01011b' }}>{s}</span>
            <span>{p}</span>
            <span>{d}</span>
          </div>
        ))}
      </div>
      <hr style={divider} />

      <h3 style={heading}>Your Rights</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          ['Access', 'Request a copy of personal data we hold about you'],
          ['Correction', 'Request correction of inaccurate personal data'],
          ['Erasure', 'Request deletion of your account and associated data'],
          ['Portability', 'Request an export in machine-readable format'],
          ['Withdraw consent', 'Revoke any data processing consent at any time'],
        ].map(([r, d]) => (
          <div
            key={r}
            style={{
              display: 'flex',
              gap: 12,
              padding: '10px 14px',
              background: '#ecedf2',
              borderRadius: 8,
              border: '1px solid #dbd7da',
            }}
          >
            <span style={{ fontWeight: 600, color: '#01011b', minWidth: 120, fontSize: 13 }}>
              {r}
            </span>
            <span style={{ color: '#484655', fontSize: 13 }}>{d}</span>
          </div>
        ))}
      </div>
      <hr style={divider} />

      <h3 style={heading}>Contact</h3>
      <div
        style={{
          padding: '16px 20px',
          background: '#ecedf2',
          border: '1px solid #dbd7da',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <span style={{ fontWeight: 600, color: '#01011b', fontSize: 14 }}>Shravan Omanakuttan</span>
        <span style={{ color: '#717a94', fontSize: 13 }}>Data Protection Officer, Sonar</span>
        <a href="mailto:sonarleads@proton.me" style={{ ...link, fontSize: 13, marginTop: 4 }}>
          sonarleads@proton.me
        </a>
        <span style={{ color: '#717a94', fontSize: 13 }}>Kerala, India</span>
      </div>
    </div>
  )
}

function TermsContent() {
  return (
    <div>
      <p style={prose}>
        By accessing Sonar at <strong>sonarleads.vercel.app</strong> you agree to these Terms. These
        Terms form a legally binding agreement between you and Shravan Omanakuttan ("we", "us").
      </p>
      <hr style={divider} />

      <h3 style={heading}>The Service</h3>
      <p style={prose}>
        Sonar is a B2B sales intelligence platform for discovering, enriching, and managing company
        and contact records. We reserve the right to modify or discontinue any aspect of the Service
        with reasonable notice.
      </p>
      <hr style={divider} />

      <h3 style={heading}>Accounts</h3>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        {[
          'Provide accurate information during registration',
          'Maintain the security of your credentials',
          'Notify us of any unauthorised access immediately',
          'Take responsibility for all activity under your account',
        ].map((t) => (
          <li key={t} style={li}>
            {t}
          </li>
        ))}
      </ul>
      <hr style={divider} />

      <h3 style={heading}>Acceptable Use</h3>
      <p style={prose}>You must not:</p>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        {[
          "Scrape or harvest data in violation of any third party's terms",
          'Send unsolicited bulk communications (spam)',
          'Attempt to gain unauthorised access to our infrastructure',
          'Store sensitive personal data (health, financial, biometric)',
          'Resell or redistribute access without prior written consent',
          "Violate LinkedIn's terms or API usage policies",
          'Reverse engineer or decompile the Service',
        ].map((t) => (
          <li key={t} style={li}>
            {t}
          </li>
        ))}
      </ul>
      <hr style={divider} />

      <h3 style={heading}>Your Data</h3>
      <p style={prose}>
        You retain ownership of all data you add to Sonar. You grant us a limited licence to store
        and process it solely to provide the Service. We will not sell or share your data beyond
        operating and improving Sonar. Data will be deleted within 30 days of account termination
        upon request.
      </p>
      <hr style={divider} />

      <h3 style={heading}>LinkedIn API Data</h3>
      <p style={prose}>
        By connecting LinkedIn you agree that LinkedIn data may only be used for your own sales
        activities, not to build competing products or datasets. LinkedIn data is subject to{' '}
        <a
          href="https://www.linkedin.com/legal/l/api-terms-of-use"
          target="_blank"
          rel="noreferrer"
          style={link}
        >
          LinkedIn's API Terms
        </a>{' '}
        in addition to ours.
      </p>
      <hr style={divider} />

      <h3 style={heading}>Disclaimers & Liability</h3>
      <p style={prose}>
        The Service is provided "as is" without warranties of any kind. We are not liable for
        indirect, incidental, or consequential damages. Our total liability shall not exceed the
        amount you paid us in the preceding 12 months or ₹5,000, whichever is greater.
      </p>
      <hr style={divider} />

      <h3 style={heading}>Governing Law</h3>
      <p style={prose}>
        These Terms are governed by the laws of India. Any disputes are subject to the exclusive
        jurisdiction of the courts of Kerala, India. Material changes to these Terms will be
        communicated at least 14 days before taking effect.
      </p>
      <hr style={divider} />

      <h3 style={heading}>Contact</h3>
      <div
        style={{
          padding: '16px 20px',
          background: '#ecedf2',
          border: '1px solid #dbd7da',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <span style={{ fontWeight: 600, color: '#01011b', fontSize: 14 }}>Shravan Omanakuttan</span>
        <span style={{ color: '#717a94', fontSize: 13 }}>Sonar</span>
        <a href="mailto:sonarleads@proton.me" style={{ ...link, fontSize: 13, marginTop: 4 }}>
          sonarleads@proton.me
        </a>
        <span style={{ color: '#717a94', fontSize: 13 }}>Kerala, India</span>
      </div>
    </div>
  )
}
