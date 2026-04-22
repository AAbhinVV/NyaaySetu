import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase server client with cookie-based auth.
 * Use this for all tRPC procedures and server components.
 * RLS policies apply — user sees only their own data.
 */
export async function createServerClient() {
    const cookieStore = await cookies()

    return createSupabaseServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options)
                        })
                    } catch {
                        // setAll may be called from a Server Component where
                        // cookies are read-only. This is safe to ignore.
                    }
                },
            },
        }
    )
}

/**
 * Creates a Supabase client with the service role key.
 * Bypasses ALL RLS policies — use only for:
 *   - Webhook handlers (Clerk, Stripe)
 *   - Admin operations that need to read/write across users
 *   - Background jobs
 */
export function createServiceRoleClient() {
    const { createClient } = require('@supabase/supabase-js')

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
    }

    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}
