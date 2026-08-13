import { initTRPC, TRPCError } from '@trpc/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { cache } from 'react'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'

// ─── Context ──────────────────────────────────────────────────────────────────

export const createTRPCContext = cache(async () => {
    const { userId: clerkUserId } = await auth()
    const supabase = await createServerClient()

    let dbUserId: string | null = null
    let dbRole: string | null = null
    let suspended = false
    let serviceSupabase: ReturnType<typeof createServiceRoleClient> | null = null

    if (clerkUserId) {
        serviceSupabase = createServiceRoleClient()

        const { data: userRow } = await serviceSupabase
            .from('users')
            .select('id, role, suspended')
            .eq('clerk_user_id', clerkUserId)
            .maybeSingle()

        dbUserId = userRow?.id ?? null
        dbRole = userRow?.role ?? null
        suspended = userRow?.suspended ?? false
    }

    return {
        userId: dbUserId,
        clerkUserId,
        // Database roles are authoritative. Clerk metadata is only a routing hint
        // and must never be used to authorize an API operation.
        role: dbRole,
        suspended,
        supabase,
        serviceSupabase,
    }
})

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

// ─── tRPC Initialization ──────────────────────────────────────────────────────

const t = initTRPC.context<TRPCContext>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        return {
            ...shape,
            data: {
                ...shape.data,
                zodError:
                    error.cause instanceof ZodError
                        ? error.cause.flatten()
                        : null,
            },
        }
    },
})

// ─── Exports ──────────────────────────────────────────────────────────────────

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory

// ─── Procedures ───────────────────────────────────────────────────────────────

/** No auth required */
export const baseProcedure = t.procedure

/** Requires authenticated user — narrows userId to non-null */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
    if (!ctx.userId || !ctx.serviceSupabase) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    if (ctx.suspended) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'This account is suspended. Contact support for assistance.',
        })
    }
    const rateLimit = await checkRateLimit('general', ctx.userId)
    if (!rateLimit.success) {
        throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many requests. Please try again shortly.',
        })
    }
    return next({
        ctx: {
            ...ctx,
            userId: ctx.userId, // narrows from string | null → string
            // All authenticated database access is server-to-server. Authorization
            // is enforced by the procedures and their ownership checks; browser
            // clients never receive the service-role key.
            supabase: ctx.serviceSupabase,
            serviceSupabase: ctx.serviceSupabase,
        },
    })
})

/** Requires Clerk auth but NOT a Supabase user row (for onboarding) */
export const onboardingProcedure = t.procedure.use(({ ctx, next }) => {
    if (!ctx.clerkUserId || !ctx.serviceSupabase) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({
        ctx: {
            ...ctx,
            clerkUserId: ctx.clerkUserId, // narrows from string | null | undefined → string
            serviceSupabase: ctx.serviceSupabase,
        },
    })
})

/** Requires authenticated CLIENT */
export const clientProcedure = protectedProcedure.use(({ ctx, next }) => {
    if (ctx.role !== 'CLIENT') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Client access required' })
    }
    return next({ ctx: { ...ctx, role: 'CLIENT' as const } })
})

/** Requires authenticated LAWYER */
export const lawyerProcedure = protectedProcedure.use(({ ctx, next }) => {
    if (ctx.role !== 'LAWYER') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Lawyer access required' })
    }
    return next({ ctx: { ...ctx, role: 'LAWYER' as const } })
})

/** Requires authenticated ADMIN */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
    if (ctx.role !== 'ADMIN') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' })
    }
    return next({ ctx: { ...ctx, role: 'ADMIN' as const } })
})
