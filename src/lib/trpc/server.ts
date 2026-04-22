import 'server-only'
import { createCallerFactory } from '@/server/trpc/init'
import { createTRPCContext } from '@/server/trpc/init'
import { appRouter } from '@/server/trpc/appRouter'

/**
 * Server-side tRPC caller for use in Server Components and Server Actions.
 * Usage: const data = await serverClient.lawyer.search({ ... })
 */
const createCaller = createCallerFactory(appRouter)

export async function getServerClient() {
    const ctx = await createTRPCContext()
    return createCaller(ctx)
}
