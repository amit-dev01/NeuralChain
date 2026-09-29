import { useNavigate } from "react-router-dom"
import { GitBranch, Clock, Coins, ShieldAlert, ArrowRight, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PEEL_CHAINS } from "@/data/timelineMockData"

// Single horizontal SVG chain row
function PeelChainRow({ chain, onNodeClick }) {
  const navigate = useNavigate()
  const hops = chain.hops

  // Calculate layout coordinates
  // Nodes alternate: Wallet -> Tx -> Wallet -> Tx...
  const nodeWidthWallet = 104
  const nodeWidthTx = 84
  const nodeHeight = 28
  const linkLength = 80 // space for arrow and label
  const startX = 20
  const yCenter = 36

  // Precompute X positions
  let currentX = startX
  const positions = hops.map((node) => {
    const width = node.type === "wallet" ? nodeWidthWallet : nodeWidthTx
    const pos = { x: currentX, width, node }
    currentX += width + linkLength
    return pos
  })

  const totalSvgWidth = currentX + 30
  const totalSvgHeight = 72

  return (
    <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 space-y-3 hover:border-zinc-700/80 transition-all">
      {/* Chain header row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            {chain.id}
          </span>
          <span className="text-xs text-zinc-300 font-medium">
            Origin: <code className="font-mono text-violet-400">{chain.hops[0]?.label}</code>
          </span>
          <span className="text-zinc-600">•</span>
          <span className="text-xs text-zinc-400 font-mono">
            Started {chain.startTime}
          </span>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/graph?focus=${chain.rootWallet}`)}
          className="h-7 text-xs gap-1.5 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
        >
          <ExternalLink className="h-3 w-3 text-blue-400" />
          Graph View
        </Button>
      </div>

      {/* Scrollable horizontal SVG chain */}
      <div className="overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
        <svg
          width={totalSvgWidth}
          height={totalSvgHeight}
          className="select-none min-w-full"
        >
          <defs>
            <marker
              id={`arrow-${chain.id}`}
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#71717a" />
            </marker>
          </defs>

          {/* Links and Labels */}
          {positions.map((pos, idx) => {
            if (idx === positions.length - 1) return null
            const nextPos = positions[idx + 1]
            const lineStartX = pos.x + pos.width
            const lineEndX = nextPos.x
            const midX = (lineStartX + lineEndX) / 2

            // If current is wallet and next is tx, show peeling amount
            const amountLabel =
              nextPos.node.type === "tx" ? nextPos.node.amount : ""

            return (
              <g key={`link-${idx}`}>
                <line
                  x1={lineStartX}
                  y1={yCenter}
                  x2={lineEndX - 4}
                  y2={yCenter}
                  stroke="#52525b"
                  strokeWidth="1.5"
                  markerEnd={`url(#arrow-${chain.id})`}
                />
                {amountLabel && (
                  <text
                    x={midX}
                    y={yCenter - 8}
                    fill="#f59e0b"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                    fontWeight="500"
                  >
                    {amountLabel}
                  </text>
                )}
              </g>
            )
          })}

          {/* Nodes */}
          {positions.map((pos) => {
            const { x, width, node } = pos
            const isWallet = node.type === "wallet"

            return (
              <g
                key={node.id}
                className="cursor-pointer group"
                onClick={() => onNodeClick(node.id)}
              >
                {/* Pill background */}
                <rect
                  x={x}
                  y={yCenter - nodeHeight / 2}
                  width={width}
                  height={nodeHeight}
                  rx={nodeHeight / 2}
                  fill={isWallet ? "rgba(139, 92, 246, 0.15)" : "rgba(59, 130, 246, 0.15)"}
                  stroke={isWallet ? "#8b5cf6" : "#3b82f6"}
                  strokeWidth="1.2"
                  className="transition-all duration-150 group-hover:fill-opacity-30 group-hover:stroke-width-2"
                />

                {/* Pill label */}
                <text
                  x={x + width / 2}
                  y={yCenter + 4}
                  fill={isWallet ? "#d8b4fe" : "#93c5fd"}
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Metadata row */}
      {/* Spec: Chain length: 12 hops | Total moved: 14.2 BTC | Duration: 8 min 34 sec | Peeling fee per hop: avg 0.003 BTC | Risk score: 0.91 🔴 */}
      <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3 text-xs text-zinc-400 bg-zinc-900/90 px-3.5 py-2 rounded-lg border border-zinc-800 font-mono">
        <span className="flex items-center gap-1.5 text-zinc-300">
          <GitBranch className="h-3.5 w-3.5 text-blue-400" />
          Chain length: <strong className="text-zinc-100">{chain.length} hops</strong>
        </span>
        <span className="text-zinc-700">|</span>

        <span className="flex items-center gap-1.5 text-zinc-300">
          <Coins className="h-3.5 w-3.5 text-amber-400" />
          Total moved: <strong className="text-amber-400">{chain.totalMoved} BTC</strong>
        </span>
        <span className="text-zinc-700">|</span>

        <span className="flex items-center gap-1.5 text-zinc-300">
          <Clock className="h-3.5 w-3.5 text-zinc-400" />
          Duration: <strong className="text-zinc-200">{chain.duration}</strong>
        </span>
        <span className="text-zinc-700">|</span>

        <span className="text-zinc-400">
          Peeling fee per hop: <span className="text-zinc-200">{chain.peelingFee}</span>
        </span>
        <span className="text-zinc-700">|</span>

        <span className="flex items-center gap-1.5">
          Risk score: <strong className="text-red-400">{chain.riskScore.toFixed(2)}</strong> 🔴
        </span>
      </div>
    </div>
  )
}

export default function PeelChainVisualizer() {
  const navigate = useNavigate()

  // TODO: GET /api/v1/timeline/peel-chains?limit=5

  const handleNodeClick = (nodeId) => {
    navigate(`/graph?focus=${nodeId}`)
  }

  return (
    <div className="editorial-surface rounded-2xl p-6 border border-white/10 shadow-xl space-y-4">
      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-white/5">
        <div>
          <h2 className="font-display text-xl font-normal text-white tracking-tight flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-violet-400" />
            Detected Peel Chains
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5 font-light">
            Sequential single-output transactions chained across time to obfuscate fund flow
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="violet" className="text-[10px] rounded-full px-2.5 py-0.5">
            {PEEL_CHAINS.length} Chains Detected
          </Badge>
          <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
            Click any node to focus in Graph Explorer
          </span>
        </div>
      </div>

      {/* ── PEEL CHAIN ROWS ── */}
      <div className="space-y-3.5">
        {PEEL_CHAINS.map((chain) => (
          <PeelChainRow
            key={chain.id}
            chain={chain}
            onNodeClick={handleNodeClick}
          />
        ))}
      </div>
    </div>
  )
}
