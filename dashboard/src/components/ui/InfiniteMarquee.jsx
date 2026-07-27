export function InfiniteMarquee({ items, speed = 30, style, itemStyle }) {
  return (
    <div
      style={{
        overflow: 'hidden',
        maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '40px',
          width: 'max-content',
          animation: `marquee-scroll ${speed}s linear infinite`,
        }}
      >
        {[...items, ...items, ...items].map((item, i) => (
          <span key={i} style={{ whiteSpace: 'nowrap', flexShrink: 0, ...itemStyle }}>
            {item}
            {i < items.length * 3 - 1 && (
              <span style={{ marginLeft: '40px', opacity: 0.3 }}>·</span>
            )}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0) }
          to { transform: translateX(calc(-100% / 3)) }
        }
      `}</style>
    </div>
  )
}
