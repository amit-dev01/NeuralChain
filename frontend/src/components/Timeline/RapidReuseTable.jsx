import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Zap,
  Globe,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Clock,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RAPID_REUSE_DATA } from "@/data/timelineMockData"
import { useTimelineStore } from "@/context/TimelineContext"

// Mini 200px wide timeline bar chart showing when each tx happened in the window
function MiniTimelineBar({ events, windowSec }) {
  const width = 200
  const height = 24

  return (
    <div className="flex flex-col gap-1 items-start">
      <svg
        width={width}
        height={height}
        className="bg-zinc-950 rounded border border-zinc-800"
      >
        {/* Baseline */}
        <line
          x1={4}
          y1={height / 2}
          x2={width - 4}
          y2={height / 2}
          stroke="#3f3f46"
          strokeWidth={1}
        />

        {/* Start & End tick marks */}
        <line x1={6} y1={4} x2={6} y2={height - 4} stroke="#71717a" strokeWidth={1} />
        <line
          x1={width - 6}
          y1={4}
          x2={width - 6}
          y2={height - 4}
          stroke="#71717a"
          strokeWidth={1}
        />

        {/* Transaction tick marks / micro bars */}
        {events.map((ev, i) => {
          const ratio = Math.min(1, Math.max(0, ev.sec / windowSec))
          const x = 6 + ratio * (width - 12)
          return (
            <line
              key={i}
              x1={x}
              y1={4}
              x2={x}
              y2={height - 4}
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeOpacity={0.85}
              className="hover:stroke-red-400 hover:stroke-width-2 transition-all cursor-pointer"
            >
              <title>{`+${ev.sec}s • ${ev.amount} BTC • ${ev.wallet}`}</title>
            </line>
          )
        })}
      </svg>
      <div className="w-full flex justify-between text-[9px] text-zinc-500 font-mono px-0.5">
        <span>0s</span>
        <span>{windowSec}s window ({events.length} txs)</span>
      </div>
    </div>
  )
}

export default function RapidReuseTable() {
  const navigate = useNavigate()
  const { setEntityFilter } = useTimelineStore()
  const [expandedIp, setExpandedIp] = useState(null)

  // TODO: GET /api/v1/timeline/rapid-reuse

  const toggleExpand = (ip) => {
    setExpandedIp((prev) => (prev === ip ? null : ip))
  }

  return (
    <div className="editorial-surface rounded-2xl p-6 border border-white/10 shadow-xl space-y-4">
      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/5">
        <div>
          <h2 className="font-display text-xl font-normal text-white tracking-tight flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            IP Address Rapid Reuse Events
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5 font-light">
            Same IP signing transactions for multiple distinct wallets within concentrated time windows
          </p>
        </div>

        <Badge variant="amber" className="text-[10px] rounded-full px-2.5 py-0.5">
          {RAPID_REUSE_DATA.length} Anomalous IP Clusters
        </Badge>
      </div>

      {/* ── TABLE ── */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-xs text-left">
          <thead className="bg-zinc-950/80 text-zinc-400 font-medium border-b border-zinc-800">
            <tr>
              <th className="py-3 px-4">IP Address</th>
              <th className="py-3 px-4">Wallets Used</th>
              <th className="py-3 px-4">Tx Count</th>
              <th className="py-3 px-4">Time Window</th>
              <th className="py-3 px-4">Risk</th>
              <th className="py-3 px-4 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-mono">
            {RAPID_REUSE_DATA.map((row) => {
              const isExpanded = expandedIp === row.ip
              const riskColor =
                row.risk >= 0.9
                  ? "text-red-400 font-bold"
                  : row.risk >= 0.8
                  ? "text-amber-400 font-semibold"
                  : "text-emerald-400 font-medium"

              return (
                <tr
                  key={row.ip}
                  className={`group transition-colors ${
                    isExpanded ? "bg-zinc-800/40" : "hover:bg-zinc-800/20"
                  }`}
                >
                  <td colSpan={6} className="p-0">
                    {/* Primary Row Content */}
                    <div
                      onClick={() => toggleExpand(row.ip)}
                      className="flex items-center justify-between py-3 px-4 cursor-pointer"
                    >
                      {/* IP Address */}
                      <div className="w-1/5 flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-zinc-400" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                        )}
                        <div>
                          <div className="font-semibold text-zinc-200 group-hover:text-blue-400 transition-colors">
                            {row.ip}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-sans">
                            {row.geo}
                          </div>
                        </div>
                      </div>

                      {/* Wallets Used */}
                      <div className="w-1/5 text-zinc-300">
                        <span className="font-bold text-violet-400">
                          {row.walletsCount}
                        </span>{" "}
                        <span className="text-zinc-500 text-[11px] font-sans">
                          wallets
                        </span>
                      </div>

                      {/* Tx Count */}
                      <div className="w-1/6 text-zinc-300">
                        <span className="font-bold text-blue-400">
                          {row.txCount}
                        </span>{" "}
                        <span className="text-zinc-500 text-[11px] font-sans">
                          txs
                        </span>
                      </div>

                      {/* Time Window */}
                      <div className="w-1/5 text-amber-300 font-medium">
                        {row.timeWindow}
                      </div>

                      {/* Risk */}
                      <div className="w-1/6">
                        <span className={riskColor}>
                          {row.risk.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-zinc-500 ml-1 font-sans">
                          ({row.detectionModel})
                        </span>
                      </div>

                      {/* View Action Buttons */}
                      <div
                        className="w-1/6 flex items-center justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEntityFilter(row.ip)
                          }}
                          className="h-7 px-2 text-[11px] text-zinc-400 hover:text-white"
                          title="Filter timeline by this IP"
                        >
                          Filter
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/graph?focus=${row.ip}`)}
                          className="h-7 px-2.5 text-xs gap-1 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                        >
                          <ExternalLink className="h-3 w-3 text-blue-400" />
                          Graph
                        </Button>
                      </div>
                    </div>

                    {/* Expandable Mini Timeline Bar & Details */}
                    {isExpanded && (
                      <div className="px-6 py-4 bg-zinc-950/70 border-t border-zinc-800/80 space-y-3 font-sans">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          {/* Mini Timeline Bar (200px wide as requested) */}
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-amber-400" />
                              Transaction Signature Distribution:
                            </span>
                            <MiniTimelineBar
                              events={row.events}
                              windowSec={row.timeWindowSec}
                            />
                          </div>

                          {/* IP Metadata */}
                          <div className="space-y-1 text-xs text-zinc-400">
                            <div>
                              ASN: <span className="text-zinc-200 font-mono">{row.asn}</span>
                            </div>
                            <div>
                              Geo Location: <span className="text-zinc-200">{row.geo}</span>
                            </div>
                            <div>
                              Trigger:{" "}
                              <span className="text-red-400 font-medium">
                                High concurrency signature ({row.txCount} txs in {row.timeWindow})
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Associated Wallets list */}
                        <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
                          <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                            <Wallet className="h-3.5 w-3.5 text-violet-400" />
                            Wallets Signed by this IP:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {row.wallets.map((w, idx) => (
                              <button
                                key={idx}
                                onClick={() => navigate(`/graph?focus=${w}`)}
                                className="font-mono text-[11px] bg-zinc-900 hover:bg-violet-950/40 text-zinc-300 hover:text-violet-300 px-2 py-0.5 rounded border border-zinc-800 hover:border-violet-700/50 transition-colors"
                              >
                                {w.slice(0, 10)}…{w.slice(-6)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
