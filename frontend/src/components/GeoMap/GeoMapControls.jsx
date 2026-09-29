import { useMemo } from "react"
import {
  SlidersHorizontal,
  Flame,
  GitCommit,
  ShieldAlert,
  Server,
  Globe2,
  Calendar,
  Layers,
  MapPin,
  TrendingDown,
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip as RechartsTooltip,
} from "recharts"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  GEO_STATS,
  COUNTRY_DISTRIBUTION,
} from "@/data/geoMockData"

export default function GeoMapControls({
  layers,
  setLayers,
  riskThreshold,
  setRiskThreshold,
  selectedCountry,
  setSelectedCountry,
  timeFilter,
  setTimeFilter,
  onSelectCountryDetail,
}) {
  const toggleLayer = (layerKey) => {
    setLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }))
  }

  // Bar chart data formatted
  const chartData = useMemo(() => {
    return COUNTRY_DISTRIBUTION.map((c) => ({
      ...c,
      displayName: `${c.flag} ${c.name}`,
    }))
  }, [])

  return (
    <aside className="w-80 shrink-0 bg-zinc-900/95 border-r border-zinc-800 flex flex-col h-full overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
      {/* ── SECTION HEADER ── */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-950/60 sticky top-0 z-10 backdrop-blur">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-blue-400" />
          Map Controls
        </h2>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          Layers, risk thresholds, and origin filtering
        </p>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* ── 1. LAYER TOGGLES ── */}
        <div className="space-y-3">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Display Layers
          </span>

          <div className="space-y-2.5 bg-zinc-950/70 p-3 rounded-xl border border-zinc-800">
            {/* IP Heatmap */}
            <div className="flex items-center justify-between">
              <Label
                htmlFor="toggle-heatmap"
                className="text-xs text-zinc-200 cursor-pointer flex items-center gap-2 font-normal"
              >
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                IP Heatmap
              </Label>
              <Switch
                id="toggle-heatmap"
                checked={layers.heatmap}
                onCheckedChange={() => toggleLayer("heatmap")}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>

            {/* Transaction Arcs */}
            <div className="flex items-center justify-between">
              <Label
                htmlFor="toggle-arcs"
                className="text-xs text-zinc-200 cursor-pointer flex items-center gap-2 font-normal"
              >
                <GitCommit className="h-3.5 w-3.5 text-blue-400 rotate-45" />
                Transaction Arcs
              </Label>
              <Switch
                id="toggle-arcs"
                checked={layers.arcs}
                onCheckedChange={() => toggleLayer("arcs")}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>

            {/* Alert Markers */}
            <div className="flex items-center justify-between">
              <Label
                htmlFor="toggle-alerts"
                className="text-xs text-zinc-200 cursor-pointer flex items-center gap-2 font-normal"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                Alert Markers
              </Label>
              <Switch
                id="toggle-alerts"
                checked={layers.alerts}
                onCheckedChange={() => toggleLayer("alerts")}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>

            {/* ASN Clusters */}
            <div className="flex items-center justify-between">
              <Label
                htmlFor="toggle-asns"
                className="text-xs text-zinc-200 cursor-pointer flex items-center gap-2 font-normal"
              >
                <Server className="h-3.5 w-3.5 text-violet-400" />
                ASN Clusters
              </Label>
              <Switch
                id="toggle-asns"
                checked={layers.asns}
                onCheckedChange={() => toggleLayer("asns")}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>

            {/* Country Choropleth */}
            <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
              <Label
                htmlFor="toggle-choropleth"
                className="text-xs text-zinc-200 cursor-pointer flex items-center gap-2 font-normal"
              >
                <Globe2 className="h-3.5 w-3.5 text-emerald-400" />
                Country Polygons
              </Label>
              <Switch
                id="toggle-choropleth"
                checked={layers.choropleth}
                onCheckedChange={() => toggleLayer("choropleth")}
                className="data-[state=checked]:bg-blue-600"
              />
            </div>
          </div>
        </div>

        {/* ── 2. RISK SCORE FILTER ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-300 font-medium flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
              Risk Score Filter:
            </span>
            <span className="font-mono text-zinc-200 font-bold bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              ≥ {riskThreshold.toFixed(2)}
            </span>
          </div>
          <Slider
            value={[riskThreshold]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={([val]) => setRiskThreshold(val)}
            className="py-1"
          />
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>0.0 (All)</span>
            <span>0.5 (Moderate)</span>
            <span className="text-red-400">0.8 (Critical)</span>
          </div>
        </div>

        {/* ── 3. COUNTRY FILTER ── */}
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-300 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-blue-400" />
            Country Filter:
          </Label>
          <Select
            value={selectedCountry}
            onValueChange={(val) => {
              setSelectedCountry(val)
              if (val !== "all") {
                onSelectCountryDetail(val)
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🌍 All Countries</SelectItem>
              {COUNTRY_DISTRIBUTION.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.ipCount.toLocaleString()} IPs)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── 4. TIME FILTER ── */}
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-300 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-violet-400" />
            Show IPs from:
          </Label>
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="h-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last 1h</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7d</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── 5. STAT CARDS (4 small stacked cards) ── */}
        {/* Spec:
            - Countries involved: 47
            - Unique IPs mapped: 9,441
            - High-risk IPs: 312
            - Top source country: Russia (1,847 IPs)
        */}
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            Network Coverage
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Countries Involved</span>
              <span className="text-base font-bold text-zinc-100 font-mono">
                {GEO_STATS.countriesInvolved}
              </span>
            </div>

            <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Unique IPs Mapped</span>
              <span className="text-base font-bold text-blue-400 font-mono">
                {GEO_STATS.uniqueIps.toLocaleString()}
              </span>
            </div>

            <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">High-Risk IPs</span>
              <span className="text-base font-bold text-red-400 font-mono">
                {GEO_STATS.highRiskIps}
              </span>
            </div>

            <div className="bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800">
              <span className="text-[10px] text-zinc-400 block">Top Source Country</span>
              <span className="text-xs font-semibold text-amber-400 font-mono truncate block mt-0.5">
                {GEO_STATS.topCountry}
              </span>
            </div>
          </div>
        </div>

        {/* ── 6. COUNTRY DISTRIBUTION BAR CHART ── */}
        {/* Spec:
            Recharts <BarChart> horizontal, height 200px, top 10 countries:
            Y-axis: country names with flag emoji
            X-axis: IP count
            Bar color: red if country has >50% flagged IPs, else blue.
            Truncate to 8 countries, "+N more" label.
        */}
        <div className="space-y-2 pt-1 border-t border-zinc-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Top Country IP Distribution
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Top 8</span>
          </div>

          <div className="h-52 w-full -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ top: 2, right: 10, left: 24, bottom: 2 }}
              >
                <XAxis
                  type="number"
                  stroke="#71717a"
                  tick={{ fill: "#71717a", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
                />
                <YAxis
                  type="category"
                  dataKey="displayName"
                  stroke="#71717a"
                  tick={{ fill: "#d4d4d8", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-xs shadow-xl space-y-1">
                        <div className="font-semibold text-zinc-200">
                          {d.displayName}
                        </div>
                        <div className="text-zinc-400">
                          Total IPs:{" "}
                          <span className="font-mono text-blue-400 font-bold">
                            {d.ipCount.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-zinc-400">
                          Flagged Rate:{" "}
                          <span
                            className={`font-mono font-bold ${
                              d.isRed ? "text-red-400" : "text-emerald-400"
                            }`}
                          >
                            {d.flaggedPct}%
                          </span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="ipCount"
                  radius={[0, 3, 3, 0]}
                  onClick={(entry) => onSelectCountryDetail(entry.code)}
                  className="cursor-pointer"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isRed ? "#ef4444" : "#3b82f6"}
                      fillOpacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 font-mono">
            <span>+39 more countries</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded bg-blue-500" /> &lt;50%
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded bg-red-500" /> &gt;50% Flagged
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
