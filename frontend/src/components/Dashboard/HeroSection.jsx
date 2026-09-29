import { Link } from 'react-router-dom'

const VIDEO_URL = 'https://designerstephen.github.io/public-assets/videos/serene-art-hero.mp4'

export default function HeroSection() {
  return (
    <section className="hero" aria-label="Hero" id="hero">
      {/* ── Background Video ── */}
      <div className="hero__video-wrap" aria-hidden="true">
        <video
          className="hero__video"
          src={VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
        <div className="hero__overlay" />
        <div className="hero__fade-bottom" />
      </div>

      {/* ── Hero Content ── */}
      <div className="hero__content">
        <div className="hero__inner">

          {/* H1 */}
          <h1 className="hero__h1 anim-fade-rise anim-delay-0">
            <em>Unmask</em> every Bitcoin<br />
            transaction with{' '}
            <span className="accent">AI precision</span>
          </h1>

          {/* Subtext */}
          <p className="hero__p anim-fade-rise anim-delay-1">
            NeuralChain ingests bulk blockchain metadata, builds entity graphs,
            and deploys ML models to surface ranked, explainable investigative
            leads — fully offline, fully in your control.
          </p>

          {/* Actions */}
          <div className="hero__actions anim-fade-rise anim-delay-2">
            <Link
              to="/ingest"
              className="btn-pill btn-pill--lg"
              id="hero-cta-primary"
            >
              Start Analysis
            </Link>
            <Link
              to="/graph"
              className="btn-pill btn-pill--lg btn-pill--ghost"
              id="hero-cta-secondary"
            >
              Explore Graph
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
