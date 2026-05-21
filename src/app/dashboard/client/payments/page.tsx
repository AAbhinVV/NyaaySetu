"use client"

import { trpc } from "@/lib/trpc/client"
import Link from "next/link"

function statusBadge(s: string) {
    return s === "ACTIVE" ? "bg-emerald/10 text-[#226B4B]" : s === "PENDING" ? "bg-gold/12 text-[#96790C]" : "bg-muted text-muted-foreground"
}

export default function ClientPaymentsPage() {
    const connections = trpc.client.getMyConnections.useQuery({ status: undefined })
    const connList = connections.data ?? []

    return (
        <div className="max-w-[960px]">
            <div className="mb-6">
                <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">Payment History</h1>
                <p className="font-body text-sm text-muted-foreground mt-1">All transactions for lawyer connections</p>
            </div>

            {/* Summary Cards */}
            <section className="grid grid-cols-3 max-md:grid-cols-1 gap-4 mb-8">
                <div className="bg-card rounded-xl p-5 shadow-lawyer">
                    <p className="font-serif-heading text-3xl font-bold text-primary">{connList.filter((c: any) => c.status === "ACTIVE").length}</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">Completed Payments</p>
                </div>
                <div className="bg-card rounded-xl p-5 shadow-lawyer">
                    <p className="font-serif-heading text-3xl font-bold text-gold">{connList.filter((c: any) => c.status === "PENDING").length}</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">Pending</p>
                </div>
                <div className="bg-card rounded-xl p-5 shadow-lawyer">
                    <p className="font-serif-heading text-3xl font-bold text-emerald">₹{(connList.filter((c: any) => c.status === "ACTIVE").length * 499).toLocaleString("en-IN")}</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">Total Spent</p>
                </div>
            </section>

            {/* Transactions List */}
            <section>
                <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary mb-4">Transactions</h2>
                {connections.isLoading ? (
                    <div className="font-body text-sm text-muted-foreground p-12 text-center bg-card rounded-xl">Loading transactions…</div>
                ) : connList.length === 0 ? (
                    <div className="text-center py-12 px-8 bg-card rounded-xl shadow-lawyer">
                        <p className="font-body text-base font-semibold text-foreground">No transactions yet</p>
                        <p className="font-body text-sm text-muted-foreground mt-1">Connect with a lawyer to get started.</p>
                        <Link href="/dashboard/client/lawyers" className="inline-block mt-4 px-6 py-2.5 rounded-lg bg-primary-gradient text-white font-body text-sm font-medium">Find a Lawyer</Link>
                    </div>
                ) : (
                    <div className="bg-card rounded-xl shadow-lawyer overflow-hidden">
                        {connList.map((conn: any, i: number) => (
                            <div key={conn.id} className={`flex max-md:flex-wrap items-center gap-5 px-6 py-4 ${i > 0 ? "border-t border-border" : ""}`}>
                                <div className="w-10 h-10 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-body text-[0.9375rem] font-semibold text-foreground truncate">
                                        Lawyer Connection — {conn.lawyers?.full_name ?? "Lawyer"}
                                    </p>
                                    <p className="font-body text-xs text-muted-foreground mt-0.5">
                                        {new Date(conn.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                                        {" • "}Stripe Payment
                                    </p>
                                </div>
                                <p className="font-serif-heading text-lg font-bold text-primary shrink-0">₹499</p>
                                <span className={`font-body text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-md whitespace-nowrap shrink-0 ${statusBadge(conn.status)}`}>
                                    {conn.status === "ACTIVE" ? "Paid" : conn.status === "PENDING" ? "Pending" : conn.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
