import { Bell, FlaskConical, Settings, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState, PageHeader } from '@/shared/ui'

export type StubSection = 'twin' | 'alerts' | 'automation' | 'settings'

const SECTION_ICONS: Record<StubSection, LucideIcon> = {
  twin: FlaskConical,
  alerts: Bell,
  automation: Zap,
  settings: Settings,
}

export default function StubPage({ section }: { section: StubSection }) {
  const { t } = useTranslation()
  const Icon = SECTION_ICONS[section]

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t(`app.stub.${section}.title`)}
        description={t(`app.stub.${section}.description`)}
      />
      <EmptyState
        icon={Icon}
        title={t('app.stub.construction')}
        description={t('app.stub.constructionBody')}
      />
    </div>
  )
}
