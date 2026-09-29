import { useState, useEffect, useCallback } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  Database, Wallet, ShieldAlert, TriangleAlert, BrainCircuit,
  Upload, FileDown, Zap, ExternalLink, Activity,
  LayoutDashboard, GitFork, Bell, Clock, Map, FileText,
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableHeader, TableBody, TableRow,
  TableHead, TableCell,
} from "@/components/ui/table"

// ─── Mock data ────────────────────────────────────────────────────────────────
// TODO: GET /api/v1/stats/overview
const KPI_DATA = [
  { label: "Transactions Ingested", value: 142857, icon: Database, color: "blue-500", border: "border-l-blue-500", change: "+12%", up: true },
  { label: "Unique Wallets Detected", value: 38291,  icon: Wallet,       color: "violet-500", border: "border-l-violet-500", change: "+8%",  up: true },
  { label: "Active Alerts",           value: 247,    icon: ShieldAlert,  color: "red-500",    border: "border-l-red-500",    change: "+34%", up: false },
  { label: "High-Risk Entities",      value: 83,     icon: TriangleAlert,color: "amber-500",  border: "border-l-amber-500",  change: "-5%",  up: true },
  { label: "Models Running",          value: 4,      icon: BrainCircuit, color: "emerald-500",border: "border-l-emerald-500", change: "Stable", up: true },
]

// TODO: GET /api/v1/alerts?limit=6&min_score=0.5
const ALERT_ROWS = [
  { wallet: "1A1zP1eP5QGefi2", score: 0.97, reason: "Fan-out mixing (83 outputs)",  time: "2 min ago"  },
  { wallet: "3J98t1WpEZ73CNm", score: 0.91, reason: "Rapid IP reuse (47 TXs/2min)", time: "5 min ago"  },
  { wallet: "bc1qxy2kgdygjrs", score: 0.88, reason: "Round-amount pattern (1.0 BTC)",time: "11 min ago" },
  { wallet: "1BpEi6DfDAUFd4",  score: 0.74, reason: "Peel chain depth 12",          time: "18 min ago" },
  { wallet: "3FZbgi29cpjq2Gj", score: 0.61, reason: "Known darknet cluster #14",    time: "25 min ago" },
  { wallet: "bc1qar0srrr7xfkv", score: 0.53, reason: "Unusual fee spike (3.2σ)",    time: "31 min ago" },
]

// TODO: GET /api/v1/ml/status
const MODEL_STATUS = [
  { name: "Isolation Forest",    status: "Active", meta: "Last run: 2 min ago",   stat: "Accuracy 97.3%" },
  { name: "Autoencoder",         status: "Active", meta: "Last run: 2 min ago",   stat: "Loss 0.0041"    },
  { name: "Node2Vec + DBSCAN",   status: "Active", meta: "Clusters found: 214",   stat: "Silhouette 0.71"},
  { name: "XGBoost Classifier",  status: "Active", meta: "Last run: 4 min ago",   stat: "F1 Score 0.961" },
]

const NAV_LINKS = [
  { label: "Dashboard", to: "/overview",  icon: LayoutDashboard },
  { label: "Ingest",    to: "/ingest",    icon: Upload           },
  { label: "Graph",     to: "/graph",     icon: GitFork          },
  { label: "Alerts",    to: "/alerts",    icon: Bell             },
  { label: "Timeline",  to: "/timeline",  icon: Clock            },
  { label: "GeoMap",    to: "/geomap",    icon: Map              },
  { label: "Reports",   to: "/reports",   icon: FileText         },
]

// ─── Sparkline mock data (60 data points) ─────────────────────────────────────
// TODO: GET /api/v1/ingest/rate?window=60m
function generateSparkline() {
  const now = new Date()
  return Array.from({ length: 60 }, (_, i) => {
    const t = new Date(now.getTime() - (59 - i) * 60000)
    const hh = String(t.getHours()).padStart(2, "0")
    const mm = String(t.getMinutes()).padStart(2, "0")
    // Inject realistic spike around i=35-45
    let base = Math.floor(Math.random() * 120 + 80)
    if (i >= 35 && i <= 45) base = Math.floor(Math.random() * 600 + 400)
    if (i >= 20 && i <= 25) base = Math.floor(Math.random() * 280 + 200)
    return { time: `${hh}:${mm}`, count: base }
  })
}
const SPARKLINE_DATA = generateSparkline()

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
    "blue-500":    "text-blue-400",
    "violet-500":  "text-violet-400",
    "red-500":     "text-red-400",
    "amber-500":   "text-amber-400",
    "emerald-500": "text-emerald-400",
  }
  const borderMap = {
    "border-l-blue-500":    "border-l-blue-500",
    "border-l-violet-500":  "border-l-violet-500",
    "border-l-red-500":     "border-l-red-500",
    "border-l-amber-500":   "border-l-amber-500",
    "border-l-emerald-500": "border-l-emerald-500",
  }
  return (
    <Card className={`border-l-4 ${borderMap[border]} transition-all duration-200 hover:bg-zinc-800/60`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</p>
          <Icon className={`h-4 w-4 ${colorMap[color]}`} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-zinc-100 tabular-nums">
          {displayed.toLocaleString()}
        </p>
        <p className={`text-xs mt-1 font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>
          {change} from last batch
        </p>
      </CardContent>
    </Card>
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

  // TODO: replace with real query → GET /api/v1/stats/overview
  const { data: stats } = useQuery({
    queryKey: ["overview-stats"],
    queryFn: () => Promise.resolve(KPI_DATA),
    initialData: KPI_DATA,
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">

      {/* ── TOAST ── */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-xl px-5 py-3 shadow-2xl text-sm flex items-center gap-3 animate-in slide-in-from-top-2 transition-all">
          <span className="text-emerald-400">✓</span>
          {toast}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-screen-2xl px-6 py-0 flex items-center h-14 gap-6">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-lg font-bold text-amber-400 tracking-tight">
              SIH26146
            </span>
            <span className="hidden sm:block text-xs text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">
              NeuralChain
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 flex-1" aria-label="Main navigation">
            {NAV_LINKS.map(({ label, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </nav>

          {/* System Status badge */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-zinc-400 hidden sm:block">All Systems Operational</span>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════
          PAGE BODY
      ══════════════════════════════════════════════════════════════ */}
      <main className="mx-auto max-w-screen-2xl px-6 py-6 space-y-6">

        {/* Page title row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Dashboard Overview</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Real-time Bitcoin transaction intelligence</p>
          </div>
          <Badge variant="blue" className="text-xs">
            <Activity className="h-3 w-3 mr-1" />
            Live
          </Badge>
        </div>

        {/* ── SECTION 1: KPI CARDS ── */}
        <section aria-label="Key Performance Indicators">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {stats.map((kpi) => (
              <KpiCard key={kpi.label} {...kpi} />
            ))}
          </div>
        </section>

        {/* ── SECTION 2 + 3: TABLE + MODEL SIDEBAR ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-label="Alerts and Model Status">

          {/* Left 65%: Alerts table */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                    Recent High-Risk Alerts
                  </CardTitle>
                  <Badge variant="red">{ALERT_ROWS.length} new</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wallet ID</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Top Reason</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ALERT_ROWS.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <code className="font-mono text-xs text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded">
                            {row.wallet.slice(0, 12)}...
                          </code>
                        </TableCell>
                        <TableCell>
                          <RiskBadge score={row.score} />
                        </TableCell>
                        <TableCell className="text-xs text-zinc-400 max-w-[180px] truncate">
                          {row.reason}
                        </TableCell>
                        <TableCell className="text-xs text-zinc-500">{row.time}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate("/alerts")}
                            className="text-xs h-7"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Inspect
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex justify-end px-4 py-3 border-t border-zinc-800">
                  <Link
                    to="/alerts"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    View All Alerts →
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right 35%: Model Health */}
          <div className="space-y-3 md:sticky md:top-20 md:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BrainCircuit className="h-4 w-4 text-emerald-400" />
                  AI Model Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {MODEL_STATUS.map((model) => (
                  <div
                    key={model.name}
                    className="rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3 space-y-1.5"
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
                    <p className="text-[11px] text-zinc-500">{model.meta}</p>
                    <p className="text-[11px] text-zinc-400 font-medium">{model.stat}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── SECTION 4: SPARKLINE CHART ── */}
        <section aria-label="Ingestion Activity">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-blue-400" />
                Transaction Ingestion Rate
                <span className="text-xs font-normal text-zinc-500">(last 60 minutes)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={SPARKLINE_DATA} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "#71717a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={9}
                  />
                  <YAxis
                    tick={{ fill: "#71717a", fontSize: 10 }}
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
            </CardContent>
          </Card>
        </section>

        {/* ── SECTION 5: QUICK ACTIONS ── */}
        <section aria-label="Quick Actions">
          <div className="flex flex-wrap items-center justify-center gap-4 py-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/ingest")}
              className="gap-2 border-zinc-700 hover:border-blue-500 hover:text-blue-400 transition-all"
            >
              <Upload className="h-5 w-5" />
              Upload New Dataset
            </Button>

            <Button
              variant="amber"
              size="lg"
              onClick={() => showToast("Models queued in Celery... check back in ~30s")}
              className="gap-2"
            >
              <Zap className="h-5 w-5" />
              Run All Models
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/reports")}
              className="gap-2 border-zinc-700 hover:border-emerald-500 hover:text-emerald-400 transition-all"
            >
              <FileDown className="h-5 w-5" />
              Export Report
            </Button>
          </div>
        </section>

      </main>
    </div>
  )
}
