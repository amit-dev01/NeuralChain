import { useNavigate } from "react-router-dom"
import {
  Globe,
  ShieldAlert,
  Server,
  Activity,
  ArrowRight,
  TrendingUp,
  ExternalLink,
  Layers,
  Copy,
} from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function CountryDetailSheet({ country, open, onClose }) {
  const navigate = useNavigate()

  if (!country) return null

  const { overview, ips, asnDistribution, asnTable, transactions } = country

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl bg-zinc-900 border-l border-zinc-800 p-0 flex flex-col z-[1000]"
      >
        {/* ── HEADER ── */}
        <SheetHeader className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/60 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl select-none">{country.flag}</span>
              <div>
                <SheetTitle className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                  {country.name}
                  <span className="text-xs font-mono text-zinc-500 font-normal">
                    ({country.code})
                  </span>
                </SheetTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge
                    variant={country.riskVariant || "red"}
                    className="text-[11px] h-5"
                  >
                    {country.riskBadge}
                  </Badge>
                  <span className="text-[11px] text-zinc-400">
                    Cross-Border Gateway
                  </span>
                </div>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* ── TABS NAVIGATION ── */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-3 bg-zinc-950/30 border-b border-zinc-800/80">
            <TabsList className="grid grid-cols-4 w-full bg-zinc-950 border border-zinc-800 h-9">
              <TabsTrigger value="overview" className="text-xs">
                Overview
              </TabsTrigger>
              <TabsTrigger value="ips" className="text-xs">
                IPs ({ips?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="asns" className="text-xs">
                ASNs
              </TabsTrigger>
              <TabsTrigger value="txs" className="text-xs">
                Transactions
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 p-6">
            {/* ── 1. OVERVIEW TAB ── */}
            <TabsContent value="overview" className="mt-0 space-y-5">
              {/* Stat Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-950/70 p-3.5 rounded-xl border border-zinc-800 space-y-1">
                  <span className="text-xs text-zinc-400">Total Origin IPs:</span>
                  <div className="text-xl font-mono font-bold text-zinc-100">
                    {overview.totalIps.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Flagged:{" "}
                    <span className="text-red-400 font-semibold font-mono">
                      {overview.flaggedIps.toLocaleString()} ({overview.flaggedIpsPct})
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-950/70 p-3.5 rounded-xl border border-zinc-800 space-y-1">
                  <span className="text-xs text-zinc-400">Total Transactions:</span>
                  <div className="text-xl font-mono font-bold text-blue-400">
                    {overview.totalTx.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Flagged Volume:{" "}
                    <span className="text-amber-400 font-semibold font-mono">
                      {overview.flaggedTx.toLocaleString()} txs
                    </span>
                  </div>
                </div>
              </div>

              {/* Top ASNs breakdown */}
              <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800 space-y-2.5">
                <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-blue-400" />
                  Top Autonomous Systems (ASN Share)
                </div>
                <div className="space-y-2">
                  {overview.topAsns.map((asn, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-300 font-medium">{asn.name}</span>
                        <span className="text-zinc-400 font-mono">{asn.pct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${asn.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mini Risk Trend (Last 7 Days) */}
              <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-red-400" />
                    7-Day Anomaly Risk Trend
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono">Daily Mean</span>
                </div>
                <div className="h-28 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={overview.riskTrend}>
                      <XAxis
                        dataKey="day"
                        stroke="#71717a"
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={[0.5, 1.0]}
                        stroke="#71717a"
                        tick={{ fill: "#71717a", fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          borderColor: "#3f3f46",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="risk"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#ef4444" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>

            {/* ── 2. IPS TAB ── */}
            <TabsContent value="ips" className="mt-0 space-y-3">
              <div className="text-xs text-zinc-400">
                Identified node addresses with high outbound transaction frequency:
              </div>
              <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/50">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-950 text-zinc-400 font-medium border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">IP Address</th>
                      <th className="py-2.5 px-3">Tx Count</th>
                      <th className="py-2.5 px-3">Risk</th>
                      <th className="py-2.5 px-3">Wallets</th>
                      <th className="py-2.5 px-3">First Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono">
                    {ips.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-2.5 px-3 text-zinc-200 font-semibold">
                          {item.ip}
                        </td>
                        <td className="py-2.5 px-3 text-blue-400">{item.txCount}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={
                              item.risk >= 0.85
                                ? "text-red-400 font-bold"
                                : "text-amber-400"
                            }
                          >
                            {item.risk.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-violet-400">
                          {item.walletsUsed}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-500 font-sans text-[11px]">
                          {item.firstSeen}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── 3. ASNS TAB ── */}
            <TabsContent value="asns" className="mt-0 space-y-4">
              {/* Donut Chart */}
              <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800 flex flex-col items-center">
                <span className="text-xs font-semibold text-zinc-300 mb-2">
                  ASN Infrastructure Distribution
                </span>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={asnDistribution}
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {asnDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          borderColor: "#3f3f46",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-3 text-[11px] text-zinc-400">
                  {asnDistribution.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                      <span>{item.name} ({item.value}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ASN Table */}
              <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/50">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-950 text-zinc-400 font-medium border-b border-zinc-800">
                    <tr>
                      <th className="py-2 px-3">ASN</th>
                      <th className="py-2 px-3">Org Name</th>
                      <th className="py-2 px-3">IP Count</th>
                      <th className="py-2 px-3">Flagged %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono">
                    {asnTable.map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 text-amber-400 font-semibold">{row.asn}</td>
                        <td className="py-2 px-3 font-sans text-zinc-300">{row.org}</td>
                        <td className="py-2 px-3 text-blue-400">{row.ipCount}</td>
                        <td className="py-2 px-3 text-red-400">{row.flaggedPct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── 4. TRANSACTIONS TAB ── */}
            <TabsContent value="txs" className="mt-0 space-y-3">
              <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/50">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-950 text-zinc-400 font-medium border-b border-zinc-800">
                    <tr>
                      <th className="py-2.5 px-3">TXID</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Risk</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Flagged Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                    {transactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/30">
                        <td className="py-2.5 px-3 text-blue-400 font-semibold">
                          {tx.txid}
                        </td>
                        <td className="py-2.5 px-3 text-amber-400">{tx.amount}</td>
                        <td className="py-2.5 px-3 text-red-400 font-bold">{tx.risk}</td>
                        <td className="py-2.5 px-3 text-zinc-400 font-sans">{tx.timestamp}</td>
                        <td className="py-2.5 px-3 text-zinc-300 font-sans italic">
                          {tx.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* ── FOOTER ── */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-3 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/graph?focus=${country.code}`)}
            className="flex-1 text-xs gap-1.5 border-zinc-700 text-zinc-200 hover:text-white hover:bg-zinc-800"
          >
            <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
            Explore in Graph
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(`/alerts?country=${country.code}`)}
            className="flex-1 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            View Country Alerts
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
