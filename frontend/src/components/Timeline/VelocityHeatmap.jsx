import { useState } from "react"
import { Grid, Flame, Info } from "lucide-react"
import { HEATMAP_DATA } from "@/data/timelineMockData"

// Color scale interpolator: zinc-900 -> blue-500 -> amber-500 -> red-500
function getHeatmapColor(count, max = 3200) {
  const ratio = Math.min(1, Math.max(0, count / max))
  if (ratio <= 0.08) return "rgb(24, 24, 27)" // zinc-900
  if (ratio <= 0.35) {
    // zinc-900 (24,24,27) -> blue-500 (59,130,246)
    const t = (ratio - 0.08) / 0.27
    const r = Math.round(24 + (59 - 24) * t)
    const g = Math.round(24 + (130 - 24) * t)
    const b = Math.round(27 + (246 - 27) * t)
    return `rgb(${r}, ${g}, ${b})`
  }
  if (ratio <= 0.68) {
    // blue-500 (59,130,246) -> amber-500 (245,158,11)
    const t = (ratio - 0.35) / 0.33
    const r = Math.round(59 + (245 - 59) * t)
    const g = Math.round(130 + (158 - 130) * t)
    const b = Math.round(246 + (11 - 246) * t)
    return `rgb(${r}, ${g}, ${b})`
  }
  // amber-500 (245,158,11) -> red-500 (239,68,68)
  const t = (ratio - 0.68) / 0.32
  const r = Math.round(245 + (239 - 245) * t)
  const g = Math.round(158 + (68 - 158) * t)
  const b = Math.round(11 + (68 - 11) * t)
  return `rgb(${r}, ${g}, ${b})`
}

export default function VelocityHeatmap() {
  const { grid, maxTx } = HEATMAP_DATA
  const [hoveredCell, setHoveredCell] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  const handleMouseEnter = (cell, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredCell(cell)
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
  }

  const handleMouseLeave = () => {
    setHoveredCell(null)
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 shadow-xl space-y-4 relative">
      {/* ── HEADER & COLOR SCALE LEGEND ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-500" />
            Transaction Velocity Heatmap (Hour × Day)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Hourly transaction density distribution across the weekly cycle (7 Days × 24 Hours)
          </p>
        </div>

        {/* Color scale legend on the right side: zinc-900 → blue-500 → amber-500 → red-500 */}
        <div className="flex items-center gap-3 bg-zinc-950/80 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs">
          <span className="text-zinc-500 text-[11px] font-medium">Density:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-400">0 tx</span>
            <div
              className="h-2.5 w-28 rounded-full border border-zinc-700/60 shadow-inner"
              style={{
                background:
                  "linear-gradient(to right, rgb(24, 24, 27) 0%, rgb(59, 130, 246) 35%, rgb(245, 158, 11) 68%, rgb(239, 68, 68) 100%)",
              }}
            />
            <span className="text-[10px] text-zinc-400">3.2k+ tx</span>
          </div>
          <div className="h-3 w-px bg-zinc-800" />
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            Peak Velocity
          </div>
        </div>
      </div>

      {/* ── HEATMAP GRID (7 rows × 24 columns) ── */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[760px] space-y-1.5">
          {/* Hour labels header (00 to 23) */}
          <div className="grid grid-cols-[56px_repeat(24,minmax(0,1fr))] gap-1 items-center">
            <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider text-right pr-2">
              Day
            </div>
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="text-[9px] font-mono text-zinc-500 text-center select-none"
              >
                {h % 3 === 0 ? `${String(h).padStart(2, "0")}h` : "·"}
              </div>
            ))}
          </div>

          {/* 7 Day Rows */}
          {grid.map((row, dayIdx) => {
            const dayName = row[0]?.dayShort || `Day ${dayIdx}`
            return (
              <div
                key={dayIdx}
                className="grid grid-cols-[56px_repeat(24,minmax(0,1fr))] gap-1 items-center"
              >
                {/* Day label */}
                <div className="text-xs font-mono text-zinc-400 font-medium text-right pr-2 select-none">
                  {dayName}
                </div>

                {/* 24 Hour Cells */}
                {row.map((cell) => {
                  const color = getHeatmapColor(cell.txCount, maxTx)
                  const isHovered =
                    hoveredCell?.dayIndex === cell.dayIndex &&
                    hoveredCell?.hour === cell.hour

                  return (
                    <div
                      key={cell.hour}
                      onMouseEnter={(e) => handleMouseEnter(cell, e)}
                      onMouseLeave={handleMouseLeave}
                      className={`h-7 rounded-sm cursor-pointer transition-all duration-150 border relative ${
                        isHovered
                          ? "scale-110 z-20 border-white shadow-lg ring-2 ring-blue-500/50"
                          : "border-zinc-800/40 hover:border-zinc-500/60"
                      }`}
                      style={{
                        backgroundColor: color,
                      }}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating or fixed hover inspector */}
      <div className="h-8 flex items-center justify-between bg-zinc-950/60 px-3.5 py-1 rounded-lg border border-zinc-800 text-xs">
        {hoveredCell ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-zinc-200 font-semibold">
              {hoveredCell.dayName} {hoveredCell.timeLabel}
            </span>
            <span className="text-zinc-600">—</span>
            <span className="text-blue-400 font-mono font-medium">
              {hoveredCell.txCount.toLocaleString()} transactions
            </span>
            <span className="text-zinc-600">,</span>
            <span className="text-red-400 font-mono font-medium">
              {hoveredCell.flaggedCount} flagged
            </span>
            {hoveredCell.txCount > 2500 && (
              <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] px-1.5 py-0.5 rounded font-medium">
                High Velocity Zone
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <Info className="h-3.5 w-3.5" />
            <span>Hover over any cell to inspect transaction density and flagged anomalies</span>
          </div>
        )}

        <div className="text-[11px] text-zinc-500 font-mono hidden md:block">
          Baseline 24h cycle • 168 temporal buckets
        </div>
      </div>
    </div>
  )
}
