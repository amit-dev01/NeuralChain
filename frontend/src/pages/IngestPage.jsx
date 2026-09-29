import { useState, useEffect, useRef, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation } from "@tanstack/react-query"
import axios from "axios"
import { Link, useNavigate } from "react-router-dom"
import {
  UploadCloud, FileText, X, CheckCircle2, Circle,
  Loader2, Network, Trash2, ChevronRight, Database,
  AlertTriangle, Check,
} from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import AppHeader from "@/components/common/AppHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
  Select, SelectTrigger, SelectContent,
  SelectItem, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogFooter, AlertDialogTitle,
  AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  Table, TableHeader, TableBody, TableRow,
  TableHead, TableCell,
} from "@/components/ui/table"

// ─── Zod schema ───────────────────────────────────────────────────────────────
const ingestSchema = z.object({
  label: z.string().min(1, "Dataset label is required"),
  sourceType: z.string().min(1, "Select a source type"),
  timestampFormat: z.string().min(1, "Select timestamp format"),
  deduplicate: z.boolean(),
  geoip: z.boolean(),
  autoRunML: z.boolean(),
})

// ─── Constants ────────────────────────────────────────────────────────────────
const STEPS = ["Uploading", "Parsing", "Validating", "Enriching", "Complete"]

const LOG_MESSAGES = [
  "[{t}] ▶ Starting ingestion pipeline...",
  "[{t}] Uploading file to server (chunk 1/4)...",
  "[{t}] Uploading file to server (chunk 2/4)...",
  "[{t}] Uploading file to server (chunk 3/4)...",
  "[{t}] Upload complete. File received by server.",
  "[{t}] Parsing row 1 / 10000...",
  "[{t}] Parsing row 1240 / 10000...",
  "[{t}] Parsing row 4800 / 10000...",
  "[{t}] Parsing row 8500 / 10000...",
  "[{t}] Parsing complete. 10,000 rows read.",
  "[{t}] Starting schema validation...",
  "[{t}] ⚠ input_addresses: 3 rows contain empty arrays (flagged)",
  "[{t}] Schema validation passed (9,997 rows clean).",
  "[{t}] Deduplication: 142 duplicate TXIDs removed.",
  "[{t}] Deduplication: 37 duplicate TXIDs in this batch removed.",
  "[{t}] GeoIP enrichment: resolving 9,823 unique IPs...",
  "[{t}] GeoIP enrichment: 9,441 IPs resolved (382 private/unroutable).",
  "[{t}] Storing 9,963 transactions to PostgreSQL...",
  "[{t}] Building Neo4j graph nodes (wallets, IPs, TXIDs)...",
  "[{t}] ✓ Ingestion complete. 9,963 transactions stored.",
]

const SCHEMA_FIELDS = [
  { field: "txid",             type: "string[64]",  status: "ok",   note: "" },
  { field: "timestamp",        type: "ISO 8601",    status: "ok",   note: "" },
  { field: "input_addresses",  type: "array",       status: "warn", note: "3 rows empty" },
  { field: "output_addresses", type: "array",       status: "ok",   note: "" },
  { field: "fee",              type: "float",       status: "ok",   note: "" },
  { field: "src_ip",           type: "string(IP)",  status: "ok",   note: "" },
  { field: "input_amounts",    type: "float[]",     status: "ok",   note: "" },
  { field: "script_type",      type: "enum",        status: "warn", note: "2 unknown values" },
]

const PAST_UPLOADS = [
  { id: 1, label: "BTC_dump_2024_Q4",  type: "CSV",  rows: 48210, uploaded: "2026-09-28 18:32", status: "ok" },
  { id: 2, label: "darknet_osint_feed", type: "JSON", rows: 12033, uploaded: "2026-09-27 11:05", status: "ok" },
  { id: 3, label: "exchange_export_BN", type: "CSV",  rows: 91040, uploaded: "2026-09-25 09:14", status: "ok" },
  { id: 4, label: "synthetic_test_v3",  type: "XML",  rows: 10000, uploaded: "2026-09-24 21:50", status: "ok" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getTypeBadge(name) {
  const ext = name.split(".").pop()?.toLowerCase()
  if (ext === "csv")  return <Badge variant="green">CSV</Badge>
  if (ext === "json") return <Badge variant="blue">JSON</Badge>
  if (ext === "xml")  return <Badge variant="amber">XML</Badge>
  return <Badge>Unknown</Badge>
}

function nowStr() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false })
}

function StatusIcon({ status }) {
  if (status === "ok")   return <Check className="h-4 w-4 text-emerald-400" />
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-400" />
  return <X className="h-4 w-4 text-red-400" />
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function Stepper({ currentStep }) {
  return (
    <div className="flex items-center gap-0 w-full" aria-label="Upload progress steps">
      {STEPS.map((step, i) => {
        const done   = i < currentStep
        const active = i === currentStep
        return (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              {/* Circle */}
              <div className="relative flex items-center justify-center">
                {active && (
                  <span className="absolute inline-flex h-8 w-8 rounded-full bg-blue-500/30 animate-ping" />
                )}
                <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold border-2 transition-all
                  ${done   ? "bg-emerald-500 border-emerald-500 text-white"
                  : active ? "bg-blue-500 border-blue-400 text-white"
                           : "bg-zinc-800 border-zinc-600 text-zinc-400"}`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap
                ${done ? "text-emerald-400" : active ? "text-blue-400" : "text-zinc-500"}`}>
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-[2px] mb-4 mx-1 transition-all
                ${i < currentStep ? "bg-emerald-500" : "bg-zinc-700"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Badge variant for file type badge (XML=amber needs custom) ───────────────
// Extend the Badge component inline
function TypeBadge({ ext }) {
  const map = { csv: "green", json: "blue", xml: "amber" }
  return <Badge variant={map[ext] || "default"}>{ext?.toUpperCase()}</Badge>
}

// ═══════════════════════════════════════════════════════════════════════════════
// INGEST PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function IngestPage() {
  const navigate = useNavigate()

  // ── Form ──
  const { control, register, handleSubmit, watch, formState: { errors } } = useForm({
    resolver: zodResolver(ingestSchema),
    defaultValues: {
      label: "",
      sourceType: "",
      timestampFormat: "",
      deduplicate: true,
      geoip: true,
      autoRunML: false,
    },
  })

  // ── File state ──
  const [file, setFile]             = useState(null)
  const [toast, setToast]           = useState(null)
  const [uploadPhase, setUploadPhase] = useState(null) // null | "running" | "done" | "error"
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress]     = useState(0)
  const [logs, setLogs]             = useState([])
  const [pastUploads, setPastUploads] = useState(PAST_UPLOADS)
  const logRef = useRef(null)

  // ── Auto-scroll log ──
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  // ── Toast helper ──
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ── Dropzone ──
  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv":        [".csv"],
      "application/json":[".json"],
      "text/xml":        [".xml"],
      "application/xml": [".xml"],
    },
    maxSize: 500 * 1024 * 1024,
    multiple: false,
  })

  // ── Simulated upload pipeline ──
  function simulateUpload() {
    setUploadPhase("running")
    setCurrentStep(0)
    setProgress(0)
    setLogs([])

    let logIdx  = 0
    let prog    = 0
    let stepVal = 0

    const STEP_THRESHOLDS = [20, 45, 65, 85, 100]

    const interval = setInterval(() => {
      prog = Math.min(prog + Math.random() * 4 + 1, 100)
      setProgress(Math.floor(prog))

      const newStep = STEP_THRESHOLDS.findIndex(t => prog <= t)
      setCurrentStep(newStep === -1 ? 4 : newStep)

      if (logIdx < LOG_MESSAGES.length) {
        setLogs(prev => [...prev, LOG_MESSAGES[logIdx].replace("{t}", nowStr())])
        logIdx++
      }

      if (prog >= 100) {
        clearInterval(interval)
        setCurrentStep(4)
        setUploadPhase("done")
        showToast("Dataset ingested successfully. 9,963 transactions added.")
      }
    }, 280)
  }

  // ── React Query mutation ──
  // TODO: POST /api/v1/ingest/upload
  const mutation = useMutation({
    mutationFn: async (formData) => {
      // Demo: simulate upload instead of real API call
      // Real: return axios.post("/api/v1/ingest/upload", formData, { headers: { "Content-Type": "multipart/form-data" } })
      return new Promise((res) => setTimeout(res, 200))
    },
    onSuccess: () => simulateUpload(),
    onError: (err) => showToast(err?.response?.data?.detail || "Upload failed", "error"),
  })

  const onSubmit = (values) => {
    if (!file) { showToast("Please select a file first.", "error"); return }
    const fd = new FormData()
    fd.append("file", file)
    fd.append("label", values.label)
    fd.append("source_type", values.sourceType)
    fd.append("timestamp_format", values.timestampFormat)
    fd.append("deduplicate", values.deduplicate)
    fd.append("geoip", values.geoip)
    fd.append("auto_run_ml", values.autoRunML)
    mutation.mutate(fd)
  }

  const handleDelete = (id) => {
    setPastUploads(prev => prev.filter(u => u.id !== id))
    showToast("Dataset removed.")
  }

  const fileExt = file?.name?.split(".").pop()?.toLowerCase()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 editorial-glow selection:bg-amber-500/20">

      {/* ── TOAST ── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 rounded-2xl px-5 py-3 text-sm shadow-2xl border backdrop-blur-xl transition-all
          ${toast.type === "error"
            ? "bg-slate-900/90 border-red-500/50 text-red-300"
            : "bg-slate-900/90 border-emerald-500/50 text-emerald-300"}`}>
          {toast.type === "error"
            ? <X className="h-4 w-4 text-red-400" />
            : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          {toast.msg}
        </div>
      )}

      {/* ── UNIFIED APP HEADER ── */}
      <AppHeader />

      <main className="mx-auto max-w-screen-xl px-6 py-8 space-y-8">

        {/* ── BREADCRUMB + TITLE ── */}
        <div className="pb-2 border-b border-white/5">
          <nav className="flex items-center gap-1.5 text-xs text-zinc-400 mb-2" aria-label="Breadcrumb">
            <Link to="/overview" className="hover:text-white transition-colors">Dashboard</Link>
            <ChevronRight className="h-3 w-3 text-zinc-600" />
            <span className="text-zinc-200 font-medium">Ingest</span>
          </nav>
          <h1 className="font-display text-3xl sm:text-4xl font-normal text-white tracking-tight">
            Upload Transaction <span className="font-serif italic text-zinc-400 font-light">Dataset</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl font-light tracking-wide">
            Accepts CSV, JSON, or XML bulk files. Schema is validated automatically. Duplicates are deduplicated by TXID.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

          {/* ══════════════════════════════════════════════════════════
              SECTION 1: DROP ZONE
          ══════════════════════════════════════════════════════════ */}
          <div className="editorial-surface rounded-2xl border border-white/10 shadow-xl overflow-hidden p-6">
            <div
              {...getRootProps()}
              className={`min-h-64 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 p-8
                ${isDragActive
                  ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
                  : "border-white/15 bg-slate-900/60 hover:border-blue-400/60 hover:bg-slate-900/90"}`}
            >
              <input {...getInputProps()} />
              <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <UploadCloud className={`h-8 w-8 transition-colors ${isDragActive ? "text-blue-400" : "text-blue-400/80"}`} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-base font-medium text-zinc-200">
                  {isDragActive ? "Drop file now" : "Drag & drop your transaction dataset here"}
                </p>
                <p className="text-xs text-zinc-500 font-light">or click to browse from system</p>
              </div>
              <button
                type="button"
                className="rounded-full px-5 py-2 text-xs font-medium text-zinc-300 bg-white/5 border border-white/15 hover:bg-white/10 hover:border-white/30 transition-all pointer-events-none"
              >
                Browse Files
              </button>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">.csv &nbsp; · &nbsp; .json &nbsp; · &nbsp; .xml — max 500 MB</p>
            </div>

            {/* Selected file card */}
            {file && (
              <div className="mt-4 flex items-center gap-3 bg-slate-900/90 border border-white/15 rounded-xl px-4 py-3 shadow-lg">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate">{file.name}</p>
                  <p className="text-[11px] text-zinc-500 font-mono">{formatBytes(file.size)}</p>
                </div>
                <TypeBadge ext={fileExt} />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════
              SECTION 2: CONFIGURATION OPTIONS
          ══════════════════════════════════════════════════════════ */}
          <div className="editorial-surface rounded-2xl border border-white/10 shadow-xl p-6">
            <div className="pb-4 mb-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Database className="h-4 w-4 text-blue-400" />
                </div>
                <h2 className="font-display text-xl font-normal text-white tracking-tight">
                  Upload Configuration
                </h2>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">PARAM_CONFIG</span>
            </div>

            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Left column */}
                <div className="space-y-5">
                  {/* Dataset Label */}
                  <div className="space-y-2">
                    <Label htmlFor="label" className="text-xs text-zinc-400 uppercase tracking-wider">Dataset Label</Label>
                    <Input
                      id="label"
                      placeholder="e.g. BTC_dump_2025_Q2"
                      {...register("label")}
                      className="bg-slate-900/80 border-white/10 text-white focus:border-blue-500/60 rounded-xl"
                    />
                    {errors.label && (
                      <p className="text-xs text-red-400">{errors.label.message}</p>
                    )}
                  </div>

                  {/* Source Type */}
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400 uppercase tracking-wider">Source Type</Label>
                    <Controller
                      name="sourceType"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="bg-slate-900/80 border-white/10 text-white rounded-xl">
                            <SelectValue placeholder="Select source type…" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-white/10">
                            <SelectItem value="mempool">Raw Bitcoin Mempool</SelectItem>
                            <SelectItem value="exchange">Exchange Export</SelectItem>
                            <SelectItem value="osint">OSINT Feed</SelectItem>
                            <SelectItem value="synthetic">Synthetic</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.sourceType && (
                      <p className="text-xs text-red-400">{errors.sourceType.message}</p>
                    )}
                  </div>

                  {/* Timestamp Format */}
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400 uppercase tracking-wider">Timestamp Format</Label>
                    <Controller
                      name="timestampFormat"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="bg-slate-900/80 border-white/10 text-white rounded-xl">
                            <SelectValue placeholder="Select format…" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-white/10">
                            <SelectItem value="iso8601">ISO 8601</SelectItem>
                            <SelectItem value="unix_ms">Unix Epoch (ms)</SelectItem>
                            <SelectItem value="unix_s">Unix Epoch (s)</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {/* Right column: Switches */}
                <div className="space-y-4">
                  <Controller name="deduplicate" control={control} render={({ field }) => (
                    <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-white/10 hover:border-white/20 transition-all">
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">Deduplication</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Filter duplicate transactions by TXID hash</p>
                      </div>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  )} />

                  <Controller name="geoip" control={control} render={({ field }) => (
                    <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-white/10 hover:border-white/20 transition-all">
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">GeoIP Enrichment</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Uses MaxMind GeoLite2 offline database</p>
                      </div>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  )} />

                  <Controller name="autoRunML" control={control} render={({ field }) => (
                    <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-900/80 border border-white/10 hover:border-white/20 transition-all">
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">Auto-run ML inference</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Queue all 4 models in Celery immediately</p>
                      </div>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  )} />
                </div>
              </div>

              {/* Submit button */}
              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={mutation.isPending || uploadPhase === "running"}
                  className="flex items-center gap-2.5 px-8 py-3 rounded-full text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:brightness-110 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25 hover:scale-105"
                >
                  {mutation.isPending || uploadPhase === "running"
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
                    : <><UploadCloud className="h-4 w-4" /> Start Ingestion Pipeline</>}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* ══════════════════════════════════════════════════════════
            SECTION 3: UPLOAD PROGRESS
        ══════════════════════════════════════════════════════════ */}
        {uploadPhase && (
          <div className="editorial-surface rounded-2xl border border-white/10 shadow-xl p-6">
            <div className="pb-4 mb-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Loader2 className={`h-4 w-4 ${uploadPhase === "running" ? "animate-spin text-blue-400" : "text-emerald-400"}`} />
                <h2 className="font-display text-xl font-normal text-white tracking-tight">
                  {uploadPhase === "done" ? "Ingestion Complete" : "Ingestion In Progress"}
                </h2>
              </div>
              <span className="font-mono text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
                {progress}%
              </span>
            </div>
            <div className="space-y-6">

              {/* Stepper */}
              <Stepper currentStep={currentStep} />

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>{STEPS[Math.min(currentStep, STEPS.length - 1)]}</span>
                  <span className="font-mono font-semibold text-blue-400">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>

              {/* Log terminal */}
              <div
                ref={logRef}
                className="bg-slate-950/95 rounded-xl border border-white/10 p-4 h-44 overflow-y-scroll font-mono text-xs text-emerald-400 space-y-1 shadow-inner"
                aria-live="polite"
                aria-label="Ingestion log"
              >
                {logs.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
                {uploadPhase === "running" && (
                  <p className="text-emerald-500 animate-pulse">▌</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            SECTION 4: SCHEMA VALIDATION RESULTS
        ══════════════════════════════════════════════════════════ */}
        {uploadPhase === "done" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Schema check table */}
            <div className="editorial-surface rounded-2xl border border-white/10 shadow-xl overflow-hidden">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <h2 className="font-display text-xl font-normal text-white tracking-tight">Schema Validation</h2>
                <span className="text-[10px] font-mono text-zinc-500">8 FIELDS</span>
              </div>
              <div className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-white/5 hover:bg-transparent">
                      <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400">Column</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400">Expected Type</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400 text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SCHEMA_FIELDS.map((row) => (
                      <TableRow key={row.field} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                        <TableCell>
                          <code className="font-mono text-xs text-zinc-300">{row.field}</code>
                        </TableCell>
                        <TableCell className="text-xs text-zinc-400">{row.type}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <StatusIcon status={row.status} />
                            {row.note && (
                              <span className="text-[10px] text-amber-400">{row.note}</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Summary stats */}
            <div className="editorial-surface rounded-2xl border border-white/10 shadow-xl p-6">
              <div className="pb-4 mb-4 border-b border-white/5 flex items-center justify-between">
                <h2 className="font-display text-xl font-normal text-white tracking-tight">Ingestion Summary</h2>
                <span className="text-[10px] font-mono text-emerald-400">STATUS: VERIFIED</span>
              </div>
              <div>
                <div className="space-y-3">
                  {[
                    ["Total rows parsed",         "10,000",  "text-zinc-200"],
                    ["Valid rows",                 "9,963",   "text-emerald-400"],
                    ["Skipped (schema error)",     "37",      "text-red-400"],
                    ["Unique TXIDs",               "9,821",   "text-zinc-200"],
                    ["Duplicate TXIDs removed",    "142",     "text-amber-400"],
                    ["IPs enriched via GeoIP",     "9,441",   "text-blue-400"],
                  ].map(([label, val, color]) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                      <span className="text-xs text-zinc-400">{label}</span>
                      <span className={`text-xs font-semibold font-mono ${color}`}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            SECTION 5: PAST UPLOADS TABLE
        ══════════════════════════════════════════════════════════ */}
        <div className="editorial-surface rounded-2xl border border-white/10 shadow-xl overflow-hidden">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Database className="h-4 w-4 text-zinc-400" />
              </div>
              <h2 className="font-display text-xl font-normal text-white tracking-tight">
                Previously Ingested Datasets
              </h2>
            </div>
            <span className="text-xs text-zinc-400 font-mono">{pastUploads.length} archives</span>
          </div>
          <div className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/5 hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400">Label</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400">File Type</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400">Rows</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400">Uploaded At</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-zinc-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastUploads.map((u) => (
                  <TableRow key={u.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <TableCell>
                      <span className="font-mono text-xs text-zinc-300 bg-slate-900/90 border border-white/10 px-2 py-0.5 rounded-md">{u.label}</span>
                    </TableCell>
                    <TableCell>
                      <TypeBadge ext={u.type.toLowerCase()} />
                    </TableCell>
                    <TableCell className="text-xs text-zinc-300 tabular-nums">
                      {u.rows.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500 font-mono">{u.uploaded}</TableCell>
                    <TableCell>
                      <Badge variant="green" className="rounded-full px-2.5 py-0.5 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Stored
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate("/graph")}
                          title="View in Graph"
                          className="h-8 w-8 text-zinc-400 hover:text-blue-400 rounded-full"
                        >
                          <Network className="h-4 w-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete dataset"
                              className="h-8 w-8 text-zinc-400 hover:text-red-400 rounded-full"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-slate-900 border-white/15">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-display text-xl text-white">Delete Dataset?</AlertDialogTitle>
                              <AlertDialogDescription className="text-zinc-400">
                                This will permanently remove <span className="font-mono text-zinc-300">"{u.label}"</span> and all associated graph nodes. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(u.id)} className="rounded-full bg-red-600 hover:bg-red-500">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

      </main>
    </div>
  )
}
