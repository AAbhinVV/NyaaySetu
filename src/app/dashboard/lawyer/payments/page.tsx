"use client"

import { trpc } from "@/lib/trpc/client"

export default function LawyerPaymentsPage() {
    const connections = trpc.connection.getMyConnections.useQuery({ page: 1, limit: 100 })
    const incoming = trpc.connection.getIncomingRequests.useQuery({ page: 1, limit: 100 })
    const connList = connections.data?.connections ?? []
    const allRequests = incoming.data?.connections ?? []

    const totalEarned = connList.length * 499
    const pendingPayments = allRequests.filter((c: any) => c.status === "PENDING").length

    return (
        <div className="max-w-[960px]">
            <div className="mb-6">
                <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">Earnings & Payments</h1>
                <p className="font-body text-sm text-muted-foreground mt-1">Track your connection fees and earnings</p>
            </div>

            {/* Stats */}
            <section className="grid grid-cols-3 max-md:grid-cols-1 gap-4 mb-8">
                <div className="bg-card rounded-xl p-5 shadow-lawyer">
                    <p className="font-serif-heading text-3xl font-bold text-emerald">₹{totalEarned.toLocaleString("en-IN")}</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">Total Earned</p>
                </div>
                <div className="bg-card rounded-xl p-5 shadow-lawyer">
                    <p className="font-serif-heading text-3xl font-bold text-primary">{connList.length}</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">Paid Connections</p>
                </div>
                <div className="bg-card rounded-xl p-5 shadow-lawyer">
                    <p className="font-serif-heading text-3xl font-bold text-gold">{pendingPayments}</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">Pending Requests</p>
                </div>
            </section>

            {/* Earnings Log */}
            <section>
                <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary mb-4">Connection Earnings</h2>
                {connections.isLoading ? (
                    <div className="font-body text-sm text-muted-foreground p-12 text-center bg-card rounded-xl">Loading earnings…</div>
                ) : connList.length === 0 ? (
                    <div className="text-center py-12 px-8 bg-card rounded-xl shadow-lawyer">
                        <p className="font-body text-base font-semibold text-foreground">No earnings yet</p>
                        <p className="font-body text-sm text-muted-foreground mt-1">Accept connection requests to start earning.</p>
                    </div>
                ) : (
                    <div className="bg-card rounded-xl shadow-lawyer overflow-hidden">
                        {connList.map((conn: any, i: number) => (
                            <div key={conn.id} className={`flex max-md:flex-wrap items-center gap-5 px-6 py-4 ${i > 0 ? "border-t border-border" : ""}`}>
                                <div className="w-10 h-10 rounded-full bg-emerald/[0.08] flex items-center justify-center shrink-0">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="1.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-body text-[0.9375rem] font-semibold text-foreground truncate">
                                        Connection Fee — {conn.users?.full_name ?? "Client"}
                                    </p>
                                    <p className="font-body text-xs text-muted-foreground mt-0.5">
                                        {new Date(conn.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                                    </p>
                                </div>
                                <p className="font-serif-heading text-lg font-bold text-emerald shrink-0">+₹499</p>
                                <span className="font-body text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-md bg-emerald/10 text-[#226B4B] shrink-0">Received</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
