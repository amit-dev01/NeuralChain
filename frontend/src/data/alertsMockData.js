// Mock alerts data for NeuralChain Alert Center
// TODO: Replace with GET /api/v1/alerts?page=1&limit=25&sort=risk_score&order=desc

const REASONS_POOL = [
  { label: "Fee ratio 3.2σ above mean",   icon: "TrendingUp" },
  { label: "Fan-out = 83 outputs",         icon: "GitBranch"  },
  { label: "IP in 47 txs / 2 min",         icon: "Zap"        },
  { label: "Round-amount 0.5 BTC",         icon: "CircleDot"  },
  { label: "Peel-chain depth 12",          icon: "ArrowRight" },
  { label: "Address reuse ×47",            icon: "RefreshCw"  },
  { label: "Known darknet cluster #14",    icon: "AlertTriangle" },
  { label: "High mixing score (0.94)",     icon: "Shuffle"    },
  { label: "Tx velocity 12/min",           icon: "Activity"   },
  { label: "Anomaly score 2.8σ",           icon: "BarChart2"  },
  { label: "Cluster risk 0.87",            icon: "Network"    },
  { label: "DBSCAN cluster outlier",       icon: "Hexagon"    },
]

const MODELS  = ["XGBoost","Isolation Forest","Autoencoder","Node2Vec+DBSCAN"]
const STATUSES = ["New","New","New","Under Review","Confirmed","Dismissed"]
const WALLETS  = [
  "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",
  "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
  "bc1qxy2kgdygjrs6et80gfqrmx6jvqk7pg",
  "1BpEi6DfDAUFd4jeFVmRNpqbCTXh3MFpKY",
  "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5",
  "bc1qar0srrr7xfkvcy6l3r7jal7q9p5ke",
  "1DUb2YYbQA1jjaNYzVXLZ7ZioEhLXtbUru",
  "3Nxwenay9Z8Lc9JBiywExpnEFiLp6Afp8v",
  "1GHkZePVMzHuD3U7E5LY8QM1xTqTVT9pS",
  "3QJmV3qfvL6sbDNetKtjB5Znt7UEKcXFd",
  "bc1qw508d6qejxtdg4y5r3zarvary0c5xw",
  "1HLoD9E4SDFFPDiYfNYnkBLQ85Y51J3Zb1",
]

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function sha256() { return Array.from({length:64},()=>"0123456789abcdef"[Math.floor(Math.random()*16)]).join("") }
function rnd(a,b) { return Math.random()*(b-a)+a }

function minutesAgo(min) {
  const d = new Date(Date.now() - min * 60000)
  return d.toISOString()
}

const SHAP_FEATURES = [
  "fee_ratio","fan_out","ip_tx_velocity","address_reuse",
  "round_amount","cluster_risk","hop_depth","tx_amount_dev",
]

export function generateAlerts(count = 247) {
  return Array.from({ length: count }, (_, i) => {
    const risk = parseFloat(rnd(0.1, 0.99).toFixed(3))
    const wallet = WALLETS[i % WALLETS.length]
    const model  = pick(MODELS)
    const reasons = REASONS_POOL.slice(0, 3).map((r, j) => REASONS_POOL[(i+j) % REASONS_POOL.length])
    const ageMin  = Math.floor(rnd(1, 14400))

    return {
      id:        2000 + i,
      wallet,
      walletShort: wallet.slice(0,8) + "…" + wallet.slice(-6),
      risk,
      reasons,
      model,
      timestamp:  minutesAgo(ageMin),
      ageMin,
      status:    pick(STATUSES),
      cluster:   Math.floor(rnd(1, 60)),
      entityLabel: risk > 0.85
        ? pick(["Likely Ransomware Operator","Suspected Mixer","Darknet Market Wallet"])
        : pick(["Unknown Entity","Low-Risk Wallet","Exchange Account"]),
      shapValues: SHAP_FEATURES.map(f => ({
        feature: f,
        value:   parseFloat(rnd(-0.6, 0.8).toFixed(3)),
      })),
      shapSummary: `This wallet was flagged by ${model} for exhibiting ${
        risk > 0.85 ? "ransomware-pattern" : "anomalous"
      } behavior: round-number payments, high address reuse, and originating IP seen across ${
        Math.floor(rnd(20,100))
      } transactions in under 5 minutes.`,
      evidenceTxids: Array.from({length:5}, () => ({
        txid:   sha256(),
        amount: parseFloat(rnd(0.001, 5).toFixed(6)),
        ts:     minutesAgo(Math.floor(rnd(1, ageMin))),
        flag:   pick(["ROUND_AMOUNT","HIGH_FAN_OUT","PEEL_CHAIN","VELOCITY"]),
      })),
    }
  })
}

export const MOCK_ALERTS = generateAlerts(247)

// 7-day trend data
export const TREND_DATA = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(Date.now() - (6-i)*86400000)
  return {
    day:       d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric"}),
    total:     Math.floor(rnd(180,320)),
    critical:  Math.floor(rnd(30,60)),
    confirmed: Math.floor(rnd(10,40)),
  }
})
