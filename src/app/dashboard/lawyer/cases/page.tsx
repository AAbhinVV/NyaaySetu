"use client"

import { useState } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"

const STATUSES = [
    { value: "", label: "All Cases" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "HEARING_SET", label: "Hearing Set" },
    { value: "VERDICT", label: "Verdict" },
    { value: "CLOSED", label: "Closed" },
] as const

const pillClass = (s: string) =>
    s === "IN_PROGRESS" ? "bg-primary/10 text-primary" :
    s === "HEARING_SET" ? "bg-gold/10 text-[#96790C]" :
    s === "VERDICT" ? "bg-emerald/10 text-emerald" :
    s === "CLOSED" ? "bg-muted text-muted-foreground" : "bg-muted text-muted-foreground"

const statusLabel = (s: string) =>
    s === "IN_PROGRESS" ? "In Progress" :
    s === "HEARING_SET" ? "Hearing Set" :
    s === "VERDICT" ? "Verdict" :
    s === "CLOSED" ? "Closed" : s

export default function LawyerCasesPage() {
    const [status, setStatus] = useState<string>("")
    const [page, setPage] = useState(1)

    const cases = trpc.case.getAllCases.useQuery({
        status: (status || undefined) as any,
        page,
        limit: 10,
    })

    const caseList = cases.data?.cases ?? []
    const totalPages = cases.data?.totalPages ?? 1
    const total = cases.data?.total ?? 0

    return (
        <div className="max-w-[960px]">
            <div className="flex max-md:flex-col justify-between items-start gap-4 mb-6">
                <div>
                    <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">My Cases</h1>
                    <p className="font-body text-sm text-muted-foreground mt-1">{total} total cases</p>
                </div>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 mb-5 flex-wrap">
                {STATUSES.map(s => (
                    <button key={s.value} onClick={() => { setStatus(s.value); setPage(1) }}
                        className={`font-body text-[0.8125rem] font-medium px-3.5 py-1.5 rounded-lg border-none cursor-pointer transition-all ${status === s.value ? "bg-primary text-white shadow-sm" : "bg-card text-muted-foreground hover:bg-muted shadow-lawyer"}`}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Case List */}
            {cases.isLoading ? (
                <div className="p-12 text-center bg-card rounded-xl shadow-lawyer">
                    <p className="font-body text-sm text-muted-foreground">Loading cases…</p>
                </div>
            ) : caseList.length === 0 ? (
                <div className="text-center py-16 px-8 bg-card rounded-xl shadow-lawyer">
                    <div className="w-14 h-14 bg-primary/[0.06] rounded-xl flex items-center justify-center mx-auto mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <p className="font-body text-base font-semibold text-foreground">No cases found</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">Cases appear once a client connection is accepted.</p>
                </div>
            ) : (
                <div className="flex flex-col bg-card rounded-xl overflow-hidden shadow-lawyer">
                    {caseList.map((c: any, i: number) => (
                        <Link key={c.id} href={`/dashboard/lawyer/cases/${c.id}`}
                            className={`flex max-md:flex-wrap items-center gap-6 px-6 py-4 hover:bg-muted transition-colors no-underline text-inherit ${i > 0 ? "border-t border-border" : ""}`}>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-body text-[0.9375rem] font-semibold text-foreground truncate">{c.title || "Untitled Case"}</h3>
                                <p className="font-body text-xs text-muted-foreground mt-0.5">
                                    Client: {c.users?.full_name ?? "—"} • {c.jurisdiction_city ?? "—"} • {c.e_token}
                                </p>
                            </div>
                            {c.next_hearing_at && (
                                <div className="text-right shrink-0">
                                    <p className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider">Next Hearing</p>
                                    <p className="font-body text-sm font-medium text-foreground">{new Date(c.next_hearing_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                                </div>
                            )}
                            <span className={`font-body text-[0.6875rem] font-semibold px-2.5 py-1 rounded-md shrink-0 ${pillClass(c.status)}`}>
                                {statusLabel(c.status)}
                            </span>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pagination */}
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
