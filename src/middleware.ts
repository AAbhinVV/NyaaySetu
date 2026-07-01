import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/',
    '/about(.*)',
    '/lawyers(.*)',
    '/pricing(.*)',
    '/onboarding(.*)',
    '/api/webhooks(.*)',
    '/api/documents/verify(.*)',
    '/api/health(.*)',
    '/api/trpc(.*)',
])

// Routes where signed-in users should be redirected away from
const isSignInOrSignUpRoute = createRouteMatcher([
    '/sign-in(.*)',
    '/sign-up(.*)',
])

export default clerkMiddleware(async (auth, req) => {
    const { userId, sessionClaims } = await auth()
    const isLandingPage = req.nextUrl.pathname === '/'

    // ── Signed-in user on a public auth/landing page → redirect to dashboard ──
    if (userId && (isSignInOrSignUpRoute(req) || isLandingPage)) {
        const role =
            (sessionClaims?.metadata as { role?: string })?.role ??
            (sessionClaims?.unsafeMetadata as { role?: string })?.role ??
            null

        let redirectTo: string

        if (role === 'CLIENT') {
            redirectTo = '/dashboard/client'
        } else if (role === 'LAWYER') {
            redirectTo = '/dashboard/lawyer'
        } else if (role === 'ADMIN') {
            redirectTo = '/dashboard/admin'
        } else {
            // Signed in but no role yet → onboarding
            // (avoid redirect loop if already on /onboarding)
            redirectTo = '/onboarding'
        }

        const url = new URL(redirectTo, req.url)
        // Prevent redirect loop: only redirect if not already at the target
        if (req.nextUrl.pathname !== url.pathname) {
            return NextResponse.redirect(url)
        }
        return
    }

    // ── Public routes: no auth required ──
    if (isPublicRoute(req)) {
        return
    }

    // ── All other routes require authentication ──
    await auth.protect()
})

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}
