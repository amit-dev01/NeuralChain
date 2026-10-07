import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Link } from "react-router-dom"
import ForceGraph2D from "react-force-graph-2d"
import cytoscape from "cytoscape"
import coseBilkent from "cytoscape-cose-bilkent"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  Cell, ResponsiveContainer,
} from "recharts"
import {
  Network, X, Copy, Search, Download, RefreshCw,
  Wallet, Globe, Shield, ChevronRight, Pin, Flag,
  ZoomIn, Info, CheckCircle2,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import AppHeader from "@/components/common/AppHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select, SelectTrigger, SelectContent,
  SelectItem, SelectValue,
} from "@/components/ui/select"
import { MOCK_GRAPH } from "@/data/graphMockData"
import { getGraphNodes } from "@/api/client"

cytoscape.use(coseBilkent)

// ─── Color map ────────────────────────────────────────────────────────────────
const NODE_COLORS = {
  wallet:      "#8b5cf6",
  transaction: "#60a5fa",
  ip:          "#fb923c",
  asn:         "#71717a",
  country:     "#34d399",
}

const EDGE_COLORS = {
  SENT:           "rgba(255,255,255,0.45)",
  RECEIVED:       "#60a5fa",
  CONNECTED_FROM: "#fb923c",
  BELONGS_TO:     "#71717a",
}

const HIGH_RISK_COLOR  = "#ef4444"
const HIGHLIGHT_COLOR  = "#fbbf24"

// ─── Canvas drawing helpers ───────────────────────────────────────────────────
function drawDiamond(ctx, x, y, r) {
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + r, y)
  ctx.lineTo(x, y + r)
  ctx.lineTo(x - r, y)
  ctx.closePath()
}

function drawHexagon(ctx, x, y, r) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6
    const px = x + r * Math.cos(a)
    const py = y + r * Math.sin(a)
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function drawSquare(ctx, x, y, r) {
  ctx.beginPath()
  ctx.rect(x - r, y - r, r * 2, r * 2)
  ctx.closePath()
}

// ─── Node detail drawer sections ─────────────────────────────────────────────
function WalletDrawer({ node }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(node.fullLabel)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full grid grid-cols-4 mb-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="txs">Txs</TabsTrigger>
        <TabsTrigger value="ips">IPs</TabsTrigger>
        <TabsTrigger value="shap">SHAP</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="space-y-3">
          {/* Address row */}
          <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
            <code className="font-mono text-xs text-zinc-300 flex-1 truncate">{node.fullLabel}</code>
            <button onClick={copy} className="text-zinc-500 hover:text-zinc-200 transition-colors">
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          {[
            ["Total Sent",        `${node.totalSent} BTC`],
            ["Total Received",    `${node.totalReceived} BTC`],
            ["Tx Count",          node.txCount],
            ["First Seen",        node.firstSeen],
            ["Last Seen",         node.lastSeen],
            ["Cluster ID",        `#${node.cluster}`],
            ["Entity Label",      node.entityLabel],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs border-b border-zinc-800 pb-2">
              <span className="text-zinc-500">{k}</span>
              <span className="text-zinc-200 font-medium font-mono">{v}</span>
            </div>
          ))}

          {node.anomalyFlags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {node.anomalyFlags.map(f => (
                <Badge key={f} variant="red" className="text-[10px]">{f}</Badge>
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="txs">
        <ScrollArea className="h-72">
          <div className="space-y-2">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="flex justify-between items-center px-3 py-2 bg-zinc-800/50 rounded-lg text-xs">
                <code className="font-mono text-zinc-400 truncate w-32">
                  {Array.from({length:16},()=>"0123456789abcdef"[Math.floor(Math.random()*16)]).join("")}…
                </code>
                <span className="text-zinc-300 font-mono">{(Math.random()*2).toFixed(6)} BTC</span>
                <span className="text-zinc-500">09/28</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="ips">
        <div className="space-y-2">
          {["185.220.101.42 🇷🇺 AS60462","45.142.212.100 🇳🇱 AS9009","194.165.16.12 🇺🇦 AS47694"].map(ip => (
            <div key={ip} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono">
              <Globe className="h-3 w-3 text-orange-400 shrink-0" />
              {ip}
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="shap">
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart layout="vertical" data={node.shapValues} margin={{ left: 60, right: 20 }}>
              <XAxis type="number" tick={{ fill: "#71717a", fontSize: 9 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="feature" tick={{ fill: "#a1a1aa", fontSize: 10 }} tickLine={false} axisLine={false} width={60} />
              <RTooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: "#d4d4d8" }}
              />
              <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                {node.shapValues?.map((d, i) => (
                  <Cell key={i} fill={d.value >= 0 ? "#ef4444" : "#3b82f6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Increases risk</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Decreases risk</span>
          </div>
          <p className="text-xs text-zinc-400 bg-zinc-800/50 rounded-lg p-3 leading-relaxed">
            {node.shapSummary}
          </p>
        </div>
      </TabsContent>
    </Tabs>
  )
}

function TxDrawer({ node }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
        <code className="font-mono text-[10px] text-zinc-300 flex-1 break-all">{node.fullLabel}</code>
        <button onClick={() => { navigator.clipboard.writeText(node.fullLabel); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="text-zinc-500 hover:text-zinc-200 shrink-0">
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      {[
        ["Amount",    `${node.amount} BTC`],
        ["USD Value", `$${node.amountUSD?.toLocaleString()}`],
        ["Fee",       `${node.fee} BTC`],
        ["Fee Ratio", `${node.amount ? ((node.fee/node.amount)*100).toFixed(3) : "—"}%`],
        ["Timestamp", node.timestamp],
      ].map(([k,v]) => (
        <div key={k} className="flex justify-between text-xs border-b border-zinc-800 pb-2">
          <span className="text-zinc-500">{k}</span>
          <span className="text-zinc-200 font-mono font-medium">{v}</span>
        </div>
      ))}
      <div>
        <p className="text-xs text-zinc-500 mb-1">Inputs</p>
        {node.inputAddresses?.map(a => (
          <code key={a} className="block font-mono text-[10px] text-blue-400 truncate">{a}</code>
        ))}
      </div>
      <div>
        <p className="text-xs text-zinc-500 mb-1">Outputs</p>
        {node.outputAddresses?.map(a => (
          <code key={a} className="block font-mono text-[10px] text-violet-400 truncate">{a}</code>
        ))}
      </div>
      {node.anomalyFlags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {node.anomalyFlags.map(f => <Badge key={f} variant="red" className="text-[10px]">{f}</Badge>)}
        </div>
      )}
    </div>
  )
}

function IpDrawer({ node }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
        <code className="font-mono text-sm text-orange-300 flex-1">{node.fullLabel}</code>
        <button onClick={() => navigator.clipboard.writeText(node.fullLabel)}
          className="text-zinc-500 hover:text-zinc-200"><Copy className="h-3.5 w-3.5" /></button>
      </div>
      {[
        ["Country",    `${node.country}`],
        ["ASN",        node.asn],
        ["Tx Count",   node.txCount],
        ["Flagged Txs",node.flaggedTxCount],
        ["Coordinates",`${node.lat?.toFixed(2)}, ${node.lon?.toFixed(2)}`],
      ].map(([k,v]) => (
        <div key={k} className="flex justify-between text-xs border-b border-zinc-800 pb-2">
          <span className="text-zinc-500">{k}</span>
          <span className="text-zinc-200 font-mono font-medium">{v}</span>
        </div>
      ))}
      <div className="w-full h-24 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
        <p className="text-xs text-zinc-500">Map: {node.lat?.toFixed(2)}°N {node.lon?.toFixed(2)}°E</p>
      </div>
    </div>
  )
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
function ContextMenu({ x, y, node, onClose, onAction }) {
  const items = [
    { label: "Pin Node",              icon: Pin,    action: "pin"    },
    { label: "Expand 2 Hops",         icon: Network,action: "expand" },
    { label: "Find Shortest Path…",   icon: RefreshCw, action: "path"  },
    { label: "Flag as Suspicious",    icon: Flag,   action: "flag"   },
    { label: "View in Alert Table",   icon: Shield, action: "alert"  },
  ]
  return (
    <div
      className="fixed z-[200] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 w-48 text-xs"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <p className="px-3 py-1.5 text-zinc-500 font-mono truncate border-b border-zinc-800 mb-1">{node?.label}</p>
      {items.map(({ label, icon: Icon, action }) => (
        <button key={action} onClick={() => { onAction(action, node); onClose() }}
          className="flex items-center gap-2 w-full px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors">
          <Icon className="h-3.5 w-3.5 text-zinc-500" />{label}
        </button>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRAPH PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function GraphPage() {
  const fgRef       = useRef(null)
  const cyRef       = useRef(null)
  const cyContRef   = useRef(null)
  const minimapRef  = useRef(null)

  const [viewMode, setViewMode]         = useState("force")   // "force" | "cytoscape"
  const [search, setSearch]             = useState("")
  const [riskRange, setRiskRange]       = useState([0.0, 1.0])
  const [nodeTypes, setNodeTypes]       = useState({ wallet: true, transaction: true, ip: true, asn: true, country: true })
  const [edgeTypes, setEdgeTypes]       = useState({ SENT: true, RECEIVED: true, CONNECTED_FROM: true, BELONGS_TO: true })
  const [showLabels, setShowLabels]     = useState(true)
  const [showEdgeLabels, setShowEdgeLabels] = useState(false)
  const [clusterMode, setClusterMode]   = useState(false)
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoveredNode, setHoveredNode]   = useState(null)
  const [hoverPos, setHoverPos]         = useState({ x: 0, y: 0 })
  const [contextMenu, setContextMenu]   = useState(null)
  const [highlightIds, setHighlightIds] = useState(new Set())
  const [toast, setToast]               = useState(null)
  const [physicsOff, setPhysicsOff]     = useState(false)
  const [graphData, setGraphData]       = useState(MOCK_GRAPH)

  const showToast = useCallback((msg) => {
    setToast(msg); setTimeout(() => setToast(null), 3000)
  }, [])

  // Live node query on search or refresh
  useEffect(() => {
    if (!search.trim() || search.length < 10) return
    let active = true
    const timeout = setTimeout(async () => {
      try {
        const live = await getGraphNodes(search.trim(), 2, riskRange[0])
        if (active && live?.nodes?.length > 0) {
          setGraphData(live)
        }
      } catch (err) {
        console.warn("Neo4j query error:", err)
      }
    }, 500)
    return () => { active = false; clearTimeout(timeout) }
  }, [search, riskRange])

  // Turn off physics after 3s
  useEffect(() => {
    const t = setTimeout(() => setPhysicsOff(true), 3000)
    return () => clearTimeout(t)
  }, [])

  // ── Filtered graph data ──
  const { nodes: filteredNodes, links: filteredLinks } = useMemo(() => {
    const nodes = (graphData?.nodes || MOCK_GRAPH.nodes).filter(n => {
      if (!nodeTypes[n.type]) return false
      const nodeRisk = typeof n.risk === 'number' ? n.risk : (typeof n.risk_score === 'number' ? n.risk_score : 0.2)
      if (nodeRisk < riskRange[0] || nodeRisk > riskRange[1]) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return n.label?.toLowerCase().includes(q) || n.fullLabel?.toLowerCase().includes(q)
      }
      return true
    })
    const nodeSet = new Set(nodes.map(n => n.id))
    const links = (graphData?.links || MOCK_GRAPH.links).filter(l => {
      const src = typeof l.source === "object" ? l.source.id : l.source
      const dst = typeof l.target === "object" ? l.target.id : l.target
      return nodeSet.has(src) && nodeSet.has(dst) && edgeTypes[l.type]
    })
    return { nodes, links }
  }, [graphData, nodeTypes, edgeTypes, riskRange, search])

  // ── Node canvas drawing ──
  const drawNode = useCallback((node, ctx, globalScale) => {
    const r          = 7
    const nodeRisk   = typeof node.risk === 'number' ? node.risk : (typeof node.risk_score === 'number' ? node.risk_score : 0.2)
    const isHigh     = nodeRisk > 0.8
    const isSelected = highlightIds.size > 0 && !highlightIds.has(node.id)
    const isSearch   = search.trim() && (node.label.toLowerCase().includes(search.toLowerCase()) || node.fullLabel?.toLowerCase().includes(search.toLowerCase()))
    const alpha      = isSelected ? 0.1 : 1

    ctx.globalAlpha = alpha

    const clusterColors = ["#8b5cf6","#06b6d4","#f59e0b","#10b981","#f43f5e","#6366f1","#84cc16","#ec4899","#14b8a6","#f97316","#a855f7","#22d3ee","#eab308","#64748b"]
    const fillColor  = clusterMode
      ? clusterColors[node.cluster % clusterColors.length]
      : isHigh ? HIGH_RISK_COLOR : NODE_COLORS[node.type] || "#aaa"

    // Glow for high-risk or search highlight
    if (isHigh || isSearch) {
      ctx.shadowColor = isSearch ? "#fbbf24" : "#ef4444"
      ctx.shadowBlur  = 12
    }

    ctx.fillStyle = fillColor
    ctx.strokeStyle = isSearch ? "#fbbf24" : "rgba(255,255,255,0.15)"
    ctx.lineWidth = isSearch ? 2 : 0.5

    switch (node.type) {
      case "transaction": drawDiamond(ctx, node.x, node.y, r); break
      case "asn":         drawSquare(ctx, node.x, node.y, r * 0.9); break
      case "country":     drawHexagon(ctx, node.x, node.y, r); break
      default:
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
        break
    }
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0

    // High-risk outer ring
    if (isHigh) {
      ctx.strokeStyle = "#ef4444"
      ctx.lineWidth   = 1.5
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI)
      ctx.stroke()
    }

    // Label
    if (showLabels && globalScale > 1.2) {
      ctx.globalAlpha = alpha
      ctx.fillStyle   = "rgba(255,255,255,0.85)"
      ctx.font        = `${Math.max(8, 10 / globalScale)}px JetBrains Mono, monospace`
      ctx.textAlign   = "center"
      ctx.textBaseline = "top"
      ctx.fillText(node.label, node.x, node.y + r + 2)
    }

    ctx.globalAlpha = 1
  }, [highlightIds, showLabels, clusterMode, search])

  // ── Link canvas drawing ──
  const drawLink = useCallback((link, ctx) => {
    const src = link.source
    const dst = link.target
    if (!src?.x || !dst?.x) return

    const color = EDGE_COLORS[link.type] || "rgba(255,255,255,0.2)"
    const width  = Math.min(4, Math.max(1, (link.amount || 0.001) * 2))
    const isDim  = highlightIds.size > 0
      && !highlightIds.has(typeof src === "object" ? src.id : src)
      && !highlightIds.has(typeof dst === "object" ? dst.id : dst)

    ctx.globalAlpha = isDim ? 0.05 : 1
    ctx.strokeStyle = color
    ctx.lineWidth   = width

    if (link.type === "RECEIVED" || link.type === "CONNECTED_FROM") {
      ctx.setLineDash([4, 4])
    } else if (link.type === "BELONGS_TO") {
      ctx.setLineDash([2, 6])
    } else {
      ctx.setLineDash([])
    }

    ctx.beginPath()
    ctx.moveTo(src.x, src.y)
    ctx.lineTo(dst.x, dst.y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1

    if (showEdgeLabels) {
      const mx = (src.x + dst.x) / 2
      const my = (src.y + dst.y) / 2
      ctx.fillStyle = "rgba(255,255,255,0.4)"
      ctx.font = "7px Inter, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(link.type, mx, my)
    }
  }, [highlightIds, showEdgeLabels])

  // ── Node click ──
  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node)
    const neighbors = new Set([node.id])
    filteredLinks.forEach(l => {
      const s = typeof l.source === "object" ? l.source.id : l.source
      const t = typeof l.target === "object" ? l.target.id : l.target
      if (s === node.id) neighbors.add(t)
      if (t === node.id) neighbors.add(s)
    })
    setHighlightIds(neighbors)
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 600)
      fgRef.current.zoom(2.5, 600)
    }
  }, [filteredLinks])

  // ── Node hover ──
  const handleNodeHover = useCallback((node, prevNode, e) => {
    setHoveredNode(node || null)
    if (e) setHoverPos({ x: e.clientX + 12, y: e.clientY - 10 })
  }, [])

  // ── Right-click ──
  const handleRightClick = useCallback((node, e) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }, [])

  const handleContextAction = (action, node) => {
    const msgs = {
      pin:    `Node "${node?.label}" pinned.`,
      expand: `Expanding 2 hops from "${node?.label}"…`,
      path:   `Shortest path tool — click target node.`,
      flag:   `"${node?.label}" flagged as suspicious.`,
      alert:  `Navigating to alert for "${node?.label}"…`,
    }
    showToast(msgs[action] || action)
  }

  // ── Export PNG ──
  const exportPNG = () => {
    const canvas = document.querySelector(".force-graph-container canvas")
    if (!canvas) return
    const a = document.createElement("a")
    a.download = "neuralchain_graph.png"
    a.href = canvas.toDataURL()
    a.click()
  }

  // ── Cytoscape mount ──
  useEffect(() => {
    if (viewMode !== "cytoscape" || !cyContRef.current) return

    const cy = cytoscape({
      container: cyContRef.current,
      elements: [
        ...filteredNodes.map(n => ({
          data: { id: n.id, label: n.label, type: n.type, risk: n.risk },
        })),
        ...filteredLinks.map((l, i) => ({
          data: {
            id: `e${i}`,
            source: typeof l.source === "object" ? l.source.id : l.source,
            target: typeof l.target === "object" ? l.target.id : l.target,
            type: l.type,
          },
        })),
      ],
      style: [
        {
          selector: "node",
          style: {
            "background-color": (ele) => NODE_COLORS[ele.data("type")] || "#aaa",
            "label": showLabels ? "data(label)" : "",
            "color": "#fff",
            "font-size": "8px",
            "font-family": "JetBrains Mono, monospace",
            "text-valign": "bottom",
            "text-margin-y": 4,
            "width": (ele) => ele.data("risk") > 0.8 ? 24 : 16,
            "height": (ele) => ele.data("risk") > 0.8 ? 24 : 16,
            "border-width": (ele) => ele.data("risk") > 0.8 ? 2 : 0,
            "border-color": "#ef4444",
          },
        },
        {
          selector: "edge",
          style: {
            "line-color": (ele) => EDGE_COLORS[ele.data("type")] || "#555",
            "width": 1,
            "opacity": 0.5,
            "curve-style": "bezier",
          },
        },
        {
          selector: ":selected",
          style: {
            "border-width": 3,
            "border-color": "#fbbf24",
          },
        },
      ],
      layout: { name: "cose-bilkent", animate: true, animationDuration: 800 },
      wheelSensitivity: 0.3,
    })

    cy.on("tap", "node", (e) => setSelectedNode(e.target.data()))
    cyRef.current = cy
    return () => cy.destroy()
  }, [viewMode, filteredNodes, filteredLinks, showLabels])

  const graphStats = useMemo(() => ({
    nodes: filteredNodes.length,
    edges: filteredLinks.length,
    communities: new Set(filteredNodes.map(n => n.cluster).filter(Boolean)).size,
  }), [filteredNodes, filteredLinks])

  const riskLabel = `Show nodes with risk ≥ ${riskRange[0].toFixed(2)}`

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 shadow-2xl flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />{toast}
        </div>
      )}

      {/* ── CONTEXT MENU ── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y} node={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {/* ── UNIFIED APP HEADER ── */}
      <AppHeader
        rightContent={
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
              {graphStats.nodes} nodes · {graphStats.edges} edges
            </span>
          </div>
        }
      />

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ════════════════════════════════════════════════
            LEFT PANEL
        ════════════════════════════════════════════════ */}
        <aside className="w-[280px] shrink-0 border-r border-white/10 bg-slate-950/85 backdrop-blur-xl flex flex-col overflow-y-auto">
          <div className="p-4 space-y-5">

            {/* Title */}
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Network className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <span className="font-display text-base font-normal text-white tracking-tight">Graph Explorer</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">2D/CYTO</span>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <Input
                placeholder="Search wallet / TXID / IP..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-900/80 border-white/10 rounded-full text-white"
              />
            </div>

            {/* Node Types */}
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Node Types</p>
              <div className="space-y-2">
                {Object.entries(nodeTypes).map(([type, checked]) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={v => setNodeTypes(p => ({ ...p, [type]: !!v }))}
                    />
                    <span className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                        style={{ backgroundColor: NODE_COLORS[type] }} />
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Edge Types */}
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Edge Types</p>
              <div className="space-y-2">
                {Object.entries(edgeTypes).map(([type, checked]) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={v => setEdgeTypes(p => ({ ...p, [type]: !!v }))}
                    />
                    <span className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <span className="w-4 h-px inline-block shrink-0"
                        style={{ backgroundColor: EDGE_COLORS[type] }} />
                      {type}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Risk slider */}
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Risk Score Filter</p>
              <p className="text-[10px] text-zinc-400 mb-3">{riskLabel}</p>
              <Slider
                min={0} max={1} step={0.01}
                value={riskRange}
                onValueChange={setRiskRange}
              />
              <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                <span>0.0</span><span>1.0</span>
              </div>
            </div>

            {/* Layout */}
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Layout Engine</p>
              <Select defaultValue="force">
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="force">Force-Directed</SelectItem>
                  <SelectItem value="hierarchical">Hierarchical</SelectItem>
                  <SelectItem value="circular">Circular</SelectItem>
                  <SelectItem value="dagre">Dagre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Display toggles */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Display</p>
              {[
                ["Show Node Labels",    showLabels,     setShowLabels],
                ["Show Edge Labels",    showEdgeLabels, setShowEdgeLabels],
                ["Cluster Communities", clusterMode,    setClusterMode],
              ].map(([label, val, setter]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{label}</span>
                  <Switch checked={val} onCheckedChange={setter} />
                </div>
              ))}
            </div>

          </div>

          {/* Bottom actions */}
          <div className="mt-auto p-4 border-t border-zinc-800 space-y-3">
            <div className="text-[10px] text-zinc-500 space-y-0.5">
              <div className="flex justify-between">
                <span>Nodes</span><span className="text-zinc-300 font-mono">{graphStats.nodes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Edges</span><span className="text-zinc-300 font-mono">{graphStats.edges.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Communities</span><span className="text-zinc-300 font-mono">{graphStats.communities}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 rounded-full border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10" onClick={exportPNG}>
              <Download className="h-3.5 w-3.5" />Export as PNG
            </Button>
            <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 rounded-full border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10"
              onClick={() => { setViewMode(v => v === "force" ? "cytoscape" : "force"); setSelectedNode(null); setHighlightIds(new Set()) }}>
              <RefreshCw className="h-3.5 w-3.5" />
              {viewMode === "force" ? "Switch to Cytoscape" : "Switch to Force Graph"}
            </Button>
          </div>
        </aside>

        {/* ════════════════════════════════════════════════
            GRAPH CANVAS
        ════════════════════════════════════════════════ */}
        <div className="flex-1 relative overflow-hidden">

          {viewMode === "force" ? (
            <>
              {/* Hover tooltip */}
              {hoveredNode && (
                <div
                  className="fixed z-[100] pointer-events-none bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl px-3 py-2.5 text-xs space-y-1 max-w-[200px]"
                  style={{ left: hoverPos.x, top: hoverPos.y }}
                >
                  <div className="flex items-center gap-1.5">
                    <Badge variant={hoveredNode.risk > 0.8 ? "red" : hoveredNode.risk > 0.5 ? "amber" : "green"} className="text-[10px]">
                      {hoveredNode.type}
                    </Badge>
                    <span className="text-zinc-400 font-mono truncate text-[10px]">{hoveredNode.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-500">Risk</span>
                    <span className={`font-mono font-semibold ${hoveredNode.risk > 0.8 ? "text-red-400" : hoveredNode.risk > 0.5 ? "text-amber-400" : "text-emerald-400"}`}>
                      {hoveredNode.risk?.toFixed(3)}
                    </span>
                  </div>
                  <p className="text-zinc-600 text-[10px]">Click to expand ↗</p>
                </div>
              )}

              {/* ForceGraph2D */}
              <div
                className="force-graph-container w-full h-full"
                onMouseMove={e => setHoverPos({ x: e.clientX + 12, y: e.clientY - 10 })}
                onContextMenu={e => e.preventDefault()}
              >
                <ForceGraph2D
                  ref={fgRef}
                  graphData={{ nodes: filteredNodes, links: filteredLinks }}
                  backgroundColor="#09090b"
                  nodeCanvasObject={drawNode}
                  nodeCanvasObjectMode={() => "replace"}
                  linkCanvasObject={drawLink}
                  linkCanvasObjectMode={() => "replace"}
                  onNodeClick={handleNodeClick}
                  onNodeHover={handleNodeHover}
                  onNodeRightClick={handleRightClick}
                  onBackgroundClick={() => { setHighlightIds(new Set()); setSelectedNode(null) }}
                  cooldownTime={physicsOff ? 0 : 3000}
                  nodeRelSize={6}
                  linkDirectionalParticles={2}
                  linkDirectionalParticleSpeed={0.004}
                  linkDirectionalParticleColor={() => "rgba(255,255,255,0.3)"}
                  width={window.innerWidth - 280 - (selectedNode ? 384 : 0)}
                  height={window.innerHeight - 56}
                />
              </div>

              {/* Minimap */}
              <div className="absolute bottom-4 right-4 rounded-xl overflow-hidden border border-zinc-700 shadow-2xl bg-zinc-900">
                <div className="px-2 py-1 text-[9px] text-zinc-500 font-mono border-b border-zinc-800">Minimap</div>
                <canvas
                  ref={minimapRef}
                  width={150}
                  height={90}
                  className="block"
                  style={{ background: "#09090b" }}
                />
              </div>
            </>
          ) : (
            // Cytoscape view
            <div ref={cyContRef} className="w-full h-full" style={{ background: "#09090b" }} />
          )}

        </div>

        {/* ════════════════════════════════════════════════
            RIGHT DETAIL DRAWER (inline slide-in)
        ════════════════════════════════════════════════ */}
        {selectedNode && (
          <div className="w-96 shrink-0 border-l border-white/10 bg-slate-950/90 backdrop-blur-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0">
              <div className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: selectedNode.risk > 0.8 ? "#ef4444" : NODE_COLORS[selectedNode.type] || "#aaa" }} />
              <span className="font-mono text-xs text-zinc-300 flex-1 truncate">{selectedNode.label}</span>
              <Badge variant={selectedNode.risk > 0.8 ? "red" : selectedNode.risk > 0.5 ? "amber" : "green"} className="text-[10px]">
                {selectedNode.risk?.toFixed(3)}
              </Badge>
              <button onClick={() => { setSelectedNode(null); setHighlightIds(new Set()) }}
                className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer content */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {selectedNode.type === "wallet"      && <WalletDrawer node={selectedNode} />}
                {selectedNode.type === "transaction"  && <TxDrawer    node={selectedNode} />}
                {selectedNode.type === "ip"           && <IpDrawer    node={selectedNode} />}
                {!["wallet","transaction","ip"].includes(selectedNode.type) && (
                  <div className="text-xs text-zinc-400 space-y-2">
                    <p className="font-mono text-zinc-200">{selectedNode.fullLabel || selectedNode.label}</p>
                    <p>Type: <span className="text-zinc-200">{selectedNode.type}</span></p>
                    <p>Risk: <span className="text-zinc-200">{selectedNode.risk}</span></p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}
