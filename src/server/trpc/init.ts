import { initTRPC, TRPCError } from '@trpc/server'
import { auth } from '@clerk/nextjs/server'
import { createServerClient } from '@/lib/supabase/server'
import { cache } from 'react'
import superjson from 'superjson'
import { ZodError } from 'zod'

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

export const createTRPCRouter = t.router
export const createCallerFactory = t.createCallerFactory

export const baseProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
    if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({ ctx: { ...ctx, userId: ctx.userId } })
})
export const clientProcedure = protectedProcedure.use(({ ctx, next }) => {
    if (ctx.role !== 'CLIENT') {
        throw new TRPCError({ code: 'FORBIDDEN' })
    }
    return next({ ctx })
})
export const lawyerProcedure = protectedProcedure.use(({ ctx, next }) => {
    if (ctx.role !== 'LAWYER') {
        throw new TRPCError({ code: 'FORBIDDEN' })
    }
    return next({ ctx })
})
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
    if (ctx.role !== 'ADMIN') {
        throw new TRPCError({ code: 'FORBIDDEN' })
    }
    return next({ ctx })
})

