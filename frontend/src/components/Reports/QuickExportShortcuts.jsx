import { TableProperties, Network, Database, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function QuickExportShortcuts({ onQuickExport }) {
  const cards = [
    {
      id: "alerts",
      title: "Export All Alerts (CSV)",
      desc: "Download full alert table with risk scores, anomaly signatures, and model confidence",
      icon: TableProperties,
      badge: "CSV",
      variant: "blue",
      color: "text-blue-400",
    },
    {
      id: "graph",
      title: "Export Graph Data (JSON)",
      desc: "Nodes and edges formatted for Cytoscape.js and react-force-graph-2d topology engines",
      icon: Network,
      badge: "JSON",
      variant: "violet",
      color: "text-violet-400",
    },
    {
      id: "transactions",
      title: "Export Raw Transactions (CSV)",
      desc: "All ingested and parsed Bitcoin transaction records with UTXO input/output distributions",
      icon: Database,
      badge: "CSV",
      variant: "amber",
      color: "text-amber-400",
    },
  ]

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
          <Download className="h-4 w-4 text-emerald-400" />
          Quick Exports
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          One-click downloads of primary datasets for offline analysis and external SIEM ingestion
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(({ id, title, desc, icon: Icon, badge, variant, color }) => (
          <div
            key={id}
            onClick={() => onQuickExport(id)}
            className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600/80 p-5 rounded-xl cursor-pointer transition-all hover:bg-zinc-800/40 hover:-translate-y-0.5 shadow-lg group space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 group-hover:border-zinc-700 transition-colors">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <Badge variant={variant} className="text-[10px] font-mono h-5">
                {badge}
              </Badge>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                {title}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                {desc}
              </p>
            </div>

            <div className="pt-1 flex items-center text-[11px] text-zinc-500 font-medium group-hover:text-zinc-300 transition-colors">
              <span>Click to download immediate export</span>
              <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
