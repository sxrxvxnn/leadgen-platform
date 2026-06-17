import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'

export function FlipWords({ words, duration = 3000, style }) {
  const [currentWord, setCurrentWord] = useState(words[0])
  const [isAnimating, setIsAnimating] = useState(false)

  const startAnimation = useCallback(() => {
    const next = words[words.indexOf(currentWord) + 1] || words[0]
    setCurrentWord(next)
    setIsAnimating(true)
  }, [currentWord, words])

  useEffect(() => {
    if (!isAnimating) setTimeout(startAnimation, duration)
  }, [isAnimating, duration, startAnimation])

  return (
    <AnimatePresence onExitComplete={() => setIsAnimating(false)}>
      <motion.span
        key={currentWord}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -40, x: 40, filter: 'blur(8px)', scale: 1.5, position: 'absolute' }}
        transition={{ type: 'spring', stiffness: 100, damping: 10 }}
        style={{ display: 'inline-block', position: 'relative', ...style }}
      >
        {currentWord.split(' ').map((word, wi) => (
          <motion.span
            key={word + wi}
            initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: wi * 0.3, duration: 0.3 }}
            style={{ display: 'inline-block', whiteSpace: 'nowrap' }}
          >
            {word.split('').map((ch, ci) => (
              <motion.span
                key={word + ci}
                initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: wi * 0.3 + ci * 0.05, duration: 0.2 }}
                style={{ display: 'inline-block' }}
              >
                {ch}
              </motion.span>
            ))}
            {wi < currentWord.split(' ').length - 1 && ' '}
          </motion.span>
        ))}
      </motion.span>
    </AnimatePresence>
  )
}
