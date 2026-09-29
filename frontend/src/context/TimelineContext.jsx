import { createContext, useContext, useState, useCallback, useMemo } from "react"
import { START_TIME, ANCHOR_TIME, VOLUME_DATA } from "@/data/timelineMockData"

const TimelineContext = createContext(null)

export function TimelineProvider({ children }) {
  const [fromTs, setFromTs] = useState(START_TIME)
  const [toTs, setToTs] = useState(ANCHOR_TIME)
  const [startIndex, setStartIndex] = useState(0)
  const [endIndex, setEndIndex] = useState(VOLUME_DATA.length - 1)
  const [preset, setPreset] = useState("24h")
  const [granularity, setGranularity] = useState("5m")
  const [entityFilter, setEntityFilter] = useState("")
  const [showFilter, setShowFilter] = useState("all") // 'all' | 'flagged' | 'high_risk'
  const [overlayAnomalies, setOverlayAnomalies] = useState(true)

  // Brush or explicit range selection
  const setRange = useCallback(({ fromTs: newFrom, toTs: newTo, startIndex: newStart, endIndex: newEnd }) => {
    if (newFrom !== undefined) setFromTs(newFrom)
    if (newTo !== undefined) setToTs(newTo)
    if (newStart !== undefined) setStartIndex(newStart)
    if (newEnd !== undefined) setEndIndex(newEnd)
  }, [])

  // Apply quick preset buttons: "Last 1 Hour", "Last 24 Hours", "Last 7 Days"
  const applyPreset = useCallback((p) => {
    setPreset(p)
    const now = ANCHOR_TIME
    let windowMs = 24 * 3600 * 1000
    if (p === "1h") windowMs = 1 * 3600 * 1000
    else if (p === "24h") windowMs = 24 * 3600 * 1000
    else if (p === "7d") windowMs = 7 * 24 * 3600 * 1000

    const newFrom = now - windowMs
    setFromTs(newFrom)
    setToTs(now)

    // Calculate approximate indices in VOLUME_DATA if in 24h
    if (p === "1h") {
      setStartIndex(Math.max(0, VOLUME_DATA.length - 12))
      setEndIndex(VOLUME_DATA.length - 1)
    } else {
      setStartIndex(0)
      setEndIndex(VOLUME_DATA.length - 1)
    }
  }, [])

  // Zoom to a specific detected burst period or range
  const zoomToRange = useCallback((startTs, endTs) => {
    setFromTs(startTs)
    setToTs(endTs)
    // Find closest indices in VOLUME_DATA
    let sIdx = VOLUME_DATA.findIndex(d => d.timestamp >= startTs)
    let eIdx = VOLUME_DATA.findIndex(d => d.timestamp >= endTs)
    if (sIdx === -1) sIdx = 0
    if (eIdx === -1) eIdx = VOLUME_DATA.length - 1
    // Give at least 5 buckets padding if too tight
    const paddedStart = Math.max(0, sIdx - 3)
    const paddedEnd = Math.min(VOLUME_DATA.length - 1, (eIdx === sIdx ? sIdx + 4 : eIdx + 3))
    setStartIndex(paddedStart)
    setEndIndex(paddedEnd)
  }, [])

  const resetRange = useCallback(() => {
    setFromTs(START_TIME)
    setToTs(ANCHOR_TIME)
    setStartIndex(0)
    setEndIndex(VOLUME_DATA.length - 1)
    setPreset("24h")
  }, [])

  const isZoomed = useMemo(() => {
    return startIndex > 5 || endIndex < VOLUME_DATA.length - 6
  }, [startIndex, endIndex])

  const value = useMemo(() => ({
    fromTs,
    toTs,
    startIndex,
    endIndex,
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
    zoomToRange,
    resetRange,
  }), [
    fromTs,
    toTs,
    startIndex,
    endIndex,
    preset,
    granularity,
    entityFilter,
    showFilter,
    overlayAnomalies,
    isZoomed,
    setRange,
    applyPreset,
    zoomToRange,
    resetRange,
  ])

  return (
    <TimelineContext.Provider value={value}>
      {children}
    </TimelineContext.Provider>
  )
}

export function useTimelineStore() {
  const ctx = useContext(TimelineContext)
  if (!ctx) {
    throw new Error("useTimelineStore must be used within a TimelineProvider")
  }
  return ctx
}
