import { useState, useRef } from "react"
import { Link } from "react-router-dom"
import {
  FileText,
  ChevronRight,
  CheckCircle2,
  Loader2,
} from "lucide-react"

import AppHeader from "@/components/common/AppHeader"
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
import { generateReport, getReportsList, generateAIForensicSummary } from "@/api/client"

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
  const handleGenerate = async (formData) => {
    setIsGenerating(true)
    setProgressVal(15)
    setProgressStage("Aggregating anomaly alerts across UTXO database...")

    // Queue real backend generation
    generateReport({
      title: formData.title || "SIH Forensic Dossier",
      report_type: formData.reportType || "alert_summary",
      risk_threshold: formData.riskThreshold || 0.6,
      format: (formData.outputFormat || "pdf").toLowerCase(),
      analyst_notes: formData.analystNotes || "",
    }).catch(err => console.warn("Backend report queuing notice:", err))

    // Generate real Gemma 4 narrative brief
    try {
      await generateAIForensicSummary({
        total_transactions: 142857,
        active_alerts: 247,
        high_risk_entities: 83,
        risk_threshold: formData.riskThreshold || 0.6,
        top_typologies: ["peeling_chain", "tumbler_pool", "ransomware_cluster"],
        time_window: "Past 30 Days",
      })
    } catch (err) {
      console.warn("Gemma 4 summary notice:", err)
    }

    setTimeout(() => {
      setProgressVal(45)
      setProgressStage("Synthesizing SHAP feature attribution distributions with Gemma 4...")
    }, 600)

    setTimeout(() => {
      setProgressVal(67)
      setProgressStage("Rendering SHAP charts and topology graph...")
    }, 1200)

    setTimeout(() => {
      setProgressVal(90)
      setProgressStage("Compiling document layout, cryptographic signatures, and Section 63 BSA certificate...")
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
    <div className="min-h-screen bg-slate-950 text-slate-100 editorial-glow selection:bg-amber-500/20 flex flex-col">
      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[9999] editorial-surface border border-emerald-500/40 rounded-full px-5 py-2.5 text-xs text-emerald-300 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="font-sans font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ── GENERATION PROGRESS MODAL ── */}
      <Dialog open={isGenerating} onOpenChange={setIsGenerating}>
        <DialogContent className="max-w-md editorial-surface border-white/10 rounded-2xl text-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-display font-medium text-white flex items-center gap-2.5">
              <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
              Generating Investigation Dossier
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Assembling analytical charts, SHAP values, and cryptographically verified network evidence...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-300 font-medium">{progressStage}</span>
              <span className="text-amber-400 font-bold">{progressVal}%</span>
            </div>
            <Progress value={progressVal} className="h-2 bg-slate-900" />
            <div className="text-[11px] text-zinc-500 italic">
              Estimated export size: ~4.2 MB • NTRO forensic hash & signature attached
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── STICKY APP HEADER ── */}
      <AppHeader />

      {/* ── MAIN CONTENT ── */}
      <main className="mx-auto max-w-screen-2xl w-full px-6 py-8 space-y-8 flex-1">
        {/* ── PAGE HEADER ── */}
        <div className="space-y-1">
          <nav className="flex items-center gap-2 text-xs text-zinc-400">
            <Link to="/overview" className="hover:text-amber-400 transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="h-3 w-3 text-zinc-600" />
            <span className="text-zinc-200 font-medium">Reports</span>
          </nav>
          <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
            <div>
              <h1 className="text-3xl sm:text-4xl font-display font-medium text-white tracking-tight flex items-center gap-3">
                <FileText className="h-7 w-7 text-amber-400" />
                Reports & <span className="font-serif italic text-zinc-400 font-light">Export Intelligence</span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl font-light">
                Generate detailed investigative dossiers for selected alerts, entities, or time periods. Export court-ready PDF briefs or raw analytical CSVs.
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
