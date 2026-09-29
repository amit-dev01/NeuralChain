import { X, Shield, Download, FileText, Globe, Printer } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip as RechartsTooltip,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  SHAP_MODEL_SUMMARY,
  SAMPLE_TOP_ALERTS,
} from "@/data/reportsMockData"

export default function ReportPreviewPane({
  reportData,
  onClose,
  onDownload,
}) {
  if (!reportData) return null

  const title = reportData.title || "Q2 2025 Ransomware & Mixer Investigation"
  const analyst = reportData.analyst || "Special Agent V. Sharma (NTRO ID: #8491)"
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const dateFrom = reportData.dateFrom ? reportData.dateFrom.replace("T", " ") : "2026-09-20 00:00"
  const dateTo = reportData.dateTo ? reportData.dateTo.replace("T", " ") : "2026-09-30 00:00"
  const sections = reportData.sections || {}

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-700/80 shadow-2xl p-6 space-y-4 animate-in fade-in-50 duration-300">
      {/* ── TOP ACTION BAR ── */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-400" />
          <h2 className="text-base font-bold text-zinc-100">Report Preview</h2>
          <Badge variant="blue" className="text-[11px] h-5 ml-1">
            Simulated A4 PDF Print Layout
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => onDownload(reportData)}
            className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Download {reportData.outputFormat || "PDF"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full"
            title="Close Preview"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── A4 PAPER CONTAINER (bg-white text-zinc-900 centered) ── */}
      <div className="max-h-[750px] overflow-y-auto p-4 bg-zinc-950/80 rounded-xl border border-zinc-800/80 flex justify-center scrollbar-thin scrollbar-thumb-zinc-700">
        <div className="w-full max-w-4xl bg-white text-zinc-900 p-8 sm:p-12 rounded-lg shadow-2xl space-y-8 font-sans border border-zinc-200">
          {/* ── A) HEADER ── */}
          {reportData.includeBranding !== false && (
            <div className="flex items-start justify-between border-b-2 border-zinc-900 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xl font-black text-amber-600 tracking-tight">
                    SIH26146
                  </span>
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-500 border border-zinc-400 px-1.5 py-0.5 rounded">
                    NTRO INTELLIGENCE
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mt-1">
                  AI-Powered Bitcoin Forensic Intelligence Platform
                </p>
              </div>

              <div className="text-right text-xs text-zinc-600 space-y-0.5">
                <div>
                  <strong>Document:</strong> FOR-REP-{Math.floor(Math.random() * 8999 + 1000)}
                </div>
                <div>
                  <strong>Date:</strong> {dateStr}
                </div>
                <div>
                  <strong>Analyst:</strong> {analyst}
                </div>
                <div>
                  <span className="inline-block bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded text-[10px] mt-1 border border-red-300">
                    CLASSIFIED // LAW ENFORCEMENT ONLY
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Title Header */}
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-zinc-950 tracking-tight">
              {title}
            </h1>
            <p className="text-xs text-zinc-600">
              Investigation Window: <span className="font-mono font-medium">{dateFrom}</span> to{" "}
              <span className="font-mono font-medium">{dateTo}</span> • Risk Threshold:{" "}
              <span className="font-mono font-bold text-red-600">
                ≥ {reportData.riskThreshold?.toFixed(2) || "0.50"}
              </span>
            </p>
          </div>

          {/* ── B) EXECUTIVE SUMMARY ── */}
          {sections.execSummary !== false && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-200 pb-1">
                1. Executive Summary
              </h3>
              <p className="text-xs leading-relaxed text-zinc-700 bg-zinc-50 p-4 rounded border border-zinc-200">
                Analysis of 10,000 transactions from {dateFrom} to {dateTo} identified{" "}
                <strong>247 high-risk alerts</strong> across <strong>83 unique entities</strong>.
                Primary patterns detected include ransomware payment channels (XGBoost,
                F1=0.961), mixing/tumbling (LSTM, 34 chains), and peel chains (Cypher, 127
                detected). Network egress concentrates heavily within Tor exit nodes in Germany
                (AS9009) and bulletproof hosting infrastructure in the Netherlands (AS44558).
              </p>
            </div>
          )}

          {/* ── C) KPI STATS TABLE ── */}
          {sections.kpiTable !== false && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-200 pb-1">
                2. Key Performance Indicators
              </h3>
              <div className="overflow-hidden rounded border border-zinc-300">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-300">
                    <tr>
                      <th className="p-2.5">Total Volume Analyzed</th>
                      <th className="p-2.5">Unique Wallets Flagged</th>
                      <th className="p-2.5">High-Risk Alerts</th>
                      <th className="p-2.5">Mixing Cascades</th>
                      <th className="p-2.5">Model Confidence (F1)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 font-mono text-zinc-800">
                    <tr>
                      <td className="p-2.5 font-bold">142.80 BTC</td>
                      <td className="p-2.5">83 entities</td>
                      <td className="p-2.5 text-red-600 font-bold">247</td>
                      <td className="p-2.5">34 chains</td>
                      <td className="p-2.5 text-emerald-700 font-bold">97.4%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── D) TOP 10 ALERTS TABLE ── */}
          {sections.alertTable !== false && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-200 pb-1">
                3. Top Ranked Anomaly Alerts
              </h3>
              <div className="overflow-hidden rounded border border-zinc-300">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-zinc-100 text-zinc-700 font-bold border-b border-zinc-300">
                    <tr>
                      <th className="p-2">Alert ID</th>
                      <th className="p-2">Risk</th>
                      <th className="p-2">Target Wallet</th>
                      <th className="p-2">Detected Pattern</th>
                      <th className="p-2">Model</th>
                      <th className="p-2">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 font-mono">
                    {SAMPLE_TOP_ALERTS.map((alert, i) => (
                      <tr key={i} className={i % 2 === 1 ? "bg-zinc-50" : ""}>
                        <td className="p-2 font-bold text-blue-700">{alert.id}</td>
                        <td className="p-2">
                          <span
                            className={`font-bold ${
                              alert.risk >= 0.9 ? "text-red-600" : "text-amber-600"
                            }`}
                          >
                            {alert.risk.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-2 text-zinc-900">{alert.wallet}</td>
                        <td className="p-2 font-sans text-zinc-700">{alert.pattern}</td>
                        <td className="p-2 text-zinc-600">{alert.model}</td>
                        <td className="p-2 font-bold text-zinc-900">{alert.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── E) SHAP FEATURE IMPORTANCE ── */}
          {sections.shapFeature !== false && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-200 pb-1">
                4. SHAP Feature Attribution (Model-Level)
              </h3>
              <p className="text-[11px] text-zinc-600">
                Global Shapley feature attribution coefficients across all classified anomaly alerts.
              </p>
              <div className="h-44 w-full bg-zinc-50 p-2 rounded border border-zinc-200">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={SHAP_MODEL_SUMMARY}
                    margin={{ top: 4, right: 20, left: 90, bottom: 4 }}
                  >
                    <XAxis
                      type="number"
                      domain={[0, 1]}
                      stroke="#71717a"
                      tick={{ fill: "#52525b", fontSize: 9 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="feature"
                      stroke="#71717a"
                      tick={{ fill: "#18181b", fontSize: 10, fontWeight: 600 }}
                      width={90}
                    />
                    <Bar dataKey="importance" radius={[0, 3, 3, 0]}>
                      {SHAP_MODEL_SUMMARY.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── F) GEOGRAPHIC & GRAPH SUMMARY ── */}
          {sections.geoDistribution !== false && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-200 pb-1">
                5. Geographic Distribution & Cross-Border Topology
              </h3>
              <div className="bg-zinc-100 border border-dashed border-zinc-400 p-6 rounded-lg text-center space-y-2">
                <Globe className="h-8 w-8 text-blue-600 mx-auto" />
                <div className="text-xs font-bold text-zinc-800">
                  Global IP Origin & Transaction Flow Map Capture
                </div>
                <p className="text-[11px] text-zinc-600 max-w-md mx-auto">
                  High density clusters: Russia (1,847 IPs), Germany (1,420 IPs), USA (1,290 IPs),
                  Netherlands (1,180 IPs). High-concurrency Tor exit routing identified across AS9009.
                </p>
                <div className="text-[10px] text-zinc-400 italic">
                  [Rendered high-resolution CartoDB map screenshot included in official PDF export]
                </div>
              </div>
            </div>
          )}

          {/* ── G) ANALYST NOTES ── */}
          {reportData.analystNotes && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-800 border-b border-zinc-200 pb-1">
                6. Field Investigator Notes
              </h3>
              <blockquote className="border-l-4 border-amber-500 bg-amber-50/60 p-3.5 text-xs text-zinc-800 italic rounded-r">
                "{reportData.analystNotes}"
              </blockquote>
            </div>
          )}

          {/* ── H) FOOTER ── */}
          <div className="pt-6 border-t border-zinc-300 text-center text-[10px] text-zinc-500 space-y-1">
            <div>
              Generated by <strong>SIH26146 AI Transaction Monitoring System</strong> | Confidential
            </div>
            <div>
              National Technical Research Organisation (NTRO) • All rights reserved • Law Enforcement Sensitive
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
