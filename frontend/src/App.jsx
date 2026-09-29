import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import GraphPage from './pages/GraphPage.jsx'
import AlertsPage from './pages/AlertsPage.jsx'
import IngestPage from './pages/IngestPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/graph" element={<GraphPage />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/ingest" element={<IngestPage />} />
    </Routes>
  )
}
