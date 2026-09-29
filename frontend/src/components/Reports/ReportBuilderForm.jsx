import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Settings2,
  FileText,
  Calendar,
  ShieldAlert,
  CheckSquare,
  FileDown,
  Eye,
  Bookmark,
  Sparkles,
  Layers,
  FileCheck,
  TableProperties,
  UserCheck,
  Database,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"

// Zod validation schema
const reportSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  reportType: z.enum(["full", "summary", "entity", "batch"]),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  riskThreshold: z.number().min(0).max(1),
  sections: z.object({
    execSummary: z.boolean(),
    kpiTable: z.boolean(),
    alertTable: z.boolean(),
    shapFeature: z.boolean(),
    graphScreenshot: z.boolean(),
    geoDistribution: z.boolean(),
    modelMetrics: z.boolean(),
    rawTxData: z.boolean(),
    evidenceList: z.boolean(),
  }),
  outputFormat: z.enum(["PDF", "CSV", "JSON"]),
  includeBranding: z.boolean(),
  analystNotes: z.string().optional(),
})

const REPORT_TYPES = [
  {
    id: "full",
    label: "Full Investigation Report",
    desc: "Comprehensive dossier: all alerts + graph + SHAP + geo analysis",
    icon: FileCheck,
    badge: "Recommended",
  },
  {
    id: "summary",
    label: "Alert Summary Report",
    desc: "Compact table of ranked alerts, risk scores, and model classifications",
    icon: TableProperties,
  },
  {
    id: "entity",
    label: "Entity Profile Report",
    desc: "Deep-dive focus on single high-risk wallet or IP cluster",
    icon: UserCheck,
  },
  {
    id: "batch",
    label: "Transaction Batch Export",
    desc: "Raw tabular dump of filtered transactions and UTXO metadata",
    icon: Database,
  },
]

const AVAILABLE_SECTIONS = [
  { id: "execSummary", label: "Executive Summary", defaultChecked: true },
  { id: "kpiTable", label: "KPI Stats Table", defaultChecked: true },
  { id: "alertTable", label: "Alert Table (ranked)", defaultChecked: true },
  { id: "shapFeature", label: "SHAP Feature Importance (per alert)", defaultChecked: true },
  { id: "graphScreenshot", label: "Transaction Graph Screenshot", defaultChecked: true },
  { id: "geoDistribution", label: "Geographic Distribution", defaultChecked: true },
  { id: "modelMetrics", label: "Model Performance Metrics", defaultChecked: true },
  { id: "rawTxData", label: "Raw Transaction Data (large)", defaultChecked: false },
  { id: "evidenceList", label: "Full TXID Evidence List", defaultChecked: false },
]

export default function ReportBuilderForm({
  onPreview,
  onGenerate,
  onSaveTemplate,
}) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      title: "Q2 2025 Ransomware & Mixer Investigation",
      reportType: "full",
      dateFrom: "2026-09-20T00:00",
      dateTo: "2026-09-30T00:00",
      riskThreshold: 0.5,
      sections: {
        execSummary: true,
        kpiTable: true,
        alertTable: true,
        shapFeature: true,
        graphScreenshot: true,
        geoDistribution: true,
        modelMetrics: true,
        rawTxData: false,
        evidenceList: false,
      },
      outputFormat: "PDF",
      includeBranding: true,
      analystNotes:
        "Cross-border Bitcoin movement involving Selectel Network and Severex bulletproof infrastructure. High mixing velocity detected across hops #1 through #4.",
    },
  })

  const currentValues = watch()

  const handleFormPreview = () => {
    handleSubmit((data) => {
      onPreview(data)
    })()
  }

  const handleFormGenerate = () => {
    handleSubmit((data) => {
      onGenerate(data)
    })()
  }

  return (
    <div className="editorial-surface rounded-2xl p-6 lg:p-8 border border-white/10 shadow-2xl space-y-6">
      {/* ── CARD HEADER ── */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-display font-medium text-white flex items-center gap-2.5">
            <Settings2 className="h-5 w-5 text-amber-400" />
            Build New Investigation Dossier
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5 font-light">
            Configure forensic scope, SHAP explanations, topology captures, and export format
          </p>
        </div>
        <div className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 hidden sm:block">
          Schema: Zod Validated
        </div>
      </div>

      {/* ── 2-COLUMN GRID FORM ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-5">
          {/* Report Title */}
          <div className="space-y-1.5">
            <Label htmlFor="report-title" className="text-xs text-zinc-300 font-medium">
              Report Title:
            </Label>
            <Input
              id="report-title"
              placeholder="e.g. Q2 2025 Ransomware Investigation"
              {...register("title")}
              className="bg-slate-950/80 border-white/10 text-zinc-100 text-xs focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
            />
            {errors.title && (
              <span className="text-[11px] text-rose-400 font-medium">
                {errors.title.message}
              </span>
            )}
          </div>

          {/* Report Type (Cards) */}
          <div className="space-y-2">
            <Label className="text-xs text-zinc-300 font-medium">Report Type:</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {REPORT_TYPES.map(({ id, label, desc, icon: Icon, badge }) => {
                const isSelected = currentValues.reportType === id
                return (
                  <div
                    key={id}
                    onClick={() => setValue("reportType", id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? "bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30 text-white shadow-lg"
                        : "bg-slate-950/60 border-white/10 hover:border-white/20 hover:bg-slate-900/40 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`h-4 w-4 ${
                            isSelected ? "text-amber-400" : "text-zinc-400"
                          }`}
                        />
                        <span className="text-xs font-semibold text-zinc-100">
                          {label}
                        </span>
                      </div>
                      {badge && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                          {badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300 font-medium flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              Investigation Date Range:
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-40">
                <span className="text-[10px] text-zinc-500 block mb-0.5">From</span>
                <Input
                  type="datetime-local"
                  {...register("dateFrom")}
                  className="bg-slate-950/80 border-white/10 text-zinc-100 text-xs h-8 rounded-lg"
                />
              </div>
              <span className="text-zinc-600 mt-4">→</span>
              <div className="flex-1 min-w-40">
                <span className="text-[10px] text-zinc-500 block mb-0.5">To</span>
                <Input
                  type="datetime-local"
                  {...register("dateTo")}
                  className="bg-slate-950/80 border-white/10 text-zinc-100 text-xs h-8 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Risk Threshold Slider */}
          <div className="space-y-2 bg-slate-950/60 p-4 rounded-xl border border-white/10">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                Include alerts with risk ≥
              </span>
              <span className="font-mono text-amber-400 font-bold bg-slate-900 px-2.5 py-0.5 rounded-full border border-white/10">
                {currentValues.riskThreshold?.toFixed(2) || "0.50"}
              </span>
            </div>
            <Controller
              name="riskThreshold"
              control={control}
              render={({ field }) => (
                <Slider
                  value={[field.value]}
                  min={0}
                  max={1}
                  step={0.05}
                  onValueChange={([val]) => field.onChange(val)}
                  className="py-1"
                />
              )}
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>0.0 (All alerts)</span>
              <span>0.5 (Moderate+)</span>
              <span className="text-rose-400">0.8 (Critical only)</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5">
          {/* Sections to Include (Multi-checkbox grid) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-zinc-300 font-medium flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5 text-amber-400" />
                Sections to Include:
              </Label>
              <span className="text-[10px] text-zinc-400 font-mono">
                {Object.values(currentValues.sections || {}).filter(Boolean).length} /{" "}
                {AVAILABLE_SECTIONS.length} selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950/60 p-3.5 rounded-xl border border-white/10 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
              {AVAILABLE_SECTIONS.map(({ id, label }) => {
                const isChecked = currentValues.sections?.[id]
                return (
                  <div
                    key={id}
                    onClick={() =>
                      setValue(`sections.${id}`, !isChecked, {
                        shouldValidate: true,
                      })
                    }
                    className={`flex items-center space-x-2 p-1.5 rounded-lg cursor-pointer transition-colors ${
                      isChecked ? "bg-white/5 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Checkbox
                      id={`section-${id}`}
                      checked={isChecked}
                      onCheckedChange={(val) => setValue(`sections.${id}`, val)}
                      className="border-white/20 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 rounded"
                    />
                    <label
                      htmlFor={`section-${id}`}
                      className="text-xs cursor-pointer select-none leading-none truncate"
                    >
                      {label}
                    </label>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Output Format (Segmented buttons) & Include Branding */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Output Format */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-medium">Output Format:</Label>
              <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-full border border-white/10">
                {["PDF", "CSV", "JSON"].map((fmt) => {
                  const isActive = currentValues.outputFormat === fmt
                  return (
                    <Button
                      key={fmt}
                      type="button"
                      size="sm"
                      variant={isActive ? "default" : "ghost"}
                      onClick={() => setValue("outputFormat", fmt)}
                      className={`flex-1 h-7 text-xs font-semibold rounded-full transition-all ${
                        isActive
                          ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {fmt}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Include Branding Switch */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-medium">Header / Branding:</Label>
              <div className="flex items-center justify-between bg-slate-950/80 px-3 py-2 rounded-xl border border-white/10 h-9">
                <span className="text-xs text-zinc-300 truncate">
                  Add SIH26146 Logo
                </span>
                <Controller
                  name="includeBranding"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-amber-500 ml-2"
                    />
                  )}
                />
              </div>
            </div>
          </div>

          {/* Analyst Notes Textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="analyst-notes" className="text-xs text-zinc-300 font-medium">
              Analyst Investigation Notes:
            </Label>
            <Textarea
              id="analyst-notes"
              rows={3}
              placeholder="Add investigator notes, hypothesis, legal remarks, or case references..."
              {...register("analystNotes")}
              className="bg-slate-950/80 border-white/10 text-zinc-100 text-xs focus:border-amber-400 focus:ring-amber-400/20 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* ── FORM ACTIONS ROW ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onSaveTemplate(currentValues)}
          className="text-xs text-zinc-400 hover:text-zinc-100 gap-1.5 rounded-full"
        >
          <Bookmark className="h-3.5 w-3.5 text-zinc-400" />
          Save as Template
        </Button>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleFormPreview}
            className="text-xs gap-1.5 border-white/15 text-zinc-200 hover:text-white hover:bg-white/5 rounded-full"
          >
            <Eye className="h-3.5 w-3.5 text-amber-400" />
            Preview Dossier
          </Button>

          <Button
            type="button"
            onClick={handleFormGenerate}
            className="text-xs gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold px-6 py-2 rounded-full shadow-lg shadow-amber-500/20 transition-all"
          >
            <FileDown className="h-4 w-4" />
            Generate & Download
          </Button>
        </div>
      </div>
    </div>
  )
}
