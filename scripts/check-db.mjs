// Standalone database healthcheck. No imports from src.
// Run with: npm run check:db  (which passes --env-file=.env)

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('FAILED: missing env. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

try {
  const { data, error } = await supabase.from('farms').select('id').limit(1)

  if (error) {
    if (error.code === '42P01' || /does not exist/i.test(error.message)) {
      console.error('FAILED: the "farms" table was not found.')
      console.error('Apply supabase/schema.sql in the Supabase SQL Editor first.')
    } else if (error.code === '42501' || /row-level security|permission denied/i.test(error.message)) {
      console.error('FAILED: query blocked by row level security. This is expected when signed out.')
      console.error(`Details: ${error.message}`)
    } else {
      console.error(`FAILED: ${error.message}${error.code ? ` (code ${error.code})` : ''}`)
    }
    process.exit(1)
  }

  // An empty result is success: the table exists and is reachable.
  console.log(`OK: database reachable, "farms" table present (${data.length} row(s) visible).`)
  process.exit(0)
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  console.error(`FAILED: could not reach the database. ${message}`)
  process.exit(1)
}
