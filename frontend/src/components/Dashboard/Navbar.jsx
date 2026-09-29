import { Link } from 'react-router-dom'

const NAV_LINKS = [
  { label: 'Intelligence', to: '/graph' },
  { label: 'Alerts', to: '/alerts' },
  { label: 'Ingest', to: '/ingest' },
  { label: 'Docs', to: '/docs' },
]

export default function Navbar() {
  return (
    <nav className="nav anim-fade-rise anim-delay-0" role="navigation" aria-label="Main navigation">
      <div className="nav__inner">
        {/* ── Brand ── */}
        <Link to="/" className="nav__brand" aria-label="NeuralChain Home">
          NeuralChain<sup>®</sup>
        </Link>

        {/* ── Links ── */}
        <ul className="nav__links" role="list">
          {NAV_LINKS.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className="nav__link">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* ── CTA ── */}
        <div className="nav__cta">
          <Link to="/graph" className="btn-pill btn-pill--sm" id="nav-cta-btn">
            Launch Analysis
          </Link>
        </div>
      </div>
    </nav>
  )
}
