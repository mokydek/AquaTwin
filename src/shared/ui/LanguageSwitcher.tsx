import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'

const LANGUAGES = ['en', 'ru', 'kk'] as const

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const active = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className="flex items-center gap-4">
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          aria-pressed={active === lng}
          onClick={() => void i18n.changeLanguage(lng)}
          className={cn(
            'cursor-pointer rounded-none border-0 bg-transparent text-sm transition-colors duration-150',
            'focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-foreground',
            active === lng ? 'font-medium text-foreground' : 'text-muted hover:text-foreground',
          )}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
