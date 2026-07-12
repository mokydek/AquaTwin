import { Activity, Bell, FlaskConical, Settings, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { useAuth } from '@/frontend/auth/AuthProvider'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { cn } from '@/shared/lib/cn'
import {
  Button,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  FormField,
  Input,
  LanguageSwitcher,
  Select,
  useDialog,
  useToast,
  Wordmark,
} from '@/shared/ui'

type Scope = 'desktop' | 'mobile'

type SidebarContentProps = {
  scope: Scope
  onNavigate?: () => void
}

type NavItem = {
  to: string
  end?: boolean
  icon: LucideIcon
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/app', end: true, icon: Activity, label: 'app.nav.dashboard' },
  { to: '/app/twin', icon: FlaskConical, label: 'app.nav.twin' },
  { to: '/app/alerts', icon: Bell, label: 'app.nav.alerts' },
  { to: '/app/automation', icon: Zap, label: 'app.nav.automation' },
  { to: '/app/settings', icon: Settings, label: 'app.nav.settings' },
]

function NewFarmDialog({ scope }: { scope: Scope }) {
  const { t } = useTranslation()
  const { createFarm, creating } = useFarm()
  const { toast } = useToast()
  const dialog = useDialog()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputId = `${scope}-new-farm-name`

  function reset() {
    setName('')
    setError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (name.trim().length === 0) {
      setError('app.farm.nameRequired')
      return
    }
    setError(null)
    const farm = await createFarm(name.trim())
    if (farm) {
      toast(t('app.farm.created'))
      reset()
      dialog.close()
    } else {
      toast(t('app.farm.createFailed'), { kind: 'critical' })
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={dialog.open}>
        {t('app.farm.newFarm')}
      </Button>
      <Dialog
        ref={dialog.ref}
        onClose={reset}
      >
        <form onSubmit={handleSubmit} noValidate>
          <DialogTitle>{t('app.farm.newFarmTitle')}</DialogTitle>
          <DialogDescription>{t('app.farm.newFarmDescription')}</DialogDescription>
          <div className="mt-4">
            <FormField
              label={t('app.farm.nameLabel')}
              htmlFor={inputId}
              error={error ? t(error) : undefined}
            >
              <Input
                id={inputId}
                value={name}
                invalid={Boolean(error)}
                placeholder={t('app.farm.namePlaceholder')}
                onChange={(event) => setName(event.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset()
                dialog.close()
              }}
            >
              {t('app.farm.cancel')}
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? t('app.farm.creating') : t('app.farm.create')}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  )
}

function FarmBlock({ scope }: { scope: Scope }) {
  const { farms, activeFarm, activeFarmId, setActiveFarmId } = useFarm()

  return (
    <div className="flex flex-col gap-2">
      {farms.length > 1 ? (
        <Select
          value={activeFarmId ?? ''}
          onChange={(event) => setActiveFarmId(event.target.value)}
        >
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </Select>
      ) : (
        <span className="text-[13px] font-medium text-foreground">{activeFarm?.name}</span>
      )}
      <NewFarmDialog scope={scope} />
    </div>
  )
}

function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
    onNavigate?.()
    navigate('/')
  }

  return (
    <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
      {user?.email ? (
        <span className="truncate font-mono text-xs text-muted">{user.email}</span>
      ) : null}
      <div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          {t('auth.actions.signOut')}
        </Button>
      </div>
      <LanguageSwitcher />
    </div>
  )
}

export function SidebarContent({ scope, onNavigate }: SidebarContentProps) {
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/app" onClick={onNavigate}>
        <Wordmark size="sm" />
      </Link>

      <FarmBlock scope={scope} />

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex h-9 items-center gap-2.5 rounded-sharp border-l-2 px-3 text-sm transition-colors duration-150',
                  isActive
                    ? 'border-foreground bg-surface text-foreground'
                    : 'border-transparent text-muted hover:text-foreground',
                )
              }
            >
              <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
              {t(item.label)}
            </NavLink>
          )
        })}
      </nav>

      <SidebarFooter onNavigate={onNavigate} />
    </div>
  )
}
