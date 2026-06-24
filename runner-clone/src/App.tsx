/**
 * App.tsx — root component composing all page sections in order.
 *
 * Section order matches runner.now:
 *   Navbar → Hero → FeatureCards → DeepDive → Comparison →
 *   WhyDifferent → Integrations → Testimonials → WorkflowLibrary →
 *   Pricing → FAQ → Footer
 *
 * A thin section-divider utility component adds the dashed separator
 * lines visible between major sections throughout the site.
 */

import Navbar from './components/Navbar'
import Hero from './components/Hero'
import FeatureCards from './components/FeatureCards'
import DeepDive from './components/DeepDive'
import Comparison from './components/Comparison'
import WhyDifferent from './components/WhyDifferent'
import Integrations from './components/Integrations'
import Testimonials from './components/Testimonials'
import WorkflowLibrary from './components/WorkflowLibrary'
import Pricing from './components/Pricing'
import FAQ from './components/FAQ'
import Footer from './components/Footer'

function SectionDivider() {
  return (
    <div
      className="w-full h-px"
      style={{ background: 'rgba(196,193,189,0.5)' }}
    />
  )
}

export default function App() {
  return (
    <div className="min-h-screen" style={{ background: '#fdfdfd' }}>
      <Navbar />

      <main>
        <Hero />
        <SectionDivider />
        <FeatureCards />
        <SectionDivider />
        <DeepDive />
        <SectionDivider />
        <Comparison />
        <SectionDivider />
        <WhyDifferent />
        <SectionDivider />
        <Integrations />
        <SectionDivider />
        <Testimonials />
        <SectionDivider />
        <WorkflowLibrary />
        <SectionDivider />
        <Pricing />
        <FAQ />
        <Footer />
      </main>
    </div>
  )
}
