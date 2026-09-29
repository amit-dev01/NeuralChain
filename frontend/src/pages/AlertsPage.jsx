import { useState, useMemo, useRef, useCallback } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, Legend, ResponsiveContainer,
  BarChart, Cell,
} from "recharts"
import {
  ShieldAlert, FileDown, CheckCheck, Search, X, Eye,
  Network, Trash2, TrendingUp, GitBranch, Zap, Copy,
  ChevronDown, ChevronUp, ChevronsUpDown, ArrowUpDown,
  CheckCircle2, Activity, BarChart2, AlertTriangle,
  ArrowRight, RefreshCw, ChevronRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select, SelectTrigger, SelectContent,
  SelectItem, SelectValue,
} from "@/components/ui/select"
import {
  Sheet, SheetContent, SheetHeader,
  SheetFooter, SheetTitle,
} from "@/components/ui/sheet"
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogFooter, AlertDialogTitle,
  AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"

import { MOCK_ALERTS, TREND_DATA } from "@/data/alertsMockData"

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25

const MODEL_BADGE = {
  "XGBoost":         { variant: "amber",  short: "XGB" },
  "Isolation Forest":{ variant: "blue",   short: "IF"  },
  "Autoencoder":     { variant: "violet", short: "AE"  },
  "Node2Vec+DBSCAN": { variant: "green",  short: "N2V" },
}

const STATUS_COLORS = {
  "New":          "text-zinc-400",
  "Under Review": "text-blue-400",
  "Confirmed":    "text-red-400",
  "Dismissed":    "text-emerald-400",
}

const REASON_ICONS = {
  TrendingUp: TrendingUp,
  GitBranch:  GitBranch,
  Zap:        Zap,
  Activity:   Activity,
  BarChart2:  BarChart2,
  AlertTriangle: AlertTriangle,
  ArrowRight: ArrowRight,
  RefreshCw:  RefreshCw,
  Network:    Network,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function riskColor(r) {
  if (r >= 0.8) return "text-red-400"
  if (r >= 0.5) return "text-amber-400"
  return "text-emerald-400"
}
function riskBg(r) {
  if (r >= 0.8) return "bg-red-500"
  if (r >= 0.5) return "bg-amber-500"
  return "bg-emerald-500"
}
function riskVariant(r) {
  if (r >= 0.8) return "red"
  if (r >= 0.5) return "amber"
  return "green"
}
function relTime(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (diff < 1)   return "just now"
  if (diff < 60)  return `${diff} min ago`
  if (diff < 1440) return `${Math.floor(diff/60)} hr ago`
  return `${Math.floor(diff/1440)} days ago`
}
function copyText(t) { navigator.clipboard.writeText(t) }

// ─── Custom dark tooltip ──────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-2xl text-xs space-y-1">
      <p className="text-zinc-400 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

// ─── Inline SHAP expansion ────────────────────────────────────────────────────
function ShapExpansion({ alert }) {
  return (
    <div className="grid grid-cols-2 gap-6 bg-zinc-900/60 border-t border-zinc-800 px-6 py-5">
      {/* Left: SHAP chart */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">SHAP Feature Contributions</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart layout="vertical" data={alert.shapValues} margin={{ left: 90, right: 16 }}>
            <XAxis type="number" domain={[-0.8, 0.8]} tick={{ fill: "#71717a", fontSize: 9 }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="feature" tick={{ fill: "#a1a1aa", fontSize: 9 }} tickLine={false} axisLine={false} width={90} />
            <RTooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "#d4d4d8" }} />
            <Bar dataKey="value" radius={[0, 3, 3, 0]}>
              {alert.shapValues?.map((d, i) => (
                <Cell key={i} fill={d.value >= 0 ? "#ef4444" : "#3b82f6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-3 text-[10px] text-zinc-500 mt-2">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Increases risk</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Decreases risk</span>
        </div>
      </div>

      {/* Right: Evidence TXIDs */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Evidence Transactions</p>
        <div className="space-y-1.5 mb-3">
          {alert.evidenceTxids?.map((ev, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] bg-zinc-800/60 rounded-lg px-3 py-1.5">
              <code className="font-mono text-zinc-400 flex-1 truncate">{ev.txid.slice(0,16)}…</code>
              <span className="text-zinc-300 font-mono shrink-0">{ev.amount} BTC</span>
              <Badge variant="red" className="text-[9px] shrink-0">{ev.flag}</Badge>
              <button onClick={() => copyText(ev.txid)} className="text-zinc-600 hover:text-zinc-300 shrink-0">
                <Copy className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400 italic leading-relaxed border border-zinc-700/50">
          {alert.shapSummary}
        </div>
      </div>
    </div>
  )
}

// ─── Alert Detail Sheet ───────────────────────────────────────────────────────
function AlertDetailSheet({ alert, open, onClose, onStatusChange }) {
  if (!alert) return null
  const m = MODEL_BADGE[alert.model] || { variant: "default", short: "?" }

  const rawJson = JSON.stringify({
    id: alert.id,
    wallet: alert.wallet,
    risk_score: alert.risk,
    model: alert.model,
    status: alert.status,
    cluster: alert.cluster,
    entity_label: alert.entityLabel,
    shap_values: alert.shapValues,
    evidence_txids: alert.evidenceTxids?.map(e => e.txid),
    timestamp: alert.timestamp,
  }, null, 2)

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-[520px] p-0">
        <SheetHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <SheetTitle>Alert #{alert.id}</SheetTitle>
            <Badge variant={riskVariant(alert.risk)} className="text-sm px-2.5 py-0.5 font-mono">
              {alert.risk.toFixed(3)}
            </Badge>
            <Badge variant={m.variant} className="text-xs">{alert.model}</Badge>
          </div>
          <Select value={alert.status} onValueChange={v => onStatusChange(alert.id, v)}>
            <SelectTrigger className="h-7 w-36 text-xs mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["New","Under Review","Confirmed","Dismissed"].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6">
          <Tabs defaultValue="summary" className="pt-4">
            <TabsList className="w-full grid grid-cols-4 mb-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="shap">SHAP</TabsTrigger>
              <TabsTrigger value="evidence">Evidence</TabsTrigger>
              <TabsTrigger value="raw">Raw Data</TabsTrigger>
            </TabsList>

            {/* SUMMARY */}
            <TabsContent value="summary" className="space-y-3 pb-6">
              <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                <code className="font-mono text-xs text-zinc-300 flex-1 break-all">{alert.wallet}</code>
                <button onClick={() => copyText(alert.wallet)} className="text-zinc-500 hover:text-zinc-200 shrink-0">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant={alert.risk > 0.8 ? "red" : "amber"} className="text-xs">{alert.entityLabel}</Badge>
                <Badge variant={m.variant} className="text-xs">{alert.model}</Badge>
              </div>
              {[
                ["First Flagged",     new Date(alert.timestamp).toLocaleString()],
                ["Alert Age",         relTime(alert.timestamp)],
                ["Cluster ID",        `#${alert.cluster}`],
                ["Related Alerts",    "3 others share this IP cluster"],
                ["Address Reuse",     "47×"],
              ].map(([k,v]) => (
                <div key={k} className="flex justify-between text-xs border-b border-zinc-800 pb-2">
                  <span className="text-zinc-500">{k}</span>
                  <span className="text-zinc-200 font-medium">{v}</span>
                </div>
              ))}
            </TabsContent>

            {/* SHAP */}
            <TabsContent value="shap" className="pb-6 space-y-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart layout="vertical" data={alert.shapValues} margin={{ left: 100, right: 16 }}>
                  <XAxis type="number" domain={[-0.8, 0.8]} tick={{ fill: "#71717a", fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="feature" tick={{ fill: "#a1a1aa", fontSize: 10 }} tickLine={false} axisLine={false} width={100} />
                  <RTooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 11 }} labelStyle={{ color: "#d4d4d8" }} />
                  <Bar dataKey="value" radius={[0,3,3,0]}>
                    {alert.shapValues?.map((d,i) => <Cell key={i} fill={d.value >= 0 ? "#ef4444" : "#3b82f6"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="overflow-hidden rounded-xl border border-zinc-800">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-800/80">
                    <tr>
                      {["Feature","Value","Contribution","Direction"].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-zinc-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {alert.shapValues?.map((d, i) => (
                      <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                        <td className="px-3 py-2 font-mono text-zinc-300">{d.feature}</td>
                        <td className="px-3 py-2 text-zinc-400 font-mono">{d.value.toFixed(3)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 rounded-full w-20 bg-zinc-700 overflow-hidden">
                              <div className={`h-full ${d.value >= 0 ? "bg-red-500" : "bg-blue-500"}`}
                                style={{ width: `${Math.abs(d.value) * 100}%`, float: d.value >= 0 ? "left" : "right" }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={d.value >= 0 ? "text-red-400 text-[10px]" : "text-blue-400 text-[10px]"}>
                            {d.value >= 0 ? "↑ risk" : "↓ risk"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* EVIDENCE */}
            <TabsContent value="evidence" className="pb-4 space-y-3">
              {alert.evidenceTxids?.map((ev, i) => (
                <div key={i} className="bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-zinc-300 flex-1 text-[10px] break-all">{ev.txid}</code>
                    <button onClick={() => copyText(ev.txid)} className="text-zinc-500 hover:text-zinc-200 shrink-0">
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex gap-4 text-zinc-500">
                    <span>Amount: <span className="text-zinc-300 font-mono">{ev.amount} BTC</span></span>
                    <span>Time: <span className="text-zinc-300">{relTime(ev.ts)}</span></span>
                    <Badge variant="red" className="text-[9px]">{ev.flag}</Badge>
                  </div>
                </div>
              ))}
              <Link to="/graph" className="block">
                <Button variant="outline" size="sm" className="w-full gap-2 mt-2">
                  <Network className="h-4 w-4" />View Full Subgraph
                </Button>
              </Link>
            </TabsContent>

            {/* RAW DATA */}
            <TabsContent value="raw" className="pb-4">
              <div className="relative">
                <button onClick={() => copyText(rawJson)}
                  className="absolute right-2 top-2 z-10 flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-200 bg-zinc-800 rounded px-2 py-1 transition-colors">
                  <Copy className="h-3 w-3" />Copy JSON
                </button>
                <pre className="bg-black rounded-xl border border-zinc-800 p-4 font-mono text-[10px] text-green-400 overflow-x-auto leading-relaxed">
                  {rawJson}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <SheetFooter>
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => onStatusChange(alert.id, "Confirmed")}>
            <ShieldAlert className="h-4 w-4" />Confirm Malicious
          </Button>
          <Button variant="outline" size="sm" onClick={() => onStatusChange(alert.id, "Under Review")}>
            Mark Reviewed
          </Button>
          <Button variant="ghost" size="sm" className="text-zinc-500" onClick={() => onStatusChange(alert.id, "Dismissed")}>
            Dismiss
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ─── Alert Table Row ──────────────────────────────────────────────────────────
function AlertRow({ alert, idx, expanded, onExpand, onStatusChange, onOpenDrawer }) {
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()
  const m = MODEL_BADGE[alert.model] || { variant: "default", short: "?" }

  const handleCopy = (e) => {
    e.stopPropagation()
    copyText(alert.wallet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <>
      <tr
        className={`border-b border-zinc-800 cursor-pointer transition-colors
          ${expanded ? "bg-zinc-800/40" : "hover:bg-zinc-800/30"}`}
        onClick={() => onExpand(alert.id)}
      >
        {/* # */}
        <td className="px-4 py-3 text-xs text-zinc-600 tabular-nums w-10">{idx + 1}</td>

        {/* Wallet */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <Link to={`/graph?focus=${alert.wallet}`}
              className="font-mono text-xs text-blue-400 hover:text-blue-300 transition-colors">
              {alert.walletShort}
            </Link>
            <button onClick={handleCopy} className="text-zinc-600 hover:text-zinc-300 shrink-0">
              {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </td>

        {/* Risk Score */}
        <td className="px-4 py-3">
          <div>
            <span className={`text-sm font-bold font-mono ${riskColor(alert.risk)}`}>
              {alert.risk.toFixed(3)}
            </span>
            <div className="h-1 w-16 bg-zinc-800 rounded-full mt-1 overflow-hidden">
              <div className={`h-full rounded-full ${riskBg(alert.risk)}`}
                style={{ width: `${alert.risk * 100}%` }} />
            </div>
          </div>
        </td>

        {/* Top 3 Reasons */}
        <td className="px-4 py-3 max-w-[220px]">
          <div className="space-y-1">
            {alert.reasons?.map((r, i) => {
              const Icon = REASON_ICONS[r.icon] || AlertTriangle
              return (
                <div key={i} className="flex items-center gap-1.5 bg-zinc-800/70 rounded px-2 py-0.5 text-[10px] text-zinc-400">
                  <Icon className="h-2.5 w-2.5 text-amber-400 shrink-0" />
                  <span className="truncate">{r.label}</span>
                </div>
              )
            })}
          </div>
        </td>

        {/* Model */}
        <td className="px-4 py-3">
          <Badge variant={m.variant} className="text-[10px]">{m.short}</Badge>
        </td>

        {/* Timestamp */}
        <td className="px-4 py-3">
          <span className="text-xs text-zinc-500" title={new Date(alert.timestamp).toLocaleString()}>
            {relTime(alert.timestamp)}
          </span>
        </td>

        {/* Status */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <Select value={alert.status} onValueChange={v => onStatusChange(alert.id, v)}>
            <SelectTrigger className="h-7 w-32 text-[11px]">
              <span className={STATUS_COLORS[alert.status] || "text-zinc-400"}>{alert.status}</span>
            </SelectTrigger>
            <SelectContent>
              {["New","Under Review","Confirmed","Dismissed"].map(s => (
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </td>

        {/* Actions */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button onClick={() => onOpenDrawer(alert)}
              className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 transition-colors" title="View Detail">
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => navigate(`/graph?focus=${alert.wallet}`)}
              className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-blue-400 transition-colors" title="View in Graph">
              <Network className="h-3.5 w-3.5" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-colors" title="Dismiss Alert">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Dismiss Alert #{alert.id}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark the alert as dismissed. You can undo this by changing the status back.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onStatusChange(alert.id, "Dismissed")}>Dismiss</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </td>

        {/* Expand caret */}
        <td className="px-2 py-3">
          {expanded
            ? <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
            : <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />}
        </td>
      </tr>

      {/* Inline SHAP expansion */}
      {expanded && (
        <tr>
          <td colSpan={9} className="p-0">
            <ShapExpansion alert={alert} />
          </td>
        </tr>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function AlertsPage() {
  const navigate = useNavigate()

  // ── State ──
  const [search,         setSearch]         = useState("")
  const [filterRisk,     setFilterRisk]     = useState("all")
  const [filterModel,    setFilterModel]    = useState("all")
  const [filterStatus,   setFilterStatus]   = useState("all")
  const [dateFrom,       setDateFrom]       = useState("")
  const [dateTo,         setDateTo]         = useState("")
  const [sortKey,        setSortKey]        = useState("risk")
  const [sortDir,        setSortDir]        = useState("desc")
  const [page,           setPage]           = useState(1)
  const [expandedRow,    setExpandedRow]    = useState(null)
  const [drawerAlert,    setDrawerAlert]    = useState(null)
  const [toast,          setToast]          = useState(null)
  const [alerts,         setAlerts]         = useState(MOCK_ALERTS)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  // ── Status mutation (optimistic) ──
  const handleStatusChange = useCallback((id, newStatus) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
    if (drawerAlert?.id === id) setDrawerAlert(prev => ({ ...prev, status: newStatus }))
    showToast(`Alert #${id} → ${newStatus}`)
    // TODO: PATCH /api/v1/alerts/{id}/status
  }, [drawerAlert])

  // ── Active filter chips ──
  const activeFilters = useMemo(() => {
    const chips = []
    if (filterRisk   !== "all") chips.push({ key: "risk",   label: `Risk: ${filterRisk}`,    clear: () => setFilterRisk("all")   })
    if (filterModel  !== "all") chips.push({ key: "model",  label: `Model: ${filterModel}`,  clear: () => setFilterModel("all")  })
    if (filterStatus !== "all") chips.push({ key: "status", label: `Status: ${filterStatus}`,clear: () => setFilterStatus("all") })
    if (dateFrom)               chips.push({ key: "from",   label: `From: ${dateFrom}`,      clear: () => setDateFrom("")        })
    if (dateTo)                 chips.push({ key: "to",     label: `To: ${dateTo}`,           clear: () => setDateTo("")          })
    return chips
  }, [filterRisk, filterModel, filterStatus, dateFrom, dateTo])

  const resetFilters = () => {
    setSearch(""); setFilterRisk("all"); setFilterModel("all")
    setFilterStatus("all"); setDateFrom(""); setDateTo("")
  }

  // ── Filtered + sorted data ──
  const filtered = useMemo(() => {
    let data = alerts
    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(a =>
        a.wallet.toLowerCase().includes(q) ||
        a.reasons.some(r => r.label.toLowerCase().includes(q))
      )
    }
    if (filterRisk !== "all") {
      data = data.filter(a => {
        if (filterRisk === "critical") return a.risk >= 0.9
        if (filterRisk === "high")     return a.risk >= 0.7 && a.risk < 0.9
        if (filterRisk === "medium")   return a.risk >= 0.5 && a.risk < 0.7
        if (filterRisk === "low")      return a.risk < 0.5
        return true
      })
    }
    if (filterModel  !== "all") data = data.filter(a => a.model === filterModel)
    if (filterStatus !== "all") data = data.filter(a => a.status === filterStatus)

    data = [...data].sort((a, b) => {
      const v = sortKey === "risk"      ? a.risk - b.risk
              : sortKey === "timestamp" ? new Date(a.timestamp) - new Date(b.timestamp)
              : 0
      return sortDir === "desc" ? -v : v
    })
    return data
  }, [alerts, search, filterRisk, filterModel, filterStatus, sortKey, sortDir])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged      = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc")
    else { setSortKey(key); setSortDir("desc") }
    setPage(1)
  }

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 text-zinc-600 ml-1" />
    return sortDir === "desc"
      ? <ChevronDown className="h-3 w-3 text-blue-400 ml-1" />
      : <ChevronUp   className="h-3 w-3 text-blue-400 ml-1" />
  }

  // ── Summary mini-stats ──
  const stats = useMemo(() => ({
    critical:  alerts.filter(a => a.risk >= 0.9).length,
    high:      alerts.filter(a => a.risk >= 0.7 && a.risk < 0.9).length,
    medium:    alerts.filter(a => a.risk >= 0.5 && a.risk < 0.7).length,
    dismissed: alerts.filter(a => a.status === "Dismissed").length,
  }), [alerts])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] bg-zinc-900 border border-emerald-500/40 rounded-xl px-4 py-2.5 text-sm text-emerald-300 shadow-2xl flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />{toast}
        </div>
      )}

      {/* ── DRAWER ── */}
      <AlertDetailSheet
        alert={drawerAlert}
        open={!!drawerAlert}
        onClose={() => setDrawerAlert(null)}
        onStatusChange={handleStatusChange}
      />

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-screen-2xl px-6 h-14 flex items-center gap-6">
          <Link to="/" className="font-mono text-lg font-bold text-amber-400">SIH26146</Link>
          <nav className="hidden md:flex items-center gap-1">
            {[
              ["Dashboard","/overview"],
              ["Ingest","/ingest"],
              ["Graph","/graph"],
              ["Alerts","/alerts"],
              ["Timeline","/timeline"],
              ["GeoMap","/geomap"],
              ["Reports","/reports"],
            ].map(([l,t]) => (
              <Link key={t} to={t} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${t === "/alerts" ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"}`}>{l}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-screen-2xl px-6 py-6 space-y-6">

        {/* ── PAGE TITLE ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-zinc-500 mb-2">
              <Link to="/overview" className="hover:text-zinc-300 transition-colors">Dashboard</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-zinc-300">Alerts</span>
            </nav>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-red-500" />
              Alert Center
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              <span className="text-red-400 font-semibold">{filtered.length}</span> active alerts across{" "}
              <span className="text-amber-400 font-semibold">83</span> high-risk entities
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <FileDown className="h-4 w-4" />Export All (CSV)
            </Button>
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <CheckCheck className="h-4 w-4" />Mark All Reviewed
            </Button>
          </div>
        </div>

        {/* ── SECTION 1: FILTERS ── */}
        <div className="bg-zinc-900 rounded-xl p-4 space-y-3 border border-zinc-800">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search wallet ID, TXID, reason..." className="pl-8 h-8 text-xs" />
            </div>

            {/* Risk */}
            <Select value={filterRisk} onValueChange={v => { setFilterRisk(v); setPage(1) }}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Risk Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                <SelectItem value="critical">Critical (&gt;0.9)</SelectItem>
                <SelectItem value="high">High (0.7–0.9)</SelectItem>
                <SelectItem value="medium">Medium (0.5–0.7)</SelectItem>
                <SelectItem value="low">Low (&lt;0.5)</SelectItem>
              </SelectContent>
            </Select>

            {/* Model */}
            <Select value={filterModel} onValueChange={v => { setFilterModel(v); setPage(1) }}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Detection Model" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Models</SelectItem>
                <SelectItem value="Isolation Forest">Isolation Forest</SelectItem>
                <SelectItem value="Autoencoder">Autoencoder</SelectItem>
                <SelectItem value="Node2Vec+DBSCAN">Node2Vec+DBSCAN</SelectItem>
                <SelectItem value="XGBoost">XGBoost</SelectItem>
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1) }}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Under Review">Under Review</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="Dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range */}
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="h-8 w-36 text-xs" />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="h-8 w-36 text-xs" />

            {/* Reset */}
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 h-8 text-xs text-zinc-500">
              <X className="h-3.5 w-3.5" />Reset
            </Button>
          </div>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {activeFilters.map(f => (
                <button key={f.key} onClick={f.clear}
                  className="flex items-center gap-1 bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[11px] px-2 py-0.5 rounded-full hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 transition-colors">
                  {f.label}
                  <X className="h-2.5 w-2.5" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── SECTION 2: SUMMARY MINI-CARDS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Critical", value: stats.critical,  color: "text-red-400",     bar: "bg-red-500"     },
            { label: "High",     value: stats.high,      color: "text-amber-400",   bar: "bg-amber-500"   },
            { label: "Medium",   value: stats.medium,    color: "text-yellow-400",  bar: "bg-yellow-500"  },
            { label: "Dismissed Today", value: stats.dismissed, color: "text-zinc-400", bar: "bg-zinc-600" },
          ].map(({ label, value, color, bar }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500">{label}</p>
                <p className={`text-2xl font-bold font-mono tabular-nums ${color}`}>{value}</p>
              </div>
              <div className={`w-1.5 h-10 rounded-full ${bar} opacity-60`} />
            </div>
          ))}
        </div>

        {/* ── SECTION 3: MAIN TABLE ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Table header row */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <p className="text-sm font-semibold text-zinc-300">
              Showing {(page-1)*PAGE_SIZE + 1}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium w-10">#</th>
                  <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Wallet ID</th>
                  <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium cursor-pointer select-none"
                    onClick={() => handleSort("risk")}>
                    <span className="flex items-center">Risk Score<SortIcon k="risk" /></span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Top 3 Reasons</th>
                  <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Model</th>
                  <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium cursor-pointer select-none"
                    onClick={() => handleSort("timestamp")}>
                    <span className="flex items-center">Time<SortIcon k="timestamp" /></span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">Actions</th>
                  <th className="px-2 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {paged.map((alert, idx) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    idx={(page-1)*PAGE_SIZE + idx}
                    expanded={expandedRow === alert.id}
                    onExpand={id => setExpandedRow(prev => prev === id ? null : id)}
                    onStatusChange={handleStatusChange}
                    onOpenDrawer={setDrawerAlert}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
            <p className="text-xs text-zinc-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs"
                disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                ← Prev
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = Math.max(1, page - 2) + i
                if (pg > totalPages) return null
                return (
                  <Button key={pg} variant={pg === page ? "secondary" : "ghost"} size="sm"
                    className="h-7 w-7 text-xs p-0" onClick={() => setPage(pg)}>
                    {pg}
                  </Button>
                )
              })}
              <Button variant="outline" size="sm" className="h-7 text-xs"
                disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                Next →
              </Button>
            </div>
          </div>
        </div>

        {/* ── SECTION 4: TREND CHART ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-base font-semibold text-zinc-100 mb-5 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            Alert Volume Over Time
            <span className="text-xs font-normal text-zinc-500">(last 7 days)</span>
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={TREND_DATA} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#71717a", fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <RTooltip content={<DarkTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#a1a1aa", paddingTop: 12 }}
                iconSize={8}
              />
              <Bar dataKey="total"     name="Total Alerts"    fill="url(#barGrad)" radius={[3,3,0,0]} />
              <Line dataKey="critical" name="Critical"        stroke="#f87171" strokeWidth={2} dot={false} type="monotone" />
              <Line dataKey="confirmed" name="Confirmed"      stroke="#fbbf24" strokeWidth={2} dot={false} type="monotone" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

      </main>
    </div>
  )
}
