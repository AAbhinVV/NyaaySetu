"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

export default function LawyerClientsPage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState("")
    const { data, isLoading } = trpc.connection.getMyConnections.useQuery({ page, limit: 10 })
    const connections = data?.connections ?? []
    const totalPages = data?.totalPages ?? 1

    const filtered = search.trim()
        ? connections.filter((c: any) => c.users?.full_name?.toLowerCase().includes(search.toLowerCase()) || c.users?.email?.toLowerCase().includes(search.toLowerCase()))
        : connections

    return (
        <div className="max-w-[960px]">
            <div className="flex max-md:flex-col justify-between items-start gap-4 mb-6">
                <div>
                    <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">My Clients</h1>
                    <p className="font-body text-sm text-muted-foreground mt-1">{data?.total ?? 0} active connections</p>
                </div>
                <div className="relative min-w-[280px] max-md:w-full">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
                        className="w-full bg-card rounded-lg pl-10 pr-4 py-2.5 font-body text-sm text-foreground outline-none shadow-lawyer placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-gold border-none" />
                </div>
            </div>

            {isLoading ? (
                <div className="font-body text-sm text-muted-foreground p-12 text-center bg-card rounded-xl">Loading clients…</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 px-8 bg-card rounded-xl shadow-lawyer">
                    <p className="font-body text-base font-semibold text-foreground">{search ? "No matching clients" : "No clients yet"}</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">{search ? "Try a different search term." : "Accept connection requests to build your client list."}</p>
                </div>
            ) : (
                <div className="bg-card rounded-xl shadow-lawyer overflow-hidden">
                    {filtered.map((conn: any, i: number) => (
                        <div key={conn.id} className={`flex max-md:flex-wrap items-center gap-5 px-6 py-4 hover:bg-muted transition-colors ${i > 0 ? "border-t border-border" : ""}`}>
                            <div className="w-10 h-10 rounded-full bg-primary/[0.08] flex items-center justify-center shrink-0">
                                <span className="font-serif-heading text-base font-bold text-primary">{(conn.users?.full_name?.[0] ?? "C").toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-body text-[0.9375rem] font-semibold text-foreground truncate">{conn.users?.full_name ?? "Client"}</p>
                                <p className="font-body text-xs text-muted-foreground mt-0.5">{conn.users?.email ?? "—"}</p>
                            </div>
                            <div className="flex gap-6 shrink-0 max-md:w-full">
                                <div className="flex flex-col">
                                    <span className="font-body text-[0.625rem] text-muted-foreground/60 uppercase tracking-wider">Connected</span>
                                    <span className="font-body text-sm font-medium text-foreground mt-px">{new Date(conn.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                                </div>
                            </div>
                            <span className="font-body text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-md bg-emerald/10 text-[#226B4B] shrink-0">Active</span>
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-6 mt-6 font-body">
                    <button className="text-sm font-medium text-primary bg-card px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
                    <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <button className="text-sm font-medium text-primary bg-card px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
            )}
        </div>
    )
}
