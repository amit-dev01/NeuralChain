const STATS = [
  { value: '10K+', label: 'Transactions Analysed' },
  { value: '4', label: 'AI/ML Models' },
  { value: '97%', label: 'Detection Accuracy' },
  { value: '100%', label: 'Offline Capable' },
]

export default function StatsBar() {
  return (
    <div className="stats-bar" aria-label="Key statistics">
      <div className="stats-bar__inner">
        {STATS.map((stat, i) => (
          <div key={i} className="stat-item anim-fade-rise" style={{ animationDelay: `${0.6 + i * 0.1}s` }}>
            <span className="stat-item__value">{stat.value}</span>
            <span className="stat-item__label">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
