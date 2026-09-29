// Mock data for NeuralChain Geographic Intelligence (/geomap)
// TODO: Replace with:
//   - GET /api/v1/geo/heatmap
//   - GET /api/v1/geo/alerts
//   - GET /api/v1/geo/arcs
//   - GET /api/v1/geo/country/{code}

// ─── 1. Stat Summary Cards ──────────────────────────────────────────────────
export const GEO_STATS = {
  countriesInvolved: 47,
  uniqueIps: 9441,
  highRiskIps: 312,
  topCountry: "Russia (1,847 IPs)",
}

// ─── 2. Top Countries Distribution (for BarChart) ───────────────────────────
// Bar color rule: red if country has >50% flagged IPs, else blue
export const COUNTRY_DISTRIBUTION = [
  { name: "Russia", code: "RU", flag: "🇷🇺", ipCount: 1847, flaggedCount: 1024, flaggedPct: 55.4, isRed: true, center: [61.524, 105.318] },
  { name: "Germany", code: "DE", flag: "🇩🇪", ipCount: 1420, flaggedCount: 412,  flaggedPct: 29.0, isRed: false, center: [51.165, 10.451] },
  { name: "USA", code: "US", flag: "🇺🇸", ipCount: 1290, flaggedCount: 280,  flaggedPct: 21.7, isRed: false, center: [37.090, -95.712] },
  { name: "Netherlands", code: "NL", flag: "🇳🇱", ipCount: 1180, flaggedCount: 680,  flaggedPct: 57.6, isRed: true, center: [52.132, 5.291] },
  { name: "Switzerland", code: "CH", flag: "🇨🇭", ipCount: 740,  flaggedCount: 185,  flaggedPct: 25.0, isRed: false, center: [46.818, 8.227] },
  { name: "China", code: "CN", flag: "🇨🇳", ipCount: 690,  flaggedCount: 430,  flaggedPct: 62.3, isRed: true, center: [35.861, 104.195] },
  { name: "UK", code: "GB", flag: "🇬🇧", ipCount: 580,  flaggedCount: 140,  flaggedPct: 24.1, isRed: false, center: [55.378, -3.436] },
  { name: "Iceland", code: "IS", flag: "🇮🇸", ipCount: 420,  flaggedCount: 245,  flaggedPct: 58.3, isRed: true, center: [64.963, -19.020] },
]

// ─── 3. Heatmap Points ──────────────────────────────────────────────────────
// Weighted lat/lng points for IP density
export const HEATMAP_POINTS = [
  // Western Europe Hubs
  { lat: 50.1109, lng: 8.6821, weight: 0.95 }, // Frankfurt
  { lat: 52.5200, lng: 13.4050, weight: 0.78 }, // Berlin
  { lat: 48.1351, lng: 11.5820, weight: 0.65 }, // Munich
  { lat: 53.5511, lng: 9.9937, weight: 0.58 }, // Hamburg
  { lat: 52.3676, lng: 4.9041, weight: 0.92 }, // Amsterdam
  { lat: 51.9244, lng: 4.4777, weight: 0.72 }, // Rotterdam
  { lat: 51.5074, lng: -0.1278, weight: 0.88 }, // London
  { lat: 51.5226, lng: -0.7200, weight: 0.68 }, // Maidenhead
  { lat: 47.3769, lng: 8.5417, weight: 0.82 }, // Zurich
  { lat: 47.1662, lng: 8.5155, weight: 0.90 }, // Zug (Crypto Valley)
  { lat: 49.6116, lng: 6.1319, weight: 0.75 }, // Luxembourg
  { lat: 48.8566, lng: 2.3522, weight: 0.62 }, // Paris
  { lat: 50.6927, lng: 3.1778, weight: 0.70 }, // Roubaix (OVH)

  // Eastern Europe & Russia
  { lat: 55.7558, lng: 37.6173, weight: 0.98 }, // Moscow
  { lat: 59.9343, lng: 30.3351, weight: 0.86 }, // St Petersburg
  { lat: 55.0084, lng: 82.9357, weight: 0.69 }, // Novosibirsk
  { lat: 52.2870, lng: 104.3050, weight: 0.61 }, // Irkutsk
  { lat: 43.1155, lng: 131.8855, weight: 0.55 }, // Vladivostok
  { lat: 54.6872, lng: 25.2797, weight: 0.76 }, // Vilnius
  { lat: 35.1856, lng: 33.3823, weight: 0.84 }, // Nicosia
  { lat: 34.7071, lng: 33.0226, weight: 0.68 }, // Limassol

  // North America
  { lat: 39.0438, lng: -77.4874, weight: 0.94 }, // Ashburn (AWS US-East)
  { lat: 40.7128, lng: -74.0060, weight: 0.88 }, // New York
  { lat: 37.7749, lng: -122.4194, weight: 0.85 }, // San Francisco
  { lat: 30.2672, lng: -97.7431, weight: 0.68 }, // Austin
  { lat: 47.6062, lng: -122.3321, weight: 0.74 }, // Seattle
  { lat: 25.7617, lng: -80.1918, weight: 0.64 }, // Miami
  { lat: 43.6532, lng: -79.3832, weight: 0.59 }, // Toronto
  { lat: 64.1466, lng: -21.9426, weight: 0.87 }, // Reykjavik
  { lat: 63.9999, lng: -22.5600, weight: 0.82 }, // Keflavik

  // Asia / Pacific
  { lat: 31.2304, lng: 121.4737, weight: 0.85 }, // Shanghai
  { lat: 39.9042, lng: 116.4074, weight: 0.82 }, // Beijing
  { lat: 22.3193, lng: 114.1694, weight: 0.90 }, // Hong Kong
  { lat: 1.3521, lng: 103.8198, weight: 0.86 }, // Singapore
  { lat: 35.6762, lng: 139.6503, weight: 0.78 }, // Tokyo
  { lat: 37.5665, lng: 126.9780, weight: 0.69 }, // Seoul
  { lat: 25.0330, lng: 121.5654, weight: 0.64 }, // Taipei
]

// ─── 4. Alert Markers (High-Risk IPs: risk > 0.75) ───────────────────────────
export const ALERT_MARKERS = [
  {
    id: "alert-ip-1",
    ip: "185.220.101.45",
    maskedIp: "185.220.101.x",
    country: "Germany",
    countryCode: "DE",
    flag: "🇩🇪",
    city: "Frankfurt",
    lat: 50.1109,
    lng: 8.6821,
    asn: "Tor Project (AS9009)",
    txCount: 347,
    flaggedCount: 89,
    walletCount: 12,
    risk: 0.94,
    reason: "Tor exit relay signing multi-wallet bursts",
    lastSeen: "2 min ago",
  },
  {
    id: "alert-ip-2",
    ip: "194.26.29.112",
    maskedIp: "194.26.29.x",
    country: "Netherlands",
    countryCode: "NL",
    flag: "🇳🇱",
    city: "Amsterdam",
    lat: 52.3676,
    lng: 4.9041,
    asn: "Severex Bulletproof (AS44558)",
    txCount: 412,
    flaggedCount: 134,
    walletCount: 16,
    risk: 0.91,
    reason: "High concurrency API automated mixing daemon",
    lastSeen: "5 min ago",
  },
  {
    id: "alert-ip-3",
    ip: "45.154.255.89",
    maskedIp: "45.154.255.x",
    country: "Switzerland",
    countryCode: "CH",
    flag: "🇨🇭",
    city: "Zurich",
    lat: 47.3769,
    lng: 8.5417,
    asn: "Alexhost Offshore (AS200019)",
    txCount: 289,
    flaggedCount: 78,
    walletCount: 9,
    risk: 0.87,
    reason: "Non-KYC OTC liquidity pass-through",
    lastSeen: "11 min ago",
  },
  {
    id: "alert-ip-4",
    ip: "198.54.130.64",
    maskedIp: "198.54.130.x",
    country: "Iceland",
    countryCode: "IS",
    flag: "🇮🇸",
    city: "Keflavik",
    lat: 63.9999,
    lng: -22.5600,
    asn: "Advania Hosting (AS206264)",
    txCount: 520,
    flaggedCount: 182,
    walletCount: 22,
    risk: 0.93,
    reason: "Coordinated peel chain cascade injection",
    lastSeen: "14 min ago",
  },
  {
    id: "alert-ip-5",
    ip: "91.240.118.232",
    maskedIp: "91.240.118.x",
    country: "Cyprus",
    countryCode: "CY",
    flag: "🇨🇾",
    city: "Nicosia",
    lat: 35.1856,
    lng: 33.3823,
    asn: "FDC Servers (AS48422)",
    txCount: 198,
    flaggedCount: 64,
    walletCount: 7,
    risk: 0.84,
    reason: "Sanctioned cluster relay proxy",
    lastSeen: "18 min ago",
  },
  {
    id: "alert-ip-6",
    ip: "185.191.171.12",
    maskedIp: "185.191.171.x",
    country: "Lithuania",
    countryCode: "LT",
    flag: "🇱🇹",
    city: "Vilnius",
    lat: 54.6872,
    lng: 25.2797,
    asn: "Hostinger International (AS49981)",
    txCount: 260,
    flaggedCount: 92,
    walletCount: 11,
    risk: 0.85,
    reason: "Rapid IP reuse cross-wallet signatures",
    lastSeen: "22 min ago",
  },
  {
    id: "alert-ip-7",
    ip: "104.244.76.13",
    maskedIp: "104.244.76.x",
    country: "Luxembourg",
    countryCode: "LU",
    flag: "🇱🇺",
    city: "Luxembourg City",
    lat: 49.6116,
    lng: 6.1319,
    asn: "Frantech Solutions (AS53667)",
    txCount: 310,
    flaggedCount: 105,
    walletCount: 14,
    risk: 0.89,
    reason: "Darknet marketplace escrow consolidation",
    lastSeen: "26 min ago",
  },
  {
    id: "alert-ip-8",
    ip: "89.248.165.77",
    maskedIp: "89.248.165.x",
    country: "UK",
    countryCode: "GB",
    flag: "🇬🇧",
    city: "Maidenhead",
    lat: 51.5226,
    lng: -0.7200,
    asn: "LeaseWeb UK (AS60781)",
    txCount: 275,
    flaggedCount: 88,
    walletCount: 10,
    risk: 0.86,
    reason: "Ransomware cash-out proxy node",
    lastSeen: "30 min ago",
  },
  {
    id: "alert-ip-9",
    ip: "95.173.136.24",
    maskedIp: "95.173.136.x",
    country: "Russia",
    countryCode: "RU",
    flag: "🇷🇺",
    city: "Moscow",
    lat: 55.7558,
    lng: 37.6173,
    asn: "Selectel Network (AS49505)",
    txCount: 680,
    flaggedCount: 295,
    walletCount: 28,
    risk: 0.96,
    reason: "Hydra successor darknet exchange exit",
    lastSeen: "4 min ago",
  },
  {
    id: "alert-ip-10",
    ip: "195.123.245.90",
    maskedIp: "195.123.245.x",
    country: "Russia",
    countryCode: "RU",
    flag: "🇷🇺",
    city: "St Petersburg",
    lat: 59.9343,
    lng: 30.3351,
    asn: "Vscale Cloud (AS49505)",
    txCount: 430,
    flaggedCount: 178,
    walletCount: 18,
    risk: 0.92,
    reason: "High velocity CoinJoin mixing agent",
    lastSeen: "8 min ago",
  },
  {
    id: "alert-ip-11",
    ip: "23.129.64.180",
    maskedIp: "23.129.64.x",
    country: "USA",
    countryCode: "US",
    flag: "🇺🇸",
    city: "Ashburn",
    lat: 39.0438,
    lng: -77.4874,
    asn: "Amazon AWS (AS16509)",
    txCount: 390,
    flaggedCount: 112,
    walletCount: 15,
    risk: 0.83,
    reason: "Compromised cloud instance transaction relay",
    lastSeen: "15 min ago",
  },
  {
    id: "alert-ip-12",
    ip: "103.251.167.22",
    maskedIp: "103.251.167.x",
    country: "China",
    countryCode: "CN",
    flag: "🇨🇳",
    city: "Hong Kong",
    lat: 22.3193,
    lng: 114.1694,
    asn: "PCCW Global (AS3491)",
    txCount: 485,
    flaggedCount: 210,
    walletCount: 24,
    risk: 0.95,
    reason: "Capital flight OTC arbitration bridge",
    lastSeen: "7 min ago",
  },
]

// ─── 5. Transaction Arc Pairs ───────────────────────────────────────────────
export const TRANSACTION_ARCS = [
  {
    id: "arc-1",
    srcCountry: "Russia",
    dstCountry: "Germany",
    srcLat: 55.7558,
    srcLng: 37.6173,
    dstLat: 50.1109,
    dstLng: 8.6821,
    volumeBtc: 142.5,
    flagged: true,
    txCount: 840,
  },
  {
    id: "arc-2",
    srcCountry: "Germany",
    dstCountry: "Netherlands",
    srcLat: 50.1109,
    srcLng: 8.6821,
    dstLat: 52.3676,
    dstLng: 4.9041,
    volumeBtc: 98.4,
    flagged: true,
    txCount: 620,
  },
  {
    id: "arc-3",
    srcCountry: "Netherlands",
    dstCountry: "Switzerland",
    srcLat: 52.3676,
    srcLng: 4.9041,
    dstLat: 47.3769,
    dstLng: 8.5417,
    volumeBtc: 76.2,
    flagged: false,
    txCount: 490,
  },
  {
    id: "arc-4",
    srcCountry: "Russia",
    dstCountry: "China",
    srcLat: 55.7558,
    srcLng: 37.6173,
    dstLat: 22.3193,
    dstLng: 114.1694,
    volumeBtc: 115.0,
    flagged: true,
    txCount: 710,
  },
  {
    id: "arc-5",
    srcCountry: "USA",
    dstCountry: "Germany",
    srcLat: 39.0438,
    srcLng: -77.4874,
    dstLat: 50.1109,
    dstLng: 8.6821,
    volumeBtc: 84.1,
    flagged: false,
    txCount: 530,
  },
  {
    id: "arc-6",
    srcCountry: "Switzerland",
    dstCountry: "Luxembourg",
    srcLat: 47.3769,
    srcLng: 8.5417,
    dstLat: 49.6116,
    dstLng: 6.1319,
    volumeBtc: 45.8,
    flagged: true,
    txCount: 310,
  },
  {
    id: "arc-7",
    srcCountry: "Iceland",
    dstCountry: "Netherlands",
    srcLat: 63.9999,
    srcLng: -22.5600,
    dstLat: 52.3676,
    dstLng: 4.9041,
    volumeBtc: 62.3,
    flagged: true,
    txCount: 380,
  },
  {
    id: "arc-8",
    srcCountry: "Cyprus",
    dstCountry: "Russia",
    srcLat: 35.1856,
    srcLng: 33.3823,
    dstLat: 55.7558,
    dstLng: 37.6173,
    volumeBtc: 53.9,
    flagged: true,
    txCount: 290,
  },
  {
    id: "arc-9",
    srcCountry: "UK",
    dstCountry: "USA",
    srcLat: 51.5074,
    srcLng: -0.1278,
    dstLat: 40.7128,
    dstLng: -74.0060,
    volumeBtc: 120.7,
    flagged: false,
    txCount: 780,
  },
  {
    id: "arc-10",
    srcCountry: "Lithuania",
    dstCountry: "Germany",
    srcLat: 54.6872,
    srcLng: 25.2797,
    dstLat: 50.1109,
    dstLng: 8.6821,
    volumeBtc: 38.6,
    flagged: true,
    txCount: 240,
  },
]

// ─── 6. ASN Clusters ────────────────────────────────────────────────────────
export const ASN_CLUSTERS = [
  { asn: "AS9009", name: "Tor Project", lat: 50.1109, lng: 8.6821, count: 84, flagged: 78, highRisk: true, country: "DE" },
  { asn: "AS44558", name: "Severex Bulletproof", lat: 52.3676, lng: 4.9041, count: 62, flagged: 54, highRisk: true, country: "NL" },
  { asn: "AS200019", name: "Alexhost Offshore", lat: 47.3769, lng: 8.5417, count: 45, flagged: 39, highRisk: true, country: "CH" },
  { asn: "AS206264", name: "Advania Iceland", lat: 63.9999, lng: -22.5600, count: 38, flagged: 29, highRisk: true, country: "IS" },
  { asn: "AS24940", name: "Hetzner Online", lat: 49.4521, lng: 11.0767, count: 210, flagged: 42, highRisk: false, country: "DE" },
  { asn: "AS16276", name: "OVH SAS", lat: 50.6927, lng: 3.1778, count: 185, flagged: 31, highRisk: false, country: "FR" },
  { asn: "AS14061", name: "DigitalOcean", lat: 40.7128, lng: -74.0060, count: 140, flagged: 22, highRisk: false, country: "US" },
  { asn: "AS16509", name: "Amazon AWS", lat: 39.0438, lng: -77.4874, count: 290, flagged: 35, highRisk: false, country: "US" },
  { asn: "AS48422", name: "FDC Servers", lat: 35.1856, lng: 33.3823, count: 32, flagged: 25, highRisk: true, country: "CY" },
]

// ─── 7. Country Detail Information (for Country Detail Sheet) ───────────────
export const COUNTRY_DETAILS = {
  RU: {
    name: "Russia",
    code: "RU",
    flag: "🇷🇺",
    riskBadge: "Critical Risk (0.94)",
    riskVariant: "red",
    center: [61.524, 105.318],
    overview: {
      totalIps: 1847,
      flaggedIps: 1024,
      flaggedIpsPct: "55.4%",
      totalTx: 24890,
      flaggedTx: 5210,
      topAsns: [
        { name: "Selectel", pct: 42 },
        { name: "Vscale Cloud", pct: 28 },
        { name: "Rostelecom", pct: 18 },
      ],
      riskTrend: [
        { day: "Mon", risk: 0.88 },
        { day: "Tue", risk: 0.91 },
        { day: "Wed", risk: 0.90 },
        { day: "Thu", risk: 0.94 },
        { day: "Fri", risk: 0.95 },
        { day: "Sat", risk: 0.93 },
        { day: "Sun", risk: 0.96 },
      ],
    },
    ips: [
      { ip: "95.173.136.24", txCount: 680, risk: 0.96, walletsUsed: 28, firstSeen: "14 days ago" },
      { ip: "195.123.245.90", txCount: 430, risk: 0.92, walletsUsed: 18, firstSeen: "8 days ago" },
      { ip: "178.62.204.11", txCount: 310, risk: 0.87, walletsUsed: 12, firstSeen: "21 days ago" },
      { ip: "46.101.99.145", txCount: 240, risk: 0.79, walletsUsed: 8, firstSeen: "5 days ago" },
      { ip: "185.14.31.88", txCount: 195, risk: 0.74, walletsUsed: 6, firstSeen: "18 days ago" },
    ],
    asnDistribution: [
      { name: "Selectel (AS49505)", value: 42, fill: "#ef4444" },
      { name: "Vscale (AS49505)", value: 28, fill: "#f97316" },
      { name: "Rostelecom (AS12389)", value: 18, fill: "#3b82f6" },
      { name: "Other Datacenters", value: 12, fill: "#8b5cf6" },
    ],
    asnTable: [
      { asn: "AS49505", org: "Selectel Network", ipCount: 775, flaggedPct: "68.2%" },
      { asn: "AS49505", org: "Vscale Cloud", ipCount: 517, flaggedPct: "52.4%" },
      { asn: "AS12389", org: "PJSC Rostelecom", ipCount: 332, flaggedPct: "34.1%" },
      { asn: "AS25513", org: "MTS Russia", ipCount: 223, flaggedPct: "28.6%" },
    ],
    transactions: [
      { txid: "7f4c91a...3b21", amount: "14.50 BTC", risk: 0.96, timestamp: "14:25:10", reason: "Direct darknet market cashout" },
      { txid: "a310d29...f90e", amount: "8.40 BTC",  risk: 0.91, timestamp: "14:18:42", reason: "Coordinated peel chain hop" },
      { txid: "19bd402...c54a", amount: "6.20 BTC",  risk: 0.88, timestamp: "13:50:09", reason: "Burst IP reuse signature" },
      { txid: "e671c89...071b", amount: "4.80 BTC",  risk: 0.82, timestamp: "12:34:19", reason: "Mixer round split" },
    ],
  },
  DE: {
    name: "Germany",
    code: "DE",
    flag: "🇩🇪",
    riskBadge: "High Risk (0.86)",
    riskVariant: "amber",
    center: [51.165, 10.451],
    overview: {
      totalIps: 1420,
      flaggedIps: 412,
      flaggedIpsPct: "29.0%",
      totalTx: 18450,
      flaggedTx: 1680,
      topAsns: [
        { name: "Hetzner", pct: 45 },
        { name: "Tor Project", pct: 28 },
        { name: "Deutsche Telekom", pct: 15 },
      ],
      riskTrend: [
        { day: "Mon", risk: 0.74 },
        { day: "Tue", risk: 0.79 },
        { day: "Wed", risk: 0.81 },
        { day: "Thu", risk: 0.86 },
        { day: "Fri", risk: 0.88 },
        { day: "Sat", risk: 0.82 },
        { day: "Sun", risk: 0.85 },
      ],
    },
    ips: [
      { ip: "185.220.101.45", txCount: 347, risk: 0.94, walletsUsed: 12, firstSeen: "22 days ago" },
      { ip: "185.220.102.8",  txCount: 280, risk: 0.89, walletsUsed: 9, firstSeen: "15 days ago" },
      { ip: "88.198.45.120",  txCount: 210, risk: 0.78, walletsUsed: 7, firstSeen: "9 days ago" },
      { ip: "144.76.12.89",   txCount: 175, risk: 0.71, walletsUsed: 5, firstSeen: "30 days ago" },
    ],
    asnDistribution: [
      { name: "Hetzner (AS24940)", value: 45, fill: "#3b82f6" },
      { name: "Tor Project (AS9009)", value: 28, fill: "#ef4444" },
      { name: "DTAG (AS3320)", value: 15, fill: "#10b981" },
      { name: "Others", value: 12, fill: "#8b5cf6" },
    ],
    asnTable: [
      { asn: "AS24940", org: "Hetzner Online GmbH", ipCount: 639, flaggedPct: "22.5%" },
      { asn: "AS9009",  org: "Tor Project Exit Relays", ipCount: 397, flaggedPct: "82.4%" },
      { asn: "AS3320",  org: "Deutsche Telekom AG", ipCount: 213, flaggedPct: "8.1%" },
      { asn: "AS12897", org: "Contabo GmbH", ipCount: 171, flaggedPct: "31.2%" },
    ],
    transactions: [
      { txid: "c402e11...99aa", amount: "11.70 BTC", risk: 0.94, timestamp: "14:26:01", reason: "Tor exit multi-wallet broadcast" },
      { txid: "5b88aa0...112e", amount: "3.90 BTC",  risk: 0.88, timestamp: "14:23:18", reason: "Simultaneous burst signature" },
      { txid: "43aa190...84df", amount: "2.10 BTC",  risk: 0.81, timestamp: "13:12:44", reason: "Rapid address reuse hop" },
    ],
  },
  NL: {
    name: "Netherlands",
    code: "NL",
    flag: "🇳🇱",
    riskBadge: "High Risk (0.91)",
    riskVariant: "red",
    center: [52.132, 5.291],
    overview: {
      totalIps: 1180,
      flaggedIps: 680,
      flaggedIpsPct: "57.6%",
      totalTx: 16200,
      flaggedTx: 3410,
      topAsns: [
        { name: "Severex", pct: 38 },
        { name: "LeaseWeb", pct: 32 },
        { name: "KPN", pct: 18 },
      ],
      riskTrend: [
        { day: "Mon", risk: 0.82 },
        { day: "Tue", risk: 0.85 },
        { day: "Wed", risk: 0.89 },
        { day: "Thu", risk: 0.91 },
        { day: "Fri", risk: 0.93 },
        { day: "Sat", risk: 0.88 },
        { day: "Sun", risk: 0.91 },
      ],
    },
    ips: [
      { ip: "194.26.29.112", txCount: 412, risk: 0.91, walletsUsed: 16, firstSeen: "12 days ago" },
      { ip: "194.26.29.140", txCount: 310, risk: 0.88, walletsUsed: 11, firstSeen: "8 days ago" },
      { ip: "85.17.140.22",  txCount: 220, risk: 0.76, walletsUsed: 7,  firstSeen: "25 days ago" },
    ],
    asnDistribution: [
      { name: "Severex (AS44558)", value: 38, fill: "#ef4444" },
      { name: "LeaseWeb (AS60781)", value: 32, fill: "#f59e0b" },
      { name: "KPN (AS1136)", value: 18, fill: "#3b82f6" },
      { name: "Others", value: 12, fill: "#8b5cf6" },
    ],
    asnTable: [
      { asn: "AS44558", org: "Severex Bulletproof", ipCount: 448, flaggedPct: "74.8%" },
      { asn: "AS60781", org: "LeaseWeb Netherlands", ipCount: 377, flaggedPct: "48.2%" },
      { asn: "AS1136",  org: "KPN Telecom B.V.", ipCount: 212, flaggedPct: "14.3%" },
    ],
    transactions: [
      { txid: "8c9d0e...1f23", amount: "9.30 BTC", risk: 0.95, timestamp: "14:24:50", reason: "Bulletproof server automated mix" },
      { txid: "1e2f3a...4b56", amount: "4.10 BTC", risk: 0.89, timestamp: "14:22:15", reason: "Cross-border OTC transfer" },
    ],
  },
  US: {
    name: "USA",
    code: "US",
    flag: "🇺🇸",
    riskBadge: "Moderate Risk (0.68)",
    riskVariant: "blue",
    center: [37.090, -95.712],
    overview: {
      totalIps: 1290,
      flaggedIps: 280,
      flaggedIpsPct: "21.7%",
      totalTx: 32400,
      flaggedTx: 1980,
      topAsns: [
        { name: "Amazon AWS", pct: 48 },
        { name: "DigitalOcean", pct: 24 },
        { name: "Cloudflare", pct: 16 },
      ],
      riskTrend: [
        { day: "Mon", risk: 0.62 },
        { day: "Tue", risk: 0.65 },
        { day: "Wed", risk: 0.67 },
        { day: "Thu", risk: 0.68 },
        { day: "Fri", risk: 0.70 },
        { day: "Sat", risk: 0.66 },
        { day: "Sun", risk: 0.68 },
      ],
    },
    ips: [
      { ip: "23.129.64.180", txCount: 390, risk: 0.83, walletsUsed: 15, firstSeen: "40 days ago" },
      { ip: "54.210.12.99",  txCount: 290, risk: 0.72, walletsUsed: 8,  firstSeen: "18 days ago" },
    ],
    asnDistribution: [
      { name: "AWS (AS16509)", value: 48, fill: "#3b82f6" },
      { name: "DigitalOcean (AS14061)", value: 24, fill: "#10b981" },
      { name: "Cloudflare (AS13335)", value: 16, fill: "#f59e0b" },
      { name: "Others", value: 12, fill: "#8b5cf6" },
    ],
    asnTable: [
      { asn: "AS16509", org: "Amazon.com Inc.", ipCount: 619, flaggedPct: "18.4%" },
      { asn: "AS14061", org: "DigitalOcean LLC", ipCount: 310, flaggedPct: "24.1%" },
      { asn: "AS13335", org: "Cloudflare Inc.", ipCount: 206, flaggedPct: "11.2%" },
    ],
    transactions: [
      { txid: "2b4d6f...8h0j", amount: "6.80 BTC", risk: 0.83, timestamp: "14:15:22", reason: "Compromised AWS instance egress" },
    ],
  },
}

// Fallback generator for other countries
export function getCountryDetail(countryCodeOrName) {
  const match = Object.values(COUNTRY_DETAILS).find(
    (c) =>
      c.code.toLowerCase() === countryCodeOrName?.toLowerCase() ||
      c.name.toLowerCase() === countryCodeOrName?.toLowerCase()
  )
  if (match) return match

  // Default structure
  return {
    name: countryCodeOrName || "Selected Region",
    code: countryCodeOrName || "XX",
    flag: "🌐",
    riskBadge: "Elevated Risk (0.75)",
    riskVariant: "amber",
    center: [20, 0],
    overview: {
      totalIps: 840,
      flaggedIps: 180,
      flaggedIpsPct: "21.4%",
      totalTx: 9400,
      flaggedTx: 740,
      topAsns: [{ name: "Local Telecom", pct: 54 }, { name: "Hosting Corp", pct: 32 }],
      riskTrend: [
        { day: "Mon", risk: 0.68 }, { day: "Tue", risk: 0.70 },
        { day: "Wed", risk: 0.72 }, { day: "Thu", risk: 0.75 },
        { day: "Fri", risk: 0.74 }, { day: "Sat", risk: 0.73 }, { day: "Sun", risk: 0.75 },
      ],
    },
    ips: [
      { ip: "185.191.171.12", txCount: 260, risk: 0.85, walletsUsed: 11, firstSeen: "22 days ago" },
    ],
    asnDistribution: [
      { name: "Regional ISP", value: 65, fill: "#3b82f6" },
      { name: "Cloud Proxy", value: 35, fill: "#ef4444" },
    ],
    asnTable: [
      { asn: "AS12345", org: "Regional Data Transit", ipCount: 540, flaggedPct: "24.5%" },
    ],
    transactions: [
      { txid: "7f4c91a...3b21", amount: "5.40 BTC", risk: 0.85, timestamp: "14:10:00", reason: "Suspected OTC bridge" },
    ],
  }
}
