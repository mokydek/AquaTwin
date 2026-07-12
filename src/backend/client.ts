import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/backend/types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
  )
}

// The single typed Supabase client. Per the architecture rules, this module is
// the only place allowed to import @supabase/supabase-js in the app; components
// go through the typed functions in src/backend.
export const supabase = createClient<Database>(url, anonKey)
