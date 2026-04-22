import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase browser client.
 * Use this for:
 *   - Realtime subscriptions (case updates, notifications)
 *   - Client-side file uploads to Supabase Storage
 *   - Any client component that needs direct Supabase access
 *
 * RLS policies still apply — user only sees their own data.
 */
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
