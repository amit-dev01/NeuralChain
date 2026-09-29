import { useState, useEffect, useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  GeoJSON,
  useMap,
} from "react-leaflet"
import L from "leaflet"
import {
  Flame,
  GitCommit,
  ShieldAlert,
  Server,
  Globe2,
  AlertTriangle,
  ExternalLink,
  Navigation,
  Layers,
  ZoomIn,
  ZoomOut,
  Compass,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  HEATMAP_POINTS,
  ALERT_MARKERS,
  TRANSACTION_ARCS,
  ASN_CLUSTERS,
  COUNTRY_DISTRIBUTION,
} from "@/data/geoMockData"

// ─── Custom Leaflet Pulsing DivIcon for Alert Markers ─────────────────────────
function createPulsingIcon(riskScore) {
  const isCritical = riskScore >= 0.9
  const baseColor = isCritical ? "#ef4444" : "#f59e0b"
  const haloColor = isCritical ? "rgba(239, 68, 68, 0.4)" : "rgba(245, 158, 11, 0.4)"
  const size = Math.round(14 + (riskScore - 0.75) * 28) // 14px to 21px

  return L.divIcon({
    className: "custom-pulsing-marker",
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
    html: `
      <div style="position: relative; width: ${size * 2}px; height: ${size * 2}px; display: flex; align-items: center; justify-content: center;">
        <span class="pulse-ring" style="position: absolute; width: ${size * 1.5}px; height: ${size * 1.5}px; border-radius: 9999px; background-color: ${haloColor}; pointer-events: none;"></span>
        <span style="position: relative; width: ${size}px; height: ${size}px; border-radius: 9999px; background-color: ${baseColor}; border: 2px solid #ffffff; box-shadow: 0 0 12px ${baseColor};"></span>
      </div>
    `,
  })
}

// ─── Custom Leaflet ASN Cluster Icon ──────────────────────────────────────────
function createAsnIcon(asn, count, highRisk) {
  const bg = highRisk ? "rgba(239, 68, 68, 0.85)" : "rgba(139, 92, 246, 0.85)"
  const border = highRisk ? "#ef4444" : "#a855f7"

  return L.divIcon({
    className: "custom-asn-marker",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `
      <div style="background-color: ${bg}; border: 1.5px solid ${border}; width: 44px; height: 44px; border-radius: 9999px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.6); cursor: pointer;">
        <span style="font-size: 8px; font-weight: 700; color: #ffffff; line-height: 1; font-family: monospace;">${asn}</span>
        <span style="font-size: 10px; font-weight: 800; color: #ffffff; line-height: 1.1;">${count}</span>
      </div>
    `,
  })
}

// ─── Helper: Generate curved arc coordinates for Transaction Arcs ─────────────
function generateCurvedPoints(lat1, lng1, lat2, lng2, numPoints = 25) {
  const points = []
  // Arc bend height based on distance
  const dLng = lng2 - lng1
  const dLat = lat2 - lat1
  const dist = Math.sqrt(dLng * dLng + dLat * dLat)
  const bendFactor = Math.min(30, dist * 0.25)

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    // Linear interpolation
    const lat = lat1 + dLat * t
    const lng = lng1 + dLng * t
    // Parabolic arc curvature
    const arcOffset = Math.sin(t * Math.PI) * bendFactor
    points.push([lat + arcOffset, lng])
  }
  return points
}

// ─── Map Controller (FlyTo & Event handling) ─────────────────────────────────
function MapController({ flyTarget }) {
  const map = useMap()

  useEffect(() => {
    if (flyTarget && flyTarget.center) {
      map.flyTo(flyTarget.center, flyTarget.zoom || 5, {
        animate: true,
        duration: 1.4,
      })
    }
  }, [flyTarget, map])

  return null
}

export default function GeoMapCanvas({
  layers,
  setLayers,
  riskThreshold,
  selectedCountry,
  onSelectCountryDetail,
}) {
  const navigate = useNavigate()
  const [offlineNotice, setOfflineNotice] = useState(false)
  const [flyTarget, setFlyTarget] = useState(null)
  const [geoJsonData, setGeoJsonData] = useState(null)

  // Load bundled world.geojson
  useEffect(() => {
    fetch("/geo/world.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("GeoJSON not loaded")
        return res.json()
      })
      .then((data) => setGeoJsonData(data))
      .catch((err) => console.warn("World GeoJSON load notice:", err))
  }, [])

  // Filter alert markers by risk threshold
  const filteredAlerts = useMemo(() => {
    return ALERT_MARKERS.filter((m) => m.risk >= riskThreshold)
  }, [riskThreshold])

  // Handle Fly-To country selector
  const handleFlyTo = (countryCode) => {
    if (countryCode === "reset") {
      setFlyTarget({ center: [20, 0], zoom: 2 })
      return
    }
    const match = COUNTRY_DISTRIBUTION.find((c) => c.code === countryCode)
    if (match && match.center) {
      setFlyTarget({ center: match.center, zoom: 5 })
    }
  }

  // Choropleth style calculation
  const getChoroplethStyle = (feature) => {
    const alerts = feature.properties?.alertCount || 0
    let fillColor = "#27272a" // 0 alerts: zinc-800
    if (alerts > 50) fillColor = "#ef4444" // 51+: red
    else if (alerts > 10) fillColor = "#f59e0b" // 11-50: amber
    else if (alerts > 0) fillColor = "#3b82f6" // 1-10: blue

    return {
      fillColor,
      weight: 1.2,
      opacity: 0.8,
      color: "#52525b",
      fillOpacity: 0.35,
    }
  }

  return (
    <div className="relative w-full h-full flex-1 bg-zinc-950 overflow-hidden">
      {/* ── OFFLINE / FALLBACK NOTICE BANNER ── */}
      {offlineNotice && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-[1000] bg-amber-950/90 border border-amber-600/60 text-amber-200 text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 backdrop-blur-md">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span>Map tiles unavailable offline — contact admin to load local tile cache.</span>
        </div>
      )}

      {/* ── MAP CONTAINER ── */}
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={12}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        <MapController flyTarget={flyTarget} />

        {/* Dark CartoDB basemap tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution={false}
          subdomains="abcd"
          maxZoom={19}
          eventHandlers={{
            tileerror: () => setOfflineNotice(true),
          }}
        />

        {/* ── 1. HEATMAP LAYER (Points weighted by tx count) ── */}
        {layers.heatmap &&
          HEATMAP_POINTS.map((pt, i) => {
            // Determine heat color: blue -> amber -> red
            let color = "#3b82f6"
            if (pt.weight >= 0.85) color = "#ef4444"
            else if (pt.weight >= 0.65) color = "#f59e0b"

            const radius = Math.round(10 + pt.weight * 22)

            return (
              <CircleMarker
                key={`heat-${i}`}
                center={[pt.lat, pt.lng]}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.18 + pt.weight * 0.22,
                  stroke: false,
                }}
              />
            )
          })}

        {/* ── 2. COUNTRY CHOROPLETH POLYGONS ── */}
        {layers.choropleth && geoJsonData && (
          <GeoJSON
            key="world-choropleth"
            data={geoJsonData}
            style={getChoroplethStyle}
            onEachFeature={(feature, layer) => {
              const name = feature.properties?.name || "Country"
              const ips = feature.properties?.ipCount || 0
              const alerts = feature.properties?.alertCount || 0
              layer.bindTooltip(
                `<div class="text-xs font-sans font-semibold">${name} — ${ips.toLocaleString()} IPs, ${alerts} alerts</div>`,
                { className: "dark-leaflet-tooltip", sticky: true }
              )
              layer.on({
                click: () => {
                  if (feature.properties?.code) {
                    onSelectCountryDetail(feature.properties.code)
                  }
                },
              })
            }}
          />
        )}

        {/* ── 3. TRANSACTION ARCS (Curved animated lines) ── */}
        {layers.arcs &&
          TRANSACTION_ARCS.map((arc) => {
            const curvePoints = generateCurvedPoints(
              arc.srcLat,
              arc.srcLng,
              arc.dstLat,
              arc.dstLng
            )
            const isFlagged = arc.flagged
            const color = isFlagged ? "#ef4444" : "#60a5fa"
            const weight = Math.max(2, Math.min(5, Math.round(arc.volumeBtc / 30)))

            return (
              <Polyline
                key={arc.id}
                positions={curvePoints}
                pathOptions={{
                  color,
                  weight,
                  opacity: 0.85,
                  dashArray: "8 6",
                  className: isFlagged ? "arc-flowing-red" : "arc-flowing-blue",
                }}
              >
                <Popup>
                  <div className="p-3 text-xs space-y-1.5 min-w-48">
                    <div className="font-semibold text-zinc-100 flex items-center justify-between border-b border-zinc-700 pb-1">
                      <span>{arc.srcCountry} → {arc.dstCountry}</span>
                      <Badge variant={isFlagged ? "red" : "blue"} className="text-[10px] h-4">
                        {isFlagged ? "Flagged Flow" : "Verified"}
                      </Badge>
                    </div>
                    <div className="text-zinc-300">
                      Volume: <span className="text-amber-400 font-mono font-bold">{arc.volumeBtc} BTC</span>
                    </div>
                    <div className="text-zinc-400">
                      Total Transactions: <span className="font-mono text-zinc-200">{arc.txCount} txs</span>
                    </div>
                  </div>
                </Popup>
              </Polyline>
            )
          })}

        {/* ── 4. ASN CLUSTERS ── */}
        {layers.asns &&
          ASN_CLUSTERS.map((cluster) => (
            <Marker
              key={cluster.asn}
              position={[cluster.lat, cluster.lng]}
              icon={createAsnIcon(cluster.asn, cluster.count, cluster.highRisk)}
            >
              <Popup>
                <div className="p-3 text-xs space-y-1.5 min-w-44">
                  <div className="font-bold text-violet-400 border-b border-zinc-700 pb-1">
                    {cluster.asn}: {cluster.name}
                  </div>
                  <div className="text-zinc-300">
                    Mapped Nodes: <span className="font-mono font-bold text-white">{cluster.count}</span>
                  </div>
                  <div className="text-zinc-400">
                    Flagged Instances:{" "}
                    <span className="text-red-400 font-mono font-bold">{cluster.flagged}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectCountryDetail(cluster.country)}
                    className="w-full h-6 text-[10px] mt-1 border-zinc-700"
                  >
                    View Country ASNs
                  </Button>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* ── 5. ALERT MARKERS (Red pulsing circles for risk > 0.75) ── */}
        {layers.alerts &&
          filteredAlerts.map((marker) => (
            <Marker
              key={marker.id}
              position={[marker.lat, marker.lng]}
              icon={createPulsingIcon(marker.risk)}
            >
              <Popup>
                {/* Popup Card matching prompt specification */}
                <div className="p-3.5 text-xs space-y-2.5 min-w-64">
                  {/* IP & Country */}
                  <div className="border-b border-zinc-800 pb-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold text-zinc-100">
                        IP: {marker.maskedIp}
                      </span>
                      <span className="text-red-400 font-mono font-bold text-xs">
                        {marker.risk.toFixed(2)} 🔴
                      </span>
                    </div>
                    <div className="text-zinc-400 text-[11px] mt-0.5">
                      Country: {marker.flag} {marker.country} | ASN: {marker.asn}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between text-zinc-300">
                      <span className="text-zinc-500">Transactions:</span>
                      <span className="font-mono">{marker.txCount}</span>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span className="text-zinc-500">Flagged:</span>
                      <span className="font-mono text-red-400 font-bold">{marker.flaggedCount}</span>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                      <span className="text-zinc-500">Wallets:</span>
                      <span className="font-mono text-violet-400">
                        {marker.walletCount} unique wallets used
                      </span>
                    </div>
                    <div className="text-zinc-400 italic pt-1 border-t border-zinc-800/80">
                      {marker.reason}
                    </div>
                  </div>

                  {/* Actions inside popup */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/graph?focus=${marker.ip}`)}
                      className="flex-1 h-7 text-[11px] gap-1 border-zinc-700 text-zinc-200 hover:text-white"
                    >
                      <ExternalLink className="h-3 w-3 text-blue-400" />
                      View in Graph
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/alerts?search=${marker.ip}`)}
                      className="flex-1 h-7 text-[11px] gap-1 bg-red-600 hover:bg-red-500 text-white"
                    >
                      <ShieldAlert className="h-3 w-3" />
                      View in Alerts
                    </Button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {/* ── MAP UI OVERLAYS (INSIDE MAP) ── */}

      {/* TOP-LEFT: "Fly To" country selector control */}
      <div className="absolute top-4 left-4 z-[999] bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-2 shadow-2xl backdrop-blur-md flex items-center gap-2">
        <Navigation className="h-3.5 w-3.5 text-blue-400 ml-1 shrink-0" />
        <span className="text-xs text-zinc-400 font-medium">Fly To:</span>
        <select
          onChange={(e) => handleFlyTo(e.target.value)}
          defaultValue="default"
          className="h-7 text-xs bg-zinc-950 border border-zinc-700 rounded-md px-2 text-zinc-200 font-sans focus:outline-none focus:border-blue-500 cursor-pointer"
        >
          <option value="default" disabled>
            Select Country / Region...
          </option>
          <option value="reset">🌐 Global View (Zoom 2)</option>
          {COUNTRY_DISTRIBUTION.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* TOP-RIGHT: Quick Layer Toggle Buttons */}
      <div className="absolute top-4 right-4 z-[999] bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-1.5 shadow-2xl backdrop-blur-md flex items-center gap-1">
        <Button
          size="sm"
          variant={layers.heatmap ? "default" : "ghost"}
          onClick={() => setLayers((prev) => ({ ...prev, heatmap: !prev.heatmap }))}
          className={`h-7 px-2.5 text-xs gap-1.5 ${
            layers.heatmap
              ? "bg-amber-600 hover:bg-amber-500 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
          title="Toggle IP Heatmap"
        >
          <Flame className="h-3 w-3" />
          Heatmap
        </Button>

        <Button
          size="sm"
          variant={layers.arcs ? "default" : "ghost"}
          onClick={() => setLayers((prev) => ({ ...prev, arcs: !prev.arcs }))}
          className={`h-7 px-2.5 text-xs gap-1.5 ${
            layers.arcs
              ? "bg-blue-600 hover:bg-blue-500 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
          title="Toggle Transaction Flow Arcs"
        >
          <GitCommit className="h-3 w-3 rotate-45" />
          Flow Arcs
        </Button>

        <Button
          size="sm"
          variant={layers.alerts ? "default" : "ghost"}
          onClick={() => setLayers((prev) => ({ ...prev, alerts: !prev.alerts }))}
          className={`h-7 px-2.5 text-xs gap-1.5 ${
            layers.alerts
              ? "bg-red-600 hover:bg-red-500 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
          title="Toggle High-Risk Alert Markers"
        >
          <ShieldAlert className="h-3 w-3" />
          Alerts ({filteredAlerts.length})
        </Button>

        <Button
          size="sm"
          variant={layers.asns ? "default" : "ghost"}
          onClick={() => setLayers((prev) => ({ ...prev, asns: !prev.asns }))}
          className={`h-7 px-2.5 text-xs gap-1.5 ${
            layers.asns
              ? "bg-violet-600 hover:bg-violet-500 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
          title="Toggle ASN Clusters"
        >
          <Server className="h-3 w-3" />
          ASNs
        </Button>
      </div>

      {/* BOTTOM-LEFT: Shadcn-styled legend card */}
      <div className="absolute bottom-4 left-4 z-[999] bg-zinc-900/90 border border-zinc-800/90 rounded-xl p-3 shadow-2xl backdrop-blur-md space-y-2 min-w-56 text-xs">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
          <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-blue-400" />
            IP Density Scale
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">Live Ingest</span>
        </div>

        {/* Gradient bar: blue -> yellow -> red */}
        <div className="space-y-1">
          <div
            className="h-2.5 w-full rounded-full border border-zinc-700/60 shadow-inner"
            style={{
              background:
                "linear-gradient(to right, #3b82f6 0%, #f59e0b 50%, #ef4444 100%)",
            }}
          />
          <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
            <span>Low (Clean)</span>
            <span>Medium</span>
            <span className="text-red-400 font-bold">Critical</span>
          </div>
        </div>

        {/* Marker legend preview */}
        <div className="pt-1.5 border-t border-zinc-800/80 space-y-1 text-[11px] text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span>High-Risk IP Origin (Risk &gt; 0.75)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-4 rounded-full bg-blue-400" />
            <span>Cross-border BTC Volume Flow</span>
          </div>
        </div>
      </div>
    </div>
  )
}
