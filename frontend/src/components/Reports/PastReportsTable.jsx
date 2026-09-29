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
    <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-xl space-y-4">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            Generated Reports History
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Archive of previously generated investigation dossiers and data dumps
          </p>
        </div>
        <Badge variant="blue" className="text-xs">
          {reports.length} Reports Archived
        </Badge>
      </div>

      {/* ── TABLE ── */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60">
        <Table>
          <TableHeader className="bg-zinc-950/80">
            <TableRow className="border-b border-zinc-800 hover:bg-transparent">
              <TableHead className="text-xs text-zinc-400 font-medium">Report Title</TableHead>
              <TableHead className="text-xs text-zinc-400 font-medium">Type</TableHead>
              <TableHead className="text-xs text-zinc-400 font-medium">Date Generated</TableHead>
              <TableHead className="text-xs text-zinc-400 font-medium text-center">Alerts Included</TableHead>
              <TableHead className="text-xs text-zinc-400 font-medium text-center">Format</TableHead>
              <TableHead className="text-xs text-zinc-400 font-medium">Size</TableHead>
              <TableHead className="text-xs text-zinc-400 font-medium text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-zinc-800/60">
            {reports.map((rep) => (
              <TableRow
                key={rep.id}
                className="hover:bg-zinc-800/30 transition-colors group"
              >
                {/* Title & ID */}
                <TableCell className="py-3 px-4">
                  <div className="font-semibold text-xs text-zinc-200 group-hover:text-blue-400 transition-colors">
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
                  <Badge variant="amber" className="text-[10px] h-5 font-mono">
                    {rep.alertsIncluded} alerts
                  </Badge>
                </TableCell>

                {/* Format */}
                <TableCell className="py-3 px-4 text-center">
                  <Badge
                    variant={rep.format === "PDF" ? "red" : "blue"}
                    className="text-[10px] h-5 font-mono uppercase"
                  >
                    {rep.format}
                  </Badge>
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
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 transition-colors"
                      title="Preview this report"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>

                    {/* Download Button */}
                    <button
                      onClick={() => onDownloadReport(rep)}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-emerald-400 transition-colors"
                      title="Download file"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>

                    {/* Delete Alert Dialog */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          onClick={() => setReportToDelete(rep)}
                          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors"
                          title="Delete report"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete Report {reportToDelete?.id}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to permanently remove "{reportToDelete?.title}" from the generated reports archive?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setReportToDelete(null)}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              if (reportToDelete) {
                                onDeleteReport(reportToDelete.id)
                                setReportToDelete(null)
                              }
                            }}
                            className="bg-red-600 hover:bg-red-500 text-white"
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
