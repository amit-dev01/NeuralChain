import { Link } from "react-router-dom"
import {
  Clock,
  ChevronRight,
  LayoutDashboard,
  Upload,
  GitFork,
  Bell,
  Map,
  FileText,
  Activity,
  Layers,
} from "lucide-react"

import { TimelineProvider } from "@/context/TimelineContext"
import TimelineControls from "@/components/Timeline/TimelineControls"
import VolumeComposedChart from "@/components/Timeline/VolumeComposedChart"
import VelocityHeatmap from "@/components/Timeline/VelocityHeatmap"
import EntitySwimLanes from "@/components/Timeline/EntitySwimLanes"
import PeelChainVisualizer from "@/components/Timeline/PeelChainVisualizer"
import RapidReuseTable from "@/components/Timeline/RapidReuseTable"

// Standard navigation links across NeuralChain platform
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
// TRANSACTION TIMELINE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function TimelinePage() {
  // TODO: GET /api/v1/timeline?from={ts}&to={ts}&granularity=5m
  // TODO: GET /api/v1/timeline/peel-chains?limit=5
  // TODO: GET /api/v1/timeline/rapid-reuse

  return (
    <TimelineProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
        {/* ── STICKY TOPBAR HEADER ── */}
        <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
          <div className="mx-auto max-w-screen-2xl px-6 h-14 flex items-center gap-6">
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
                const isActive = to === "/timeline"
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

        {/* ── MAIN CONTENT ── */}
        <main className="mx-auto max-w-screen-2xl w-full px-6 py-6 space-y-6 flex-1">
          {/* ── PAGE HEADER ── */}
          <div className="space-y-1">
            <nav className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Link to="/overview" className="hover:text-zinc-300 transition-colors">
                Dashboard
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-zinc-300 font-medium">Timeline</span>
            </nav>
            <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2.5 text-zinc-100">
                  <Clock className="h-6 w-6 text-blue-400" />
                  Transaction Timeline
                </h1>
                <p className="text-sm text-zinc-400 mt-1">
                  Visualize transaction bursts, velocity anomalies, and temporal clustering across ingested data.
                </p>
              </div>

              {/* Quick status pill */}
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-lg text-xs">
                <Layers className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-zinc-400">Stream Status:</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Syncing
                </span>
              </div>
            </div>
          </div>

          {/* ── SECTION 1: TIME RANGE & FILTER CONTROLS ── */}
          <TimelineControls />

          {/* ── SECTION 2: VOLUME OVER TIME CHART ── */}
          <VolumeComposedChart />

          {/* ── SECTION 3: VELOCITY HEATMAP ── */}
          <VelocityHeatmap />

          {/* ── SECTION 4: ENTITY ACTIVITY SWIM LANES ── */}
          <EntitySwimLanes />

          {/* ── SECTION 5: PEEL CHAIN VISUALIZER ── */}
          <PeelChainVisualizer />

          {/* ── SECTION 6: RAPID REUSE TIMELINE ── */}
          <RapidReuseTable />
        </main>
      </div>
    </TimelineProvider>
  )
}
