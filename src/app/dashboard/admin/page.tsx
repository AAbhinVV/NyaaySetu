"use client"

import { trpc } from "@/lib/trpc/client"
import Link from "next/link"

export default function AdminDashboardPage() {
    const stats = trpc.admin.getPlatformStats.useQuery()
    const pending = trpc.admin.getAllLawyers.useQuery({ verificationStatus: "PENDING", page: 1, limit: 5 })

    const s = stats.data

    if (stats.isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Loading platform stats…</p></div>

    return (
        <div className="max-w-[960px]">
            <div className="mb-8">
                <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">Admin Dashboard</h1>
                <p className="font-body text-sm text-muted-foreground mt-1">Platform overview & management</p>
            </div>

            {/* Platform Stats */}
            <section className="grid grid-cols-4 max-md:grid-cols-2 gap-4 mb-8">
                {[
                    { label: "Total Users", value: s?.totalUsers ?? 0, color: "text-primary", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" },
                    { label: "Verified Lawyers", value: s?.verifiedLawyers ?? 0, color: "text-emerald", icon: "M22 11.08V12a10 10 0 1 1-5.93-9.14" },
                    { label: "Active Cases", value: s?.activeCases ?? 0, color: "text-gold", icon: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" },
                    { label: "Total Revenue", value: `₹${((s?.totalRevenue ?? 0) / 100).toLocaleString("en-IN")}`, color: "text-emerald", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
                ].map((stat, i) => (
                    <div key={i} className="bg-card rounded-xl p-5 shadow-lawyer">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/[0.06] flex items-center justify-center">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d={stat.icon}/></svg>
                            </div>
                        </div>
                        <p className={`font-serif-heading text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="font-body text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wider mt-1">{stat.label}</p>
                    </div>
                ))}
            </section>

            {/* Secondary Stats */}
            <section className="grid grid-cols-3 max-md:grid-cols-1 gap-4 mb-8">
                <div className="bg-card rounded-xl p-5 shadow-lawyer flex justify-between items-center">
                    <div>
                        <p className="font-body text-sm text-muted-foreground">Total Lawyers</p>
                        <p className="font-serif-heading text-xl font-bold text-primary mt-1">{s?.totalLawyers ?? 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-primary/[0.06] flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                </div>
                <div className="bg-card rounded-xl p-5 shadow-lawyer flex justify-between items-center">
                    <div>
                        <p className="font-body text-sm text-muted-foreground">Closed Cases</p>
                        <p className="font-serif-heading text-xl font-bold text-primary mt-1">{s?.closedCases ?? 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald/[0.06] flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                    </div>
                </div>
                <div className="bg-card rounded-xl p-5 shadow-lawyer flex justify-between items-center">
                    <div>
                        <p className="font-body text-sm text-muted-foreground">Total Payments</p>
                        <p className="font-serif-heading text-xl font-bold text-primary mt-1">{s?.totalPayments ?? 0}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gold/[0.08] flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    </div>
                </div>
            </section>

            {/* Pending Verifications */}
            <section>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary">
                        Pending Verifications
                        {(s?.pendingVerification ?? 0) > 0 && (
                            <span className="ml-2 font-body text-sm font-semibold text-gold bg-gold/10 px-2 py-0.5 rounded-md">{s?.pendingVerification}</span>
                        )}
                    </h2>
                    <Link href="/dashboard/admin/users" className="font-body text-sm font-medium text-primary hover:underline">View All Users →</Link>
                </div>

                {pending.isLoading ? (
                    <div className="font-body text-sm text-muted-foreground p-8 text-center bg-card rounded-xl">Loading…</div>
                ) : (pending.data?.lawyers ?? []).length === 0 ? (
                    <div className="text-center py-10 bg-card rounded-xl shadow-lawyer">
                        <p className="font-body text-sm text-muted-foreground">No pending verifications</p>
                    </div>
                ) : (
                    <div className="bg-card rounded-xl shadow-lawyer overflow-hidden">
                        {(pending.data?.lawyers ?? []).map((lawyer, i) => (
                            <div key={lawyer.id} className={`flex max-md:flex-wrap items-center gap-5 px-6 py-4 ${i > 0 ? "border-t border-border" : ""}`}>
                                <div className="w-10 h-10 rounded-full bg-gold/[0.08] flex items-center justify-center shrink-0">
                                    <span className="font-serif-heading text-base font-bold text-gold">{(lawyer.full_name?.[0] ?? "L").toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-body text-[0.9375rem] font-semibold text-foreground truncate">{lawyer.full_name}</p>
                                    <p className="font-body text-xs text-muted-foreground mt-0.5">{lawyer.city}, {lawyer.state} • {(lawyer.specializations ?? []).slice(0, 2).join(", ")}</p>
                                </div>
                                <div className="flex flex-col shrink-0">
                                    <span className="font-body text-[0.625rem] text-muted-foreground/60 uppercase tracking-wider">Applied</span>
                                    <span className="font-body text-sm font-medium text-foreground mt-px">{new Date(lawyer.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                                </div>
                                <span className="font-body text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-md bg-gold/12 text-[#96790C] shrink-0">Pending</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
