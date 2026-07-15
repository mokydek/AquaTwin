import { supabase } from '@/backend/client'
import { BackendError } from '@/backend/errors'
import type { FarmApiKey } from '@/backend/types'

// The UI never needs the hash; it only ever sees the prefix.
export type ApiKeyView = Omit<FarmApiKey, 'key_hash'>

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/*
 * Key model: the raw key (aqk_...) is generated in the browser, its SHA-256 hash
 * is stored in the database, and only the hash plus a short prefix ever persist.
 * The raw key is returned to the caller exactly once and never saved anywhere.
 * The ingest edge function hashes the incoming x-api-key header the same way and
 * matches it against the stored hash, so the plaintext key is never transmitted
 * to nor stored by our own tables in a reversible form.
 */
export async function createApiKey(
  farmId: string,
  label: string,
): Promise<{ rawKey: string; key: ApiKeyView }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const rawKey = `aqk_${base64url(bytes)}`
  const keyHash = await sha256Hex(rawKey)
  const keyPrefix = rawKey.slice(0, 12)

  const { data, error } = await supabase
    .from('farm_api_keys')
    .insert({ farm_id: farmId, key_hash: keyHash, key_prefix: keyPrefix, label })
    .select('id, farm_id, key_prefix, label, created_at, last_used_at, revoked')
    .single()
  if (error) throw new BackendError(error.message, error.code)

  return { rawKey, key: data }
}

export async function listApiKeys(farmId: string): Promise<ApiKeyView[]> {
  const { data, error } = await supabase
    .from('farm_api_keys')
    .select('id, farm_id, key_prefix, label, created_at, last_used_at, revoked')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
  if (error) throw new BackendError(error.message, error.code)
  return data
}

export async function revokeApiKey(id: string): Promise<void> {
  const { error } = await supabase.from('farm_api_keys').update({ revoked: true }).eq('id', id)
  if (error) throw new BackendError(error.message, error.code)
}
