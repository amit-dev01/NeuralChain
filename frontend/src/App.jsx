import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import OverviewPage from './pages/OverviewPage.jsx'
import GraphPage from './pages/GraphPage.jsx'
import AlertsPage from './pages/AlertsPage.jsx'
import IngestPage from './pages/IngestPage.jsx'
import TimelinePage from './pages/TimelinePage.jsx'
import GeoMapPage from './pages/GeoMapPage.jsx'

export default function App() {
  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<Dashboard />} />

      {/* App pages */}
      <Route path="/overview"  element={<OverviewPage />} />
      <Route path="/graph"     element={<GraphPage />} />
      <Route path="/alerts"    element={<AlertsPage />} />
      <Route path="/ingest"    element={<IngestPage />} />
      <Route path="/timeline"  element={<TimelinePage />} />
      <Route path="/geomap"    element={<GeoMapPage />} />

      {/* Stub routes */}
      <Route path="/reports"   element={<PlaceholderPage title="Reports" />} />
    </Routes>
  )
}

function PlaceholderPage({ title }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-400 text-lg">{title} — coming soon</p>
    </div>
  )
}
