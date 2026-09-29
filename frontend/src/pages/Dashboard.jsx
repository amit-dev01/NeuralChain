import Navbar from '../components/Dashboard/Navbar.jsx'
import HeroSection from '../components/Dashboard/HeroSection.jsx'
import StatsBar from '../components/Dashboard/StatsBar.jsx'
import FeaturesSection from '../components/Dashboard/FeaturesSection.jsx'

export default function Dashboard() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <HeroSection />
        <StatsBar />
        <FeaturesSection />
      </main>
    </>
  )
}
