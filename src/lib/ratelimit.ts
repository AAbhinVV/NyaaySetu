import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ─── Lazy-init Redis client ──────────────────────────────────────────────────

let _redis: Redis | null = null

function getRedis(): Redis {
    if (!_redis) {
        const url = process.env.UPSTASH_REDIS_REST_URL
        const token = process.env.UPSTASH_REDIS_REST_TOKEN

        if (!url || !token) {
            throw new Error('Missing Upstash env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN')
        }

        _redis = new Redis({ url, token })
    }
    return _redis
}

// ─── Rate Limiters ────────────────────────────────────────────────────────────

/** General API: 60 requests per minute per user */
export const generalLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    prefix: 'rl:general',
})

/** Payment endpoints: 5 requests per minute per user */
export const paymentLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    prefix: 'rl:payment',
})

/** Auth-related: 10 requests per minute per IP */
export const authLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'rl:auth',
})

/** Document upload: 10 uploads per 10 minutes per user */
export const uploadLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, '10 m'),
    prefix: 'rl:upload',
})

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Check rate limit and throw a standardized response if exceeded. */
export async function checkRateLimit(
    limiter: Ratelimit,
    identifier: string
): Promise<{ success: boolean; remaining: number }> {
    const result = await limiter.limit(identifier)

    if (!result.success) {
        throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(result.reset - Date.now() / 1000)}s.`)
    }

    return { success: true, remaining: result.remaining }
}
