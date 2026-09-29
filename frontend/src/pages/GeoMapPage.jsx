import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Globe,
  ChevronRight,
} from "lucide-react"

import AppHeader from "@/components/common/AppHeader"
import GeoMapControls from "@/components/GeoMap/GeoMapControls"
import GeoMapCanvas from "@/components/GeoMap/GeoMapCanvas"
import CountryDetailSheet from "@/components/GeoMap/CountryDetailSheet"
import { getCountryDetail } from "@/data/geoMockData"

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
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden editorial-glow selection:bg-amber-500/20">
      {/* ── UNIFIED APP HEADER ── */}
      <AppHeader
        rightContent={
          <span className="text-[11px] font-mono text-zinc-400 bg-slate-900/80 px-3 py-1 rounded-full border border-white/10 hidden sm:inline">
            Basemap: CartoDB Dark Matter
          </span>
        }
      />

      {/* ── SUBHEADER / BREADCRUMB ROW ── */}
      <div className="h-14 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl px-6 flex items-center justify-between shrink-0">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Link to="/overview" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="h-3 w-3 text-zinc-600" />
            <span className="text-zinc-200 font-medium">GeoMap</span>
          </nav>
          <div className="flex items-center gap-2 mt-0.5">
            <h1 className="font-display text-lg font-normal flex items-center gap-2 text-white tracking-tight">
              <Globe className="h-4 w-4 text-blue-400" />
              Geographic <span className="font-serif italic text-zinc-400 font-light">Intelligence</span>
            </h1>
            <span className="text-zinc-700 hidden sm:inline">•</span>
            <p className="text-xs text-zinc-400 hidden sm:inline font-light">
              IP origin mapping, ASN distribution, and cross-border transaction flow analysis.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
            OFFLINE READY
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
