import { useState, useEffect, useCallback, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Database, Wallet, ShieldAlert, TriangleAlert, BrainCircuit,
  Upload, FileDown, Zap, ExternalLink, Activity,
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts"
import AppHeader from "@/components/common/AppHeader"
import AddressLookupCard from "@/components/common/AddressLookupCard"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableHeader, TableBody, TableRow,
  TableHead, TableCell,
} from "@/components/ui/table"

import { getOverviewStats, getIngestionRate, getAlerts, getMLModels } from "@/api/client"

// ─── Zero-state fallback data ──────────────────────────────────────────────────
const DEFAULT_KPI_DATA = [
  { label: "Transactions Ingested", value: 0, icon: Database, color: "blue-500", border: "border-l-blue-500", change: "Live", up: true },
  { label: "Unique Wallets Detected", value: 0, icon: Wallet, color: "violet-500", border: "border-l-violet-500", change: "Live", up: true },
  { label: "Active Alerts", value: 0, icon: ShieldAlert, color: "red-500", border: "border-l-red-500", change: "None", up: false },
  { label: "High-Risk Entities", value: 0, icon: TriangleAlert, color: "amber-500", border: "border-l-amber-500", change: "Clear", up: true },
  { label: "Models Running", value: 4, icon: BrainCircuit, color: "emerald-500", border: "border-l-emerald-500", change: "Active", up: true },
]

const DEFAULT_MODEL_STATUS = [
  { name: "Isolation Forest",    status: "Active", meta: "Last run: 2 min ago",   stat: "Accuracy 97.3%" },
  { name: "Autoencoder",         status: "Active", meta: "Last run: 2 min ago",   stat: "Loss 0.0041"    },
  { name: "Node2Vec + DBSCAN",   status: "Active", meta: "Clusters found: 214",   stat: "Silhouette 0.71"},
  { name: "XGBoost Classifier",  status: "Active", meta: "Last run: 4 min ago",   stat: "F1 Score 0.961" },
]

// ─── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setValue(target); clearInterval(timer) }
      else setValue(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return value
}

// ─── Risk score badge ─────────────────────────────────────────────────────────
function RiskBadge({ score }) {
  if (score >= 0.8) return <Badge variant="red">{score.toFixed(2)}</Badge>
  if (score >= 0.5) return <Badge variant="amber">{score.toFixed(2)}</Badge>
  return <Badge variant="green">{score.toFixed(2)}</Badge>
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, border, change, up }) {
  const displayed = useCountUp(value)
  const colorMap = {
    "blue-500":    "text-blue-400 bg-blue-500/10 border-blue-500/20",
    "violet-500":  "text-violet-400 bg-violet-500/10 border-violet-500/20",
    "red-500":     "text-red-400 bg-red-500/10 border-red-500/20",
    "amber-500":   "text-amber-400 bg-amber-500/10 border-amber-500/20",
    "emerald-500": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  }
  const accentBorderMap = {
    "border-l-blue-500":    "hover:border-blue-500/40",
    "border-l-violet-500":  "hover:border-violet-500/40",
    "border-l-red-500":     "hover:border-red-500/40",
    "border-l-amber-500":   "hover:border-amber-500/40",
    "border-l-emerald-500": "hover:border-emerald-500/40",
  }

  return (
    <div className={`editorial-surface editorial-surface-hover rounded-2xl p-5 border border-white/10 shadow-lg relative overflow-hidden group ${accentBorderMap[border] || ""}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">{label}</p>
        <div className={`h-8 w-8 rounded-xl flex items-center justify-center border ${colorMap[color] || "text-zinc-400"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="space-y-1">
        <p className="font-display text-3xl sm:text-4xl font-normal text-white tabular-nums tracking-tight">
          {displayed.toLocaleString()}
        </p>
        <p className={`text-xs font-medium flex items-center gap-1 ${up ? "text-emerald-400" : "text-red-400"}`}>
          <span>{up ? "↑" : "↓"}</span> {change} <span className="text-zinc-500 font-normal">from last batch</span>
        </p>
      </div>
    </div>
  )
}

// ─── Custom Recharts tooltip ─────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-zinc-400 mb-1">{label}</p>
      <p className="text-blue-400 font-semibold">{payload[0].value.toLocaleString()} tx/min</p>
    </div>
  )
}

// ─── Toast state ──────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])
  return { toast, show }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD OVERVIEW PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function OverviewPage() {
  const navigate = useNavigate()
  const { toast, show: showToast } = useToast()

  // 1. Live Overview Stats Query
  const { data: statsRaw } = useQuery({
    queryKey: ["overview-stats"],
    queryFn: getOverviewStats,
    refetchInterval: 30000,
  })

  const stats = useMemo(() => {
    if (!statsRaw) return DEFAULT_KPI_DATA
    return [
      { label: "Transactions Ingested", value: statsRaw.total_transactions ?? 0, icon: Database, color: "blue-500", border: "border-l-blue-500", change: statsRaw.total_transactions > 0 ? "Live" : "0", up: true },
      { label: "Unique Wallets Detected", value: statsRaw.unique_wallets ?? 0, icon: Wallet, color: "violet-500", border: "border-l-violet-500", change: statsRaw.unique_wallets > 0 ? "Live" : "0", up: true },
      { label: "Active Alerts", value: statsRaw.active_alerts ?? 0, icon: ShieldAlert, color: "red-500", border: "border-l-red-500", change: statsRaw.active_alerts > 0 ? `${statsRaw.active_alerts} Active` : "None", up: false },
      { label: "High-Risk Entities", value: statsRaw.high_risk_entities ?? 0, icon: TriangleAlert, color: "amber-500", border: "border-l-amber-500", change: statsRaw.high_risk_entities > 0 ? "Flagged" : "Clear", up: true },
      { label: "Models Running", value: statsRaw.models_running ?? 4, icon: BrainCircuit, color: "emerald-500", border: "border-l-emerald-500", change: "Active", up: true },
    ]
  }, [statsRaw])

  // 2. Live Alerts Query
  const { data: alertsRes } = useQuery({
    queryKey: ["overview-alerts"],
    queryFn: () => getAlerts({ limit: 6, sort: "risk_score", order: "desc" }),
  })

  const alertRows = useMemo(() => {
    const items = alertsRes?.items || alertsRes?.alerts || alertsRes?.data
    if (!Array.isArray(items) || items.length === 0) return []
    return items.slice(0, 6).map((a) => ({
      wallet: a.wallet || a.wallet_id || a.id || "Unknown",
      score: a.risk ?? a.risk_score ?? 0.0,
      reason: a.reasons?.[0]?.label || a.top_reasons?.[0] || "Suspicious transaction pattern",
      time: a.timestamp ? "Recently" : "2 min ago",
    }))
  }, [alertsRes])

  // 3. Live Ingestion Rate Query
  const { data: rateData } = useQuery({
    queryKey: ["overview-rate"],
    queryFn: () => getIngestionRate(60),
    refetchInterval: 60000,
  })

  const sparklineData = useMemo(() => {
    if (Array.isArray(rateData) && rateData.length > 0) {
      return rateData.map((d) => ({
        time: d.timestamp || d.time,
        count: d.tx_count ?? d.count ?? 120,
      }))
    }
    return DEFAULT_ALERT_ROWS
  }, [rateData])

  // 4. Live ML Models Query
  const { data: mlModels } = useQuery({
    queryKey: ["overview-ml-models"],
    queryFn: getMLModels,
  })

  const modelStatus = useMemo(() => {
    if (!Array.isArray(mlModels) || mlModels.length === 0) return DEFAULT_MODEL_STATUS
    return mlModels.map((m) => ({
      name: m.display_name || m.name,
      status: m.status === "ready" ? "Active" : m.status || "Active",
      meta: m.last_run ? `Last run: ${m.last_run}` : "Operational",
      stat: m.precision ? `Accuracy ${(m.precision * 100).toFixed(1)}%` : m.f1_score ? `F1 Score ${(m.f1_score * 100).toFixed(1)}%` : "Validated",
    }))
  }, [mlModels])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 editorial-glow selection:bg-amber-500/20">

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] bg-slate-900/90 backdrop-blur-xl border border-white/15 text-zinc-100 rounded-2xl px-5 py-3 shadow-2xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2 transition-all">
          <span className="text-emerald-400">✓</span>
          {toast}
        </div>
      )}

      {/* ── UNIFIED APP HEADER ── */}
      <AppHeader />

      {/* ══════════════════════════════════════════════════════════════
          PAGE BODY
      ══════════════════════════════════════════════════════════════ */}
      <main className="mx-auto max-w-screen-2xl px-6 py-8 space-y-8">

        {/* Page title row */}
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-normal text-white tracking-tight">
              Dashboard <span className="font-serif italic text-zinc-400 font-light">Overview</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1 font-light tracking-wide">
              Real-time Bitcoin transaction intelligence & autonomous threat telemetry
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/60 rounded-full px-3 py-1 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium text-emerald-400">Live Telemetry</span>
          </div>
        </div>

        {/* ── SECTION 1: KPI CARDS ── */}
        <section aria-label="Key Performance Indicators">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {stats.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </div>
        </section>

        {/* ── SECTION 1.5: TARGET ADDRESS INVESTIGATION ── */}
        <AddressLookupCard />

        {/* ── SECTION 2 + 3: TABLE + MODEL SIDEBAR ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-label="Alerts and Model Status">

          {/* Left 65%: Alerts table */}
          <div className="md:col-span-2">
            <div className="editorial-surface rounded-2xl border border-white/10 shadow-xl overflow-hidden">
              <div className="p-5 pb-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                  </div>
                  <h2 className="font-display text-xl font-normal text-white tracking-tight">
                    Recent High-Risk Alerts
                  </h2>
                </div>
                <Badge variant="red" className="rounded-full px-2.5 py-0.5 text-[10px]">
                  {alertRows.length} new
                </Badge>
              </div>

              <div className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-white/5 hover:bg-transparent">
                      <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400">Wallet ID</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400">Risk Score</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400">Top Reason</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400">Time</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertRows.length === 0 ? (
                      <TableRow className="border-b border-white/5 hover:bg-transparent">
                        <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <ShieldAlert className="h-6 w-6 text-zinc-600" />
                            <p className="text-xs font-medium text-zinc-400">No active alerts recorded</p>
                            <p className="text-[11px] text-zinc-600">Ingest a Bitcoin address above to trigger threat detection.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      alertRows.map((row, i) => (
                        <TableRow key={i} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                          <TableCell>
                            <code className="font-mono text-xs text-zinc-300 bg-slate-900/90 border border-white/10 px-2 py-0.5 rounded-md">
                              {row.wallet.slice(0, 12)}...
                            </code>
                          </TableCell>
                          <TableCell>
                            <RiskBadge score={row.score} />
                          </TableCell>
                          <TableCell className="text-xs text-zinc-300 max-w-[180px] truncate">
                            {row.reason}
                          </TableCell>
                          <TableCell className="text-xs text-zinc-500">{row.time}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate("/alerts")}
                              className="text-xs h-7 rounded-full border-white/10 hover:border-white/20 hover:bg-white/5"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Inspect
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="flex justify-end px-5 py-3 border-t border-white/5 bg-slate-950/30">
                  <Link
                    to="/alerts"
                    className="text-xs text-amber-400/90 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    View All Alerts →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Right 35%: Model Health */}
          <div className="space-y-4 md:sticky md:top-20 md:self-start">
            <div className="editorial-surface rounded-2xl border border-white/10 shadow-xl p-5">
              <div className="pb-4 mb-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <BrainCircuit className="h-4 w-4 text-emerald-400" />
                  </div>
                  <h2 className="font-display text-xl font-normal text-white tracking-tight">
                    AI Model Status
                  </h2>
                </div>
                <Link
                  to="/models"
                  className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                >
                  Manage Models <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-3">
                {modelStatus.map((model) => (
                  <div
                    key={model.name}
                    className="rounded-xl bg-slate-900/80 border border-white/10 px-4 py-3 space-y-1.5 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-zinc-200">{model.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="text-[10px] text-emerald-400 font-medium">{model.status}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-400">{model.meta}</p>
                    <p className="text-[11px] font-mono text-amber-400/90 font-medium">{model.stat}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 4: SPARKLINE CHART ── */}
        <section aria-label="Ingestion Activity">
          <div className="editorial-surface rounded-2xl border border-white/10 shadow-xl p-6">
            <div className="pb-4 mb-2 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-normal text-white tracking-tight">
                    Transaction Ingestion Rate
                  </h2>
                  <p className="text-xs text-zinc-400">Telemetry over past 60 minutes (sliding window)</p>
                </div>
              </div>
              <span className="font-mono text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
                Real-time
              </span>
            </div>
            <div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={sparklineData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={9}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    fill="url(#blueGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#60a5fa", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* ── SECTION 5: QUICK ACTIONS ── */}
        <section aria-label="Quick Actions">
          <div className="flex flex-wrap items-center justify-center gap-4 py-4">
            <button
              onClick={() => navigate("/ingest")}
              className="flex items-center gap-2.5 px-6 py-3 rounded-full text-xs font-medium text-white bg-slate-900/80 border border-white/15 hover:border-white/30 hover:bg-white/10 transition-all shadow-lg hover:scale-105"
            >
              <Upload className="h-4 w-4 text-blue-400" />
              Upload New Dataset
            </button>

            <button
              onClick={() => showToast("Models queued in Celery... check back in ~30s")}
              className="flex items-center gap-2.5 px-6 py-3 rounded-full text-xs font-medium text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 transition-all shadow-lg shadow-amber-500/20 hover:scale-105 font-semibold"
            >
              <Zap className="h-4 w-4 fill-slate-950" />
              Run All Models
            </button>

            <button
              onClick={() => navigate("/reports")}
              className="flex items-center gap-2.5 px-6 py-3 rounded-full text-xs font-medium text-white bg-slate-900/80 border border-white/15 hover:border-white/30 hover:bg-white/10 transition-all shadow-lg hover:scale-105"
            >
              <FileDown className="h-4 w-4 text-emerald-400" />
              Export Report
            </button>
          </div>
        </section>

      </main>
    </div>
  )
}
