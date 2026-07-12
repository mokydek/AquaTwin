import { CtaSection } from '@/landing/components/CtaSection'
import { FeaturesSection } from '@/landing/components/FeaturesSection'
import { Hero } from '@/landing/components/Hero'
import { HowItWorksSection } from '@/landing/components/HowItWorksSection'
import { LandingFooter } from '@/landing/components/LandingFooter'
import { LandingNav } from '@/landing/components/LandingNav'
import { ProblemSection } from '@/landing/components/ProblemSection'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <main>
        <Hero />
        <ProblemSection />
        <HowItWorksSection />
        <FeaturesSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  )
}
