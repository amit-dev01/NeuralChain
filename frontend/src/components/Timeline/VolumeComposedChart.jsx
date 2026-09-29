import { useMemo, useCallback } from "react"
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  Legend,
} from "recharts"
import { AlertTriangle, Activity, BarChart2, ShieldAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useTimelineStore } from "@/context/TimelineContext"
import { VOLUME_DATA, BURST_ANOMALIES } from "@/data/timelineMockData"

// Custom rich dark tooltip for the volume chart
function VolumeTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null

  const txData = payload.find((p) => p.dataKey === "txCount")
  const flaggedData = payload.find((p) => p.dataKey === "flaggedCount")
  const pointData = payload[0]?.payload

  const txVal = txData?.value || 0
  const flagVal = flaggedData?.value || 0
  const flagPercent = txVal > 0 ? ((flagVal / txVal) * 100).toFixed(1) : 0

  return (
    <div className="bg-zinc-900 border border-zinc-700/90 rounded-xl p-3 shadow-2xl text-xs space-y-2 min-w-52">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
        <span className="font-mono text-zinc-300 font-semibold">{label}</span>
        {pointData?.isBurst && (
          <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" /> Burst Spike
          </span>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            Total Transactions:
          </span>
          <span className="font-mono text-blue-300 font-bold">
            {txVal.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            Flagged Suspicious:
          </span>
          <span className="font-mono text-red-400 font-bold">
            {flagVal.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between items-center text-[11px] pt-1 border-t border-zinc-800 text-zinc-400">
          <span>Anomaly Ratio:</span>
          <span
            className={`font-semibold ${
              flagPercent > 10 ? "text-red-400" : "text-amber-400"
            }`}
          >
            {flagPercent}%
          </span>
        </div>

        {pointData?.burstLabel && (
          <p className="text-[10px] text-amber-300/90 bg-amber-500/10 p-1.5 rounded mt-1 border border-amber-500/20">
            {pointData.burstLabel}
          </p>
        )}
      </div>
    </div>
  )
}

export default function VolumeComposedChart() {
  const {
    startIndex,
    endIndex,
    overlayAnomalies,
    showFilter,
    setRange,
  } = useTimelineStore()

  // Handle Recharts Brush change
  const handleBrushChange = useCallback(
    (range) => {
      if (
        range &&
        typeof range.startIndex === "number" &&
        typeof range.endIndex === "number"
      ) {
        const s = Math.max(0, range.startIndex)
        const e = Math.min(VOLUME_DATA.length - 1, range.endIndex)
        setRange({
          startIndex: s,
          endIndex: e,
          fromTs: VOLUME_DATA[s]?.timestamp,
          toTs: VOLUME_DATA[e]?.timestamp,
        })
      }
    },
    [setRange]
  )

  // Visible window slice
  const visibleData = useMemo(() => {
    return VOLUME_DATA
  }, [])

  // Aggregate stats in current brush selection
  const stats = useMemo(() => {
    const s = Math.max(0, startIndex)
    const e = Math.min(VOLUME_DATA.length - 1, endIndex)
    let totalTx = 0
    let totalFlagged = 0
    for (let i = s; i <= e; i++) {
      totalTx += VOLUME_DATA[i]?.txCount || 0
      totalFlagged += VOLUME_DATA[i]?.flaggedCount || 0
    }
    const fromTime = VOLUME_DATA[s]?.time || "00:00"
    const toTime = VOLUME_DATA[e]?.time || "23:55"
    return { totalTx, totalFlagged, fromTime, toTime }
  }, [startIndex, endIndex])

  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 shadow-xl space-y-3">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              Transaction Volume & Anomaly Events
            </h2>
            <Badge variant="blue" className="text-[11px] h-5 px-2">
              syncId: timeline
            </Badge>
          </div>
          <p className="text-xs text-zinc-400">
            Real-time multi-resolution transaction throughput and flagged volume with interactive brush zoom
          </p>
        </div>

        {/* Selected window metrics summary */}
        <div className="flex items-center gap-3 bg-zinc-950/80 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs">
          <div className="text-zinc-400">
            Window:{" "}
            <span className="font-mono text-zinc-200 font-semibold">
              {stats.fromTime} – {stats.toTime}
            </span>
          </div>
          <div className="h-3 w-px bg-zinc-700" />
          <div className="text-zinc-400">
            Volume:{" "}
            <span className="font-mono text-blue-400 font-semibold">
              {stats.totalTx.toLocaleString()} tx
            </span>
          </div>
          <div className="h-3 w-px bg-zinc-700" />
          <div className="text-zinc-400">
            Flagged:{" "}
            <span className="font-mono text-red-400 font-semibold">
              {stats.totalFlagged.toLocaleString()} tx
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Composed Chart (Area + Bar + ReferenceLines + Brush) */}
      <div className="w-full pt-1">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart
            syncId="timeline"
            data={visibleData}
            margin={{ top: 12, right: 16, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="txAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="flaggedBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />

            <XAxis
              dataKey="time"
              stroke="#71717a"
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              interval={24}
              dy={4}
            />

            <YAxis
              yAxisId="volume"
              stroke="#71717a"
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
            />

            <YAxis
              yAxisId="flagged"
              orientation="right"
              stroke="#71717a"
              tick={{ fill: "#ef4444", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}`}
              domain={[0, 600]}
              hide={showFilter === "flagged"}
            />

            <RechartsTooltip content={<VolumeTooltip />} />

            {/* Area: tx count per time bucket */}
            {showFilter !== "flagged" && (
              <Area
                yAxisId="volume"
                type="monotone"
                dataKey="txCount"
                name="Total Transactions"
                stroke="#60a5fa"
                strokeWidth={1.8}
                fill="url(#txAreaGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#60a5fa", stroke: "#1e3a8a", strokeWidth: 2 }}
              />
            )}

            {/* Bar: flagged tx count */}
            <Bar
              yAxisId="flagged"
              dataKey="flaggedCount"
              name="Flagged Transactions"
              fill="url(#flaggedBarGrad)"
              radius={[2, 2, 0, 0]}
              maxBarSize={6}
            />

            {/* ReferenceLines for detected anomaly bursts */}
            {overlayAnomalies &&
              BURST_ANOMALIES.map((burst) => (
                <ReferenceLine
                  key={burst.id}
                  yAxisId="volume"
                  x={burst.time}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "⚡ Burst",
                    position: "top",
                    fill: "#ef4444",
                    fontSize: 9,
                    fontWeight: 600,
                  }}
                />
              ))}

            {/* Brush component at bottom for drag-to-zoom time range selection */}
            <Brush
              dataKey="time"
              height={26}
              stroke="#3b82f6"
              fill="#09090b"
              tickFormatter={(val) => val}
              startIndex={startIndex}
              endIndex={endIndex}
              onChange={handleBrushChange}
              travellerWidth={10}
            >
              <ComposedChart data={visibleData}>
                <Area
                  dataKey="txCount"
                  fill="#1e3a8a"
                  stroke="#3b82f6"
                  strokeWidth={1}
                  dot={false}
                />
              </ComposedChart>
            </Brush>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend and explanation notes */}
      <div className="flex flex-wrap items-center justify-between text-xs text-zinc-400 pt-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue-500/80 border border-blue-400" />
            Total Volume (Area)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-500/80 border border-red-400" />
            Flagged Suspicious (Bar)
          </span>
          {overlayAnomalies && (
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="h-3 w-0.5 border-l-2 border-dashed border-red-500" />
              Burst Anomaly Reference Line
            </span>
          )}
        </div>
        <span className="text-zinc-500 text-[11px] italic">
          Tip: Drag brush handles at bottom to zoom into specific time windows
        </span>
      </div>
    </div>
  )
}
