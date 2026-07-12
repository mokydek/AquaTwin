import { useTranslation } from 'react-i18next'

import { CtaSection } from '@/landing/components/CtaSection'
import { FeaturesSection } from '@/landing/components/FeaturesSection'
import { Hero } from '@/landing/components/Hero'
import { HowItWorksSection } from '@/landing/components/HowItWorksSection'
import { LandingFooter } from '@/landing/components/LandingFooter'
import { LandingNav } from '@/landing/components/LandingNav'
import { ProblemSection } from '@/landing/components/ProblemSection'
import { usePageTitle } from '@/shared/lib/usePageTitle'

export default function LandingPage() {
  const { t } = useTranslation()
  usePageTitle(`${t('app.name')} · ${t('app.tagline')}`)

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
