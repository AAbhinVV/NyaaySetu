"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser, UserButton } from "@clerk/nextjs"
import { trpc } from "@/lib/trpc/client"

const icons = {
    dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    cases: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    lawyers: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    documents: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg>,
    payments: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    notifications: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    profile: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
}

const CLIENT_NAV = [
    { label: "Dashboard", href: "/dashboard/client", icon: icons.dashboard },
    { label: "My Cases", href: "/dashboard/client/cases", icon: icons.cases },
    { label: "Find Lawyers", href: "/dashboard/client/lawyers", icon: icons.lawyers },
    { label: "Documents", href: "/dashboard/client/documents", icon: icons.documents },
    { label: "Payments", href: "/dashboard/client/payments", icon: icons.payments },
    { label: "Notifications", href: "/dashboard/client/notifications", icon: icons.notifications },
    { label: "Profile", href: "/dashboard/client/profile", icon: icons.profile },
    { label: "Settings", href: "/dashboard/client/settings", icon: icons.settings },
]

const LAWYER_NAV = [
    { label: "Dashboard", href: "/dashboard/lawyer", icon: icons.dashboard },
    { label: "Cases", href: "/dashboard/lawyer/cases", icon: icons.cases },
    { label: "Clients", href: "/dashboard/lawyer/clients", icon: icons.lawyers },
    { label: "Documents", href: "/dashboard/lawyer/documents", icon: icons.documents },
    { label: "Payments", href: "/dashboard/lawyer/payments", icon: icons.payments },
    { label: "Notifications", href: "/dashboard/lawyer/notifications", icon: icons.notifications },
    { label: "Profile", href: "/dashboard/lawyer/profile", icon: icons.profile },
    { label: "Settings", href: "/dashboard/lawyer/settings", icon: icons.settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { user } = useUser()
    const isLawyer = pathname.startsWith("/dashboard/lawyer")
    const navItems = isLawyer ? LAWYER_NAV : CLIENT_NAV

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    // Live unread count for notification badge
    const unread = trpc.client.getDashboardSummary.useQuery(undefined, {
        enabled: !isLawyer,
    })
    const unreadCount = unread.data?.unreadNotifications ?? 0

    // Close menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false)
    }, [pathname])

    // Dynamic page title
    useEffect(() => {
        const segment = pathname.split("/").filter(Boolean).pop() ?? "dashboard"
        const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")
        document.title = `${label} — NyaaySetu Dashboard`
    }, [pathname])

    return (
        <div className="flex min-h-screen bg-background relative">
            {/* ── Mobile Overlay ────────────────────────────────────── */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-30 md:hidden" 
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* ── Sidebar ─────────────────────────────────────────── */}
            <aside className={`fixed top-0 left-0 bottom-0 z-40 w-[260px] flex flex-col py-6 bg-sidebar transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
                {/* Logo & Close Button */}
                <div className="flex items-center justify-between px-6 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gold/12 flex items-center justify-center shrink-0">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                                    stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div>
                            <h1 className="font-serif-heading text-xl font-bold text-white leading-tight tracking-tight">NyaaySetu</h1>
                            <p className="text-[0.6875rem] text-white/45 uppercase tracking-wider mt-px">Premium Legal Council</p>
                        </div>
                    </div>
                    <button 
                        className="md:hidden text-white/60 hover:text-white p-1"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 flex flex-col gap-0.5 px-3">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-all duration-150
                                    ${isActive
                                        ? "text-gold bg-gold/10 font-medium"
                                        : "text-white/60 hover:text-white/90 hover:bg-white/[0.06]"
                                    }`}
                            >
                                {isActive && (
                                    <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gold rounded-r-sm"/>
                                )}
                                <span className="shrink-0 flex items-center">{item.icon}</span>
                                <span>{item.label}</span>
                                {item.label === "Notifications" && unreadCount > 0 && (
                                    <span className="ml-auto bg-gold text-sidebar text-[0.6875rem] font-semibold px-1.5 py-px rounded-full min-w-[18px] text-center">
                                        {unreadCount}
                                    </span>
                                )}
                            </Link>
                        )
                    })}
                </nav>

                {/* User */}
                <div className="flex items-center gap-3 px-6 pt-4 mt-2 border-t border-white/[0.08]">
                    <UserButton appearance={{ elements: { avatarBox: { width: 36, height: 36 } } }}/>
                    <div className="overflow-hidden">
                        <p className="text-sm font-medium text-white truncate">{user?.firstName || "User"}</p>
                        <p className="text-xs text-white/45 mt-px">{isLawyer ? "Advocate" : "Client"}</p>
                    </div>
                </div>
            </aside>

            {/* ── Main Content ────────────────────────────────────── */}
            <main className="flex-1 md:ml-[260px] min-h-screen flex flex-col">
                {/* Mobile Header */}
                <header className="md:hidden flex items-center gap-4 px-5 py-4 bg-card border-b border-border sticky top-0 z-20">
                    <button 
                        className="text-primary p-1 -ml-1"
                        onClick={() => setIsMobileMenuOpen(true)}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                    </button>
                    <span className="font-serif-heading text-lg font-bold text-primary tracking-tight">NyaaySetu</span>
                </header>
                
                {/* Page Content */}
                <div className="p-8 max-md:p-5 flex-1 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    )
}
