import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { setAuthToken } from './api/client'
import './styles/globals.css'

// Extract auth token from URL query parameter and store it
const params = new URLSearchParams(window.location.search)
const token = params.get('token')
if (token) {
  setAuthToken(token)
  // Remove token from URL to avoid exposing it in browser history
  params.delete('token')
  const newUrl = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname
  window.history.replaceState({}, '', newUrl)
}

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
