import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Globe,
  ChevronRight,
  LayoutDashboard,
  Upload,
  GitFork,
  Bell,
  Clock,
  Map,
  FileText,
  Activity,
} from "lucide-react"

import GeoMapControls from "@/components/GeoMap/GeoMapControls"
import GeoMapCanvas from "@/components/GeoMap/GeoMapCanvas"
import CountryDetailSheet from "@/components/GeoMap/CountryDetailSheet"
import { getCountryDetail } from "@/data/geoMockData"

const NAV_LINKS = [
  { label: "Dashboard", to: "/overview", icon: LayoutDashboard },
  { label: "Ingest",    to: "/ingest",   icon: Upload          },
  { label: "Graph",     to: "/graph",    icon: GitFork         },
  { label: "Alerts",    to: "/alerts",   icon: Bell            },
  { label: "Timeline",  to: "/timeline", icon: Clock           },
  { label: "GeoMap",    to: "/geomap",   icon: Map             },
  { label: "Reports",   to: "/reports",  icon: FileText        },
]

// ═══════════════════════════════════════════════════════════════════════════════
// GEOGRAPHIC INTELLIGENCE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function GeoMapPage() {
  // TODO: GET /api/v1/geo/heatmap → [{lat, lng, weight}]
  // TODO: GET /api/v1/geo/alerts → [{ip, lat, lng, risk, wallet_count, tx_count}]
  // TODO: GET /api/v1/geo/arcs → [{src_country, dst_country, volume, flagged}]
  // TODO: GET /api/v1/geo/country/{code} for detail sheet

  // Layer switches state
  const [layers, setLayers] = useState({
    heatmap: true,
    arcs: false,
    alerts: true,
    asns: false,
    choropleth: false,
  })

  // Filter state
  const [riskThreshold, setRiskThreshold] = useState(0.75)
  const [selectedCountry, setSelectedCountry] = useState("all")
  const [timeFilter, setTimeFilter] = useState("24h")

  // Country detail sheet state
  const [activeCountryDetail, setActiveCountryDetail] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleOpenCountryDetail = (countryCode) => {
    const detail = getCountryDetail(countryCode)
    setActiveCountryDetail(detail)
    setSheetOpen(true)
  }

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      {/* ── STICKY TOPBAR HEADER ── */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md z-50 shrink-0">
        <div className="mx-auto max-w-full px-6 h-full flex items-center gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <span className="font-mono text-lg font-bold text-amber-400 tracking-tight">
              SIH26146
            </span>
            <span className="hidden sm:block text-xs text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">
              NeuralChain
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 flex-1" aria-label="Main navigation">
            {NAV_LINKS.map(({ label, to, icon: Icon }) => {
              const isActive = to === "/geomap"
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* System Status badge */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-zinc-400 hidden sm:block">
              All Systems Operational
            </span>
          </div>
        </div>
      </header>

      {/* ── SUBHEADER / BREADCRUMB ROW ── */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-900/60 px-6 flex items-center justify-between shrink-0">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Link to="/overview" className="hover:text-zinc-300 transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-zinc-300 font-medium">GeoMap</span>
          </nav>
          <div className="flex items-center gap-2 mt-0.5">
            <h1 className="text-sm font-bold flex items-center gap-1.5 text-zinc-100">
              <Globe className="h-4 w-4 text-blue-400" />
              Geographic Intelligence
            </h1>
            <span className="text-zinc-600 hidden sm:inline">•</span>
            <p className="text-xs text-zinc-400 hidden sm:inline">
              IP origin mapping, ASN distribution, and cross-border transaction flow analysis.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2.5 py-1 rounded-md border border-zinc-800">
            Basemap: CartoDB Dark Matter
          </span>
        </div>
      </div>

      {/* ── MAIN FULL-SCREEN SPLIT LAYOUT ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel (320px fixed) */}
        <GeoMapControls
          layers={layers}
          setLayers={setLayers}
          riskThreshold={riskThreshold}
          setRiskThreshold={setRiskThreshold}
          selectedCountry={selectedCountry}
          setSelectedCountry={setSelectedCountry}
          timeFilter={timeFilter}
          setTimeFilter={setTimeFilter}
          onSelectCountryDetail={handleOpenCountryDetail}
        />

        {/* Right Panel (flex-1 full-height Leaflet map) */}
        <GeoMapCanvas
          layers={layers}
          setLayers={setLayers}
          riskThreshold={riskThreshold}
          selectedCountry={selectedCountry}
          onSelectCountryDetail={handleOpenCountryDetail}
        />

        {/* Country Detail Side Sheet */}
        <CountryDetailSheet
          country={activeCountryDetail}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
        />
      </div>
    </div>
  )
}
