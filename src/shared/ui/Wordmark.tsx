import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'

export type WordmarkSize = 'sm' | 'md'

export type WordmarkProps = {
  size?: WordmarkSize
  className?: string
}

const sizeClasses: Record<WordmarkSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
}

export function Wordmark({ size = 'md', className }: WordmarkProps) {
  const { t } = useTranslation()

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span aria-hidden="true" className="h-2.5 w-2.5 bg-foreground" />
      <span className={cn('font-semibold tracking-tight text-foreground', sizeClasses[size])}>
        {t('app.name')}
      </span>
    </span>
  )
}
