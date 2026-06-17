import { useEffect, useState } from 'react'

function easeOut(t) { return 1 - Math.pow(1 - t, 3) }

export function CountUp({ to, duration = 1.2, delay = 0 }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (to === 0) return
    const timeout = setTimeout(() => {
      const startTime = Date.now()
      const ms = duration * 1000
      const frame = () => {
        const elapsed = (Date.now() - startTime) / ms
        if (elapsed >= 1) { setCount(to); return }
        setCount(Math.floor(to * easeOut(elapsed)))
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    }, delay * 1000)
    return () => clearTimeout(timeout)
  }, [to, duration, delay])

  return count
}
