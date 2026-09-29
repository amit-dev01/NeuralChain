import { useState, useMemo } from "react"
import { Users, AlertTriangle, Zap, Network, ZoomIn, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useTimelineStore } from "@/context/TimelineContext"
import {
  SWIM_LANE_ENTITIES,
  BURST_ANOMALIES,
  START_TIME,
  ANCHOR_TIME,
} from "@/data/timelineMockData"

function getRiskColor(risk) {
  if (risk >= 0.8) return "#ef4444" // red
  if (risk >= 0.5) return "#f59e0b" // amber
  return "#10b981" // green
}

export default function EntitySwimLanes() {
  const {
    fromTs,
    toTs,
    entityFilter,
    zoomToRange,
    overlayAnomalies,
  } = useTimelineStore()

  const [hoveredEvent, setHoveredEvent] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const timeStart = fromTs || START_TIME
  const timeEnd = toTs || ANCHOR_TIME
  const durationMs = Math.max(1000, timeEnd - timeStart)

  // Filter entities if filterQuery is set
  const filteredEntities = useMemo(() => {
    if (!entityFilter.trim()) return SWIM_LANE_ENTITIES
    const q = entityFilter.toLowerCase()
    return SWIM_LANE_ENTITIES.filter(
      (e) =>
        e.id.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.events.some((ev) => ev.txid.toLowerCase().includes(q))
    )
  }, [entityFilter])

  // SVG dimensions
  const svgWidth = 980
  const labelWidth = 175
  const chartWidth = svgWidth - labelWidth - 25
  const rowHeight = 34
  const topPadding = 30
  const svgHeight = topPadding + filteredEntities.length * rowHeight + 25

  // Time grid markers (5 tick lines across visible duration)
  const timeTicks = useMemo(() => {
    const ticks = []
    const count = 6
    for (let i = 0; i <= count; i++) {
      const t = timeStart + (durationMs * i) / count
      const d = new Date(t)
      const hh = String(d.getHours()).padStart(2, "0")
      const mm = String(d.getMinutes()).padStart(2, "0")
      const x = labelWidth + (chartWidth * i) / count
      ticks.push({ x, label: `${hh}:${mm}` })
    }
    return ticks
  }, [timeStart, durationMs, labelWidth, chartWidth])

  const handleCircleHover = (ev, entity, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredEvent({ ...ev, entityId: entity.id, entityLabel: entity.label })
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    })
  }

  return (
    <div className="editorial-surface rounded-2xl p-6 border border-white/10 shadow-xl space-y-4">
      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/5">
        <div>
          <h2 className="font-display text-xl font-normal text-white tracking-tight flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-400" />
            Entity Activity Over Time
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5 font-light">
            Each row = one high-risk wallet or IP entity • Synchronized with volume timeline
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-950/80 px-3.5 py-1.5 rounded-full border border-white/10 text-xs">
          <span className="text-zinc-500 text-[11px] font-medium">Risk Score:</span>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-zinc-400">Low (&lt;0.5)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="text-[10px] text-zinc-400">Med (0.5–0.8)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-[10px] text-zinc-400">High (&gt;0.8)</span>
          </div>
          <div className="h-3 w-px bg-zinc-700" />
          <span className="text-[10px] text-zinc-400">Circle size ∝ BTC value</span>
        </div>
      </div>

      {/* ── CUSTOM SVG SWIMLANE CANVAS ── */}
      <div className="overflow-x-auto relative rounded-lg border border-zinc-800/80 bg-zinc-950/70 p-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[780px] h-auto select-none"
        >
          {/* Vertical Time Grid Lines & Headers */}
          {timeTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={tick.x}
                y1={topPadding - 10}
                x2={tick.x}
                y2={svgHeight - 15}
                stroke="#27272a"
                strokeDasharray="2 3"
              />
              <text
                x={tick.x}
                y={topPadding - 16}
                fill="#71717a"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {/* Vertical Burst Zone Overlay Bands (multi-entity simultaneous bursts) */}
          {overlayAnomalies &&
            BURST_ANOMALIES.map((burst) => {
              const normX = (burst.timestamp - timeStart) / durationMs
              if (normX < -0.05 || normX > 1.05) return null
              const bandCenter = labelWidth + normX * chartWidth
              const bandWidth = 28
              const bandX = bandCenter - bandWidth / 2

              return (
                <g key={burst.id}>
                  <rect
                    x={bandX}
                    y={topPadding - 8}
                    width={bandWidth}
                    height={svgHeight - topPadding - 6}
                    fill="rgba(239, 68, 68, 0.12)"
                    stroke="rgba(239, 68, 68, 0.35)"
                    strokeDasharray="3 3"
                    rx={4}
                  />
                  <text
                    x={bandCenter}
                    y={svgHeight - 4}
                    fill="#ef4444"
                    fontSize="9"
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    BURST ZONE
                  </text>
                </g>
              )
            })}

          {/* Swimlane Rows */}
          {filteredEntities.map((entity, rowIdx) => {
            const rowY = topPadding + rowIdx * rowHeight + 14
            const isIP = entity.type === "ip"

            return (
              <g key={entity.id} className="group">
                {/* Horizontal baseline track */}
                <line
                  x1={labelWidth}
                  y1={rowY}
                  x2={labelWidth + chartWidth}
                  y2={rowY}
                  stroke="#27272a"
                  strokeWidth="1"
                />

                {/* Y-axis Label: Entity ID & Label */}
                <g className="cursor-pointer">
                  <rect
                    x={4}
                    y={rowY - 12}
                    width={labelWidth - 10}
                    height={22}
                    rx={4}
                    fill="transparent"
                    className="hover:fill-zinc-800/60 transition-colors"
                  />
                  <text
                    x={12}
                    y={rowY + 1}
                    fill={isIP ? "#fb923c" : "#c084fc"}
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="600"
                  >
                    {entity.shortId}
                  </text>
                  <text
                    x={12}
                    y={rowY + 9}
                    fill="#71717a"
                    fontSize="8"
                  >
                    {entity.label.slice(0, 22)}
                  </text>
                </g>

                {/* Event Circles */}
                {entity.events.map((ev) => {
                  const normX = (ev.timestamp - timeStart) / durationMs
                  // Only draw if within bounds (with slight slack for radius)
                  if (normX < -0.02 || normX > 1.02) return null

                  const cx = labelWidth + normX * chartWidth
                  // Proportional radius: min 4px, max 16px
                  const radius = Math.max(
                    4,
                    Math.min(16, 4 + Math.sqrt(ev.amount || 0.5) * 3)
                  )
                  const fill = getRiskColor(ev.risk)

                  return (
                    <circle
                      key={ev.id}
                      cx={cx}
                      cy={rowY}
                      r={radius}
                      fill={fill}
                      fillOpacity={0.85}
                      stroke={fill}
                      strokeWidth={1.5}
                      className="cursor-pointer transition-transform hover:scale-125"
                      onMouseEnter={(e) => handleCircleHover(ev, entity, e)}
                      onMouseLeave={() => setHoveredEvent(null)}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredEvent && (
          <div
            className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-2xl text-xs space-y-1.5 min-w-56"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
              <span className="font-mono text-zinc-300 font-semibold">
                TXID: {hoveredEvent.txid}
              </span>
              <Badge
                variant={
                  hoveredEvent.risk >= 0.8
                    ? "red"
                    : hoveredEvent.risk >= 0.5
                    ? "amber"
                    : "green"
                }
                className="text-[10px] h-4"
              >
                Risk: {hoveredEvent.risk.toFixed(2)}
              </Badge>
            </div>
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-500">Timestamp:</span>
                <span className="text-zinc-200 font-mono">
                  {new Date(hoveredEvent.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Amount:</span>
                <span className="text-amber-400 font-mono font-semibold">
                  {hoveredEvent.amount} BTC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Reason:</span>
                <span className="text-zinc-300 italic">{hoveredEvent.reason}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── DETECTED BURST PERIODS (AMBER BADGE PILLS) ── */}
      <div className="space-y-2 pt-1 border-t border-zinc-800/80">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            Detected Burst Periods (Click pill to zoom chart):
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">
            {BURST_ANOMALIES.length} temporal clusters identified
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {BURST_ANOMALIES.map((burst) => (
            <button
              key={burst.id}
              onClick={() => {
                // Zoom chart to burst window with padding
                const pad = 12 * 60 * 1000
                zoomToRange(burst.timestamp - pad, burst.timestamp + pad)
              }}
              className="inline-flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-400 rounded-full px-3 py-1 text-xs font-mono transition-all group shadow-sm"
              title="Click to zoom timeline to this burst window"
            >
              <AlertTriangle className="h-3 w-3 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>
                {burst.timeWindow} — {burst.entitiesCount} entities, {burst.txCount} tx
              </span>
              <ZoomIn className="h-3 w-3 text-amber-400/70 ml-0.5 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
