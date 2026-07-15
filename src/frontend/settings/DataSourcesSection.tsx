import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import type { ApiKeyView } from '@/backend'
import { createApiKey, listApiKeys, revokeApiKey } from '@/backend'
import { useFarm } from '@/frontend/farm/FarmProvider'
import {
  Badge,
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
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useDialog,
  useToast,
} from '@/shared/ui'

// The ingestion endpoint lives on the Supabase project derived from the public
// project URL. It is not a secret; devices authenticate with an api key header.
const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest`

// Code snippets are code, not UI copy: they stay English and are constants.
const CURL_SNIPPET = `curl -X POST '${INGEST_URL}' \\
  -H 'content-type: application/json' \\
  -H 'x-api-key: aqk_YOUR_KEY_HERE' \\
  -d '{"readings":[{"sensor":"ph","value":7.10},{"sensor":"water_temp","value":24.5}]}'`

const ARDUINO_SNIPPET = `#include <WiFi.h>
#include <HTTPClient.h>

const char* INGEST_URL = "${INGEST_URL}";
const char* API_KEY = "aqk_YOUR_KEY_HERE";

void postReading(float ph, float tempC) {
  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("content-type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  String body = "{\\"readings\\":[{\\"sensor\\":\\"ph\\",\\"value\\":" + String(ph) +
                "},{\\"sensor\\":\\"water_temp\\",\\"value\\":" + String(tempC) + "}]}";
  http.POST(body);
  http.end();
}`

function relativeTime(iso: string, locale: string): string {
  const diffMs = Date.parse(iso) - Date.now()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const minutes = Math.round(diffMs / 60000)
  if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
  const hours = Math.round(diffMs / 3600000)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(diffMs / 86400000), 'day')
}

export function DataSourcesSection() {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage ?? i18n.language
  const { activeFarmId } = useFarm()
  const { toast } = useToast()

  const newKeyDialog = useDialog()
  const revokeDialog = useDialog()

  const [keys, setKeys] = useState<ApiKeyView[] | null>(null)
  const [label, setLabel] = useState('')
  const [labelError, setLabelError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [rawKey, setRawKey] = useState<string | null>(null)
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyView | null>(null)

  useEffect(() => {
    if (!activeFarmId) return
    let live = true
    setKeys(null)
    listApiKeys(activeFarmId)
      .then((list) => {
        if (live) setKeys(list)
      })
      .catch(() => {
        if (live) setKeys([])
      })
    return () => {
      live = false
    }
  }, [activeFarmId])

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast(t('settings.dataSources.copied'))
    } catch {
      toast(t('settings.dataSources.copyFailed'), { kind: 'critical' })
    }
  }

  function openNewKey() {
    setLabel('')
    setLabelError(null)
    setRawKey(null)
    newKeyDialog.open()
  }

  async function submitKey(event: FormEvent) {
    event.preventDefault()
    if (!activeFarmId) return
    if (label.trim().length === 0) {
      setLabelError('settings.dataSources.labelRequired')
      return
    }
    setLabelError(null)
    setCreating(true)
    try {
      const { rawKey: created } = await createApiKey(activeFarmId, label.trim())
      setRawKey(created)
      const list = await listApiKeys(activeFarmId)
      setKeys(list)
    } catch {
      toast(t('settings.saveFailed'), { kind: 'critical' })
    }
    setCreating(false)
  }

  function openRevoke(key: ApiKeyView) {
    setKeyToRevoke(key)
    revokeDialog.open()
  }

  async function confirmRevoke() {
    if (!activeFarmId || !keyToRevoke) return
    try {
      await revokeApiKey(keyToRevoke.id)
      revokeDialog.close()
      setKeyToRevoke(null)
      toast(t('settings.dataSources.revoked'))
      const list = await listApiKeys(activeFarmId)
      setKeys(list)
    } catch {
      toast(t('settings.saveFailed'), { kind: 'critical' })
    }
  }

  return (
    <Card>
      <CardHeader
        title={t('settings.dataSources.title')}
        description={t('settings.dataSources.hint')}
        actions={
          <Button size="sm" onClick={openNewKey}>
            {t('settings.dataSources.newKey')}
          </Button>
        }
      />
      <CardContent className="flex flex-col gap-6">
        {keys && keys.length === 0 ? (
          <p className="text-[13px] text-muted">{t('settings.dataSources.noKeys')}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>{t('settings.dataSources.label')}</Th>
                  <Th>{t('settings.dataSources.prefix')}</Th>
                  <Th>{t('settings.dataSources.created')}</Th>
                  <Th>{t('settings.dataSources.lastUsed')}</Th>
                  <Th>{t('settings.dataSources.status')}</Th>
                  <Th>{t('settings.dataSources.actions')}</Th>
                </Tr>
              </THead>
              <TBody>
                {(keys ?? []).map((key) => (
                  <Tr key={key.id}>
                    <Td>{key.label}</Td>
                    <Td className="font-mono tabular-nums">{key.key_prefix}</Td>
                    <Td className="font-mono tabular-nums">{key.created_at.slice(0, 10)}</Td>
                    <Td className="font-mono">
                      {key.last_used_at ? relativeTime(key.last_used_at, locale) : t('settings.dataSources.never')}
                    </Td>
                    <Td>
                      <Badge variant={key.revoked ? 'neutral' : 'ok'}>
                        {key.revoked ? t('settings.dataSources.revokedStatus') : t('settings.dataSources.active')}
                      </Badge>
                    </Td>
                    <Td>
                      {key.revoked ? null : (
                        <Button variant="ghost" size="sm" onClick={() => openRevoke(key)}>
                          {t('settings.dataSources.revoke')}
                        </Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <span className="text-[11px] uppercase tracking-wider text-muted">
            {t('settings.dataSources.endpoint')}
          </span>
          <p className="text-[13px] text-muted">{t('settings.dataSources.endpointHint')}</p>
          <div className="flex items-center gap-2">
            <pre className="flex-1 overflow-x-auto rounded-sharp border border-border bg-surface p-3 font-mono text-xs text-foreground">
              {INGEST_URL}
            </pre>
            <Button variant="secondary" size="sm" onClick={() => copy(INGEST_URL)}>
              {t('settings.dataSources.copy')}
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted">
                {t('settings.dataSources.curl')}
              </span>
              <Button variant="ghost" size="sm" onClick={() => copy(CURL_SNIPPET)}>
                {t('settings.dataSources.copy')}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-sharp border border-border bg-surface p-3 font-mono text-xs text-foreground">
              {CURL_SNIPPET}
            </pre>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted">
                {t('settings.dataSources.arduino')}
              </span>
              <Button variant="ghost" size="sm" onClick={() => copy(ARDUINO_SNIPPET)}>
                {t('settings.dataSources.copy')}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-sharp border border-border bg-surface p-3 font-mono text-xs text-foreground">
              {ARDUINO_SNIPPET}
            </pre>
          </div>
        </div>
      </CardContent>

      <Dialog ref={newKeyDialog.ref} onClose={() => setRawKey(null)}>
        {rawKey ? (
          <>
            <DialogTitle>{t('settings.dataSources.rawKeyTitle')}</DialogTitle>
            <DialogDescription>{t('settings.dataSources.rawKeyWarning')}</DialogDescription>
            <div className="mt-4 flex items-center gap-2">
              <pre className="flex-1 overflow-x-auto rounded-sharp border border-border bg-surface p-3 font-mono text-xs text-foreground">
                {rawKey}
              </pre>
              <Button variant="secondary" size="sm" onClick={() => copy(rawKey)}>
                {t('settings.dataSources.copy')}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={newKeyDialog.close}>{t('settings.dataSources.done')}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submitKey} noValidate>
            <DialogTitle>{t('settings.dataSources.newKey')}</DialogTitle>
            <div className="mt-4">
              <FormField
                label={t('settings.dataSources.keyLabel')}
                htmlFor="key-label"
                error={labelError ? t(labelError) : undefined}
              >
                <Input
                  id="key-label"
                  value={label}
                  invalid={Boolean(labelError)}
                  placeholder={t('settings.dataSources.keyLabelPlaceholder')}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </FormField>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={newKeyDialog.close}>
                {t('settings.dataSources.cancel')}
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? t('settings.dataSources.creating') : t('settings.dataSources.create')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>

      <Dialog ref={revokeDialog.ref}>
        <DialogTitle>{t('settings.dataSources.revokeTitle')}</DialogTitle>
        <DialogDescription>
          {t('settings.dataSources.revokeBody', { label: keyToRevoke?.label ?? '' })}
        </DialogDescription>
        <DialogFooter>
          <Button variant="secondary" onClick={revokeDialog.close}>
            {t('settings.dataSources.cancel')}
          </Button>
          <Button onClick={confirmRevoke}>{t('settings.dataSources.revoke')}</Button>
        </DialogFooter>
      </Dialog>
    </Card>
  )
}
