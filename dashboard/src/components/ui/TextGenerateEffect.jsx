import { useEffect } from 'react'
import { motion, stagger, useAnimate } from 'motion/react'

export function TextGenerateEffect({
  text,
  style,
  wordStyle,
  delay = 0,
  duration = 0.4,
  staggerDelay = 0.08,
}) {
  const [scope, animate] = useAnimate()

  useEffect(() => {
    animate(
      'span.tge-word',
      { opacity: 1, filter: 'blur(0px)', y: 0 },
      { duration, delay: stagger(staggerDelay, { startDelay: delay }), ease: [0.22, 1, 0.36, 1] }
    )
  }, [])

  return (
    <div ref={scope} style={style}>
      {text.split(' ').map((word, i) => (
        <motion.span
          key={i}
          className="tge-word"
          style={{
            opacity: 0,
            filter: 'blur(8px)',
            display: 'inline-block',
            marginRight: '0.3em',
            transform: 'translateY(8px)',
            ...wordStyle,
          }}
        >
          {word}
        </motion.span>
      ))}
    </div>
  )
}
