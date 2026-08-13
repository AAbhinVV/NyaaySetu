"use client"

import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { trpc } from "@/lib/trpc/client"
import { firstRelation } from '@/lib/utils'

function StatCard({ value, label, color, sub }: { value: number | string; label: string; color: string; sub?: string }) {
    return (
        <div className="bg-card rounded-xl p-5 shadow-lawyer hover:shadow-lg hover:-translate-y-px transition-all">
            <p className={`font-serif-heading text-3xl font-bold leading-none ${color}`}>{value}</p>
            <p className="font-body text-sm text-muted-foreground mt-1.5">{label}</p>
            {sub && <p className="font-body text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
        </div>
    )
}

function statusPill(s: string) {
    const map: Record<string, string> = {
        IN_PROGRESS: "bg-emerald/10 text-[#226B4B]",
        HEARING_SET: "bg-gold/12 text-[#96790C]",
        VERDICT: "bg-primary/[0.08] text-primary",
        CLOSED: "bg-muted text-muted-foreground",
        PENDING: "bg-gold/12 text-[#96790C]",
        ACTIVE: "bg-emerald/10 text-[#226B4B]",
        DECLINED: "bg-destructive/10 text-destructive",
    }
    return map[s] ?? "bg-muted text-muted-foreground"
}
function statusLabel(s: string) {
    const m: Record<string, string> = { IN_PROGRESS: "In Progress", HEARING_SET: "Hearing Set", VERDICT: "Verdict", CLOSED: "Closed", PENDING: "Pending", ACTIVE: "Active", DECLINED: "Declined" }
    return m[s] ?? s
}

export default function LawyerDashboardPage() {
    const { user } = useUser()
    const firstName = user?.firstName || "Counsellor"
    const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

    // Fetch data from multiple routers
    const profile = trpc.lawyer.getMyProfile.useQuery()
    const cases = trpc.case.getAllCases.useQuery({ page: 1, limit: 5 })
    const pendingReqs = trpc.connection.getIncomingRequests.useQuery({ status: "PENDING", page: 1, limit: 5 })
    const connections = trpc.connection.getMyConnections.useQuery({ page: 1, limit: 100 })
    const unread = trpc.notification.getUnreadCount.useQuery()

    const prof = profile.data
    const caseList = cases.data?.cases ?? []
    const totalCases = cases.data?.total ?? 0
    const requests = pendingReqs.data?.connections ?? []
    const totalConnections = connections.data?.total ?? 0
    const unreadCount = unread.data?.unreadCount ?? 0
    const isLoading = profile.isLoading

    // Accept/Decline mutations
    const acceptConn = trpc.connection.acceptConnection.useMutation({ onSuccess: () => { pendingReqs.refetch(); connections.refetch() } })
    const declineConn = trpc.connection.declineConnection.useMutation({ onSuccess: () => pendingReqs.refetch() })

    return (
        <div className="max-w-[1060px]">
            {/* ── Header — Stitch: Serif heading left, meta right, editorial asymmetry ── */}
            <header className="flex max-md:flex-col justify-between items-start gap-4 mb-8">
                <div>
                    <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">
                        Good {getTimeOfDay()}, {firstName}
                    </h1>
                    <p className="font-body text-sm text-muted-foreground mt-1">{today}</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Verification badge */}
                    {prof?.verified && (
                        <span className="flex items-center gap-1.5 font-body text-xs font-semibold text-emerald bg-emerald/[0.06] px-3 py-1.5 rounded-lg">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                            Profile Reviewed
                        </span>
                    )}
                    {/* Notification bell */}
                    <Link href="/dashboard/lawyer/notifications" className="relative w-10 h-10 rounded-[10px] bg-card flex items-center justify-center shadow-lawyer" aria-label="Notifications">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                        {unreadCount > 0 && (
                            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-white text-[0.625rem] font-bold flex items-center justify-center">{unreadCount}</span>
                        )}
                    </Link>
                </div>
            </header>

            {/* ── Stat Cards — Stitch: 4-column grid, serif numbers, tonal cards ── */}
            <section className="grid grid-cols-4 max-lg:grid-cols-2 max-md:grid-cols-1 gap-4 mb-9">
                <StatCard value={totalCases} label="Total Cases" color="text-primary" />
                <StatCard value={totalConnections} label="Active Clients" color="text-emerald" />
                <StatCard value={requests.length} label="Pending Requests" color="text-gold" />
                <StatCard
                    value={prof?.avg_rating ? `${prof.avg_rating.toFixed(1)} ★` : "—"}
                    label="Average Rating"
                    color="text-gold"
                    sub={prof?.review_count ? `${prof.review_count} reviews` : undefined}
                />
            </section>

            {/* ── Two-column layout: Cases + Requests ── */}
            <div className="grid grid-cols-5 max-lg:grid-cols-1 gap-6 mb-9">
                {/* Active Cases — takes 3 cols */}
                <section className="col-span-3 max-lg:col-span-1">
                    <div className="flex justify-between items-baseline mb-4">
                        <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary">Active Cases</h2>
                        <Link href="/dashboard/lawyer/cases" className="font-body text-sm font-medium text-gold hover:underline">View All →</Link>
                    </div>

                    {isLoading ? (
                        <div className="p-8 text-center bg-card rounded-xl shadow-lawyer"><p className="font-body text-sm text-muted-foreground">Loading…</p></div>
                    ) : caseList.length === 0 ? (
                        <div className="p-10 text-center bg-card rounded-xl shadow-lawyer">
                            <p className="font-body text-base font-semibold text-foreground">No cases assigned yet</p>
                            <p className="font-body text-sm text-muted-foreground mt-1">Accept client connection requests to begin.</p>
                        </div>
                    ) : (
                        <div className="bg-card rounded-xl shadow-lawyer overflow-hidden">
                            {caseList.map((c, i) => (
                                <Link key={c.id} href={`/dashboard/lawyer/cases/${c.id}`}
                                    className={`flex items-center gap-5 px-5 py-4 hover:bg-muted transition-colors no-underline text-inherit ${i > 0 ? "border-t border-border" : ""}`}>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-body text-[0.9375rem] font-semibold text-foreground truncate">{c.title || "Untitled Case"}</h3>
                                        <p className="font-body text-xs text-muted-foreground mt-0.5">
                                            {c.category || "General"} • {firstRelation(c.users)?.full_name ?? "Client"}
                                            {c.next_hearing_at && ` • Hearing ${new Date(c.next_hearing_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`}
                                        </p>
                                    </div>
                                    <span className={`font-body text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-md whitespace-nowrap shrink-0 ${statusPill(c.status)}`}>
                                        {statusLabel(c.status)}
                                    </span>
                                    <svg className="shrink-0 text-muted-foreground/40" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9,18 15,12 9,6"/></svg>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* Pending Connection Requests — takes 2 cols */}
                <section className="col-span-2 max-lg:col-span-1">
                    <div className="flex justify-between items-baseline mb-4">
                        <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary">Connection Requests</h2>
                        {requests.length > 0 && <span className="font-body text-xs font-semibold text-gold bg-gold/10 px-2 py-0.5 rounded-md">{requests.length} pending</span>}
                    </div>

                    {requests.length === 0 ? (
                        <div className="p-8 text-center bg-card rounded-xl shadow-lawyer">
                            <p className="font-body text-sm text-muted-foreground">No pending requests.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {requests.map((req) => (
                                <div key={req.id} className="bg-card rounded-xl p-4 shadow-lawyer">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div>
                                            <p className="font-body text-sm font-semibold text-foreground">{firstRelation(req.users)?.full_name ?? "Client"}</p>
                                            <p className="font-body text-xs text-muted-foreground mt-0.5">{firstRelation(req.users)?.email}</p>
                                        </div>
                                        <span className="font-body text-[0.625rem] text-muted-foreground/60 whitespace-nowrap">
                                            {new Date(req.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => acceptConn.mutate({ connectionId: req.id })}
                                            disabled={acceptConn.isPending}
                                            className="flex-1 font-body text-sm font-medium px-3 py-2 rounded-lg bg-primary-gradient text-white border-none cursor-pointer hover:shadow-lg transition-shadow disabled:opacity-50"
                                        >Accept</button>
                                        <button
                                            onClick={() => declineConn.mutate({ connectionId: req.id })}
                                            disabled={declineConn.isPending}
                                            className="flex-1 font-body text-sm font-medium px-3 py-2 rounded-lg bg-muted text-muted-foreground border-none cursor-pointer hover:bg-surface-high transition-colors disabled:opacity-50"
                                        >Decline</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* ── Profile Summary Card — Stitch: editorial card, asymmetric layout ── */}
            {prof && (
                <section className="mb-9">
                    <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary mb-4">Your Profile</h2>
                    <div className="bg-card rounded-xl shadow-lawyer p-6">
                        <div className="flex max-md:flex-col gap-8">
                            {/* Left: Identity */}
                            <div className="flex-1">
                                <h3 className="font-serif-heading text-xl font-semibold text-primary">{prof.full_name}</h3>
                                <p className="font-body text-sm text-muted-foreground mt-1">{prof.city}, {prof.state} • {prof.years_of_experience}+ years experience</p>
                                {prof.bio && <p className="font-body text-sm text-foreground/80 mt-3 leading-relaxed line-clamp-2">{prof.bio}</p>}
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {(prof.specializations ?? []).map((s: string) => (
                                        <span key={s} className="font-body text-[0.6875rem] font-medium px-2 py-0.5 rounded-md bg-primary/[0.06] text-primary">{s}</span>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Key metrics */}
                            <div className="grid grid-cols-2 gap-4 shrink-0 max-md:grid-cols-4">
                                <div className="text-center">
                                    <p className="font-serif-heading text-2xl font-bold text-primary">{prof.total_cases}</p>
                                    <p className="font-body text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wider mt-0.5">Cases</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-serif-heading text-2xl font-bold text-emerald">{prof.win_rate}%</p>
                                    <p className="font-body text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wider mt-0.5">Win Rate</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-serif-heading text-2xl font-bold text-gold">{prof.avg_rating?.toFixed(1) ?? "—"}</p>
                                    <p className="font-body text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wider mt-0.5">Rating</p>
                                </div>
                                <div className="text-center">
                                    <p className="font-serif-heading text-2xl font-bold text-primary">₹{prof.fee_per_consultation?.toLocaleString("en-IN")}</p>
                                    <p className="font-body text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wider mt-0.5">Fee</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-5 pt-5 border-t border-border">
                            <Link href="/dashboard/lawyer/profile" className="font-body text-sm font-medium px-4 py-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors">Edit Profile</Link>
                            <Link href="/dashboard/lawyer/cases" className="font-body text-sm font-medium px-4 py-2 rounded-lg bg-primary-gradient text-white hover:shadow-lg transition-shadow">Manage Cases</Link>
                        </div>
                    </div>
                </section>
            )}

            {/* ── Quick Actions ── */}
            <section>
                <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary mb-4">Quick Actions</h2>
                <div className="grid grid-cols-3 max-md:grid-cols-1 gap-3">
                    <Link href="/dashboard/lawyer/cases" className="flex items-center gap-3 px-5 py-4 rounded-xl bg-card shadow-lawyer hover:shadow-lg hover:-translate-y-px transition-all no-underline">
                        <div className="w-10 h-10 rounded-lg bg-primary/[0.06] flex items-center justify-center">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                        </div>
                        <div>
                            <p className="font-body text-sm font-semibold text-foreground">View All Cases</p>
                            <p className="font-body text-xs text-muted-foreground">Manage your active legal matters</p>
                        </div>
                    </Link>
                    <Link href="/dashboard/lawyer/documents" className="flex items-center gap-3 px-5 py-4 rounded-xl bg-card shadow-lawyer hover:shadow-lg hover:-translate-y-px transition-all no-underline">
                        <div className="w-10 h-10 rounded-lg bg-emerald/[0.06] flex items-center justify-center">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg>
                        </div>
                        <div>
                            <p className="font-body text-sm font-semibold text-foreground">Document Vault</p>
                            <p className="font-body text-xs text-muted-foreground">Blockchain-secured evidence files</p>
                        </div>
                    </Link>
                    <Link href="/dashboard/lawyer/profile" className="flex items-center gap-3 px-5 py-4 rounded-xl bg-card shadow-lawyer hover:shadow-lg hover:-translate-y-px transition-all no-underline">
                        <div className="w-10 h-10 rounded-lg bg-gold/[0.06] flex items-center justify-center">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gold"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        </div>
                        <div>
                            <p className="font-body text-sm font-semibold text-foreground">Edit Profile</p>
                            <p className="font-body text-xs text-muted-foreground">Update credentials & fee structure</p>
                        </div>
                    </Link>
                </div>
            </section>
        </div>
    )
}

function getTimeOfDay(): string {
    const h = new Date().getHours()
    if (h < 12) return "morning"
    if (h < 17) return "afternoon"
    return "evening"
}
