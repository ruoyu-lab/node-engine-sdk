import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@node-wright/react/style.css'
import '@playground/shared/styles/index.css'
import { App } from '../app/App'

const container = document.getElementById('app')

if (!container) {
  throw new Error('The playground page has no #app element.')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
