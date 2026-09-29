const FEATURES = [
  {
    icon: '⛓',
    title: 'Bulk Ingestion',
    desc: 'Parse CSV, JSON, and XML transaction datasets at scale. Auto-enriched with MaxMind GeoIP — country, ASN, and city — entirely offline.',
  },
  {
    icon: '🕸',
    title: 'Entity Graph',
    desc: 'Build a Neo4j property graph linking wallets, IPs, and TXIDs. Traverse multi-hop paths to uncover hidden connections and co-spending clusters.',
  },
  {
    icon: '🧠',
    title: 'AI Detection',
    desc: 'Four ML models run in parallel: Isolation Forest, Node2Vec+DBSCAN, LSTM sequence analysis, and XGBoost classification for known threat patterns.',
  },
  {
    icon: '🎯',
    title: 'Ranked Alerts',
    desc: 'Every flagged entity gets a composite risk score, SHAP waterfall explanation, and linked evidence TXIDs — no black boxes.',
  },
  {
    icon: '🗺',
    title: 'GeoIP Heatmap',
    desc: 'Visualize IP origin clusters on an offline Leaflet map. Spot geographic anomalies and unusual routing patterns at a glance.',
  },
  {
    icon: '🔒',
    title: 'Fully Offline',
    desc: 'Runs entirely on a local Linux Docker stack. No cloud, no telemetry, no external APIs. Deployable on air-gapped investigation machines.',
  },
]

export default function FeaturesSection() {
  return (
    <section className="features" id="features" aria-labelledby="features-heading">
      <div className="features__inner">
        <header className="features__header">
          <p className="features__label">Capabilities</p>
          <h2 className="features__h2" id="features-heading">
            Built for deep-level blockchain forensics
          </h2>
        </header>

        <div className="features__grid" role="list">
          {FEATURES.map((feat, i) => (
            <article
              key={i}
              className="feature-card"
              role="listitem"
              aria-label={feat.title}
            >
              <div className="feature-card__icon" aria-hidden="true">
                {feat.icon}
              </div>
              <h3 className="feature-card__title">{feat.title}</h3>
              <p className="feature-card__desc">{feat.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
