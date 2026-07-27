import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const cursor = document.createElement('div')
cursor.id = 'cursor'
document.body.appendChild(cursor)

document.addEventListener('mousemove', (e) => {
  cursor.style.left = e.clientX + 'px'
  cursor.style.top = e.clientY + 'px'
})

document.addEventListener('mouseover', (e) => {
  if (e.target.matches('button, a, input, select, [data-hover]')) {
    cursor.classList.add('hovering')
  } else {
    cursor.classList.remove('hovering')
  }
})

// Watch for theme changes and update cursor color
const observer = new MutationObserver(() => {
  const theme = document.documentElement.getAttribute('data-theme')
  cursor.style.background = theme === 'light' ? '#0a0a0a' : '#f0ede8'
})
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

// Apply saved theme on load
const savedTheme = localStorage.getItem('theme') || 'dark'
document.documentElement.setAttribute('data-theme', savedTheme)
if (savedTheme === 'light') cursor.style.background = '#0a0a0a'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
