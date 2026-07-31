import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export type RateLimitKind = 'general' | 'payment' | 'auth' | 'upload'

const configs = {
    general: { requests: 60, window: '1 m' as const, windowMs: 60_000 },
    payment: { requests: 5, window: '1 m' as const, windowMs: 60_000 },
    auth: { requests: 10, window: '1 m' as const, windowMs: 60_000 },
    upload: { requests: 10, window: '10 m' as const, windowMs: 600_000 },
}

const distributedLimiters = new Map<RateLimitKind, Ratelimit>()
const localWindows = new Map<string, { count: number; resetAt: number }>()

function getDistributedLimiter(kind: RateLimitKind): Ratelimit | null {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) return null

    const existing = distributedLimiters.get(kind)
    if (existing) return existing

    const config = configs[kind]
    const limiter = new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        prefix: `nyaaysetu:rl:${kind}`,
    })
    distributedLimiters.set(kind, limiter)
    return limiter
}

/**
 * Uses Upstash when configured and a bounded in-process fallback for local
 * development. Production deployments should configure Upstash so limits are
 * shared by every server instance.
 */
export async function checkRateLimit(kind: RateLimitKind, identifier: string) {
    const distributed = getDistributedLimiter(kind)
    if (distributed) {
        const result = await distributed.limit(identifier)
        return {
            success: result.success,
            remaining: result.remaining,
            resetAt: result.reset,
        }
    }

    const config = configs[kind]
    const key = `${kind}:${identifier}`
    const now = Date.now()
    const current = localWindows.get(key)
    const window = !current || current.resetAt <= now
        ? { count: 0, resetAt: now + config.windowMs }
        : current

    window.count += 1
    localWindows.set(key, window)

    // Prevent an unbounded map in long-running development processes.
    if (localWindows.size > 10_000) {
        for (const [entryKey, entry] of localWindows) {
            if (entry.resetAt <= now) localWindows.delete(entryKey)
        }
    }

    return {
        success: window.count <= config.requests,
        remaining: Math.max(0, config.requests - window.count),
        resetAt: window.resetAt,
    }
}
