import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  Upload,
  GitFork,
  Bell,
  Clock,
  Map,
  FileText,
  Activity,
  Sparkles,
  BookOpen,
} from "lucide-react"
import AICopilotDrawer from "./AICopilotDrawer"

const NAV_LINKS = [
  { label: "Dashboard", to: "/overview", icon: LayoutDashboard },
  { label: "Ingest",    to: "/ingest",   icon: Upload          },
  { label: "Graph",     to: "/graph",    icon: GitFork         },
  { label: "Alerts",    to: "/alerts",   icon: Bell            },
  { label: "Timeline",  to: "/timeline", icon: Clock           },
  { label: "GeoMap",    to: "/geomap",   icon: Map             },
  { label: "Reports",   to: "/reports",  icon: FileText        },
  { label: "Docs",      to: "/docs",     icon: BookOpen        },
]

export default function AppHeader({ rightContent }) {
  const location = useLocation()
  const [isCopilotOpen, setIsCopilotOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto max-w-screen-2xl px-6 h-14 flex items-center gap-6">
          {/* ── Brand Logo matching Landing Page Theme ── */}
          <Link to="/" className="flex items-center gap-2 group select-none shrink-0" aria-label="NeuralChain Home">
            <span className="font-display text-2xl font-normal text-white tracking-tight group-hover:text-amber-200 transition-colors">
              NeuralChain<sup className="text-[10px] font-sans text-zinc-400 ml-0.5">®</sup>
            </span>
            <span className="font-mono text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-md px-1.5 py-0.5">
              SIH26146
            </span>
          </Link>

          {/* ── Editorial Pill Navigation Links ── */}
          <nav className="hidden md:flex items-center gap-1.5 flex-1" aria-label="Main navigation">
            {NAV_LINKS.map(({ label, to, icon: Icon }) => {
              const isActive = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white/10 text-white font-semibold border border-white/20 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? "text-amber-400" : "text-zinc-500"}`} />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* ── Right Content & Live Operational Status ── */}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {/* AI Forensics Copilot Button */}
            <button
              onClick={() => setIsCopilotOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 transition-all shadow-sm shadow-amber-500/10 group cursor-pointer"
              title="Open Forensic Co-Pilot powered by Gemma 4"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
              <span className="font-semibold">AI Co-Pilot</span>
              <span className="hidden sm:inline text-[9px] font-mono bg-amber-500/20 px-1 py-0.2 rounded text-amber-200">Gemma 4</span>
            </button>

            {rightContent}
            <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/60 rounded-full px-3 py-1 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-medium text-zinc-300 hidden sm:inline">
                All Systems Operational
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Persistent AI Copilot Drawer */}
      <AICopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />
    </>
  )
}
