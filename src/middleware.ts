import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

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

export default clerkMiddleware(async (auth, req) => {
    // Public routes are always accessible
    if (isPublicRoute(req)) {
        return
    }

    // All non-public routes require authentication
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
