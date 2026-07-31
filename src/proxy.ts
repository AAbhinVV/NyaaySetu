import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/',
    '/about(.*)',
    '/lawyers(.*)',
    '/pricing(.*)',
    '/terms(.*)',
    '/privacy(.*)',
    '/disclaimer(.*)',
    '/refund-policy(.*)',
    '/lawyer-verification-policy(.*)',
    '/document-retention-policy(.*)',
    '/support(.*)',
    '/onboarding(.*)',
    '/api/webhooks(.*)',
    '/api/documents/verify(.*)',
    '/api/health(.*)',
    '/api/trpc(.*)',
])

const isSignInOrSignUpRoute = createRouteMatcher([
    '/sign-in(.*)',
    '/sign-up(.*)',
])

export default clerkMiddleware(async (auth, req) => {
    const { userId, sessionClaims } = await auth()
    const isLandingPage = req.nextUrl.pathname === '/'

    if (userId && (isSignInOrSignUpRoute(req) || isLandingPage)) {
        const role =
            (sessionClaims?.metadata as { role?: string })?.role ??
            null

        let redirectTo: string

        if (role === 'CLIENT') {
            redirectTo = '/dashboard/client'
        } else if (role === 'LAWYER') {
            redirectTo = '/dashboard/lawyer'
        } else if (role === 'ADMIN') {
            redirectTo = '/dashboard/admin'
        } else {
            redirectTo = '/onboarding'
        }

        const url = new URL(redirectTo, req.url)
        if (req.nextUrl.pathname !== url.pathname) {
            return NextResponse.redirect(url)
        }
        return
    }

    if (isPublicRoute(req)) {
        return
    }

    await auth.protect()

    // These checks improve navigation UX only. API authorization always uses the
    // authoritative role stored in Supabase.
    const role = (sessionClaims?.metadata as { role?: string })?.role
    const path = req.nextUrl.pathname
    const expectedPrefix =
        role === 'CLIENT' ? '/dashboard/client' :
        role === 'LAWYER' ? '/dashboard/lawyer' :
        role === 'ADMIN' ? '/dashboard/admin' : null

    if (path.startsWith('/dashboard/') && expectedPrefix && !path.startsWith(expectedPrefix)) {
        return NextResponse.redirect(new URL(expectedPrefix, req.url))
    }
})

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
        '/__clerk/(.*)',
    ],
}
