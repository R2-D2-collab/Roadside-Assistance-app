import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// The app runs in two modes:
//  1. "Mock mode" (default, right now) — no Supabase project connected yet, all data
//     lives in the browser's localStorage via lib/dataStore.ts. Good enough to click
//     through the full customer/operator/admin flow and demo it.
//  2. "Live mode" — once VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in a
//     .env.local file (see .env.example), dataStore.ts automatically uses the real
//     Supabase backend instead. No UI code needs to change.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isLiveMode = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isLiveMode
  ? createClient(url as string, anonKey as string)
  : null
