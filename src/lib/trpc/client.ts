import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/trpc/appRouter'

/**
 * tRPC React hooks for client components.
 * Usage: const { data } = trpc.lawyer.search.useQuery({ ... })
 */
export const trpc = createTRPCReact<AppRouter>()
