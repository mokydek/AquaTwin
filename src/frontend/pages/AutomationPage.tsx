import { Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import type { AutomationEventRow, AutomationRule } from '@/backend'
import {
  createRule,
  deleteRule,
  listAutomationEvents,
  setRuleEnabled,
  subscribeToAutomationEvents,
  updateRule,
} from '@/backend'
import { useRuleEngine } from '@/frontend/automation/RuleEngineProvider'
import { useFarm } from '@/frontend/farm/FarmProvider'
import {
  DEVICE_TYPE_LIST,
  SENSOR_INPUT_RANGE,
  SENSOR_TYPES,
  SENSOR_TYPE_LIST,
} from '@/shared/config/aquaponics'
import type { DeviceType, SensorType } from '@/shared/config/aquaponics'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import type { RuleAction, RuleCondition } from '@/backend'
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  Switch,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useDialog,
  useToast,
} from '@/shared/ui'

type RuleDraft = {
  id: string | null
  name: string
  sensor_type: SensorType
  condition: RuleCondition
  threshold: string
  device_type: DeviceType
  action: RuleAction
  enabled: boolean
}

function defaultDraft(): RuleDraft {
  return {
    id: null,
    name: '',
    sensor_type: 'dissolved_oxygen',
    condition: 'below',
    threshold: '5',
    device_type: 'aerator',
    action: 'turn_on',
    enabled: true,
  }
}

function ruleSummary(
  sensor: SensorType,
  condition: RuleCondition,
  threshold: number,
  device: DeviceType,
  action: RuleAction,
  t: TFunction,
): string {
  const config = SENSOR_TYPES[sensor]
  const conditionText = t(
    condition === 'above' ? 'automation.summary.above' : 'automation.summary.below',
    { sensor: t(`sensors.${sensor}`), threshold: threshold.toFixed(config.decimals), unit: config.unit },
  )
  const actionText = t(action === 'turn_on' ? 'automation.summary.turnOn' : 'automation.summary.turnOff', {
    device: t(`devices.${device}`),
  })
  return t('automation.summary.template', { condition: conditionText, action: actionText })
}

function relativeTime(iso: string, locale: string): string {
  const diffMs = Date.parse(iso) - Date.now()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minutes = Math.round(diffMs / 60000)
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  const hours = Math.round(diffMs / 3600000)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(diffMs / 86400000), 'day')
}

function absoluteTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}

export default function AutomationPage() {
  const { t, i18n } = useTranslation()
  usePageTitle(`${t('automation.title')} · ${t('app.name')}`)
  const locale = i18n.resolvedLanguage ?? i18n.language
  const { activeFarmId } = useFarm()
  const { rules, refreshRules } = useRuleEngine()
  const { toast } = useToast()

  const editorDialog = useDialog()
  const deleteDialog = useDialog()
  const [draft, setDraft] = useState<RuleDraft>(defaultDraft)
  const [nameError, setNameError] = useState<string | null>(null)
  const [thresholdError, setThresholdError] = useState<string | null>(null)
  const [ruleToDelete, setRuleToDelete] = useState<AutomationRule | null>(null)
  const [events, setEvents] = useState<AutomationEventRow[] | null>(null)

  const rulesRef = useRef<AutomationRule[]>(rules)
  useEffect(() => {
    rulesRef.current = rules
  }, [rules])

  useEffect(() => {
    if (!activeFarmId) return
    let live = true
    setEvents(null)
    listAutomationEvents(activeFarmId, 100)
      .then((list) => {
        if (live) setEvents(list)
      })
      .catch(() => {
        if (live) setEvents([])
      })
    const unsubscribe = subscribeToAutomationEvents(activeFarmId, (event) => {
      const enriched: AutomationEventRow = {
        ...event,
        rule_name: event.rule_id
          ? (rulesRef.current.find((rule) => rule.id === event.rule_id)?.name ?? null)
          : null,
      }
      setEvents((previous) => [enriched, ...(previous ?? [])].slice(0, 100))
    })
    return () => {
      live = false
      unsubscribe()
    }
  }, [activeFarmId])

  function openCreate() {
    setDraft(defaultDraft())
    setNameError(null)
    setThresholdError(null)
    editorDialog.open()
  }

  function openEdit(rule: AutomationRule) {
    setDraft({
      id: rule.id,
      name: rule.name,
      sensor_type: rule.sensor_type,
      condition: rule.condition,
      threshold: String(rule.threshold),
      device_type: rule.device_type,
      action: rule.action,
      enabled: rule.enabled,
    })
    setNameError(null)
    setThresholdError(null)
    editorDialog.open()
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!activeFarmId) return
    const range = SENSOR_INPUT_RANGE[draft.sensor_type]
    const thresholdValue = Number(draft.threshold)
    const nextNameError = draft.name.trim().length === 0 ? 'automation.errors.name' : null
    const nextThresholdError =
      draft.threshold.trim() === '' ||
      !Number.isFinite(thresholdValue) ||
      thresholdValue < range.min ||
      thresholdValue > range.max
        ? 'automation.errors.threshold'
        : null
    setNameError(nextNameError)
    setThresholdError(nextThresholdError)
    if (nextNameError || nextThresholdError) return

    const payload = {
      name: draft.name.trim(),
      sensor_type: draft.sensor_type,
      condition: draft.condition,
      threshold: thresholdValue,
      device_type: draft.device_type,
      action: draft.action,
      enabled: draft.enabled,
    }
    try {
      if (draft.id) {
        await updateRule(draft.id, payload)
      } else {
        await createRule({ farm_id: activeFarmId, ...payload })
      }
      editorDialog.close()
      toast(t('automation.saved'))
      await refreshRules()
    } catch {
      toast(t('automation.saveFailed'), { kind: 'critical' })
    }
  }

  async function handleToggle(rule: AutomationRule, enabled: boolean) {
    try {
      await setRuleEnabled(rule.id, enabled)
      await refreshRules()
    } catch {
      toast(t('automation.saveFailed'), { kind: 'critical' })
    }
  }

  function openDelete(rule: AutomationRule) {
    setRuleToDelete(rule)
    deleteDialog.open()
  }

  async function handleDelete() {
    if (!ruleToDelete) return
    try {
      await deleteRule(ruleToDelete.id)
      deleteDialog.close()
      setRuleToDelete(null)
      toast(t('automation.deleted'))
      await refreshRules()
    } catch {
      toast(t('automation.saveFailed'), { kind: 'critical' })
    }
  }

  async function createPreset(preset: 'oxygen' | 'temperature') {
    if (!activeFarmId) return
    const rule =
      preset === 'oxygen'
        ? {
            name: t('automation.presets.lowOxygenName'),
            sensor_type: 'dissolved_oxygen' as SensorType,
            condition: 'below' as RuleCondition,
            threshold: 5,
            device_type: 'aerator' as DeviceType,
            action: 'turn_on' as RuleAction,
            enabled: true,
          }
        : {
            name: t('automation.presets.lowTempName'),
            sensor_type: 'water_temp' as SensorType,
            condition: 'below' as RuleCondition,
            threshold: 20,
            device_type: 'heater' as DeviceType,
            action: 'turn_on' as RuleAction,
            enabled: true,
          }
    try {
      await createRule({ farm_id: activeFarmId, ...rule })
      toast(t('automation.saved'))
      await refreshRules()
    } catch {
      toast(t('automation.saveFailed'), { kind: 'critical' })
    }
  }

  const previewThreshold = Number(draft.threshold)
  const previewValid = draft.threshold.trim() !== '' && Number.isFinite(previewThreshold)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('automation.title')}
        description={t('automation.description')}
        actions={
          <Button size="sm" onClick={openCreate}>
            {t('automation.newRule')}
          </Button>
        }
      />

      {rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title={t('automation.emptyTitle')}
          description={t('automation.emptyBody')}
          action={
            <div className="flex flex-col items-center gap-3">
              <Button size="sm" onClick={openCreate}>
                {t('automation.newRule')}
              </Button>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => createPreset('oxygen')}>
                  {t('automation.presets.lowOxygen')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => createPreset('temperature')}>
                  {t('automation.presets.lowTemp')}
                </Button>
              </div>
            </div>
          }
        />
      ) : (
        <section className="flex flex-col gap-3">
          {rules.map((rule) => (
            <Card key={rule.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(value) => handleToggle(rule, value)}
                  aria-label={rule.name}
                />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">{rule.name}</span>
                  <span className="text-[13px] text-muted">
                    {ruleSummary(
                      rule.sensor_type,
                      rule.condition,
                      rule.threshold,
                      rule.device_type,
                      rule.action,
                      t,
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="neutral">{t(`sensors.${rule.sensor_type}`)}</Badge>
                <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                  {t('automation.edit')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openDelete(rule)}>
                  {t('automation.delete')}
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-[11px] uppercase tracking-wider text-muted">
          {t('automation.eventLog')}
        </h2>
        {events && events.length === 0 ? (
          <EmptyState icon={Zap} title={t('automation.noEvents')} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>{t('automation.event.time')}</Th>
                  <Th>{t('automation.event.device')}</Th>
                  <Th>{t('automation.event.action')}</Th>
                  <Th>{t('automation.event.source')}</Th>
                </Tr>
              </THead>
              <TBody>
                {(events ?? []).map((entry) => (
                  <Tr key={entry.id}>
                    <Td className="font-mono tabular-nums" title={absoluteTime(entry.created_at, locale)}>
                      {relativeTime(entry.created_at, locale)}
                    </Td>
                    <Td>{t(`devices.${entry.device_type}`)}</Td>
                    <Td>
                      <Badge variant={entry.action === 'turn_on' ? 'ok' : 'neutral'}>
                        {entry.action === 'turn_on' ? t('app.overview.on') : t('app.overview.off')}
                      </Badge>
                    </Td>
                    <Td>
                      {entry.triggered_by === 'rule'
                        ? (entry.rule_name ?? t('automation.ruleFallback'))
                        : t('automation.manual')}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog ref={editorDialog.ref}>
        <form onSubmit={handleSave} noValidate>
          <DialogTitle>
            {draft.id ? t('automation.editRule') : t('automation.newRule')}
          </DialogTitle>
          <div className="mt-4 flex flex-col gap-4">
            <FormField
              label={t('automation.fields.name')}
              htmlFor="rule-name"
              error={nameError ? t(nameError) : undefined}
            >
              <Input
                id="rule-name"
                value={draft.name}
                invalid={Boolean(nameError)}
                placeholder={t('automation.fields.namePlaceholder')}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('automation.fields.sensor')} htmlFor="rule-sensor">
                <Select
                  id="rule-sensor"
                  value={draft.sensor_type}
                  onChange={(event) =>
                    setDraft({ ...draft, sensor_type: event.target.value as SensorType })
                  }
                >
                  {SENSOR_TYPE_LIST.map((type) => (
                    <option key={type} value={type}>
                      {t(`sensors.${type}`)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={t('automation.fields.condition')} htmlFor="rule-condition">
                <Select
                  id="rule-condition"
                  value={draft.condition}
                  onChange={(event) =>
                    setDraft({ ...draft, condition: event.target.value as RuleCondition })
                  }
                >
                  <option value="above">{t('automation.condition.above')}</option>
                  <option value="below">{t('automation.condition.below')}</option>
                </Select>
              </FormField>
            </div>

            <FormField
              label={t('automation.fields.threshold')}
              htmlFor="rule-threshold"
              error={thresholdError ? t(thresholdError, SENSOR_INPUT_RANGE[draft.sensor_type]) : undefined}
            >
              <div className="flex items-center gap-2">
                <Input
                  id="rule-threshold"
                  type="number"
                  step={SENSOR_INPUT_RANGE[draft.sensor_type].step}
                  value={draft.threshold}
                  invalid={Boolean(thresholdError)}
                  onChange={(event) => setDraft({ ...draft, threshold: event.target.value })}
                />
                <span className="font-mono text-xs text-muted">
                  {SENSOR_TYPES[draft.sensor_type].unit}
                </span>
              </div>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('automation.fields.device')} htmlFor="rule-device">
                <Select
                  id="rule-device"
                  value={draft.device_type}
                  onChange={(event) =>
                    setDraft({ ...draft, device_type: event.target.value as DeviceType })
                  }
                >
                  {DEVICE_TYPE_LIST.map((type) => (
                    <option key={type} value={type}>
                      {t(`devices.${type}`)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={t('automation.fields.action')} htmlFor="rule-action">
                <Select
                  id="rule-action"
                  value={draft.action}
                  onChange={(event) =>
                    setDraft({ ...draft, action: event.target.value as RuleAction })
                  }
                >
                  <option value="turn_on">{t('automation.action.turnOn')}</option>
                  <option value="turn_off">{t('automation.action.turnOff')}</option>
                </Select>
              </FormField>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted">
                {t('automation.fields.enabled')}
              </span>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(value) => setDraft({ ...draft, enabled: value })}
                aria-label={t('automation.fields.enabled')}
              />
            </div>

            {previewValid ? (
              <p className="rounded-sharp border border-border bg-surface p-3 text-[13px] text-muted">
                {ruleSummary(
                  draft.sensor_type,
                  draft.condition,
                  previewThreshold,
                  draft.device_type,
                  draft.action,
                  t,
                )}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={editorDialog.close}>
              {t('automation.cancel')}
            </Button>
            <Button type="submit">{t('automation.save')}</Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog ref={deleteDialog.ref}>
        <DialogTitle>{t('automation.deleteTitle')}</DialogTitle>
        <DialogDescription>
          {t('automation.deleteBody', { name: ruleToDelete?.name ?? '' })}
        </DialogDescription>
        <DialogFooter>
          <Button variant="secondary" onClick={deleteDialog.close}>
            {t('automation.cancel')}
          </Button>
          <Button onClick={handleDelete}>{t('automation.delete')}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
