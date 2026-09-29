// Mock graph data for NeuralChain Graph Explorer
// TODO: Replace with GET /api/v1/graph/nodes?depth=2&start={walletId}

const WALLET_ADDRS = [
  "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",
  "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
  "bc1qxy2kgdygjrs6et80gfqrmx6jvqk7pg",
  "1BpEi6DfDAUFd4jeFVmRNpqbCTXh3MFpKY",
  "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5",
  "bc1qar0srrr7xfkvcy6l3r7jal7q9p5ke",
  "1DUb2YYbQA1jjaNYzVXLZ7ZioEhLXtbUru",
  "3Nxwenay9Z8Lc9JBiywExpnEFiLp6Afp8v",
  "bc1qc7sl4e6p8z5q5d5v7q3r8k2k3m4n5",
  "1GHkZePVMzHuD3U7E5LY8QM1xTqTVT9pS",
  "3QJmV3qfvL6sbDNetKtjB5Znt7UEKcXFd",
  "bc1qw508d6qejxtdg4y5r3zarvary0c5xw",
  "1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1",
  "3CLoMMyuoDQTPRD3XYZtCvgvkadrAdvdXh",
  "bc1qm34lsc65zpw79lxes69zkqmk6ee3ef",
]

const IPS = [
  { id: "ip_1", label: "185.220.101.42", country: "RU", asn: "AS60462", lat: 55.7, lon: 37.6 },
  { id: "ip_2", label: "45.142.212.100", country: "NL", asn: "AS9009",  lat: 52.3, lon: 4.9  },
  { id: "ip_3", label: "194.165.16.12",  country: "UA", asn: "AS47694", lat: 50.4, lon: 30.5 },
  { id: "ip_4", label: "103.75.190.5",   country: "CN", asn: "AS134810",lat: 39.9, lon: 116.4},
  { id: "ip_5", label: "5.188.206.201",  country: "DE", asn: "AS24940", lat: 52.5, lon: 13.4 },
  { id: "ip_6", label: "95.217.234.11",  country: "FI", asn: "AS24940", lat: 60.2, lon: 24.9 },
]

function rnd(min, max) { return Math.random() * (max - min) + min }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function sha256Like() { return Array.from({length:64},()=>"0123456789abcdef"[Math.floor(Math.random()*16)]).join("") }

export function generateMockGraph(nodeCount = 120) {
  const nodes = []
  const links = []
  const usedIds = new Set()

  // Wallet nodes
  const walletCount = Math.floor(nodeCount * 0.45)
  for (let i = 0; i < walletCount; i++) {
    const id = `w_${i}`
    const risk = Math.random()
    nodes.push({
      id,
      type: "wallet",
      label: WALLET_ADDRS[i % WALLET_ADDRS.length].slice(0, 16) + "…",
      fullLabel: WALLET_ADDRS[i % WALLET_ADDRS.length],
      risk: parseFloat(risk.toFixed(3)),
      cluster: Math.floor(Math.random() * 14),
      totalSent: parseFloat(rnd(0.001, 50).toFixed(4)),
      totalReceived: parseFloat(rnd(0.001, 80).toFixed(4)),
      txCount: Math.floor(rnd(1, 500)),
      firstSeen: "2024-01-15 08:32",
      lastSeen: "2024-09-28 21:14",
      entityLabel: pick(["Unknown", "Unknown", "Unknown", "Exchange", "Darknet Market", "Mixer"]),
      anomalyFlags: risk > 0.8
        ? pick([["PEEL_CHAIN"], ["HIGH_FAN_OUT"], ["ROUND_AMOUNT"], ["PEEL_CHAIN", "HIGH_FAN_OUT"]])
        : [],
      shapValues: [
        { feature: "fee_ratio",   value:  0.42 },
        { feature: "ip_velocity", value:  0.31 },
        { feature: "fan_out",     value:  0.28 },
        { feature: "addr_reuse",  value: -0.12 },
        { feature: "tx_amount",   value: -0.08 },
        { feature: "hop_depth",   value:  0.06 },
      ],
      shapSummary: risk > 0.8
        ? "This wallet was flagged because: fee ratio 3.2σ above mean, IP appeared in 47 transactions in 2 min, fan-out = 83 outputs."
        : "Low-risk wallet. No significant anomaly features detected.",
    })
    usedIds.add(id)
  }

  // Transaction nodes
  const txCount = Math.floor(nodeCount * 0.3)
  for (let i = 0; i < txCount; i++) {
    const id = `tx_${i}`
    const amount = parseFloat(rnd(0.0001, 10).toFixed(6))
    nodes.push({
      id,
      type: "transaction",
      label: sha256Like().slice(0, 12) + "…",
      fullLabel: sha256Like(),
      risk: parseFloat(rnd(0, 0.9).toFixed(3)),
      amount,
      amountUSD: parseFloat((amount * 67000).toFixed(2)),
      fee: parseFloat(rnd(0.00001, 0.001).toFixed(6)),
      timestamp: "2024-09-28 " + `${Math.floor(rnd(0,23))}`.padStart(2,"0") + ":32:11",
      anomalyFlags: Math.random() > 0.85
        ? pick([["PEEL_CHAIN"], ["HIGH_FAN_OUT"], ["ROUND_AMOUNT"]])
        : [],
      inputAddresses: [WALLET_ADDRS[Math.floor(Math.random()*WALLET_ADDRS.length)]],
      outputAddresses: Array.from({length: Math.floor(rnd(1,5))}, () => WALLET_ADDRS[Math.floor(Math.random()*WALLET_ADDRS.length)]),
    })
    usedIds.add(id)
  }

  // IP nodes
  IPS.forEach(ip => {
    nodes.push({
      ...ip,
      type: "ip",
      label: ip.label,
      fullLabel: ip.label,
      risk: parseFloat(rnd(0.1, 0.95).toFixed(3)),
      txCount: Math.floor(rnd(3, 200)),
      flaggedTxCount: Math.floor(rnd(0, 30)),
    })
    usedIds.add(ip.id)
  })

  // ASN nodes
  const asnNodes = ["AS60462", "AS9009", "AS47694"].map((asn, i) => ({
    id: `asn_${i}`, type: "asn", label: asn, fullLabel: asn,
    risk: parseFloat(rnd(0, 0.4).toFixed(3)),
  }))
  asnNodes.forEach(n => { nodes.push(n); usedIds.add(n.id) })

  // Country nodes
  const countryNodes = ["Russia", "Netherlands", "Ukraine", "China"].map((c, i) => ({
    id: `country_${i}`, type: "country", label: c, fullLabel: c,
    risk: 0,
  }))
  countryNodes.forEach(n => { nodes.push(n); usedIds.add(n.id) })

  // Links
  const walletNodes = nodes.filter(n => n.type === "wallet")
  const txNodes     = nodes.filter(n => n.type === "transaction")
  const ipNodes     = nodes.filter(n => n.type === "ip")

  // wallet → tx (SENT)
  txNodes.forEach((tx, i) => {
    const src = walletNodes[i % walletNodes.length]
    links.push({ source: src.id, target: tx.id, type: "SENT", amount: tx.amount })
  })

  // tx → wallet (RECEIVED)
  txNodes.forEach((tx, i) => {
    const dst = walletNodes[(i + 3) % walletNodes.length]
    links.push({ source: tx.id, target: dst.id, type: "RECEIVED", amount: tx.amount })
  })

  // wallet → ip (CONNECTED_FROM) — sparse
  walletNodes.slice(0, 30).forEach((w, i) => {
    const ip = ipNodes[i % ipNodes.length]
    links.push({ source: w.id, target: ip.id, type: "CONNECTED_FROM", amount: 0 })
  })

  // ip → asn (BELONGS_TO)
  ipNodes.forEach((ip, i) => {
    links.push({ source: ip.id, target: asnNodes[i % asnNodes.length].id, type: "BELONGS_TO", amount: 0 })
  })

  // Extra wallet→wallet (cluster same cluster ID)
  for (let i = 0; i < 40; i++) {
    const a = walletNodes[Math.floor(Math.random() * walletNodes.length)]
    const b = walletNodes[Math.floor(Math.random() * walletNodes.length)]
    if (a.id !== b.id) {
      links.push({ source: a.id, target: b.id, type: "SENT", amount: parseFloat(rnd(0.001,5).toFixed(6)) })
    }
  }

  return { nodes, links }
}

export const MOCK_GRAPH = generateMockGraph(120)
