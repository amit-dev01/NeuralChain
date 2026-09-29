import { Link } from "react-router-dom"
import {
  Clock,
  ChevronRight,
  Layers,
} from "lucide-react"

import AppHeader from "@/components/common/AppHeader"
import { TimelineProvider } from "@/context/TimelineContext"
import TimelineControls from "@/components/Timeline/TimelineControls"
import VolumeComposedChart from "@/components/Timeline/VolumeComposedChart"
import VelocityHeatmap from "@/components/Timeline/VelocityHeatmap"
import EntitySwimLanes from "@/components/Timeline/EntitySwimLanes"
import PeelChainVisualizer from "@/components/Timeline/PeelChainVisualizer"
import RapidReuseTable from "@/components/Timeline/RapidReuseTable"

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION TIMELINE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function TimelinePage() {
  return (
    <TimelineProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 editorial-glow selection:bg-amber-500/20 flex flex-col">
        {/* ── UNIFIED APP HEADER ── */}
        <AppHeader />

        {/* ── MAIN CONTENT ── */}
        <main className="mx-auto max-w-screen-2xl w-full px-6 py-8 space-y-8 flex-1">
          {/* ── PAGE HEADER ── */}
          <div className="pb-2 border-b border-white/5 space-y-1">
            <nav className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Link to="/overview" className="hover:text-white transition-colors">
                Dashboard
              </Link>
              <ChevronRight className="h-3 w-3 text-zinc-600" />
              <span className="text-zinc-200 font-medium">Timeline</span>
            </nav>
            <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-normal text-white tracking-tight flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-blue-400" />
                  </div>
                  Transaction <span className="font-serif italic text-zinc-400 font-light">Timeline</span>
                </h1>
                <p className="text-xs text-zinc-400 mt-1 font-light tracking-wide">
                  Visualize transaction bursts, velocity anomalies, and temporal clustering across ingested data.
                </p>
              </div>

              {/* Quick status pill */}
              <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/60 px-3.5 py-1.5 rounded-full text-xs">
                <Layers className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-zinc-400">Stream:</span>
                <span className="font-medium text-emerald-400 flex items-center gap-1.5">
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
