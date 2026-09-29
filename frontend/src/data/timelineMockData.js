// Mock data for NeuralChain Transaction Timeline (/timeline)
// TODO: Replace with:
//   - GET /api/v1/timeline?from={ts}&to={ts}&granularity=5m
//   - GET /api/v1/timeline/peel-chains?limit=5
//   - GET /api/v1/timeline/rapid-reuse

// ─── Deterministic Seeded Random / Base Anchor ──────────────────────────────
const BASE_NOW = new Date()
// Align to top of current hour for clean round intervals
const ANCHOR_TIME = new Date(BASE_NOW.getFullYear(), BASE_NOW.getMonth(), BASE_NOW.getDate(), BASE_NOW.getHours(), 0, 0, 0).getTime()
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const START_TIME = ANCHOR_TIME - ONE_DAY_MS

export { ANCHOR_TIME, START_TIME }

// ─── 1. Volume Data (288 buckets for 24h at 5-min intervals) ─────────────────
export function generateVolumeData() {
  const data = []
  const burstIndices = [38, 116, 173, 226, 267] // roughly 03:10, 09:40, 14:25, 18:50, 22:15

  for (let i = 0; i < 288; i++) {
    const bucketTs = START_TIME + i * 5 * 60 * 1000
    const d = new Date(bucketTs)
    const hh = String(d.getHours()).padStart(2, "0")
    const mm = String(d.getMinutes()).padStart(2, "0")
    const timeLabel = `${hh}:${mm}`
    const isoString = d.toISOString()

    // Base cyclical traffic (higher during afternoon, lower at 4 AM)
    const hour = d.getHours()
    const diurnalFactor = 0.6 + 0.5 * Math.sin(((hour - 6) / 24) * 2 * Math.PI)
    let txCount = Math.floor(diurnalFactor * 650 + 250 + (i % 7) * 22)
    let flaggedCount = Math.floor(txCount * 0.05 + ((i % 5) * 4))

    let isBurst = false
    let burstLabel = null

    // Inject bursts
    if (i === 173) {
      // 14:25 - matches prompt: "Burst Detected: 847 tx in 3 min"
      txCount = 1420
      flaggedCount = 312
      isBurst = true
      burstLabel = "Burst Detected: 847 tx in 3 min"
    } else if (i === 38) {
      // 03:10
      txCount = 1180
      flaggedCount = 245
      isBurst = true
      burstLabel = "Burst Detected: 620 tx in 3 min"
    } else if (i === 116) {
      // 09:40
      txCount = 1680
      flaggedCount = 410
      isBurst = true
      burstLabel = "Burst Detected: 1,140 tx in 4 min"
    } else if (i === 226) {
      // 18:50
      txCount = 1540
      flaggedCount = 370
      isBurst = true
      burstLabel = "Burst Detected: 980 tx in 3 min"
    } else if (i === 267) {
      // 22:15
      txCount = 1260
      flaggedCount = 280
      isBurst = true
      burstLabel = "Burst Detected: 720 tx in 2 min"
    }

    data.push({
      index: i,
      time: timeLabel,
      timestamp: bucketTs,
      iso: isoString,
      txCount,
      flaggedCount,
      isBurst,
      burstLabel,
    })
  }
  return data
}

export const VOLUME_DATA = generateVolumeData()

// ─── Anomaly Burst Events (ReferenceLines & Badges) ──────────────────────────
export const BURST_ANOMALIES = [
  {
    id: "burst-1",
    index: 38,
    time: VOLUME_DATA[38].time,
    timestamp: VOLUME_DATA[38].timestamp,
    txCount: 620,
    duration: "3 min",
    timeWindow: `${VOLUME_DATA[38].time}–${VOLUME_DATA[39].time}`,
    label: "Burst Detected: 620 tx in 3 min",
    entitiesCount: 3,
    risk: 0.88,
  },
  {
    id: "burst-2",
    index: 116,
    time: VOLUME_DATA[116].time,
    timestamp: VOLUME_DATA[116].timestamp,
    txCount: 1140,
    duration: "4 min",
    timeWindow: `${VOLUME_DATA[116].time}–${VOLUME_DATA[117].time}`,
    label: "Burst Detected: 1,140 tx in 4 min",
    entitiesCount: 5,
    risk: 0.94,
  },
  {
    id: "burst-3",
    index: 173,
    time: VOLUME_DATA[173].time,
    timestamp: VOLUME_DATA[173].timestamp,
    txCount: 847,
    duration: "3 min",
    timeWindow: "14:23–14:26",
    label: "Burst Detected: 847 tx in 3 min",
    entitiesCount: 3,
    risk: 0.96,
  },
  {
    id: "burst-4",
    index: 226,
    time: VOLUME_DATA[226].time,
    timestamp: VOLUME_DATA[226].timestamp,
    txCount: 980,
    duration: "3 min",
    timeWindow: `${VOLUME_DATA[226].time}–${VOLUME_DATA[227].time}`,
    label: "Burst Detected: 980 tx in 3 min",
    entitiesCount: 4,
    risk: 0.91,
  },
  {
    id: "burst-5",
    index: 267,
    time: VOLUME_DATA[267].time,
    timestamp: VOLUME_DATA[267].timestamp,
    txCount: 720,
    duration: "2 min",
    timeWindow: `${VOLUME_DATA[267].time}–${VOLUME_DATA[268].time}`,
    label: "Burst Detected: 720 tx in 2 min",
    entitiesCount: 3,
    risk: 0.85,
  },
]

// ─── 2. Velocity Heatmap (7 days × 24 hours = 168 cells) ──────────────────────
const DAYS = [
  { short: "Mon", full: "Monday" },
  { short: "Tue", full: "Tuesday" },
  { short: "Wed", full: "Wednesday" },
  { short: "Thu", full: "Thursday" },
  { short: "Fri", full: "Friday" },
  { short: "Sat", full: "Saturday" },
  { short: "Sun", full: "Sunday" },
]

export function generateHeatmapData() {
  const grid = []
  // Fixed max for color normalization (max ~3,200)
  const maxTx = 3200

  DAYS.forEach((day, dayIndex) => {
    const row = []
    for (let hour = 0; hour < 24; hour++) {
      const timeStr = `${String(hour).padStart(2, "0")}:00`
      let count = 0
      let flagged = 0

      // Exact match for specification:
      // "Tuesday 14:00 — 2,847 transactions, 34 flagged"
      if (day.full === "Tuesday" && hour === 14) {
        count = 2847
        flagged = 34
      } else {
        // Base realistic variation
        const weekendPenalty = dayIndex >= 5 ? 0.7 : 1.0
        const hourPeak = Math.sin(((hour - 4) / 20) * Math.PI)
        const normalizedPeak = Math.max(0.15, hourPeak)
        const noise = ((dayIndex * 17 + hour * 23) % 29) / 29
        count = Math.floor((normalizedPeak * 1800 + noise * 600 + 350) * weekendPenalty)
        // Occasional hotspots
        if ((dayIndex === 3 && hour === 16) || (dayIndex === 4 && hour === 20)) {
          count = Math.floor(count * 1.45)
        }
        flagged = Math.max(2, Math.floor(count * 0.015 + ((dayIndex + hour) % 7)))
      }

      row.push({
        dayIndex,
        dayName: day.full,
        dayShort: day.short,
        hour,
        timeLabel: timeStr,
        txCount: count,
        flaggedCount: flagged,
      })
    }
    grid.push(row)
  })

  return { grid, maxTx }
}

export const HEATMAP_DATA = generateHeatmapData()

// ─── 3. Entity Activity Swim Lanes (Top 10 High-Risk Entities) ────────────────
export const SWIM_LANE_ENTITIES = [
  {
    id: "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",
    shortId: "1A1zP1eP…Divf",
    type: "wallet",
    label: "Mixer Deposit Hub",
    risk: 0.97,
    events: [
      { id: "ev-1", timeOffsetMin: 45,  amount: 4.82, risk: 0.95, txid: "7f4c91a...3b21", reason: "Direct mixer fan-out hop" },
      { id: "ev-2", timeOffsetMin: 180, amount: 0.65, risk: 0.72, txid: "a310d29...f90e", reason: "Round-value split transaction" },
      { id: "ev-3", timeOffsetMin: 228, amount: 8.40, risk: 0.98, txid: "19bd402...c54a", reason: "Burst velocity: 12 txs in 2m" },
      { id: "ev-4", timeOffsetMin: 420, amount: 2.10, risk: 0.84, txid: "e671c89...071b", reason: "Address reuse hop #4" },
      { id: "ev-5", timeOffsetMin: 580, amount: 14.5, risk: 0.96, txid: "c402e11...99aa", reason: "Large value darknet exit" },
      { id: "ev-6", timeOffsetMin: 864, amount: 1.25, risk: 0.78, txid: "5b88aa0...112e", reason: "Consolidation transfer" },
      { id: "ev-7", timeOffsetMin: 866, amount: 3.90, risk: 0.94, txid: "43aa190...84df", reason: "Simultaneous burst signature" },
      { id: "ev-8", timeOffsetMin: 1130,amount: 6.20, risk: 0.92, txid: "89ee120...00cd", reason: "High fee ratio (3.8σ)" },
      { id: "ev-9", timeOffsetMin: 1335,amount: 0.45, risk: 0.68, txid: "33acbb1...ee71", reason: "Peeling hop dust collector" },
    ],
  },
  {
    id: "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
    shortId: "3J98t1Wp…WNLy",
    type: "wallet",
    label: "Rapid-Reuse Aggregator",
    risk: 0.92,
    events: [
      { id: "ev-10", timeOffsetMin: 110, amount: 1.80, risk: 0.88, txid: "2a3b4c...9d01", reason: "Shared IP cluster reuse" },
      { id: "ev-11", timeOffsetMin: 229, amount: 7.15, risk: 0.96, txid: "6b7c8d...0e12", reason: "Burst cluster participant" },
      { id: "ev-12", timeOffsetMin: 582, amount: 9.30, risk: 0.95, txid: "8c9d0e...1f23", reason: "Darknet link confirmed" },
      { id: "ev-13", timeOffsetMin: 720, amount: 0.35, risk: 0.55, txid: "1e2f3a...4b56", reason: "Standard transfer" },
      { id: "ev-14", timeOffsetMin: 865, amount: 4.10, risk: 0.91, txid: "3a4b5c...6d78", reason: "Burst window simultaneous" },
      { id: "ev-15", timeOffsetMin: 1132,amount: 5.60, risk: 0.89, txid: "5c6d7e...8f90", reason: "Fan-out receiver" },
      { id: "ev-16", timeOffsetMin: 1280,amount: 0.95, risk: 0.74, txid: "7e8f9a...0b12", reason: "Micro-splitting tx" },
    ],
  },
  {
    id: "bc1qxy2kgdygjrs6et80gfqrmx6jvqk7pg",
    shortId: "bc1qxy2k…k7pg",
    type: "wallet",
    label: "Peel-Chain Origin",
    risk: 0.95,
    events: [
      { id: "ev-17", timeOffsetMin: 60,  amount: 14.2, risk: 0.94, txid: "9a0b1c...2d34", reason: "Initial peel root funding" },
      { id: "ev-18", timeOffsetMin: 68,  amount: 12.9, risk: 0.91, txid: "1c2d3e...4f56", reason: "Peel chain hop #1" },
      { id: "ev-19", timeOffsetMin: 228, amount: 11.7, risk: 0.95, txid: "3e4f5a...6b78", reason: "Burst time cascade peel" },
      { id: "ev-20", timeOffsetMin: 581, amount: 9.80, risk: 0.93, txid: "5a6b7c...8d90", reason: "Secondary peel sequence" },
      { id: "ev-21", timeOffsetMin: 865, amount: 6.40, risk: 0.97, txid: "7c8d9e...0f12", reason: "Burst time terminal peel" },
      { id: "ev-22", timeOffsetMin: 1135,amount: 3.20, risk: 0.86, txid: "9e0f1a...2b34", reason: "Final cold-wallet peel" },
    ],
  },
  {
    id: "1BpEi6DfDAUFd4jeFVmRNpqbCTXh3MFpKY",
    shortId: "1BpEi6Df…FpKY",
    type: "wallet",
    label: "Ransomware Cashout Node",
    risk: 0.89,
    events: [
      { id: "ev-23", timeOffsetMin: 190, amount: 3.40, risk: 0.85, txid: "0a1b2c...3d4e", reason: "Extortion ransom split" },
      { id: "ev-24", timeOffsetMin: 230, amount: 5.90, risk: 0.96, txid: "2c3d4e...5f6a", reason: "Burst coordinated egress" },
      { id: "ev-25", timeOffsetMin: 450, amount: 0.80, risk: 0.62, txid: "4e5f6a...7b8c", reason: "Fee pre-allocation" },
      { id: "ev-26", timeOffsetMin: 866, amount: 6.80, risk: 0.93, txid: "6a7b8c...9d0e", reason: "Burst window active entity" },
      { id: "ev-27", timeOffsetMin: 1040,amount: 2.20, risk: 0.77, txid: "8c9d0e...1f2a", reason: "P2P OTC swap broadcast" },
      { id: "ev-28", timeOffsetMin: 1340,amount: 1.10, risk: 0.70, txid: "0e1f2a...3b4c", reason: "Change return output" },
    ],
  },
  {
    id: "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5",
    shortId: "3FZbgi29…tZc5",
    type: "wallet",
    label: "High-Frequency Relay",
    risk: 0.86,
    events: [
      { id: "ev-29", timeOffsetMin: 95,  amount: 0.45, risk: 0.60, txid: "a1b2c3...d4e5", reason: "Relay test packet" },
      { id: "ev-30", timeOffsetMin: 227, amount: 3.10, risk: 0.89, txid: "b2c3d4...e5f6", reason: "Burst entry relay" },
      { id: "ev-31", timeOffsetMin: 340, amount: 1.95, risk: 0.75, txid: "c3d4e5...f6a7", reason: "Relay batch dispatch" },
      { id: "ev-32", timeOffsetMin: 580, amount: 4.80, risk: 0.92, txid: "d4e5f6...a7b8", reason: "Burst bridge relay" },
      { id: "ev-33", timeOffsetMin: 864, amount: 2.50, risk: 0.90, txid: "e5f6a7...b8c9", reason: "Burst synchronization relay" },
      { id: "ev-34", timeOffsetMin: 1133,amount: 3.75, risk: 0.84, txid: "f6a7b8...c9d0", reason: "High-throughput pass" },
      { id: "ev-35", timeOffsetMin: 1390,amount: 0.50, risk: 0.58, txid: "a7b8c9...d0e1", reason: "Residual clean-up" },
    ],
  },
  {
    id: "bc1qar0srrr7xfkvcy6l3r7jal7q9p5ke",
    shortId: "bc1qar0s…p5ke",
    type: "wallet",
    label: "CoinJoin Mixing Participant",
    risk: 0.83,
    events: [
      { id: "ev-36", timeOffsetMin: 150, amount: 0.054,risk: 0.71, txid: "b8c9d0...e1f2", reason: "Standard denomination round" },
      { id: "ev-37", timeOffsetMin: 310, amount: 0.054,risk: 0.71, txid: "c9d0e1...f2a3", reason: "Whirlpool mix round 2" },
      { id: "ev-38", timeOffsetMin: 583, amount: 1.08, risk: 0.88, txid: "d0e1f2...a3b4", reason: "Post-mix consolidation" },
      { id: "ev-39", timeOffsetMin: 867, amount: 0.054,risk: 0.82, txid: "e1f2a3...b4c5", reason: "Burst period coinjoin join" },
      { id: "ev-40", timeOffsetMin: 1200,amount: 2.15, risk: 0.86, txid: "f2a3b4...c5d6", reason: "Split to non-KYC service" },
    ],
  },
  {
    id: "1DUb2YYbQA1jjaNYzVXLZ7ZioEhLXtbUru",
    shortId: "1DUb2YYb…bUru",
    type: "wallet",
    label: "Darknet Market Escrow",
    risk: 0.88,
    events: [
      { id: "ev-41", timeOffsetMin: 180, amount: 5.20, risk: 0.89, txid: "01a2b3...c4d5", reason: "Escrow multisig release" },
      { id: "ev-42", timeOffsetMin: 410, amount: 1.45, risk: 0.76, txid: "12b3c4...d5e6", reason: "Vendor dispute settlement" },
      { id: "ev-43", timeOffsetMin: 581, amount: 8.90, risk: 0.94, txid: "23c4d5...e6f7", reason: "Coordinated market batch" },
      { id: "ev-44", timeOffsetMin: 920, amount: 3.10, risk: 0.83, txid: "34d5e6...f7a8", reason: "Automated withdrawal" },
      { id: "ev-45", timeOffsetMin: 1134,amount: 7.40, risk: 0.91, txid: "45e6f7...a8b9", reason: "Vendor payout batch" },
    ],
  },
  {
    id: "3Nxwenay9Z8Lc9JBiywExpnEFiLp6Afp8v",
    shortId: "3Nxwenay…fp8v",
    type: "wallet",
    label: "Unregistered MSB Gateway",
    risk: 0.81,
    events: [
      { id: "ev-46", timeOffsetMin: 75,  amount: 2.80, risk: 0.79, txid: "56f7a8...b9c0", reason: "Fiat off-ramp conversion" },
      { id: "ev-47", timeOffsetMin: 228, amount: 6.50, risk: 0.90, txid: "67a8b9...c0d1", reason: "Burst liquidity injection" },
      { id: "ev-48", timeOffsetMin: 510, amount: 1.20, risk: 0.65, txid: "78b9c0...d1e2", reason: "Single retail client tx" },
      { id: "ev-49", timeOffsetMin: 780, amount: 4.30, risk: 0.82, txid: "89c0d1...e2f3", reason: "Cross-border settlement" },
      { id: "ev-50", timeOffsetMin: 1131,amount: 5.10, risk: 0.88, txid: "90d1e2...f3a4", reason: "Inter-exchange arbitrage" },
    ],
  },
  {
    id: "185.220.101.45 (Tor Exit)",
    shortId: "185.220…Tor",
    type: "ip",
    label: "Tor Exit Relay Cluster",
    risk: 0.96,
    events: [
      { id: "ev-51", timeOffsetMin: 40,  amount: 3.10, risk: 0.92, txid: "a1c2e3...f4a5", reason: "Tor-routed broadcast" },
      { id: "ev-52", timeOffsetMin: 227, amount: 12.4, risk: 0.98, txid: "b2d3f4...a5b6", reason: "Burst signature epicenter" },
      { id: "ev-53", timeOffsetMin: 580, amount: 8.60, risk: 0.97, txid: "c3e4a5...b6c7", reason: "Coordinated cluster push" },
      { id: "ev-54", timeOffsetMin: 865, amount: 15.2, risk: 0.99, txid: "d4f5b6...c7d8", reason: "Burst signature epicenter" },
      { id: "ev-55", timeOffsetMin: 1132,amount: 9.90, risk: 0.94, txid: "e5a6c7...d8e9", reason: "Burst signature broadcast" },
      { id: "ev-56", timeOffsetMin: 1350,amount: 2.40, risk: 0.88, txid: "f6b7d8...e9fa", reason: "Tor proxy wallet release" },
    ],
  },
  {
    id: "194.26.29.112 (VPN Mesh)",
    shortId: "194.26…VPN",
    type: "ip",
    label: "Bulletproof Hosting Node",
    risk: 0.91,
    events: [
      { id: "ev-57", timeOffsetMin: 115, amount: 2.20, risk: 0.85, txid: "1a3c5e...7g9i", reason: "Automated API key bot" },
      { id: "ev-58", timeOffsetMin: 229, amount: 6.80, risk: 0.93, txid: "2b4d6f...8h0j", reason: "Burst signature relay" },
      { id: "ev-59", timeOffsetMin: 460, amount: 1.50, risk: 0.74, txid: "3c5e7g...9i1k", reason: "P2P daemon sync" },
      { id: "ev-60", timeOffsetMin: 866, amount: 7.40, risk: 0.95, txid: "4d6f8h...0j2l", reason: "Burst signature active peer" },
      { id: "ev-61", timeOffsetMin: 1134,amount: 4.80, risk: 0.89, txid: "5e7g9i...1k3m", reason: "Mass transaction injector" },
      { id: "ev-62", timeOffsetMin: 1410,amount: 0.80, risk: 0.69, txid: "6f8h0j...2l4n", reason: "Periodic heartbeat ping" },
    ],
  },
]

// Add exact timestamps to swim lane events based on START_TIME
SWIM_LANE_ENTITIES.forEach(entity => {
  entity.events.forEach(ev => {
    ev.timestamp = START_TIME + ev.timeOffsetMin * 60 * 1000
    const d = new Date(ev.timestamp)
    const hh = String(d.getHours()).padStart(2, "0")
    const mm = String(d.getMinutes()).padStart(2, "0")
    ev.timeStr = `${hh}:${mm}`
  })
})

// ─── 4. Peel Chains Data (Top 5 Sequential Chains) ───────────────────────────
export const PEEL_CHAINS = [
  {
    id: "PC-8491",
    length: 12,
    totalMoved: 14.2,
    duration: "8 min 34 sec",
    peelingFee: "avg 0.003 BTC",
    riskScore: 0.91,
    startTime: "14:22:10",
    rootWallet: "bc1qxy2kgdygjrs6et80gfqrmx6jvqk7pg",
    hops: [
      { type: "wallet", id: "bc1qxy2kgdygjrs6et80gfqrmx6jvqk7pg", label: "bc1qxy…k7pg", role: "Origin Root", balance: "14.200 BTC" },
      { type: "tx", id: "tx_98f4e271a0", label: "tx_98f4e2", amount: "1.234 BTC peeled", fee: "0.0031 BTC" },
      { type: "wallet", id: "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf", label: "1A1zP1…Divf", role: "Peel Hop 1", balance: "12.963 BTC" },
      { type: "tx", id: "tx_44b91ac09d", label: "tx_44b91a", amount: "1.189 BTC peeled", fee: "0.0029 BTC" },
      { type: "wallet", id: "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", label: "3J98t1…WNLy", role: "Peel Hop 2", balance: "11.771 BTC" },
      { type: "tx", id: "tx_77c24f881b", label: "tx_77c24f", amount: "1.050 BTC peeled", fee: "0.0030 BTC" },
      { type: "wallet", id: "1BpEi6DfDAUFd4jeFVmRNpqbCTXh3MFpKY", label: "1BpEi6…FpKY", role: "Peel Hop 3", balance: "10.718 BTC" },
      { type: "tx", id: "tx_12e98d447a", label: "tx_12e98d", amount: "1.320 BTC peeled", fee: "0.0032 BTC" },
      { type: "wallet", id: "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5", label: "3FZbgi…tZc5", role: "Peel Hop 4", balance: "9.395 BTC" },
      { type: "tx", id: "tx_55fa1100e4", label: "tx_55fa11", amount: "0.985 BTC peeled", fee: "0.0028 BTC" },
      { type: "wallet", id: "bc1qar0srrr7xfkvcy6l3r7jal7q9p5ke", label: "bc1qar…p5ke", role: "Peel Hop 5", balance: "8.407 BTC" },
      { type: "tx", id: "tx_88de3910c2", label: "tx_88de39", amount: "1.140 BTC peeled", fee: "0.0030 BTC" },
      { type: "wallet", id: "1DUb2YYbQA1jjaNYzVXLZ7ZioEhLXtbUru", label: "1DUb2Y…bUru", role: "Peel Hop 6", balance: "7.264 BTC" },
      { type: "tx", id: "tx_33bc99401f", label: "tx_33bc99", amount: "1.210 BTC peeled", fee: "0.0031 BTC" },
      { type: "wallet", id: "3Nxwenay9Z8Lc9JBiywExpnEFiLp6Afp8v", label: "3Nxwen…fp8v", role: "Peel Hop 7", balance: "6.051 BTC" },
      { type: "tx", id: "tx_01fe8811dd", label: "tx_01fe88", amount: "1.090 BTC peeled", fee: "0.0029 BTC" },
      { type: "wallet", id: "1GHkZePVMzHuD3U7E5LY8QM1xTqTVT9pS", label: "1GHkZe…T9pS", role: "Peel Hop 8", balance: "4.958 BTC" },
      { type: "tx", id: "tx_66ab44901e", label: "tx_66ab44", amount: "1.150 BTC peeled", fee: "0.0032 BTC" },
      { type: "wallet", id: "3QJmV3qfvL6sbDNetKtjB5Znt7UEKcXFd", label: "3QJmV3…cXFd", role: "Peel Hop 9", balance: "3.805 BTC" },
      { type: "tx", id: "tx_29dc1177ba", label: "tx_29dc11", amount: "1.300 BTC peeled", fee: "0.0033 BTC" },
      { type: "wallet", id: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw", label: "bc1qw5…c5xw", role: "Peel Hop 10", balance: "2.502 BTC" },
      { type: "tx", id: "tx_90ff33118a", label: "tx_90ff33", amount: "1.100 BTC peeled", fee: "0.0027 BTC" },
      { type: "wallet", id: "1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1", label: "1HLoD9…3Zb1", role: "Terminal Peel Sink", balance: "1.399 BTC" },
    ],
  },
  {
    id: "PC-7230",
    length: 9,
    totalMoved: 8.75,
    duration: "5 min 12 sec",
    peelingFee: "avg 0.0028 BTC",
    riskScore: 0.88,
    startTime: "09:38:40",
    rootWallet: "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
    hops: [
      { type: "wallet", id: "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", label: "3J98t1…WNLy", role: "Origin Root", balance: "8.750 BTC" },
      { type: "tx", id: "tx_34a1c900e1", label: "tx_34a1c9", amount: "0.980 BTC peeled", fee: "0.0028 BTC" },
      { type: "wallet", id: "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf", label: "1A1zP1…Divf", role: "Peel Hop 1", balance: "7.767 BTC" },
      { type: "tx", id: "tx_91ff82b3a4", label: "tx_91ff82", amount: "0.950 BTC peeled", fee: "0.0027 BTC" },
      { type: "wallet", id: "bc1qar0srrr7xfkvcy6l3r7jal7q9p5ke", label: "bc1qar…p5ke", role: "Peel Hop 2", balance: "6.814 BTC" },
      { type: "tx", id: "tx_12cc447789", label: "tx_12cc44", amount: "1.020 BTC peeled", fee: "0.0029 BTC" },
      { type: "wallet", id: "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5", label: "3FZbgi…tZc5", role: "Peel Hop 3", balance: "5.791 BTC" },
      { type: "tx", id: "tx_78dd0012ba", label: "tx_78dd00", amount: "1.100 BTC peeled", fee: "0.0028 BTC" },
      { type: "wallet", id: "1DUb2YYbQA1jjaNYzVXLZ7ZioEhLXtbUru", label: "1DUb2Y…bUru", role: "Terminal Sink", balance: "4.688 BTC" },
    ],
  },
  {
    id: "PC-9104",
    length: 15,
    totalMoved: 22.4,
    duration: "14 min 02 sec",
    peelingFee: "avg 0.0032 BTC",
    riskScore: 0.95,
    startTime: "18:48:22",
    rootWallet: "1BpEi6DfDAUFd4jeFVmRNpqbCTXh3MFpKY",
    hops: [
      { type: "wallet", id: "1BpEi6DfDAUFd4jeFVmRNpqbCTXh3MFpKY", label: "1BpEi6…FpKY", role: "Origin Root", balance: "22.400 BTC" },
      { type: "tx", id: "tx_72e81b99a0", label: "tx_72e81b", amount: "1.450 BTC peeled", fee: "0.0033 BTC" },
      { type: "wallet", id: "3Nxwenay9Z8Lc9JBiywExpnEFiLp6Afp8v", label: "3Nxwen…fp8v", role: "Peel Hop 1", balance: "20.946 BTC" },
      { type: "tx", id: "tx_01bb7744cc", label: "tx_01bb77", amount: "1.520 BTC peeled", fee: "0.0031 BTC" },
      { type: "wallet", id: "bc1qxy2kgdygjrs6et80gfqrmx6jvqk7pg", label: "bc1qxy…k7pg", role: "Peel Hop 2", balance: "19.423 BTC" },
      { type: "tx", id: "tx_89ff4411ee", label: "tx_89ff44", amount: "1.490 BTC peeled", fee: "0.0034 BTC" },
      { type: "wallet", id: "1Nd9s8V83Qp8rTx1Jk7W7d9E2y5B8A1C4F", label: "1Nd9s8…1C4F", role: "Peel Hop 3", balance: "17.929 BTC" },
      { type: "tx", id: "tx_44aa0099ff", label: "tx_44aa00", amount: "1.600 BTC peeled", fee: "0.0030 BTC" },
      { type: "wallet", id: "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo", label: "34xp4v…wseo", role: "Terminal Sink", balance: "16.326 BTC" },
    ],
  },
  {
    id: "PC-5512",
    length: 8,
    totalMoved: 6.1,
    duration: "4 min 45 sec",
    peelingFee: "avg 0.0025 BTC",
    riskScore: 0.79,
    startTime: "03:08:15",
    rootWallet: "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5",
    hops: [
      { type: "wallet", id: "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5", label: "3FZbgi…tZc5", role: "Origin Root", balance: "6.100 BTC" },
      { type: "tx", id: "tx_51d0aa882c", label: "tx_51d0aa", amount: "0.820 BTC peeled", fee: "0.0024 BTC" },
      { type: "wallet", id: "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf", label: "1A1zP1…Divf", role: "Peel Hop 1", balance: "5.277 BTC" },
      { type: "tx", id: "tx_22cc9911e3", label: "tx_22cc99", amount: "0.780 BTC peeled", fee: "0.0026 BTC" },
      { type: "wallet", id: "bc1qar0srrr7xfkvcy6l3r7jal7q9p5ke", label: "bc1qar…p5ke", role: "Terminal Sink", balance: "4.494 BTC" },
    ],
  },
  {
    id: "PC-6789",
    length: 11,
    totalMoved: 11.8,
    duration: "7 min 20 sec",
    peelingFee: "avg 0.0029 BTC",
    riskScore: 0.92,
    startTime: "22:12:00",
    rootWallet: "1DUb2YYbQA1jjaNYzVXLZ7ZioEhLXtbUru",
    hops: [
      { type: "wallet", id: "1DUb2YYbQA1jjaNYzVXLZ7ZioEhLXtbUru", label: "1DUb2Y…bUru", role: "Origin Root", balance: "11.800 BTC" },
      { type: "tx", id: "tx_83b54fe01a", label: "tx_83b54f", amount: "1.120 BTC peeled", fee: "0.0029 BTC" },
      { type: "wallet", id: "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", label: "3J98t1…WNLy", role: "Peel Hop 1", balance: "10.677 BTC" },
      { type: "tx", id: "tx_14aa8822ff", label: "tx_14aa88", amount: "1.080 BTC peeled", fee: "0.0030 BTC" },
      { type: "wallet", id: "1BpEi6DfDAUFd4jeFVmRNpqbCTXh3MFpKY", label: "1BpEi6…FpKY", role: "Terminal Sink", balance: "9.594 BTC" },
    ],
  },
]

// ─── 5. Rapid Reuse Timeline Data ────────────────────────────────────────────
export const RAPID_REUSE_DATA = [
  {
    ip: "185.220.101.45",
    geo: "Frankfurt, Germany",
    asn: "AS9009 M247 Europe",
    walletsCount: 6,
    wallets: [
      "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",
      "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
      "bc1qxy2kgdygjrs6et80gfqrmx6jvqk7pg",
      "1BpEi6DfDAUFd4jeFVmRNpqbCTXh3MFpKY",
      "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5",
      "bc1qar0srrr7xfkvcy6l3r7jal7q9p5ke",
    ],
    txCount: 47,
    timeWindow: "2 min 18 sec",
    timeWindowSec: 138,
    risk: 0.94,
    detectionModel: "XGBoost + IF",
    // 47 transaction events relative to 0s
    events: [
      { sec: 2,  txid: "9f8a...110", amount: 1.2, wallet: "1A1zP1..." },
      { sec: 5,  txid: "8e7b...221", amount: 0.8, wallet: "3J98t1..." },
      { sec: 9,  txid: "7d6c...332", amount: 2.4, wallet: "bc1qxy..." },
      { sec: 11, txid: "6c5d...443", amount: 0.5, wallet: "1A1zP1..." },
      { sec: 14, txid: "5b4e...554", amount: 3.1, wallet: "1BpEi6..." },
      { sec: 18, txid: "4a3f...665", amount: 1.7, wallet: "3FZbgi..." },
      { sec: 22, txid: "3920...776", amount: 0.9, wallet: "bc1qar..." },
      { sec: 27, txid: "2811...887", amount: 4.2, wallet: "3J98t1..." },
      { sec: 31, txid: "1702...998", amount: 1.1, wallet: "bc1qxy..." },
      { sec: 35, txid: "06f3...009", amount: 0.4, wallet: "1BpEi6..." },
      { sec: 40, txid: "f5e4...11a", amount: 2.8, wallet: "1A1zP1..." },
      { sec: 44, txid: "e4d5...22b", amount: 3.6, wallet: "3FZbgi..." },
      { sec: 49, txid: "d3c6...33c", amount: 0.7, wallet: "bc1qar..." },
      { sec: 53, txid: "c2b7...44d", amount: 1.5, wallet: "3J98t1..." },
      { sec: 58, txid: "b1a8...55e", amount: 5.0, wallet: "1BpEi6..." },
      { sec: 62, txid: "a099...66f", amount: 0.3, wallet: "bc1qxy..." },
      { sec: 67, txid: "9f88...770", amount: 2.1, wallet: "1A1zP1..." },
      { sec: 71, txid: "8e77...881", amount: 1.8, wallet: "3FZbgi..." },
      { sec: 76, txid: "7d66...992", amount: 0.6, wallet: "bc1qar..." },
      { sec: 80, txid: "6c55...003", amount: 3.3, wallet: "3J98t1..." },
      { sec: 85, txid: "5b44...114", amount: 1.9, wallet: "1BpEi6..." },
      { sec: 89, txid: "4a33...225", amount: 0.4, wallet: "bc1qxy..." },
      { sec: 94, txid: "3922...336", amount: 2.7, wallet: "1A1zP1..." },
      { sec: 99, txid: "2811...447", amount: 4.1, wallet: "3FZbgi..." },
      { sec: 104,txid: "1700...558", amount: 0.9, wallet: "bc1qar..." },
      { sec: 109,txid: "06ff...669", amount: 1.6, wallet: "3J98t1..." },
      { sec: 114,txid: "f5ee...77a", amount: 3.8, wallet: "1BpEi6..." },
      { sec: 119,txid: "e4dd...88b", amount: 0.5, wallet: "bc1qxy..." },
      { sec: 124,txid: "d3cc...99c", amount: 2.3, wallet: "1A1zP1..." },
      { sec: 128,txid: "c2bb...00d", amount: 1.4, wallet: "3FZbgi..." },
      { sec: 133,txid: "b1aa...11e", amount: 0.8, wallet: "bc1qar..." },
      { sec: 137,txid: "a099...22f", amount: 2.9, wallet: "3J98t1..." },
    ],
  },
  {
    ip: "194.26.29.112",
    geo: "Amsterdam, Netherlands",
    asn: "AS44558 Severex",
    walletsCount: 8,
    wallets: [
      "1BpEi6DfDAUFd4jeFVmRNpqbCTXh3MFpKY",
      "3Nxwenay9Z8Lc9JBiywExpnEFiLp6Afp8v",
      "bc1qxy2kgdygjrs6et80gfqrmx6jvqk7pg",
      "1Nd9s8V83Qp8rTx1Jk7W7d9E2y5B8A1C4F",
      "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo",
      "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",
      "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
      "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5",
    ],
    txCount: 38,
    timeWindow: "1 min 45 sec",
    timeWindowSec: 105,
    risk: 0.91,
    detectionModel: "Isolation Forest",
    events: [
      { sec: 3,  txid: "bb01...45a", amount: 2.1, wallet: "1BpEi6..." },
      { sec: 8,  txid: "cc12...67b", amount: 1.4, wallet: "3Nxwen..." },
      { sec: 12, txid: "dd23...89c", amount: 3.8, wallet: "bc1qxy..." },
      { sec: 17, txid: "ee34...01d", amount: 0.9, wallet: "1Nd9s8..." },
      { sec: 23, txid: "ff45...23e", amount: 4.5, wallet: "34xp4v..." },
      { sec: 29, txid: "0056...45f", amount: 1.2, wallet: "1A1zP1..." },
      { sec: 35, txid: "1167...67a", amount: 2.9, wallet: "3J98t1..." },
      { sec: 41, txid: "2278...89b", amount: 0.7, wallet: "3FZbgi..." },
      { sec: 47, txid: "3389...01c", amount: 3.4, wallet: "1BpEi6..." },
      { sec: 54, txid: "4490...23d", amount: 1.8, wallet: "3Nxwen..." },
      { sec: 61, txid: "5501...45e", amount: 2.6, wallet: "bc1qxy..." },
      { sec: 68, txid: "6612...67f", amount: 5.1, wallet: "1Nd9s8..." },
      { sec: 75, txid: "7723...89a", amount: 0.4, wallet: "34xp4v..." },
      { sec: 82, txid: "8834...01b", amount: 3.2, wallet: "1A1zP1..." },
      { sec: 91, txid: "9945...23c", amount: 1.6, wallet: "3J98t1..." },
      { sec: 98, txid: "aa56...45d", amount: 2.4, wallet: "3FZbgi..." },
      { sec: 104,txid: "bb67...67e", amount: 4.0, wallet: "1BpEi6..." },
    ],
  },
  {
    ip: "45.154.255.89",
    geo: "Zurich, Switzerland",
    asn: "AS200019 Alexhost",
    walletsCount: 5,
    wallets: [
      "1DUb2YYbQA1jjaNYzVXLZ7ZioEhLXtbUru",
      "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5",
      "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",
      "bc1qar0srrr7xfkvcy6l3r7jal7q9p5ke",
      "3Nxwenay9Z8Lc9JBiywExpnEFiLp6Afp8v",
    ],
    txCount: 29,
    timeWindow: "3 min 10 sec",
    timeWindowSec: 190,
    risk: 0.87,
    detectionModel: "Autoencoder",
    events: [
      { sec: 8,  txid: "ab12...01", amount: 1.7, wallet: "1DUb2Y..." },
      { sec: 24, txid: "cd34...23", amount: 3.1, wallet: "3FZbgi..." },
      { sec: 45, txid: "ef56...45", amount: 0.8, wallet: "1A1zP1..." },
      { sec: 68, txid: "gh78...67", amount: 2.2, wallet: "bc1qar..." },
      { sec: 95, txid: "ij90...89", amount: 4.6, wallet: "3Nxwen..." },
      { sec: 122,txid: "kl12...01", amount: 1.4, wallet: "1DUb2Y..." },
      { sec: 149,txid: "mn34...23", amount: 2.9, wallet: "3FZbgi..." },
      { sec: 175,txid: "op56...45", amount: 0.9, wallet: "1A1zP1..." },
      { sec: 188,txid: "qr78...67", amount: 3.5, wallet: "bc1qar..." },
    ],
  },
  {
    ip: "104.244.76.13",
    geo: "Luxembourg City, Luxembourg",
    asn: "AS53667 Frantech",
    walletsCount: 4,
    wallets: [
      "bc1qxy2kgdygjrs6et80gfqrmx6jvqk7pg",
      "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
      "1BpEi6DfDAUFd4jeFVmRNpqbCTXh3MFpKY",
      "1GHkZePVMzHuD3U7E5LY8QM1xTqTVT9pS",
    ],
    txCount: 22,
    timeWindow: "2 min 05 sec",
    timeWindowSec: 125,
    risk: 0.82,
    detectionModel: "Node2Vec+DBSCAN",
    events: [
      { sec: 5,  txid: "1234...ab", amount: 0.9, wallet: "bc1qxy..." },
      { sec: 22, txid: "2345...bc", amount: 2.1, wallet: "3J98t1..." },
      { sec: 41, txid: "3456...cd", amount: 1.8, wallet: "1BpEi6..." },
      { sec: 63, txid: "4567...de", amount: 3.4, wallet: "1GHkZe..." },
      { sec: 84, txid: "5678...ef", amount: 1.2, wallet: "bc1qxy..." },
      { sec: 105,txid: "6789...fa", amount: 2.5, wallet: "3J98t1..." },
      { sec: 122,txid: "7890...ab", amount: 0.6, wallet: "1BpEi6..." },
    ],
  },
  {
    ip: "198.54.130.64",
    geo: "Keflavik, Iceland",
    asn: "AS206264 Advania",
    walletsCount: 7,
    wallets: [
      "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",
      "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
      "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5",
      "1DUb2YYbQA1jjaNYzVXLZ7ZioEhLXtbUru",
      "3Nxwenay9Z8Lc9JBiywExpnEFiLp6Afp8v",
      "bc1qar0srrr7xfkvcy6l3r7jal7q9p5ke",
      "1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1",
    ],
    txCount: 41,
    timeWindow: "2 min 50 sec",
    timeWindowSec: 170,
    risk: 0.93,
    detectionModel: "XGBoost",
    events: [
      { sec: 4,  txid: "fa01...33", amount: 3.5, wallet: "1A1zP1..." },
      { sec: 18, txid: "fb12...44", amount: 1.9, wallet: "3J98t1..." },
      { sec: 35, txid: "fc23...55", amount: 2.4, wallet: "3FZbgi..." },
      { sec: 52, txid: "fd34...66", amount: 4.1, wallet: "1DUb2Y..." },
      { sec: 71, txid: "fe45...77", amount: 0.8, wallet: "3Nxwen..." },
      { sec: 92, txid: "ff56...88", amount: 2.7, wallet: "bc1qar..." },
      { sec: 114,txid: "0067...99", amount: 1.5, wallet: "1HLoD9..." },
      { sec: 135,txid: "0178...aa", amount: 3.9, wallet: "1A1zP1..." },
      { sec: 156,txid: "0289...bb", amount: 2.2, wallet: "3J98t1..." },
      { sec: 168,txid: "0390...cc", amount: 1.1, wallet: "3FZbgi..." },
    ],
  },
  {
    ip: "91.240.118.232",
    geo: "Nicosia, Cyprus",
    asn: "AS48422 FDC Servers",
    walletsCount: 3,
    wallets: [
      "bc1qxy2kgdygjrs6et80gfqrmx6jvqk7pg",
      "1BpEi6DfDAUFd4jeFVmRNpqbCTXh3MFpKY",
      "bc1qar0srrr7xfkvcy6l3r7jal7q9p5ke",
    ],
    txCount: 18,
    timeWindow: "1 min 20 sec",
    timeWindowSec: 80,
    risk: 0.76,
    detectionModel: "Isolation Forest",
    events: [
      { sec: 4,  txid: "a1b2...99", amount: 1.1, wallet: "bc1qxy..." },
      { sec: 19, txid: "b2c3...88", amount: 0.6, wallet: "1BpEi6..." },
      { sec: 36, txid: "c3d4...77", amount: 2.0, wallet: "bc1qar..." },
      { sec: 51, txid: "d4e5...66", amount: 1.4, wallet: "bc1qxy..." },
      { sec: 68, txid: "e5f6...55", amount: 0.9, wallet: "1BpEi6..." },
      { sec: 78, txid: "f6a7...44", amount: 1.7, wallet: "bc1qar..." },
    ],
  },
  {
    ip: "185.191.171.12",
    geo: "Vilnius, Lithuania",
    asn: "AS49981 Hostinger",
    walletsCount: 5,
    wallets: [
      "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
      "1DUb2YYbQA1jjaNYzVXLZ7ZioEhLXtbUru",
      "3Nxwenay9Z8Lc9JBiywExpnEFiLp6Afp8v",
      "1Nd9s8V83Qp8rTx1Jk7W7d9E2y5B8A1C4F",
      "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo",
    ],
    txCount: 31,
    timeWindow: "3 min 40 sec",
    timeWindowSec: 220,
    risk: 0.85,
    detectionModel: "Autoencoder",
    events: [
      { sec: 12, txid: "11aa...ff", amount: 2.4, wallet: "3J98t1..." },
      { sec: 42, txid: "22bb...ee", amount: 1.8, wallet: "1DUb2Y..." },
      { sec: 75, txid: "33cc...dd", amount: 3.2, wallet: "3Nxwen..." },
      { sec: 110,txid: "44dd...cc", amount: 0.7, wallet: "1Nd9s8..." },
      { sec: 145,txid: "55ee...bb", amount: 2.9, wallet: "34xp4v..." },
      { sec: 180,txid: "66ff...aa", amount: 1.3, wallet: "3J98t1..." },
      { sec: 215,txid: "7700...99", amount: 3.6, wallet: "1DUb2Y..." },
    ],
  },
  {
    ip: "89.248.165.77",
    geo: "Maidenhead, United Kingdom",
    asn: "AS60781 LeaseWeb",
    walletsCount: 6,
    wallets: [
      "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",
      "bc1qxy2kgdygjrs6et80gfqrmx6jvqk7pg",
      "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5",
      "1BpEi6DfDAUFd4jeFVmRNpqbCTXh3MFpKY",
      "bc1qar0srrr7xfkvcy6l3r7jal7q9p5ke",
      "1GHkZePVMzHuD3U7E5LY8QM1xTqTVT9pS",
    ],
    txCount: 34,
    timeWindow: "2 min 30 sec",
    timeWindowSec: 150,
    risk: 0.89,
    detectionModel: "XGBoost",
    events: [
      { sec: 6,  txid: "9911...00", amount: 1.5, wallet: "1A1zP1..." },
      { sec: 25, txid: "8822...11", amount: 2.8, wallet: "bc1qxy..." },
      { sec: 48, txid: "7733...22", amount: 0.9, wallet: "3FZbgi..." },
      { sec: 72, txid: "6644...33", amount: 3.4, wallet: "1BpEi6..." },
      { sec: 95, txid: "5555...44", amount: 1.2, wallet: "bc1qar..." },
      { sec: 120,txid: "4466...55", amount: 2.7, wallet: "1GHkZe..." },
      { sec: 145,txid: "3377...66", amount: 1.9, wallet: "1A1zP1..." },
    ],
  },
]
