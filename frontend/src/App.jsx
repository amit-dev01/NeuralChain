import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import OverviewPage from './pages/OverviewPage.jsx'
import GraphPage from './pages/GraphPage.jsx'
import AlertsPage from './pages/AlertsPage.jsx'
import IngestPage from './pages/IngestPage.jsx'
import TimelinePage from './pages/TimelinePage.jsx'
import GeoMapPage from './pages/GeoMapPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import DocsPage from './pages/DocsPage.jsx'

export default function App() {
  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<Dashboard />} />

      {/* App pages */}
      <Route path="/overview"      element={<OverviewPage />} />
      <Route path="/dashboard"     element={<OverviewPage />} />
      <Route path="/graph"         element={<GraphPage />} />
      <Route path="/intelligence"  element={<GraphPage />} />
      <Route path="/alerts"        element={<AlertsPage />} />
      <Route path="/ingest"        element={<IngestPage />} />
      <Route path="/timeline"      element={<TimelinePage />} />
      <Route path="/geomap"        element={<GeoMapPage />} />
      <Route path="/reports"       element={<ReportsPage />} />
      <Route path="/docs"          element={<DocsPage />} />

      {/* Fallback route */}
      <Route path="*"              element={<OverviewPage />} />
    </Routes>
  )
}
