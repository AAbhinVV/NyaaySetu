import { initTRPC, TRPCError } from '@trpc/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { cache } from 'react'
import superjson from 'superjson'
import { ZodError } from 'zod'

// ─── Context ──────────────────────────────────────────────────────────────────

export const createTRPCContext = cache(async () => {
    const { userId, sessionClaims } = await auth()
    const supabase = await createServerClient()

    return {
        userId,
        role: (sessionClaims?.metadata as { role?: string })?.role ?? null,
        supabase,
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
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({
        ctx: {
            ...ctx,
            userId: ctx.userId, // narrows from string | null → string
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
