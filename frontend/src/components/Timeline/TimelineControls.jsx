import { useState, useEffect } from "react"
import { Calendar, Search, Filter, RotateCcw, Clock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTimelineStore } from "@/context/TimelineContext"

// Format Date object to "YYYY-MM-DDTHH:mm" for datetime-local input
function toLocalDatetimeString(timestamp) {
  const d = new Date(timestamp)
  const pad = (n) => String(n).padStart(2, "0")
  const year = d.getFullYear()
  const month = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function TimelineControls() {
  const {
    fromTs,
    toTs,
    preset,
    granularity,
    entityFilter,
    showFilter,
    overlayAnomalies,
    isZoomed,
    setRange,
    applyPreset,
    setGranularity,
    setEntityFilter,
    setShowFilter,
    setOverlayAnomalies,
    resetRange,
  } = useTimelineStore()

  const [localFrom, setLocalFrom] = useState(() => toLocalDatetimeString(fromTs))
  const [localTo, setLocalTo] = useState(() => toLocalDatetimeString(toTs))

  // Keep local inputs in sync when store timestamps change (e.g. from preset or brush)
  useEffect(() => {
    setLocalFrom(toLocalDatetimeString(fromTs))
  }, [fromTs])

  useEffect(() => {
    setLocalTo(toLocalDatetimeString(toTs))
  }, [toTs])

  const handleApply = () => {
    const fTs = new Date(localFrom).getTime()
    const tTs = new Date(localTo).getTime()
    if (!isNaN(fTs) && !isNaN(tTs) && fTs < tTs) {
      setRange({ fromTs: fTs, toTs: tTs })
    }
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 shadow-lg space-y-3.5">
      {/* ── ROW 1: TIME RANGE CONTROLS ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Date range pickers */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-400 font-medium flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-blue-400" />
            From
          </span>
          <Input
            type="datetime-local"
            value={localFrom}
            onChange={(e) => setLocalFrom(e.target.value)}
            className="h-8 w-48 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 focus:border-blue-500"
          />
          <span className="text-zinc-500 font-medium">→</span>
          <span className="text-zinc-400 font-medium">To</span>
          <Input
            type="datetime-local"
            value={localTo}
            onChange={(e) => setLocalTo(e.target.value)}
            className="h-8 w-48 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 focus:border-blue-500"
          />
        </div>

        {/* Segmented Preset Buttons */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          {[
            { id: "1h", label: "Last 1 Hour" },
            { id: "24h", label: "Last 24 Hours" },
            { id: "7d", label: "Last 7 Days" },
          ].map(({ id, label }) => {
            const isActive = preset === id && !isZoomed
            return (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={isActive ? "default" : "ghost"}
                onClick={() => applyPreset(id)}
                className={`h-7 px-3 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                }`}
              >
                {label}
              </Button>
            )
          })}
        </div>

        {/* Granularity & Apply */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Granularity:</span>
          </div>
          <Select value={granularity} onValueChange={setGranularity}>
            <SelectTrigger className="h-8 w-28 text-xs bg-zinc-950 border-zinc-700 text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1 min</SelectItem>
              <SelectItem value="5m">5 min</SelectItem>
              <SelectItem value="15m">15 min</SelectItem>
              <SelectItem value="1h">1 hour</SelectItem>
              <SelectItem value="1d">1 day</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            size="sm"
            onClick={handleApply}
            className="h-8 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white"
          >
            Apply
          </Button>
        </div>
      </div>

      {/* ── ROW 2: ENTITY FILTER & ANOMALY TOGGLE ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-64">
          {/* Entity filter input */}
          <div className="relative flex-1 min-w-56 max-w-md">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
            <Input
              type="text"
              placeholder="Filter by Wallet / IP / TXID..."
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="h-8 pl-8 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 focus:border-blue-500"
            />
          </div>

          {/* Show select */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-400">Show:</span>
            <Select value={showFilter} onValueChange={setShowFilter}>
              <SelectTrigger className="h-8 w-44 text-xs bg-zinc-950 border-zinc-700 text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="flagged">Flagged Only</SelectItem>
                <SelectItem value="high_risk">High-Risk Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Anomaly markers toggle & Reset button */}
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2 bg-zinc-950/80 px-3 py-1.5 rounded-lg border border-zinc-800">
            <Switch
              id="overlay-anomalies"
              checked={overlayAnomalies}
              onCheckedChange={setOverlayAnomalies}
              className="data-[state=checked]:bg-blue-600"
            />
            <Label
              htmlFor="overlay-anomalies"
              className="text-xs font-normal text-zinc-300 cursor-pointer select-none flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Overlay Anomaly Markers
            </Label>
          </div>

          {(isZoomed || entityFilter || showFilter !== "all") && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetRange}
              className="h-8 text-xs gap-1.5 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
            >
              <RotateCcw className="h-3 w-3" />
              Reset View
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
