import { AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import type { FarmNode, FishBatch, FishEvent, FishEventType, Species } from '@/backend'
import {
  createBatch,
  deleteBatch,
  getLayout,
  listBatches,
  listEvents,
  logEvent,
  updateSensorThresholds,
} from '@/backend'
import { useLiveReadings } from '@/frontend/data/LiveReadingsProvider'
import { useFarm } from '@/frontend/farm/FarmProvider'
import { SPECIES, SPECIES_LIST } from '@/shared/config/species'
import {
  computeBatchStats,
  computeDensity,
  computeFeedSuggestion,
  densityStatus,
} from '@/shared/lib/biomass'
import { statusToBadgeVariant } from '@/shared/lib/status'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  Stat,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useDialog,
  useToast,
} from '@/shared/ui'

const EVENT_TYPES: FishEventType[] = ['mortality', 'harvest', 'restock', 'weighing']
const EVENT_BADGE: Record<FishEventType, 'ok' | 'warning' | 'neutral'> = {
  mortality: 'warning',
  harvest: 'neutral',
  restock: 'ok',
  weighing: 'neutral',
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function ageDays(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000)))
}

function formatFeed(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`
}

export default function LivestockPage() {
  const { t } = useTranslation()
  usePageTitle(`${t('app.nav.livestock')} · ${t('app.name')}`)
  const { activeFarmId } = useFarm()
  const { latest, sensors, refreshSensors } = useLiveReadings()
  const { toast } = useToast()

  const [batches, setBatches] = useState<FishBatch[] | null>(null)
  const [events, setEvents] = useState<FishEvent[] | null>(null)
  const [tanks, setTanks] = useState<FarmNode[]>([])

  const newBatchDialog = useDialog()
  const logDialog = useDialog()
  const deleteDialog = useDialog()

  const [batchDraft, setBatchDraft] = useState({
    species: 'tilapia' as Species,
    nodeId: '',
    count: '',
    avgWeight: '',
    stockedAt: todayIso(),
    note: '',
  })
  const [batchErrors, setBatchErrors] = useState<{ count?: string; avgWeight?: string; tank?: string }>({})
  const [logBatch, setLogBatch] = useState<FishBatch | null>(null)
  const [eventDraft, setEventDraft] = useState({
    type: 'mortality' as FishEventType,
    count: '',
    avgWeight: '',
    note: '',
  })
  const [eventError, setEventError] = useState<string | null>(null)
  const [batchToDelete, setBatchToDelete] = useState<FishBatch | null>(null)
  const [suggestSpecies, setSuggestSpecies] = useState<Species | null>(null)

  useEffect(() => {
    if (!activeFarmId) return
    let live = true
    setBatches(null)
    setEvents(null)
    Promise.all([listBatches(activeFarmId), listEvents(activeFarmId, 1000), getLayout(activeFarmId)])
      .then(([loadedBatches, loadedEvents, layout]) => {
        if (!live) return
        setBatches(loadedBatches)
        setEvents(loadedEvents)
        setTanks(layout.nodes.filter((node) => node.type === 'fish_tank'))
      })
      .catch(() => {
        if (!live) return
        setBatches([])
        setEvents([])
        setTanks([])
      })
    return () => {
      live = false
    }
  }, [activeFarmId])

  const waterTempSensor = sensors.find((sensor) => sensor.type === 'water_temp') ?? null
  const currentWaterTemp = latest.get('water_temp') ?? null

  const eventsByBatch = useMemo(() => {
    const map = new Map<string, FishEvent[]>()
    for (const event of events ?? []) {
      const list = map.get(event.batch_id) ?? []
      list.push(event)
      map.set(event.batch_id, list)
    }
    return map
  }, [events])

  function tankFor(batch: FishBatch): FarmNode | null {
    return tanks.find((node) => node.id === batch.node_id) ?? null
  }

  const summary = useMemo(() => {
    let live = 0
    let biomass = 0
    let stocked = 0
    let mortality = 0
    let feedGrams = 0
    let feedReduced = false
    for (const batch of batches ?? []) {
      const stats = computeBatchStats(batch, eventsByBatch.get(batch.id) ?? [])
      live += stats.currentCount
      biomass += stats.biomassKg
      stocked += batch.initial_count
      mortality += stats.totalMortality
      const feed = computeFeedSuggestion(stats.biomassKg, batch.species, currentWaterTemp)
      feedGrams += feed.gramsPerDay
      if (feed.reduced) feedReduced = true
    }
    const survival = stocked > 0 ? Math.max(0, Math.min(100, ((stocked - mortality) / stocked) * 100)) : 0
    return { live, biomass, survival, feedGrams, feedReduced }
  }, [batches, eventsByBatch, currentWaterTemp])

  function openNewBatch() {
    setBatchDraft({
      species: 'tilapia',
      nodeId: tanks[0]?.id ?? '',
      count: '',
      avgWeight: '',
      stockedAt: todayIso(),
      note: '',
    })
    setBatchErrors({})
    newBatchDialog.open()
  }

  async function submitBatch(event: FormEvent) {
    event.preventDefault()
    if (!activeFarmId) return
    const count = Number(batchDraft.count)
    const avgWeight = Number(batchDraft.avgWeight)
    const errors: { count?: string; avgWeight?: string; tank?: string } = {}
    if (batchDraft.nodeId === '') errors.tank = 'livestock.errors.tank'
    if (!Number.isFinite(count) || count <= 0) errors.count = 'livestock.errors.count'
    if (!Number.isFinite(avgWeight) || avgWeight <= 0) errors.avgWeight = 'livestock.errors.weight'
    setBatchErrors(errors)
    if (Object.keys(errors).length > 0) return

    try {
      await createBatch({
        farm_id: activeFarmId,
        node_id: batchDraft.nodeId,
        species: batchDraft.species,
        initial_count: Math.round(count),
        avg_weight_g: avgWeight,
        stocked_at: batchDraft.stockedAt,
        note: batchDraft.note.trim() === '' ? null : batchDraft.note.trim(),
      })
      newBatchDialog.close()
      toast(t('livestock.batchCreated'))
      const [loadedBatches, loadedEvents] = await Promise.all([
        listBatches(activeFarmId),
        listEvents(activeFarmId, 1000),
      ])
      setBatches(loadedBatches)
      setEvents(loadedEvents)
      const config = SPECIES[batchDraft.species]
      if (
        waterTempSensor &&
        (waterTempSensor.warn_low !== config.tempMin || waterTempSensor.warn_high !== config.tempMax)
      ) {
        setSuggestSpecies(batchDraft.species)
      }
    } catch {
      toast(t('livestock.saveFailed'), { kind: 'critical' })
    }
  }

  function openLog(batch: FishBatch) {
    setLogBatch(batch)
    setEventDraft({ type: 'mortality', count: '', avgWeight: '', note: '' })
    setEventError(null)
    logDialog.open()
  }

  async function submitEvent(event: FormEvent) {
    event.preventDefault()
    if (!activeFarmId || !logBatch) return
    const count = Number(eventDraft.count)
    const avgWeight = Number(eventDraft.avgWeight)
    const stats = computeBatchStats(logBatch, eventsByBatch.get(logBatch.id) ?? [])

    if (eventDraft.type === 'weighing') {
      if (!Number.isFinite(avgWeight) || avgWeight <= 0) {
        setEventError('livestock.errors.weight')
        return
      }
    } else {
      if (!Number.isFinite(count) || count < 0) {
        setEventError('livestock.errors.count')
        return
      }
      if (eventDraft.type === 'harvest' && count > stats.currentCount) {
        setEventError('livestock.errors.harvestTooMany')
        return
      }
    }
    setEventError(null)

    try {
      await logEvent(logBatch.id, activeFarmId, eventDraft.type, {
        count: eventDraft.type === 'weighing' ? null : Math.round(count),
        avgWeightG: eventDraft.type === 'weighing' ? avgWeight : null,
        note: eventDraft.note.trim() === '' ? null : eventDraft.note.trim(),
      })
      logDialog.close()
      toast(t('livestock.eventLogged'))
      const loadedEvents = await listEvents(activeFarmId, 1000)
      setEvents(loadedEvents)
    } catch {
      toast(t('livestock.saveFailed'), { kind: 'critical' })
    }
  }

  function openDelete(batch: FishBatch) {
    setBatchToDelete(batch)
    deleteDialog.open()
  }

  async function confirmDelete() {
    if (!activeFarmId || !batchToDelete) return
    try {
      await deleteBatch(batchToDelete.id)
      deleteDialog.close()
      setBatchToDelete(null)
      toast(t('livestock.batchDeleted'))
      const [loadedBatches, loadedEvents] = await Promise.all([
        listBatches(activeFarmId),
        listEvents(activeFarmId, 1000),
      ])
      setBatches(loadedBatches)
      setEvents(loadedEvents)
    } catch {
      toast(t('livestock.saveFailed'), { kind: 'critical' })
    }
  }

  async function applyTempProfile() {
    if (!suggestSpecies || !waterTempSensor) return
    const config = SPECIES[suggestSpecies]
    const result = await updateSensorThresholds(waterTempSensor.id, {
      warn_low: config.tempMin,
      warn_high: config.tempMax,
      crit_low: waterTempSensor.crit_low,
      crit_high: waterTempSensor.crit_high,
    })
    if (result.ok) {
      await refreshSensors()
      toast(t('livestock.profileApplied'))
      setSuggestSpecies(null)
    } else {
      toast(t('livestock.saveFailed'), { kind: 'critical' })
    }
  }

  const loading = batches === null || events === null
  const recentEvents = (events ?? []).slice(0, 50)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('app.nav.livestock')}
        description={t('livestock.description')}
        actions={
          <Button size="sm" onClick={openNewBatch}>
            {t('livestock.newBatch')}
          </Button>
        }
      />

      {loading ? (
        <p className="text-[13px] text-muted">{t('livestock.loading')}</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="p-4">
              <Stat label={t('livestock.totalLive')} value={String(summary.live)} />
            </Card>
            <Card className="p-4">
              <Stat label={t('livestock.totalBiomass')} value={summary.biomass.toFixed(1)} unit="kg" />
            </Card>
            <Card className="p-4">
              <Stat label={t('livestock.survival')} value={summary.survival.toFixed(0)} unit="%" />
            </Card>
            <Card className="p-4">
              <Stat label={t('livestock.feedToday')} value={formatFeed(summary.feedGrams)} />
            </Card>
          </section>

          {summary.feedReduced ? (
            <p className="flex items-center gap-1.5 text-[13px] text-muted">
              <AlertTriangle size={14} strokeWidth={1.5} aria-hidden="true" />
              {t('livestock.feedReducedHint')}
            </p>
          ) : null}

          {suggestSpecies ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-sharp border border-border p-3">
              <span className="text-[13px] text-muted">
                {t('livestock.profileSuggestion', {
                  species: t(`species.${suggestSpecies}`),
                  min: SPECIES[suggestSpecies].tempMin,
                  max: SPECIES[suggestSpecies].tempMax,
                })}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={applyTempProfile}>
                  {t('livestock.applyProfile')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSuggestSpecies(null)}>
                  {t('livestock.dismiss')}
                </Button>
              </div>
            </div>
          ) : null}

          {(batches ?? []).length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title={t('livestock.emptyTitle')}
              description={t('livestock.emptyBody')}
              action={
                <Button size="sm" onClick={openNewBatch}>
                  {t('livestock.newBatch')}
                </Button>
              }
            />
          ) : (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {(batches ?? []).map((batch) => {
                const stats = computeBatchStats(batch, eventsByBatch.get(batch.id) ?? [])
                const tank = tankFor(batch)
                const volumeL = tank?.props.volumeL ?? null
                const density = computeDensity(stats.biomassKg, volumeL)
                const config = SPECIES[batch.species]
                return (
                  <Card key={batch.id}>
                    <CardHeader
                      title={t(`species.${batch.species}`)}
                      description={tank ? tank.label : t('livestock.noTank')}
                    />
                    <CardContent className="flex flex-col gap-3">
                      <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                        <div className="flex flex-col">
                          <span className="text-muted">{t('livestock.count')}</span>
                          <span className="text-foreground">{stats.currentCount}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted">{t('livestock.avgWeight')}</span>
                          <span className="text-foreground">{stats.currentAvgWeightG.toFixed(0)} g</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted">{t('livestock.biomass')}</span>
                          <span className="text-foreground">{stats.biomassKg.toFixed(1)} kg</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] text-muted">{t('livestock.density')}</span>
                          {density !== null ? (
                            <span className="font-mono text-sm text-foreground">
                              {density.toFixed(1)} kg/m³
                            </span>
                          ) : (
                            <span className="text-[13px] text-muted">{t('livestock.noTank')}</span>
                          )}
                        </div>
                        {density !== null ? (
                          <Badge variant={statusToBadgeVariant(densityStatus(density, config.maxDensityKgM3))}>
                            {t(`app.status.${densityStatus(density, config.maxDensityKgM3)}`)}
                          </Badge>
                        ) : null}
                      </div>
                      {volumeL !== null ? (
                        <p className="font-mono text-[11px] text-muted">
                          {t('livestock.basedOn', { volume: volumeL })}
                        </p>
                      ) : null}

                      <p className="font-mono text-[11px] text-muted">
                        {t('livestock.stockedAge', { date: batch.stocked_at, days: ageDays(batch.stocked_at) })}
                      </p>
                    </CardContent>
                    <CardFooter>
                      <Button variant="ghost" size="sm" onClick={() => openLog(batch)}>
                        {t('livestock.logEvent')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openDelete(batch)}>
                        {t('livestock.deleteBatch')}
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </section>
          )}

          <section className="flex flex-col gap-4">
            <h2 className="text-[11px] uppercase tracking-wider text-muted">{t('livestock.events')}</h2>
            {recentEvents.length === 0 ? (
              <EmptyState icon={AlertTriangle} title={t('livestock.noEvents')} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>{t('livestock.event.date')}</Th>
                      <Th>{t('livestock.event.batch')}</Th>
                      <Th>{t('livestock.event.type')}</Th>
                      <Th>{t('livestock.event.amount')}</Th>
                      <Th>{t('livestock.event.note')}</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {recentEvents.map((event) => {
                      const batch = (batches ?? []).find((b) => b.id === event.batch_id)
                      const tank = batch ? tankFor(batch) : null
                      return (
                        <Tr key={event.id}>
                          <Td className="font-mono tabular-nums">{event.created_at.slice(0, 10)}</Td>
                          <Td>
                            {batch ? t(`species.${batch.species}`) : '—'}
                            {tank ? <span className="text-muted"> {tank.label}</span> : null}
                          </Td>
                          <Td>
                            <Badge variant={EVENT_BADGE[event.type]}>{t(`livestock.type.${event.type}`)}</Badge>
                          </Td>
                          <Td numeric>
                            {event.type === 'weighing'
                              ? event.avg_weight_g !== null
                                ? `${event.avg_weight_g.toFixed(0)} g`
                                : '—'
                              : (event.count ?? '—')}
                          </Td>
                          <Td className="max-w-40 truncate text-muted">{event.note ?? ''}</Td>
                        </Tr>
                      )
                    })}
                  </TBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}

      <Dialog ref={newBatchDialog.ref}>
        <DialogTitle>{t('livestock.newBatch')}</DialogTitle>
        {tanks.length === 0 ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[13px] text-muted">{t('livestock.noTankNotice')}</p>
            <Link to="/app/twin" className="text-sm text-foreground underline">
              {t('livestock.goToLayout')}
            </Link>
          </div>
        ) : (
          <form onSubmit={submitBatch} noValidate>
            <div className="mt-4 flex flex-col gap-4">
              <FormField label={t('livestock.species')} htmlFor="batch-species">
                <Select
                  id="batch-species"
                  value={batchDraft.species}
                  onChange={(event) =>
                    setBatchDraft((prev) => ({ ...prev, species: event.target.value as Species }))
                  }
                >
                  {SPECIES_LIST.map((species) => (
                    <option key={species} value={species}>
                      {t(`species.${species}`)}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                label={t('livestock.tank')}
                htmlFor="batch-tank"
                error={batchErrors.tank ? t(batchErrors.tank) : undefined}
              >
                <Select
                  id="batch-tank"
                  value={batchDraft.nodeId}
                  onChange={(event) => setBatchDraft((prev) => ({ ...prev, nodeId: event.target.value }))}
                >
                  <option value="">{t('livestock.selectTank')}</option>
                  {tanks.map((tank) => (
                    <option key={tank.id} value={tank.id}>
                      {tank.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label={t('livestock.count')}
                  htmlFor="batch-count"
                  error={batchErrors.count ? t(batchErrors.count) : undefined}
                >
                  <Input
                    id="batch-count"
                    type="number"
                    className="font-mono"
                    value={batchDraft.count}
                    invalid={Boolean(batchErrors.count)}
                    onChange={(event) => setBatchDraft((prev) => ({ ...prev, count: event.target.value }))}
                  />
                </FormField>
                <FormField
                  label={t('livestock.avgWeightG')}
                  htmlFor="batch-weight"
                  error={batchErrors.avgWeight ? t(batchErrors.avgWeight) : undefined}
                >
                  <Input
                    id="batch-weight"
                    type="number"
                    className="font-mono"
                    value={batchDraft.avgWeight}
                    invalid={Boolean(batchErrors.avgWeight)}
                    onChange={(event) => setBatchDraft((prev) => ({ ...prev, avgWeight: event.target.value }))}
                  />
                </FormField>
              </div>

              <FormField label={t('livestock.stockedAt')} htmlFor="batch-date">
                <Input
                  id="batch-date"
                  type="date"
                  className="font-mono"
                  value={batchDraft.stockedAt}
                  onChange={(event) => setBatchDraft((prev) => ({ ...prev, stockedAt: event.target.value }))}
                />
              </FormField>

              <FormField label={t('livestock.note')} htmlFor="batch-note">
                <Input
                  id="batch-note"
                  value={batchDraft.note}
                  onChange={(event) => setBatchDraft((prev) => ({ ...prev, note: event.target.value }))}
                />
              </FormField>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={newBatchDialog.close}>
                {t('livestock.cancel')}
              </Button>
              <Button type="submit">{t('livestock.save')}</Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>

      <Dialog ref={logDialog.ref}>
        <form onSubmit={submitEvent} noValidate>
          <DialogTitle>{t('livestock.logEvent')}</DialogTitle>
          <div className="mt-4 flex flex-col gap-4">
            <FormField label={t('livestock.eventType')} htmlFor="event-type">
              <Select
                id="event-type"
                value={eventDraft.type}
                onChange={(event) =>
                  setEventDraft((prev) => ({ ...prev, type: event.target.value as FishEventType }))
                }
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`livestock.type.${type}`)}
                  </option>
                ))}
              </Select>
            </FormField>

            {eventDraft.type === 'weighing' ? (
              <FormField
                label={t('livestock.avgWeightG')}
                htmlFor="event-weight"
                error={eventError ? t(eventError) : undefined}
              >
                <Input
                  id="event-weight"
                  type="number"
                  className="font-mono"
                  value={eventDraft.avgWeight}
                  invalid={Boolean(eventError)}
                  onChange={(event) => setEventDraft((prev) => ({ ...prev, avgWeight: event.target.value }))}
                />
              </FormField>
            ) : (
              <FormField
                label={t('livestock.count')}
                htmlFor="event-count"
                error={eventError ? t(eventError) : undefined}
              >
                <Input
                  id="event-count"
                  type="number"
                  className="font-mono"
                  value={eventDraft.count}
                  invalid={Boolean(eventError)}
                  onChange={(event) => setEventDraft((prev) => ({ ...prev, count: event.target.value }))}
                />
              </FormField>
            )}

            <FormField label={t('livestock.note')} htmlFor="event-note">
              <Input
                id="event-note"
                value={eventDraft.note}
                onChange={(event) => setEventDraft((prev) => ({ ...prev, note: event.target.value }))}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={logDialog.close}>
              {t('livestock.cancel')}
            </Button>
            <Button type="submit">{t('livestock.save')}</Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog ref={deleteDialog.ref}>
        <DialogTitle>{t('livestock.deleteBatch')}</DialogTitle>
        <DialogDescription>{t('livestock.deleteBatchBody')}</DialogDescription>
        <DialogFooter>
          <Button variant="secondary" onClick={deleteDialog.close}>
            {t('livestock.cancel')}
          </Button>
          <Button onClick={confirmDelete}>{t('livestock.confirmDelete')}</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
