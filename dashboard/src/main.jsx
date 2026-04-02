import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Custom cursor
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)