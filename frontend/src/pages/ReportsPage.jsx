import { useState, useRef } from "react"
import { Link } from "react-router-dom"
import {
  FileText,
  ChevronRight,
  LayoutDashboard,
  Upload,
  GitFork,
  Bell,
  Clock,
  Map,
  CheckCircle2,
  Sparkles,
  Loader2,
  Download,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"

import ReportBuilderForm from "@/components/Reports/ReportBuilderForm"
import ReportPreviewPane from "@/components/Reports/ReportPreviewPane"
import PastReportsTable from "@/components/Reports/PastReportsTable"
import QuickExportShortcuts from "@/components/Reports/QuickExportShortcuts"

import {
  PAST_REPORTS,
  triggerFileDownload,
  generateAlertsCsv,
  generateGraphJson,
  generateRawTransactionsCsv,
} from "@/data/reportsMockData"

const NAV_LINKS = [
  { label: "Dashboard", to: "/overview", icon: LayoutDashboard },
  { label: "Ingest",    to: "/ingest",   icon: Upload          },
  { label: "Graph",     to: "/graph",    icon: GitFork         },
  { label: "Alerts",    to: "/alerts",   icon: Bell            },
  { label: "Timeline",  to: "/timeline", icon: Clock           },
  { label: "GeoMap",    to: "/geomap",   icon: Map             },
  { label: "Reports",   to: "/reports",  icon: FileText        },
]

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS & EXPORT PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function ReportsPage() {
  // TODO: POST /api/v1/reports/generate { config: ReportConfig }
  // TODO: GET /api/v1/reports → list of past reports
  // TODO: GET /api/v1/reports/{id}/download
  // TODO: For PDF generation: use jspdf + html2canvas to capture preview pane or server-side Puppeteer stream

  const [reportsList, setReportsList] = useState(PAST_REPORTS)
  const [previewData, setPreviewData] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  // Generation progress modal state
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressVal, setProgressVal] = useState(0)
  const [progressStage, setProgressStage] = useState("Initializing compiler...")

  const previewRef = useRef(null)

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // ── Handle Preview ──
  const handlePreview = (formData) => {
    setPreviewData(formData)
    setTimeout(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth" })
    }, 100)
  }

  // ── Handle Generate & Download ──
  const handleGenerate = (formData) => {
    setIsGenerating(true)
    setProgressVal(15)
    setProgressStage("Aggregating 247 anomaly alerts across UTXO database...")

    setTimeout(() => {
      setProgressVal(45)
      setProgressStage("Calculating SHAP feature attribution distributions...")
    }, 600)

    setTimeout(() => {
      setProgressVal(67)
      setProgressStage("Rendering SHAP charts and topology graph...")
    }, 1200)

    setTimeout(() => {
      setProgressVal(90)
      setProgressStage("Compiling document layout and signatures...")
    }, 1800)

    setTimeout(() => {
      setProgressVal(100)
      setProgressStage("Report ready — packaging file...")

      setTimeout(() => {
        setIsGenerating(false)
        showToast("Report ready — downloading now.")

        // Trigger real client download based on format
        const format = formData.outputFormat || "PDF"
        const cleanTitle = (formData.title || "Report")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")

        if (format === "CSV") {
          const csvData = generateAlertsCsv()
          triggerFileDownload(`${cleanTitle}.csv`, csvData, "text/csv")
        } else if (format === "JSON") {
          const jsonData = generateGraphJson()
          triggerFileDownload(`${cleanTitle}.json`, jsonData, "application/json")
        } else {
          // PDF export mock
          const dummyPdfText = `%PDF-1.4\n1 0 obj\n<< /Title (${formData.title}) /Author (SIH26146 NeuralChain) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`
          triggerFileDownload(`${cleanTitle}.pdf`, dummyPdfText, "application/pdf")
        }

        // Add to past reports
        const newReport = {
          id: `REP-2026-${Math.floor(Math.random() * 899 + 100)}`,
          title: formData.title,
          type:
            formData.reportType === "full"
              ? "Full Investigation Report"
              : formData.reportType === "summary"
              ? "Alert Summary Report"
              : formData.reportType === "entity"
              ? "Entity Profile Report"
              : "Transaction Batch Export",
          dateGenerated: new Date().toISOString().slice(0, 16).replace("T", " "),
          alertsIncluded: 247,
          format: format,
          size: format === "PDF" ? "4.2 MB" : format === "CSV" ? "920 KB" : "1.8 MB",
          analyst: "Special Agent V. Sharma",
          notes: formData.analystNotes || "Generated from Report Builder",
          kpis: {
            volume: "142.8 BTC",
            entities: 83,
            alerts: 247,
            chains: 34,
            confidence: "97.4%",
          },
        }
        setReportsList((prev) => [newReport, ...prev])
      }, 500)
    }, 2400)
  }

  // ── Handle Save Template ──
  const handleSaveTemplate = (formData) => {
    showToast(`Template "${formData.title}" saved successfully.`)
  }

  // ── Handle Past Report Download ──
  const handleDownloadPastReport = (report) => {
    showToast(`Downloading archived report ${report.id}...`)
    if (report.format === "CSV") {
      const csvData = generateAlertsCsv()
      triggerFileDownload(`${report.id}_alerts.csv`, csvData, "text/csv")
    } else {
      const dummyPdf = `%PDF-1.4\n1 0 obj\n<< /Title (${report.title}) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`
      triggerFileDownload(`${report.id}_dossier.pdf`, dummyPdf, "application/pdf")
    }
  }

  // ── Handle Past Report Delete ──
  const handleDeleteReport = (id) => {
    setReportsList((prev) => prev.filter((r) => r.id !== id))
    showToast(`Report ${id} deleted from archive.`)
  }

  // ── Handle Quick Exports ──
  const handleQuickExport = (type) => {
    if (type === "alerts") {
      showToast("Generating Full Alerts CSV export...")
      const data = generateAlertsCsv()
      triggerFileDownload("neuralchain_alerts_export.csv", data, "text/csv")
    } else if (type === "graph") {
      showToast("Generating Force Graph JSON export...")
      const data = generateGraphJson()
      triggerFileDownload("neuralchain_graph_topology.json", data, "application/json")
    } else if (type === "transactions") {
      showToast("Generating Raw Transactions CSV export...")
      const data = generateRawTransactionsCsv()
      triggerFileDownload("neuralchain_raw_transactions.csv", data, "text/csv")
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] bg-zinc-900 border border-emerald-500/50 rounded-xl px-4 py-2.5 text-xs text-emerald-300 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── GENERATION PROGRESS MODAL ── */}
      <Dialog open={isGenerating} onOpenChange={setIsGenerating}>
        <DialogContent className="max-w-md bg-zinc-900 border-zinc-700">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
              Generating Investigation Report
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Assembling analytical charts, SHAP values, and network evidence...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-300 font-medium">{progressStage}</span>
              <span className="text-blue-400 font-bold">{progressVal}%</span>
            </div>
            <Progress value={progressVal} className="h-2 bg-zinc-800" />
            <div className="text-[11px] text-zinc-500 italic">
              Estimated export size: ~4.2 MB • Confidential cryptographic hash attached
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── STICKY TOPBAR HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto max-w-screen-2xl px-6 h-14 flex items-center gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <span className="font-mono text-lg font-bold text-amber-400 tracking-tight">
              SIH26146
            </span>
            <span className="hidden sm:block text-xs text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">
              NeuralChain
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 flex-1" aria-label="Main navigation">
            {NAV_LINKS.map(({ label, to, icon: Icon }) => {
              const isActive = to === "/reports"
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* System Status badge */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-zinc-400 hidden sm:block">
              All Systems Operational
            </span>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="mx-auto max-w-screen-2xl w-full px-6 py-6 space-y-8 flex-1">
        {/* ── PAGE HEADER ── */}
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Link to="/overview" className="hover:text-zinc-300 transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-zinc-300 font-medium">Reports</span>
          </nav>
          <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2.5 text-zinc-100">
                <FileText className="h-6 w-6 text-blue-400" />
                Reports & Export
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Generate detailed investigative reports for selected alerts, entities, or time periods. Export as PDF or CSV.
              </p>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: REPORT BUILDER FORM ── */}
        <ReportBuilderForm
          onPreview={handlePreview}
          onGenerate={handleGenerate}
          onSaveTemplate={handleSaveTemplate}
        />

        {/* ── SECTION 2: REPORT PREVIEW PANE ── */}
        <div ref={previewRef}>
          {previewData && (
            <ReportPreviewPane
              reportData={previewData}
              onClose={() => setPreviewData(null)}
              onDownload={handleGenerate}
            />
          )}
        </div>

        {/* ── SECTION 3: PAST REPORTS TABLE ── */}
        <PastReportsTable
          reports={reportsList}
          onPreviewReport={handlePreview}
          onDownloadReport={handleDownloadPastReport}
          onDeleteReport={handleDeleteReport}
        />

        {/* ── SECTION 4: QUICK EXPORT SHORTCUTS ── */}
        <QuickExportShortcuts onQuickExport={handleQuickExport} />
      </main>
    </div>
  )
}
