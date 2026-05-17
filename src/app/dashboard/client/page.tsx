"use client"

import { useUser } from "@clerk/nextjs"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
    return (
        <div className="bg-card rounded-xl p-5 shadow-lawyer hover:shadow-lg hover:-translate-y-px transition-all">
            <p className={`font-serif-heading text-4xl font-bold leading-none ${color}`}>{value}</p>
            <p className="font-body text-sm text-muted-foreground mt-1">{label}</p>
        </div>
    )
}

function statusColor(s: string) { return s === "HEARING_SET" ? "gold" : s === "IN_PROGRESS" ? "emerald" : "navy" }
function statusLabel(s: string) {
    const m: Record<string, string> = { IN_PROGRESS: "In Progress", HEARING_SET: "Hearing Scheduled", VERDICT: "Verdict", CLOSED: "Closed" }
    return m[s] ?? s
}

export default function ClientDashboardPage() {
    const { user } = useUser()
    const firstName = user?.firstName || "there"
    const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

    const summary = trpc.client.getDashboardSummary.useQuery()
    const cases = trpc.client.getMyCases.useQuery({ page: 1, limit: 4 })
    const notifs = trpc.client.getNotifications.useQuery({ page: 1, limit: 5 })

    const stats = summary.data
    const activeCases = cases.data?.cases ?? []
    const notifications = notifs.data?.notifications ?? []
    const isLoading = summary.isLoading || cases.isLoading || notifs.isLoading

    const pillClass: Record<string, string> = {
        gold: "bg-gold/12 text-[#96790C]",
        emerald: "bg-emerald/10 text-[#226B4B]",
        navy: "bg-primary/[0.08] text-primary",
    }

    return (
        <div className="max-w-[960px]">
            {/* Header */}
            <header className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">Welcome back, {firstName}</h1>
                    <p className="font-body text-sm text-muted-foreground mt-1">{today}</p>
                </div>
                <Link href="/dashboard/client/notifications" className="relative w-10 h-10 rounded-[10px] bg-card flex items-center justify-center shadow-lawyer" aria-label="Notifications">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                    {(stats?.unreadNotifications ?? 0) > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-destructive text-white text-[0.625rem] font-bold flex items-center justify-center">{stats!.unreadNotifications}</span>
                    )}
                </Link>
            </header>

            {/* Stats */}
            <section className="grid grid-cols-3 max-md:grid-cols-1 gap-4 mb-9">
                <StatCard value={stats?.activeCases ?? 0} label="Active Cases" color="text-primary" />
                <StatCard value={stats?.activeConnections ?? 0} label="Connected Lawyers" color="text-emerald" />
                <StatCard value={stats?.unreadNotifications ?? 0} label="Unread Notifications" color="text-gold" />
            </section>

            {/* Active Cases */}
            <section className="mb-9">
                <div className="flex justify-between items-baseline mb-4">
                    <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary">Active Legal Matters</h2>
                    <Link href="/dashboard/client/cases" className="font-body text-sm font-medium text-gold hover:underline">View All →</Link>
                </div>
                {isLoading ? (
                    <div className="font-body text-sm text-muted-foreground p-8 text-center bg-card rounded-xl">Loading cases…</div>
                ) : activeCases.length === 0 ? (
                    <div className="font-body text-sm text-muted-foreground p-8 text-center bg-card rounded-xl">
                        <p>No active cases yet.</p>
                        <Link href="/dashboard/client/lawyers" className="inline-flex mt-4 px-5 py-2.5 rounded-lg bg-primary-gradient text-white text-sm font-medium">Find a Lawyer</Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                        {activeCases.map((c: any) => (
                            <div key={c.id} className="bg-card rounded-xl p-5 shadow-lawyer hover:shadow-lg hover:-translate-y-px transition-all">
                                <div className="flex justify-between items-start gap-4 mb-5">
                                    <div>
                                        <h3 className="font-body text-[0.9375rem] font-semibold text-foreground">{c.title || "Untitled Case"}</h3>
                                        <p className="font-body text-xs text-muted-foreground mt-1">{c.category || "General"} • {c.e_token}</p>
                                    </div>
                                    <span className={`font-body text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-md whitespace-nowrap ${pillClass[statusColor(c.status)]}`}>
                                        {statusLabel(c.status)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <div className="flex gap-7">
                                        <div>
                                            <p className="font-body text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wider">Counsel</p>
                                            <p className="font-body text-sm font-medium text-foreground mt-px">{c.lawyers?.full_name ?? "—"}</p>
                                        </div>
                                        {c.next_hearing_at && (
                                            <div>
                                                <p className="font-body text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wider">Next Hearing</p>
                                                <p className="font-body text-sm font-medium text-foreground mt-px">{new Date(c.next_hearing_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</p>
                                            </div>
                                        )}
                                    </div>
                                    <Link href={`/dashboard/client/cases/${c.id}`} className="font-body text-sm font-medium text-primary px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors">View Details</Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Quick Actions */}
            <section className="mb-9">
                <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary mb-4">Immediate Actions</h2>
                <div className="flex max-md:flex-col gap-3">
                    <Link href="/dashboard/client/lawyers" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-gradient text-white text-sm font-medium hover:shadow-lg transition-shadow">Find a Lawyer</Link>
                    <Link href="/dashboard/client/documents" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-card text-primary text-sm font-medium shadow-lawyer">Upload Document</Link>
                    <Link href="/dashboard/client/payments" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-primary text-sm font-medium hover:bg-primary/[0.04] transition-colors">Payment History</Link>
                </div>
            </section>

            {/* Recent Activity */}
            <section className="mb-9">
                <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary mb-4">Recent Activity</h2>
                {notifications.length === 0 ? (
                    <div className="font-body text-sm text-muted-foreground p-8 text-center bg-card rounded-xl">No recent activity.</div>
                ) : (
                    <div className="bg-card rounded-xl shadow-lawyer">
                        {notifications.map((n: any) => (
                            <div key={n.id} className="flex items-start gap-3.5 px-6 py-4 hover:bg-muted transition-colors">
                                <div className="w-9 h-9 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <p className="font-body text-sm font-semibold text-foreground">{n.title}</p>
                                        <span className="font-body text-[0.6875rem] text-muted-foreground/60 whitespace-nowrap ml-4">{new Date(n.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                                    </div>
                                    <p className="font-body text-sm text-muted-foreground mt-0.5">{n.body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
