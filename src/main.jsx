import React from 'react'
import ReactDOM from 'react-dom/client'
import SessionGate from './SessionGate.jsx'
import './index.css'

// Registro del Service Worker PWA Offline-First
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration error:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SessionGate />
  </React.StrictMode>,
)
