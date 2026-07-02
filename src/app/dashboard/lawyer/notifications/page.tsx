"use client"

import { trpc } from "@/lib/trpc/client"
import { useState } from "react"

const typeIcon = (t: string) => {
    if (t === "CONNECTION_REQUEST") return "🤝"
    if (t === "CONNECTION_ACCEPTED") return "✅"
    if (t === "CONNECTION_DECLINED") return "❌"
    if (t === "NEW_MESSAGE") return "💬"
    if (t === "NEW_REVIEW") return "⭐"
    if (t === "HEARING_SCHEDULED") return "📅"
    if (t === "VERDICT") return "⚖️"
    if (t === "DOCUMENT_UPLOADED") return "📄"
    if (t === "REVIEW_FLAGGED" || t === "REVIEW_REMOVED") return "🚩"
    return "🔔"
}

export default function LawyerNotificationsPage() {
    const [page, setPage] = useState(1)

    const notifications = trpc.notification.getAllNotifications.useQuery({ page, limit: 20 })
    const markRead = trpc.notification.markRead.useMutation({
        onSuccess: () => { notifications.refetch() },
    })
    const markAllRead = trpc.notification.markAllRead.useMutation({
        onSuccess: () => { notifications.refetch() },
    })

    const notifList = notifications.data?.notifications ?? []
    const totalPages = notifications.data?.totalPages ?? 1
    const unread = notifications.data?.unreadCount ?? 0

    return (
        <div className="max-w-[960px]">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">Notifications</h1>
                    <p className="font-body text-sm text-muted-foreground mt-1">
                        {unread > 0 ? `${unread} unread notification${unread > 1 ? "s" : ""}` : "All caught up"}
                    </p>
                </div>
                {unread > 0 && (
                    <button onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}
                        className="font-body text-sm font-medium px-4 py-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors border-none cursor-pointer disabled:opacity-50">
                        {markAllRead.isPending ? "Marking…" : "Mark all read"}
                    </button>
                )}
            </div>

            {notifications.isLoading ? (
                <div className="p-12 text-center bg-card rounded-xl shadow-lawyer">
                    <p className="font-body text-sm text-muted-foreground">Loading notifications…</p>
                </div>
            ) : notifList.length === 0 ? (
                <div className="text-center py-16 px-8 bg-card rounded-xl shadow-lawyer">
                    <div className="w-14 h-14 bg-primary/[0.06] rounded-xl flex items-center justify-center mx-auto mb-4 text-2xl">🔔</div>
                    <p className="font-body text-base font-semibold text-foreground">No notifications</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">You&apos;re all caught up.</p>
                </div>
            ) : (
                <div className="bg-card rounded-xl shadow-lawyer overflow-hidden">
                    {notifList.map((n: any, i: number) => (
                        <div key={n.id}
                            className={`flex items-start gap-4 px-6 py-4 transition-colors ${!n.read ? "bg-primary/[0.02]" : ""} ${i > 0 ? "border-t border-border" : ""}`}>
                            <span className="text-xl mt-0.5 shrink-0">{typeIcon(n.type)}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-3">
                                    <h3 className={`font-body text-sm truncate ${!n.read ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}>{n.title}</h3>
                                    <span className="font-body text-[0.6875rem] text-muted-foreground/60 shrink-0">{new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                                </div>
                                <p className="font-body text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                            </div>
                            {!n.read && (
                                <button onClick={() => markRead.mutate({ notificationId: n.id })}
                                    className="font-body text-[0.6875rem] font-medium text-primary px-2.5 py-1 rounded-md bg-primary/5 hover:bg-primary/10 transition-colors border-none cursor-pointer shrink-0 mt-0.5">Read</button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-6 mt-6 font-body">
                    <button className="text-sm font-medium text-primary bg-card px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 hover:bg-muted transition-colors border-none cursor-pointer" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
                    <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <button className="text-sm font-medium text-primary bg-card px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 hover:bg-muted transition-colors border-none cursor-pointer" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
            )}
        </div>
    )
}
