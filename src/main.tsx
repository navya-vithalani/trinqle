import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/500.css'
import '@fontsource/fredoka/600.css'
import './index.css'
import { App } from './ui/App'
import { ErrorBoundary } from './ui/components/ErrorBoundary'

const rootElement = document.getElementById('root')

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
}
