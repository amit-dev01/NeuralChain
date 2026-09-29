import { useState } from "react"
import {
  FileText,
  Download,
  Eye,
  Trash2,
  Clock,
  ShieldAlert,
  FileCheck,
} from "lucide-react"

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function PastReportsTable({
  reports,
  onPreviewReport,
  onDownloadReport,
  onDeleteReport,
}) {
  const [reportToDelete, setReportToDelete] = useState(null)

  return (
    <div className="editorial-surface rounded-2xl p-6 border border-white/10 shadow-xl space-y-4">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-medium text-white flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            Generated Reports Archive
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5 font-light">
            Archive of previously generated investigation dossiers and forensic data dumps
          </p>
        </div>
        <div className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
          {reports.length} Reports Archived
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/60">
        <Table>
          <TableHeader className="bg-slate-950/80">
            <TableRow className="border-b border-white/10 hover:bg-transparent">
              <TableHead className="text-xs text-zinc-400 font-medium">Report Title</TableHead>
              <TableHead className="text-xs text-zinc-400 font-medium">Type</TableHead>
              <TableHead className="text-xs text-zinc-400 font-medium">Date Generated</TableHead>
              <TableHead className="text-xs text-zinc-400 font-medium text-center">Alerts Included</TableHead>
              <TableHead className="text-xs text-zinc-400 font-medium text-center">Format</TableHead>
              <TableHead className="text-xs text-zinc-400 font-medium">Size</TableHead>
              <TableHead className="text-xs text-zinc-400 font-medium text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-white/5">
            {reports.map((rep) => (
              <TableRow
                key={rep.id}
                className="hover:bg-white/5 transition-colors group"
              >
                {/* Title & ID */}
                <TableCell className="py-3 px-4">
                  <div className="font-semibold text-xs text-zinc-200 group-hover:text-amber-400 transition-colors">
                    {rep.title}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    ID: {rep.id} • Analyst: {rep.analyst}
                  </div>
                </TableCell>

                {/* Type */}
                <TableCell className="py-3 px-4 text-xs text-zinc-300">
                  {rep.type}
                </TableCell>

                {/* Date */}
                <TableCell className="py-3 px-4 text-xs text-zinc-400 font-mono">
                  {rep.dateGenerated}
                </TableCell>

                {/* Alerts Included */}
                <TableCell className="py-3 px-4 text-center">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    {rep.alertsIncluded} alerts
                  </span>
                </TableCell>

                {/* Format */}
                <TableCell className="py-3 px-4 text-center">
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                      rep.format === "PDF"
                        ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                        : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                    }`}
                  >
                    {rep.format}
                  </span>
                </TableCell>

                {/* Size */}
                <TableCell className="py-3 px-4 text-xs text-zinc-400 font-mono">
                  {rep.size}
                </TableCell>

                {/* Actions */}
                <TableCell className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Preview Button */}
                    <button
                      onClick={() => onPreviewReport(rep)}
                      className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-amber-400 transition-colors"
                      title="Preview this report"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>

                    {/* Download Button */}
                    <button
                      onClick={() => onDownloadReport(rep)}
                      className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-emerald-400 transition-colors"
                      title="Download file"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>

                    {/* Delete Alert Dialog */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          onClick={() => setReportToDelete(rep)}
                          className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-rose-400 transition-colors"
                          title="Delete report"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="editorial-surface border-white/10 rounded-2xl text-slate-100 shadow-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-display text-lg text-white">
                            Delete Report {reportToDelete?.id}?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-zinc-400 text-xs">
                            Are you sure you want to permanently remove "{reportToDelete?.title}" from the generated reports archive?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setReportToDelete(null)} className="rounded-full border-white/10 text-zinc-300 hover:bg-white/5">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              if (reportToDelete) {
                                onDeleteReport(reportToDelete.id)
                                setReportToDelete(null)
                              }
                            }}
                            className="bg-rose-600 hover:bg-rose-500 text-white rounded-full font-medium"
                          >
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
  )
}
