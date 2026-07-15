import { AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { AuthErrorCode, Sensor } from '@/backend'
import { deleteFarm, renameFarm, updatePassword, updateSensorThresholds } from '@/backend'
import { useAuth } from '@/frontend/auth/AuthProvider'
import { useLiveReadings } from '@/frontend/data/LiveReadingsProvider'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { DataSourcesSection } from '@/frontend/settings/DataSourcesSection'
import { SENSOR_TYPES } from '@/shared/config/aquaponics'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  FormField,
  Input,
  LanguageSwitcher,
  PageHeader,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useDialog,
  useToast,
} from '@/shared/ui'

type BoundKey = 'warn_low' | 'warn_high' | 'crit_low' | 'crit_high'
const BOUNDS: BoundKey[] = ['warn_low', 'warn_high', 'crit_low', 'crit_high']

type ThresholdDraft = Record<BoundKey, string>

function draftFromSensor(sensor: Sensor): ThresholdDraft {
  return {
    warn_low: sensor.warn_low === null ? '' : String(sensor.warn_low),
    warn_high: sensor.warn_high === null ? '' : String(sensor.warn_high),
    crit_low: sensor.crit_low === null ? '' : String(sensor.crit_low),
    crit_high: sensor.crit_high === null ? '' : String(sensor.crit_high),
  }
}

function parseBound(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-sharp border border-border p-3 text-[13px] text-foreground">
      <AlertCircle size={16} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  usePageTitle(`${t('app.nav.settings')} · ${t('app.name')}`)
  const { user, isAnonymous } = useAuth()
  const { activeFarm, activeFarmId, refreshFarms } = useFarm()
  const { sensors, refreshSensors } = useLiveReadings()
  const { toast } = useToast()
  const deleteDialog = useDialog()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [passwordServerError, setPasswordServerError] = useState<AuthErrorCode | null>(null)
  const [passwordPending, setPasswordPending] = useState(false)

  const [farmName, setFarmName] = useState('')
  const [farmNameError, setFarmNameError] = useState<string | null>(null)
  const [renamePending, setRenamePending] = useState(false)

  const [drafts, setDrafts] = useState<Record<string, ThresholdDraft>>({})
  const [savingSensorId, setSavingSensorId] = useState<string | null>(null)

  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletePending, setDeletePending] = useState(false)

  useEffect(() => {
    setFarmName(activeFarm?.name ?? '')
  }, [activeFarm?.name])

  useEffect(() => {
    const next: Record<string, ThresholdDraft> = {}
    for (const sensor of sensors) next[sensor.id] = draftFromSensor(sensor)
    setDrafts(next)
  }, [sensors])

  async function handlePassword(event: FormEvent) {
    event.preventDefault()
    setPasswordServerError(null)
    const nextPasswordError = password.length >= 8 ? null : 'auth.validation.passwordLength'
    const nextConfirmError = password === confirm ? null : 'auth.validation.passwordMatch'
    setPasswordError(nextPasswordError)
    setConfirmError(nextConfirmError)
    if (nextPasswordError || nextConfirmError) return

    setPasswordPending(true)
    const result = await updatePassword(password)
    setPasswordPending(false)
    if (result.ok) {
      setPassword('')
      setConfirm('')
      toast(t('settings.passwordUpdated'))
    } else {
      setPasswordServerError(result.code)
    }
  }

  async function handleRename(event: FormEvent) {
    event.preventDefault()
    if (!activeFarmId) return
    if (farmName.trim().length === 0) {
      setFarmNameError('settings.farmNameRequired')
      return
    }
    setFarmNameError(null)
    setRenamePending(true)
    try {
      await renameFarm(activeFarmId, farmName.trim())
      await refreshFarms()
      toast(t('settings.farmRenamed'))
    } catch {
      toast(t('settings.saveFailed'), { kind: 'critical' })
    }
    setRenamePending(false)
  }

  function updateDraft(sensorId: string, bound: BoundKey, value: string) {
    setDrafts((previous) => ({
      ...previous,
      [sensorId]: { ...previous[sensorId], [bound]: value },
    }))
  }

  async function saveRow(sensor: Sensor) {
    const draft = drafts[sensor.id]
    if (!draft) return
    setSavingSensorId(sensor.id)
    const result = await updateSensorThresholds(sensor.id, {
      warn_low: parseBound(draft.warn_low),
      warn_high: parseBound(draft.warn_high),
      crit_low: parseBound(draft.crit_low),
      crit_high: parseBound(draft.crit_high),
    })
    setSavingSensorId(null)
    if (result.ok) {
      await refreshSensors()
      toast(t('settings.thresholdsSaved'))
    } else if (result.code === 'invalid') {
      toast(t('settings.thresholdInvalid'), { kind: 'critical' })
    } else {
      toast(t('settings.saveFailed'), { kind: 'critical' })
    }
  }

  function resetRow(sensor: Sensor) {
    const defaults = SENSOR_TYPES[sensor.type].thresholds
    setDrafts((previous) => ({
      ...previous,
      [sensor.id]: {
        warn_low: defaults.warnLow === null ? '' : String(defaults.warnLow),
        warn_high: defaults.warnHigh === null ? '' : String(defaults.warnHigh),
        crit_low: defaults.critLow === null ? '' : String(defaults.critLow),
        crit_high: defaults.critHigh === null ? '' : String(defaults.critHigh),
      },
    }))
  }

  async function handleDeleteFarm() {
    if (!activeFarmId || !activeFarm) return
    if (deleteConfirmText !== activeFarm.name) return
    setDeletePending(true)
    try {
      await deleteFarm(activeFarmId)
      await refreshFarms()
      deleteDialog.close()
      setDeleteConfirmText('')
      toast(t('settings.farmDeleted'))
    } catch {
      toast(t('settings.saveFailed'), { kind: 'critical' })
    }
    setDeletePending(false)
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('app.nav.settings')} description={t('settings.description')} />

      <Card>
        <CardHeader title={t('settings.profile')} description={t('settings.profileHint')} />
        <CardContent className="flex flex-col gap-5">
          {isAnonymous ? (
            <Notice>{t('demo.settings.passwordNotice')}</Notice>
          ) : (
            <>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted">
              {t('settings.email')}
            </span>
            <span className="font-mono text-sm text-foreground">{user?.email}</span>
          </div>

          <form className="flex max-w-sm flex-col gap-4" onSubmit={handlePassword} noValidate>
            <FormField
              label={t('settings.newPassword')}
              htmlFor="new-password"
              error={passwordError ? t(passwordError) : undefined}
            >
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                invalid={Boolean(passwordError)}
                onChange={(event) => setPassword(event.target.value)}
              />
            </FormField>
            <FormField
              label={t('settings.confirmPassword')}
              htmlFor="confirm-password"
              error={confirmError ? t(confirmError) : undefined}
            >
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                invalid={Boolean(confirmError)}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </FormField>
            {passwordServerError ? <Notice>{t(`auth.errors.${passwordServerError}`)}</Notice> : null}
            <div>
              <Button type="submit" disabled={passwordPending}>
                {passwordPending ? t('settings.saving') : t('settings.savePassword')}
              </Button>
            </div>
          </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.farm')} />
        <CardContent className="flex flex-col gap-5">
          <form className="flex max-w-sm flex-col gap-4" onSubmit={handleRename} noValidate>
            <FormField
              label={t('settings.farmName')}
              htmlFor="farm-name"
              error={farmNameError ? t(farmNameError) : undefined}
            >
              <Input
                id="farm-name"
                value={farmName}
                invalid={Boolean(farmNameError)}
                onChange={(event) => setFarmName(event.target.value)}
              />
            </FormField>
            <div>
              <Button type="submit" disabled={renamePending}>
                {renamePending ? t('settings.saving') : t('settings.saveFarm')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.thresholds')} description={t('settings.thresholdsHint')} />
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>{t('settings.sensor')}</Th>
                  <Th>{t('settings.warnLow')}</Th>
                  <Th>{t('settings.warnHigh')}</Th>
                  <Th>{t('settings.critLow')}</Th>
                  <Th>{t('settings.critHigh')}</Th>
                  <Th>{t('settings.actions')}</Th>
                </Tr>
              </THead>
              <TBody>
                {sensors.map((sensor) => {
                  const draft = drafts[sensor.id]
                  if (!draft) return null
                  return (
                    <Tr key={sensor.id}>
                      <Td>
                        {t(`sensors.${sensor.type}`)}
                        <span className="ml-1 font-mono text-xs text-muted">
                          {SENSOR_TYPES[sensor.type].unit}
                        </span>
                      </Td>
                      {BOUNDS.map((bound) => (
                        <Td key={bound}>
                          <Input
                            type="number"
                            className="w-24 font-mono tabular-nums"
                            value={draft[bound]}
                            aria-label={`${t(`sensors.${sensor.type}`)} ${t(`settings.${bound === 'warn_low' ? 'warnLow' : bound === 'warn_high' ? 'warnHigh' : bound === 'crit_low' ? 'critLow' : 'critHigh'}`)}`}
                            onChange={(event) => updateDraft(sensor.id, bound, event.target.value)}
                          />
                        </Td>
                      ))}
                      <Td>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={savingSensorId === sensor.id}
                            onClick={() => saveRow(sensor)}
                          >
                            {t('settings.save')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => resetRow(sensor)}>
                            {t('settings.reset')}
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  )
                })}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.language')} description={t('settings.languageHint')} />
        <CardContent>
          <LanguageSwitcher />
        </CardContent>
      </Card>

      {isAnonymous ? (
        <Card>
          <CardHeader
            title={t('settings.dataSources.title')}
            description={t('settings.dataSources.hint')}
          />
          <CardContent>
            <Notice>{t('demo.settings.apiNotice')}</Notice>
          </CardContent>
        </Card>
      ) : (
        <DataSourcesSection />
      )}

      <div className="rounded-sharp border border-foreground">
        <CardHeader title={t('settings.dangerZone')} description={t('settings.dangerHint')} />
        <CardContent>
          <Button onClick={deleteDialog.open}>{t('settings.deleteFarm')}</Button>
        </CardContent>
      </div>

      <Dialog ref={deleteDialog.ref} onClose={() => setDeleteConfirmText('')}>
        <DialogTitle>{t('settings.deleteFarm')}</DialogTitle>
        <DialogDescription>
          {t('settings.deleteFarmBody', { name: activeFarm?.name ?? '' })}
        </DialogDescription>
        <div className="mt-4">
          <FormField label={t('settings.typeToConfirm')} htmlFor="delete-confirm">
            <Input
              id="delete-confirm"
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={deleteDialog.close}>
            {t('settings.cancel')}
          </Button>
          <Button
            disabled={deletePending || deleteConfirmText !== activeFarm?.name}
            onClick={handleDeleteFarm}
          >
            {deletePending ? t('settings.saving') : t('settings.deleteFarm')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
