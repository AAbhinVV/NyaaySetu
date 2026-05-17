"use client"

import { useState } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"

const STATUS_OPTIONS = [
    { value: "", label: "All Cases" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "HEARING_SET", label: "Hearing Scheduled" },
    { value: "VERDICT", label: "Verdict" },
    { value: "CLOSED", label: "Closed" },
] as const

function statusColor(s: string) { return s === "HEARING_SET" ? "gold" : s === "IN_PROGRESS" ? "emerald" : s === "VERDICT" ? "amber" : "navy" }
function statusLabel(s: string) {
    const m: Record<string, string> = { IN_PROGRESS: "In Progress", HEARING_SET: "Hearing Scheduled", VERDICT: "Verdict", CLOSED: "Closed" }
    return m[s] ?? s
}

const pillClass: Record<string, string> = {
    gold: "bg-gold/12 text-[#96790C]",
    emerald: "bg-emerald/10 text-[#226B4B]",
    amber: "bg-[#D4A017]/12 text-[#8B6914]",
    navy: "bg-primary/[0.08] text-primary",
}

export default function ClientCasesPage() {
    const [statusFilter, setStatusFilter] = useState<string>("")
    const [page, setPage] = useState(1)
    const { data, isLoading } = trpc.client.getMyCases.useQuery({ status: (statusFilter || undefined) as any, page, limit: 8 })
    const cases = data?.cases ?? []
    const totalPages = data?.totalPages ?? 1

    return (
        <div className="max-w-[960px]">
            <div className="mb-6">
                <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">My Cases</h1>
                <p className="font-body text-sm text-muted-foreground mt-1">{data?.total ?? 0} total cases</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-6">
                {STATUS_OPTIONS.map((opt) => (
                    <button key={opt.value}
                        className={`font-body text-sm font-medium px-4 py-2 rounded-lg border-none cursor-pointer transition-all
                            ${statusFilter === opt.value ? "bg-primary text-white shadow-lawyer" : "bg-card text-muted-foreground shadow-sm hover:bg-muted"}`}
                        onClick={() => { setStatusFilter(opt.value); setPage(1) }}
                    >{opt.label}</button>
                ))}
            </div>

            {/* Cases List */}
            {isLoading ? (
                <div className="font-body text-sm text-muted-foreground p-12 text-center bg-card rounded-xl">Loading cases…</div>
            ) : cases.length === 0 ? (
                <div className="text-center py-12 px-8 bg-card rounded-xl">
                    <p className="font-body text-base font-semibold text-foreground">No cases found</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">{statusFilter ? "Try a different filter." : "Connect with a lawyer to get started."}</p>
                    {!statusFilter && <Link href="/dashboard/client/lawyers" className="inline-block mt-4 px-6 py-2.5 rounded-lg bg-primary-gradient text-white font-body text-sm font-medium">Find a Lawyer</Link>}
                </div>
            ) : (
                <div className="flex flex-col bg-card rounded-xl overflow-hidden shadow-lawyer">
                    {cases.map((c: any, i: number) => (
                        <Link key={c.id} href={`/dashboard/client/cases/${c.id}`}
                            className={`flex max-md:flex-wrap items-center gap-6 px-6 py-4 hover:bg-muted transition-colors no-underline text-inherit ${i > 0 ? "border-t border-border" : ""}`}>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-body text-[0.9375rem] font-semibold text-foreground truncate">{c.title || "Untitled Case"}</h3>
                                <p className="font-body text-xs text-muted-foreground mt-0.5">{c.category || "General"} • {c.e_token} • Filed {new Date(c.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</p>
                            </div>
                            <div className="flex gap-8 shrink-0 max-md:w-full">
                                <div className="flex flex-col">
                                    <span className="font-body text-[0.625rem] text-muted-foreground/60 uppercase tracking-wider">Counsel</span>
                                    <span className="font-body text-sm font-medium text-foreground mt-px">{c.lawyers?.full_name ?? "—"}</span>
                                </div>
                                {c.next_hearing_at && (
                                    <div className="flex flex-col">
                                        <span className="font-body text-[0.625rem] text-muted-foreground/60 uppercase tracking-wider">Next Hearing</span>
                                        <span className="font-body text-sm font-medium text-foreground mt-px">{new Date(c.next_hearing_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                                    </div>
                                )}
                            </div>
                            <span className={`font-body text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-md whitespace-nowrap shrink-0 ${pillClass[statusColor(c.status)]}`}>{statusLabel(c.status)}</span>
                            <svg className="shrink-0 text-muted-foreground/40 max-md:hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6"/></svg>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pagination */}
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
