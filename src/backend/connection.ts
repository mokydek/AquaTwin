import { supabase } from '@/backend/client'

let channelSeq = 0

// Subscribes a lightweight channel whose realtime status mirrors the overall
// connection health, so the UI can show a live or reconnecting indicator.
export function subscribeConnection(onStatus: (connected: boolean) => void): () => void {
  channelSeq += 1
  const channel = supabase.channel(`connection-${channelSeq}`)
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      onStatus(true)
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      onStatus(false)
    }
  })
  return () => {
    void supabase.removeChannel(channel)
  }
}
