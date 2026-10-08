import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search,
  Zap,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  GitFork,
  FileText,
  Copy,
  CheckCircle2,
  Loader2,
  X,
  AlertTriangle,
  Wallet,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { investigateAddress } from "@/api/client"

const PRESETS = [
  { label: "Silk Road Seizure", address: "1F1tAaz5x1HUXrCNLbtMDqcw6o5GNn4xqX", type: "Darknet" },
  { label: "Bitfinex Hack", address: "1C2DHN5jXnswBqE7c1b5H5UqV5R3Yv3Wb", type: "Heist" },
  { label: "WannaCry Ransomware", address: "115p7UMMngoj1pMvkpHijcRdfJNXj6LrLn", type: "Ransomware" },
  { label: "Satoshi Genesis", address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", type: "Benchmark" },
]

export default function AddressLookupCard({ onAnalyzed, className = "" }) {
  const navigate = useNavigate()
  const [addressInput, setAddressInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleLookup = async (targetAddr) => {
    const addr = (targetAddr || addressInput).trim()
    if (!addr) return

    setAddressInput(addr)
    setLoading(true)
    setErrorMessage("")
    setStatusMessage("Querying live Bitcoin mainnet via Mempool explorer...")

    setTimeout(() => {
      setStatusMessage("Extracting UTXO graph & scoring 4-Tier ML Ensemble...")
    }, 700)

    setTimeout(() => {
      setStatusMessage("Synthesizing court-admissible profile with Gemma 4...")
    }, 1400)

    try {
      const data = await investigateAddress(addr)
      setResult(data)
      if (onAnalyzed) onAnalyzed(data)
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || "Failed to investigate address"
      setErrorMessage(typeof detail === "string" ? detail : JSON.stringify(detail))
      console.error("Address investigation error:", err)
    } finally {
      setLoading(false)
      setStatusMessage("")
    }
  }

  const copyBrief = () => {
    if (result?.ai_summary) {
      navigator.clipboard.writeText(result.ai_summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const riskColor = (score) => {
    if (score >= 0.8) return "text-red-400 bg-red-500/10 border-red-500/30"
    if (score >= 0.6) return "text-amber-400 bg-amber-500/10 border-amber-500/30"
    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
  }

  return (
    <Card className={`editorial-surface border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 ${className}`}>
      {/* ── CARD HEADER ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-display font-medium text-white flex items-center gap-2">
              Instant Target Address Investigation
              <span className="text-[10px] font-mono font-normal text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/25">
                NO CSV NEEDED
              </span>
            </h2>
            <p className="text-xs text-zinc-400 font-light">
              Enter any Bitcoin address to instantly pull on-chain history, evaluate risk, and synthesize a Gemma 4 brief.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Mempool Live Sync
        </div>
      </div>

      {/* ── INPUT ROW ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="Paste Bitcoin address (e.g., 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa or bc1q...)"
              className="w-full bg-slate-900/90 border border-white/10 focus:border-amber-500/50 rounded-xl pl-10 pr-9 py-2.5 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-all"
            />
            {addressInput && (
              <button
                onClick={() => setAddressInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            onClick={() => handleLookup()}
            disabled={loading || !addressInput.trim()}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-xs px-5 py-2.5 rounded-xl h-auto shrink-0 shadow-lg shadow-amber-500/10 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Analyzing Target...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Investigate
              </>
            )}
          </Button>
        </div>

        {/* ── QUICK PRESET BUTTONS ── */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[11px] text-zinc-500 font-mono">Quick Targets:</span>
          {PRESETS.map((p) => (
            <button
              key={p.address}
              onClick={() => handleLookup(p.address)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 hover:border-white/20 transition-all text-[11px] font-mono flex items-center gap-1.5 group cursor-pointer"
            >
              <span>{p.label}</span>
              <span className="text-[9px] text-zinc-500 group-hover:text-amber-400">({p.type})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── LOADING STATUS BANNER ── */}
      {loading && (
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/20 text-xs text-amber-200 flex items-center gap-3 animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-amber-400 shrink-0" />
          <span className="font-mono text-[11px]">{statusMessage}</span>
        </div>
      )}

      {/* ── ERROR MESSAGE BANNER ── */}
      {errorMessage && !loading && (
        <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <span className="font-mono text-[11px]">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage("")} className="text-zinc-500 hover:text-zinc-200 cursor-pointer">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── RESULT DOSSIER ── */}
      {result && !loading && (
        <div className="p-5 rounded-xl bg-slate-900/60 border border-white/10 space-y-4 animate-in fade-in slide-in-from-top-2">
          {/* Header Stats */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-white/5">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-zinc-400" />
                <code className="text-xs font-mono font-semibold text-white">{result.address}</code>
                <Badge variant="outline" className="text-[10px] font-mono text-zinc-400">
                  {result.script_type}
                </Badge>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                On-Chain Ingest ID: <span className="font-mono text-zinc-400">{result.dataset_id}</span> • {result.tx_count} Transactions Indexed
              </p>
            </div>

            <div className={`px-3 py-1 rounded-full border font-mono text-xs font-semibold ${riskColor(result.risk_score)}`}>
              Risk Score: {(result.risk_score * 100).toFixed(0)}% ({result.risk_level.toUpperCase()})
            </div>
          </div>

          {/* Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Balance</span>
              <p className="text-sm font-mono font-semibold text-zinc-100">{result.final_balance_btc} BTC</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Received</span>
              <p className="text-sm font-mono font-semibold text-emerald-400">+{result.total_received_btc} BTC</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Sent</span>
              <p className="text-sm font-mono font-semibold text-rose-400">-{result.total_sent_btc} BTC</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Typologies</span>
              <div className="flex flex-wrap gap-1">
                {result.typologies?.map((t) => (
                  <span key={t} className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                    {t.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Gemma 4 AI Summary Box */}
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Gemma 4 Forensic Suspect Profile
              </div>
              <button
                onClick={copyBrief}
                className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                {copied ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans whitespace-pre-line">
              {result.ai_summary}
            </p>
          </div>

          {/* Action Navigation Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/graph?search=${result.address}`)}
              className="text-xs rounded-xl border-white/10 hover:bg-white/10 text-zinc-200"
            >
              <GitFork className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
              Open Ego-Network Graph
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/alerts")}
              className="text-xs rounded-xl border-white/10 hover:bg-white/10 text-zinc-200"
            >
              <ShieldAlert className="h-3.5 w-3.5 mr-1.5 text-red-400" />
              View Alert Dossier
            </Button>

            <Button
              size="sm"
              onClick={() => navigate("/reports")}
              className="text-xs rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Export Dossier (§65B)
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
