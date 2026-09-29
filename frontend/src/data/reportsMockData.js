// Mock data and export helpers for NeuralChain Reports & Export (/reports)
// TODO: Replace with:
//   - POST /api/v1/reports/generate
//   - GET /api/v1/reports
//   - GET /api/v1/reports/{id}/download
//   - Client-side html2canvas/jspdf or Server-side Puppeteer stream

export const PAST_REPORTS = [
  {
    id: "REP-2025-089",
    title: "Q2 2025 Ransomware & Mixer Cascade Investigation",
    type: "Full Investigation Report",
    dateGenerated: "2026-09-28 16:42",
    alertsIncluded: 247,
    format: "PDF",
    size: "4.8 MB",
    analyst: "Special Agent V. Sharma",
    notes: "Cross-border Bitcoin movement involving Selectel Network and Severex bulletproof infrastructure.",
    kpis: {
      volume: "142.8 BTC",
      entities: 83,
      alerts: 247,
      chains: 34,
      confidence: "97.4%",
    },
  },
  {
    id: "REP-2025-088",
    title: "Tor Exit Relay Cluster Rapid Reuse Analysis",
    type: "Entity Profile Report",
    dateGenerated: "2026-09-26 11:15",
    alertsIncluded: 47,
    format: "PDF",
    size: "2.1 MB",
    analyst: "Analyst D. Patel",
    notes: "Focused on IP 185.220.101.45 (Tor Project AS9009) signing 47 txs across 12 distinct wallets.",
    kpis: {
      volume: "68.4 BTC",
      entities: 12,
      alerts: 47,
      chains: 8,
      confidence: "98.1%",
    },
  },
  {
    id: "REP-2025-087",
    title: "High-Risk Alert Table Raw Export (Risk ≥ 0.8)",
    type: "Alert Summary Report",
    dateGenerated: "2026-09-24 09:30",
    alertsIncluded: 112,
    format: "CSV",
    size: "840 KB",
    analyst: "System Automated Export",
    notes: "Scheduled weekly high-risk alert triage batch for NTRO intelligence desk.",
    kpis: {
      volume: "310.2 BTC",
      entities: 48,
      alerts: 112,
      chains: 19,
      confidence: "96.5%",
    },
  },
  {
    id: "REP-2025-086",
    title: "Peel Chain Depth 12 Sequential Dispersion Dossier",
    type: "Full Investigation Report",
    dateGenerated: "2026-09-21 14:05",
    alertsIncluded: 64,
    format: "PDF",
    size: "3.4 MB",
    analyst: "Special Agent V. Sharma",
    notes: "Traced peeling origin from bc1qxy2kgdygjrs across 12 hops totaling 14.2 BTC.",
    kpis: {
      volume: "14.2 BTC",
      entities: 14,
      alerts: 64,
      chains: 5,
      confidence: "99.0%",
    },
  },
  {
    id: "REP-2025-085",
    title: "Ingested Transaction Batch Dump (Block 840,000–840,250)",
    type: "Transaction Batch Export",
    dateGenerated: "2026-09-18 18:22",
    alertsIncluded: 189,
    format: "CSV",
    size: "12.6 MB",
    analyst: "Data Ingestion Pipeline",
    notes: "Raw parsed transaction records including fee ratios, hop counts, and SHAP outputs.",
    kpis: {
      volume: "1,240.5 BTC",
      entities: 290,
      alerts: 189,
      chains: 42,
      confidence: "95.8%",
    },
  },
  {
    id: "REP-2025-084",
    title: "Darknet Market Escrow Cashout Network Briefing",
    type: "Alert Summary Report",
    dateGenerated: "2026-09-15 10:48",
    alertsIncluded: 88,
    format: "PDF",
    size: "2.9 MB",
    analyst: "Senior Analyst R. Mehta",
    notes: "Identified coordinated market batch disbursements through Cypriot OTC brokerages.",
    kpis: {
      volume: "89.5 BTC",
      entities: 36,
      alerts: 88,
      chains: 12,
      confidence: "96.9%",
    },
  },
]

// ─── SHAP Model-Level Feature Importance ─────────────────────────────────────
export const SHAP_MODEL_SUMMARY = [
  { feature: "fee_ratio", importance: 0.78, fill: "#ef4444", description: "Transaction fee deviation vs block median" },
  { feature: "ip_tx_velocity", importance: 0.72, fill: "#ef4444", description: "Signatures per minute from same IP" },
  { feature: "fan_out_degree", importance: 0.65, fill: "#f59e0b", description: "Split ratio of UTXO outputs" },
  { feature: "address_reuse", importance: 0.58, fill: "#f59e0b", description: "Key pair recurrence across clusters" },
  { feature: "round_amount", importance: 0.49, fill: "#3b82f6", description: "Human/OTC round figure denomination" },
  { feature: "cluster_risk_score", importance: 0.44, fill: "#3b82f6", description: "Neighbor graph anomaly propagation" },
  { feature: "peel_hop_depth", importance: 0.38, fill: "#8b5cf6", description: "Single-output sequential chain count" },
  { feature: "tx_amount_dev", importance: 0.29, fill: "#8b5cf6", description: "Standard deviation from entity history" },
]

// ─── Sample Top 10 Alerts for Preview Pane Table ─────────────────────────────
export const SAMPLE_TOP_ALERTS = [
  { id: "ALT-2041", risk: 0.98, wallet: "1A1zP1eP…Divf", pattern: "Mixer fan-out (83 outputs)", model: "XGBoost", amount: "14.50 BTC", date: "14:26:01" },
  { id: "ALT-2040", risk: 0.96, wallet: "3J98t1Wp…WNLy", pattern: "Rapid IP reuse (47 tx/2m)", model: "Isolation Forest", amount: "9.30 BTC", date: "14:24:50" },
  { id: "ALT-2039", risk: 0.95, wallet: "bc1qxy2k…k7pg", pattern: "Peel chain origin (12 hops)", model: "Autoencoder", amount: "14.20 BTC", date: "14:22:10" },
  { id: "ALT-2038", risk: 0.94, wallet: "1BpEi6Df…FpKY", pattern: "Ransomware extortion egress", model: "XGBoost", amount: "11.70 BTC", date: "14:18:42" },
  { id: "ALT-2037", risk: 0.91, wallet: "3FZbgi29…tZc5", pattern: "High-frequency relay bridge", model: "Node2Vec+DBSCAN", amount: "8.40 BTC", date: "14:15:22" },
  { id: "ALT-2036", risk: 0.89, wallet: "bc1qar0s…p5ke", pattern: "CoinJoin mixing participant", model: "Autoencoder", amount: "6.20 BTC", date: "13:50:09" },
  { id: "ALT-2035", risk: 0.88, wallet: "1DUb2YYb…bUru", pattern: "Darknet market escrow release", model: "XGBoost", amount: "5.40 BTC", date: "13:30:15" },
  { id: "ALT-2034", risk: 0.86, wallet: "3Nxwenay…fp8v", pattern: "Unregistered MSB pass-through", model: "Isolation Forest", amount: "4.80 BTC", date: "13:12:44" },
  { id: "ALT-2033", risk: 0.84, wallet: "1GHkZePV…T9pS", pattern: "Round amount splitting", model: "XGBoost", amount: "3.90 BTC", date: "12:55:00" },
  { id: "ALT-2032", risk: 0.82, wallet: "3QJmV3qf…cXFd", pattern: "Unusual fee ratio spike (3.4σ)", model: "Isolation Forest", amount: "2.10 BTC", date: "12:40:19" },
]

// ─── Browser Download Helper (Blob generator) ────────────────────────────────
export function triggerFileDownload(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Generate realistic CSV string for alerts
export function generateAlertsCsv(alerts = SAMPLE_TOP_ALERTS) {
  const headers = ["Alert_ID", "Risk_Score", "Wallet_Address", "Detected_Pattern", "Model", "Amount_BTC", "Timestamp"]
  const rows = alerts.map(a => [
    a.id,
    a.risk,
    `"${a.wallet}"`,
    `"${a.pattern}"`,
    `"${a.model}"`,
    `"${a.amount}"`,
    `"${a.date}"`,
  ].join(","))
  return [headers.join(","), ...rows].join("\n")
}

// Generate realistic JSON for graph export
export function generateGraphJson() {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    system: "SIH26146 NeuralChain",
    nodes: [
      { id: "1A1zP1eP5QGefi2", label: "Mixer Deposit Hub", type: "wallet", risk: 0.98, balance: 14.5 },
      { id: "3J98t1WpEZ73CNm", label: "Tor Exit Aggregator", type: "wallet", risk: 0.96, balance: 9.3 },
      { id: "bc1qxy2kgdygjrs", label: "Peel Chain Origin", type: "wallet", risk: 0.95, balance: 14.2 },
      { id: "185.220.101.45", label: "Tor Project Exit Node", type: "ip", risk: 0.94, geo: "DE" },
      { id: "tx_98f4e271a0", label: "Cascade Hop 1", type: "transaction", amount: 1.234, fee: 0.0031 },
    ],
    links: [
      { source: "1A1zP1eP5QGefi2", target: "tx_98f4e271a0", value: 14.5, type: "SENT" },
      { source: "tx_98f4e271a0", target: "3J98t1WpEZ73CNm", value: 1.234, type: "RECEIVED" },
      { source: "185.220.101.45", target: "tx_98f4e271a0", value: 1.0, type: "SIGNED_FROM" },
    ],
  }, null, 2)
}

// Generate realistic CSV string for raw transactions
export function generateRawTransactionsCsv() {
  const headers = ["TXID", "Block_Height", "Timestamp", "Inputs_Count", "Outputs_Count", "Total_Input_BTC", "Total_Output_BTC", "Fee_BTC", "Fee_Rate_SatB", "Risk_Score"]
  const rows = [
    ["7f4c91a0b3...3b21", 840120, "2026-09-29T14:26:01Z", 1, 83, 14.502, 14.498, 0.004, 185.4, 0.98],
    ["8c9d0e12f3...1f23", 840118, "2026-09-29T14:24:50Z", 3, 2, 9.308, 9.305, 0.003, 142.1, 0.96],
    ["9a0b1c23d4...2d34", 840115, "2026-09-29T14:22:10Z", 1, 2, 14.204, 14.200, 0.004, 160.0, 0.95],
    ["0a1b2c34d5...3d4e", 840112, "2026-09-29T14:18:42Z", 2, 4, 11.705, 11.701, 0.004, 155.8, 0.94],
    ["b2c3d4e5f6...e5f6", 840109, "2026-09-29T14:15:22Z", 1, 1, 8.403, 8.400, 0.003, 120.5, 0.91],
    ["b8c9d0e1f2...e1f2", 840105, "2026-09-29T13:50:09Z", 5, 5, 6.204, 6.200, 0.004, 138.2, 0.89],
    ["01a2b3c4d5...c4d5", 840100, "2026-09-29T13:30:15Z", 2, 2, 5.403, 5.400, 0.003, 110.0, 0.88],
  ].map(r => r.join(","))
  return [headers.join(","), ...rows].join("\n")
}
