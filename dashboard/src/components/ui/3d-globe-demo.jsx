import Globe from './3d-globe'

const SANS    = "'Host Grotesk', 'Roboto', sans-serif"
const DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif"

export default function GlobeDemo() {
  return (
    <section style={{
      position: 'relative',
      background: '#0A0A0A',
      overflow: 'hidden',
      padding: '96px 48px',
    }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(231,0,11,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 80,
        alignItems: 'center',
      }}>
        {/* Left: text */}
        <div>
          <p style={{
            fontFamily: SANS,
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: '0.12em',
            color: '#E7000B',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}>
            Global coverage
          </p>
          <h2 style={{
            fontFamily: DISPLAY,
            fontSize: 'clamp(44px, 5vw, 72px)',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: '#FFFFFF',
            lineHeight: 1.0,
            letterSpacing: '-0.01em',
            marginBottom: 28,
          }}>
            Signals from<br />every market.
          </h2>
          <p style={{
            fontFamily: SANS,
            fontSize: 15,
            color: '#6B7280',
            lineHeight: 1.75,
            maxWidth: 380,
            marginBottom: 40,
          }}>
            Sonar surfaces buying intent across 140+ countries in real time. Reach the right account in any market before your competitors even know they exist.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              ['140+', 'Countries monitored'],
              ['2M+',  'Companies tracked'],
              ['<1s',  'Signal latency'],
            ].map(([stat, label]) => (
              <div key={stat} style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                  {stat}
                </span>
                <span style={{ fontFamily: SANS, fontSize: 12, color: '#4B5563', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: globe */}
        <div style={{ position: 'relative' }}>
          {/* Bottom gradient fade */}
          <div style={{
            position: 'absolute',
            bottom: '-2px',
            left: 0,
            right: 0,
            height: '30%',
            background: 'linear-gradient(to top, #0A0A0A, transparent)',
            zIndex: 1,
            pointerEvents: 'none',
          }} />
          {/* Red glow under globe */}
          <div style={{
            position: 'absolute',
            bottom: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            height: 60,
            background: 'radial-gradient(ellipse, rgba(231,0,11,0.35) 0%, transparent 70%)',
            filter: 'blur(20px)',
            pointerEvents: 'none',
          }} />
          <Globe />
        </div>
      </div>
    </section>
  )
}
