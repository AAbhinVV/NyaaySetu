"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

const TYPE_ICONS: Record<string, JSX.Element> = {
    CASE_UPDATE: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>,
    HEARING: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    MESSAGE: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    PAYMENT: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    CONNECTION: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    DOCUMENT: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg>,
}
const FALLBACK_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>

export default function ClientNotificationsPage() {
    const [page, setPage] = useState(1)
    const notifs = trpc.client.getNotifications.useQuery({ page, limit: 15 })
    const markOne = trpc.client.markNotificationRead.useMutation({ onSuccess: () => notifs.refetch() })
    const markAll = trpc.client.markAllNotificationsRead.useMutation({ onSuccess: () => notifs.refetch() })

    const list = notifs.data?.notifications ?? []
    const total = notifs.data?.total ?? 0
    const unread = notifs.data?.unreadCount ?? 0
    const totalPages = Math.ceil(total / 15) || 1

    return (
        <div className="max-w-[960px]">
            {/* Header — Stitch: Serif title, editorial breathing room */}
            <header className="flex max-md:flex-col justify-between items-start gap-4 mb-8">
                <div>
                    <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">Notifications</h1>
                    <p className="font-body text-sm text-muted-foreground mt-1">
                        {unread > 0 ? `${unread} unread of ${total} total` : `${total} notifications`}
                    </p>
                </div>
                {unread > 0 && (
                    <button
                        onClick={() => markAll.mutate()}
                        disabled={markAll.isPending}
                        className="font-body text-sm font-medium px-4 py-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors border-none cursor-pointer disabled:opacity-50"
                    >
                        Mark All as Read
                    </button>
                )}
            </header>

            {/* Unread badge strip */}
            {unread > 0 && (
                <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-xl bg-gold/[0.06]">
                    <div className="w-2 h-2 rounded-full bg-gold animate-pulse"/>
                    <span className="font-body text-sm font-medium text-[#96790C]">{unread} unread notification{unread > 1 ? "s" : ""} require your attention</span>
                </div>
            )}

            {/* Notification list — Stitch: Tonal layering, no borders, editorial spacing */}
            {notifs.isLoading ? (
                <div className="p-12 text-center bg-card rounded-xl shadow-lawyer">
                    <p className="font-body text-sm text-muted-foreground">Loading notifications…</p>
                </div>
            ) : list.length === 0 ? (
                <div className="text-center py-16 px-8 bg-card rounded-xl shadow-lawyer">
                    <div className="w-14 h-14 bg-primary/[0.06] rounded-xl flex items-center justify-center mx-auto mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    </div>
                    <p className="font-body text-base font-semibold text-foreground">All caught up</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">No notifications to display.</p>
                </div>
            ) : (
                <div className="bg-card rounded-xl shadow-lawyer overflow-hidden">
                    {list.map((n: any, i: number) => (
                        <button
                            key={n.id}
                            onClick={() => { if (!n.read) markOne.mutate({ notificationId: n.id }) }}
                            className={`w-full text-left flex items-start gap-4 px-6 py-5 transition-colors border-none cursor-pointer
                                ${!n.read ? "bg-gold/[0.03] hover:bg-gold/[0.06]" : "bg-transparent hover:bg-muted/50"}
                                ${i > 0 ? "border-t border-border" : ""}
                            `}
                        >
                            {/* Icon */}
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${!n.read ? "bg-primary/[0.08]" : "bg-muted"}`}>
                                {TYPE_ICONS[n.type] ?? FALLBACK_ICON}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-4">
                                    <h3 className={`font-body text-[0.9375rem] truncate ${!n.read ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>
                                        {n.title}
                                    </h3>
                                    <span className="font-body text-[0.6875rem] text-muted-foreground/60 whitespace-nowrap shrink-0">
                                        {timeAgo(n.created_at)}
                                    </span>
                                </div>
                                <p className="font-body text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                            </div>

                            {/* Unread indicator */}
                            {!n.read && (
                                <div className="w-2.5 h-2.5 rounded-full bg-gold shrink-0 mt-2"/>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-6 mt-6 font-body">
                    <button className="text-sm font-medium text-primary bg-card px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors border-none cursor-pointer" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
                    <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <button className="text-sm font-medium text-primary bg-card px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors border-none cursor-pointer" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
            )}
        </div>
    )
}

function timeAgo(dateStr: string): string {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diff = now - then
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
}
