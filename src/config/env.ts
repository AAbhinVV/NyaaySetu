type Env = {
    clerk_sign_up_url: string
    clerk_sign_up_fallback_redirect_url: string
    clerk_sign_in_fallback_redirect_url: string
    supabase_url: string
    supabase_publishable_key: string
    supabase_anon_key: string
    supabase_service_role_key: string
}

function getEnv(): Env {
    const requiredVars = {
        clerk_sign_up_url: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
        clerk_sign_up_fallback_redirect_url:
            process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL,
        clerk_sign_in_fallback_redirect_url:
            process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabase_publishable_key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        supabase_anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        supabase_service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    }

    for (const [key, value] of Object.entries(requiredVars)) {
        if (!value) {
            throw new Error(`Missing environment variable: ${key}`)
        }
    }

    return requiredVars as Env
}

const env = Object.freeze(getEnv())

export default env