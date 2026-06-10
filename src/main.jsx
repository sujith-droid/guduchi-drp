import React from 'react'
import ReactDOM from 'react-dom/client'
import moment from 'moment-timezone'
moment.tz.setDefault('Asia/Kolkata')
import App from '@/App.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)