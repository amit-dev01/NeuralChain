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
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-display font-medium text-white flex items-center gap-2">
          <Download className="h-4 w-4 text-emerald-400" />
          Quick Analytical Exports
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5 font-light">
          One-click downloads of primary datasets for offline analysis, SIEM ingestion, and evidence logs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(({ id, title, desc, icon: Icon, badge, color }) => (
          <div
            key={id}
            onClick={() => onQuickExport(id)}
            className="editorial-surface editorial-surface-hover border border-white/10 p-5 rounded-2xl cursor-pointer transition-all duration-300 shadow-xl group space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10 group-hover:border-amber-500/30 transition-colors">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300">
                {badge}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                {title}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed font-light">
                {desc}
              </p>
            </div>

            <div className="pt-1 flex items-center text-[11px] text-zinc-500 font-medium group-hover:text-amber-400 transition-colors">
              <span>Click to download immediate export</span>
              <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
