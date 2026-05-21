import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/',
    '/about(.*)',
    '/lawyers(.*)',
    '/pricing(.*)',
    '/api/webhooks(.*)',
    '/api/documents/verify(.*)',
    '/api/health(.*)',
])

const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)'])

export default clerkMiddleware(async (auth, req) => {
    // Public routes are always accessible
    if (isPublicRoute(req)) {
        return
    }

    // All non-public routes require authentication
    const { userId, sessionClaims } = await auth.protect()

    // If user is authenticated but hasn't completed onboarding (no role set),
    // redirect them to onboarding — unless they're already on the onboarding page
    if (userId && !isOnboardingRoute(req)) {
        const role = (sessionClaims?.publicMetadata as any)?.role ??
                     (sessionClaims?.metadata as any)?.role ??
                     (sessionClaims?.unsafeMetadata as any)?.role

        if (!role) {
            const onboardingUrl = new URL('/onboarding', req.url)
            return NextResponse.redirect(onboardingUrl)
        }
    }
})

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
}
