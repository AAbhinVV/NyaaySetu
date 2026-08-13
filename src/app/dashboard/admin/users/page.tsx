"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { firstRelation } from '@/lib/utils'

type VerificationFilter = "PENDING" | "VERIFIED" | "REJECTED" | ""

const FILTER_TABS = [
    { value: "", label: "All Lawyers" },
    { value: "PENDING", label: "Pending" },
    { value: "VERIFIED", label: "Verified" },
    { value: "REJECTED", label: "Rejected" },
] as const

export default function AdminUsersPage() {
    const [filter, setFilter] = useState<VerificationFilter>("")
    const [page, setPage] = useState(1)

    const { data, isLoading } = trpc.admin.getAllLawyers.useQuery({
        verificationStatus: filter || undefined,
        page,
        limit: 12,
    })

    const verifyLawyer = trpc.admin.verifyLawyer.useMutation({
        onSuccess: () => { /* refetch handled by trpc cache invalidation */ },
    })

    const lawyers = data?.lawyers ?? []
    const totalPages = data?.totalPages ?? 1

    const handleVerify = (lawyerId: string, status: "VERIFIED" | "REJECTED") => {
        const reason = status === "REJECTED" ? prompt("Enter rejection reason:") : undefined
        if (status === "REJECTED" && !reason) return
        verifyLawyer.mutate({ lawyerId, status, rejectionReason: reason ?? undefined })
    }

    return (
        <div className="max-w-[960px]">
            <div className="mb-6">
                <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">User Management</h1>
                <p className="font-body text-sm text-muted-foreground mt-1">{data?.total ?? 0} lawyers registered</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
                {FILTER_TABS.map(tab => (
                    <button key={tab.value}
                        className={`font-body text-sm font-medium px-4 py-2 rounded-lg border-none cursor-pointer transition-all
                            ${filter === tab.value ? "bg-primary text-white shadow-lawyer" : "bg-card text-muted-foreground shadow-sm hover:bg-muted"}`}
                        onClick={() => { setFilter(tab.value as VerificationFilter); setPage(1) }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Lawyers Table */}
            {isLoading ? (
                <div className="font-body text-sm text-muted-foreground p-12 text-center bg-card rounded-xl">Loading lawyers…</div>
            ) : lawyers.length === 0 ? (
                <div className="text-center py-12 px-8 bg-card rounded-xl shadow-lawyer">
                    <p className="font-body text-base font-semibold text-foreground">No lawyers found</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">{filter ? "Try a different filter." : "No lawyers have registered yet."}</p>
                </div>
            ) : (
                <div className="bg-card rounded-xl shadow-lawyer overflow-hidden">
                    {/* Header */}
                    <div className="hidden md:flex items-center gap-4 px-6 py-3 bg-muted text-muted-foreground">
                        <span className="font-body text-[0.625rem] uppercase tracking-wider flex-1">Lawyer</span>
                        <span className="font-body text-[0.625rem] uppercase tracking-wider w-28">Location</span>
                        <span className="font-body text-[0.625rem] uppercase tracking-wider w-28">Specialization</span>
                        <span className="font-body text-[0.625rem] uppercase tracking-wider w-20 text-center">Rating</span>
                        <span className="font-body text-[0.625rem] uppercase tracking-wider w-20 text-center">Status</span>
                        <span className="font-body text-[0.625rem] uppercase tracking-wider w-32 text-center">Actions</span>
                    </div>

                    {/* Rows */}
                    {lawyers.map((lawyer, i) => (
                        <div key={lawyer.id} className={`flex max-md:flex-wrap items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors ${i > 0 ? "border-t border-border" : ""}`}>
                            {/* Name + Email */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-9 h-9 rounded-full bg-primary/[0.08] flex items-center justify-center shrink-0">
                                    <span className="font-serif-heading text-sm font-bold text-primary">{(lawyer.full_name?.[0] ?? "L").toUpperCase()}</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="font-body text-sm font-semibold text-foreground truncate">{lawyer.full_name}</p>
                                    <p className="font-body text-xs text-muted-foreground truncate">{lawyer.users?.email ?? "—"}</p>
                                    <p className="font-body text-[0.6875rem] text-muted-foreground/70 truncate">
                                        {lawyer.state_bar_council ?? "Council not provided"}{lawyer.enrollment_year ? ` • ${lawyer.enrollment_year}` : ""}
                                    </p>
                                    {lawyer.verification_document_url && (
                                        <a href={`/api/lawyers/${lawyer.id}/verification-document`} target="_blank" rel="noopener noreferrer" className="font-body text-[0.6875rem] text-primary hover:underline">
                                            View proof
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Location */}
                            <span className="font-body text-xs text-muted-foreground w-28 truncate max-md:hidden">{lawyer.city}, {lawyer.state}</span>

                            {/* Specializations */}
                            <div className="w-28 max-md:hidden">
                                <span className="font-body text-[0.6875rem] font-medium px-2 py-0.5 rounded-md bg-primary/[0.06] text-primary truncate block text-center">
                                    {(lawyer.specializations ?? [])[0] ?? "—"}
                                </span>
                            </div>

                            {/* Rating */}
                            <div className="w-20 text-center max-md:hidden">
                                <span className="font-body text-sm font-semibold text-gold">{lawyer.avg_rating?.toFixed(1) ?? "—"}</span>
                                <span className="font-body text-xs text-muted-foreground ml-0.5">({lawyer.review_count ?? 0})</span>
                            </div>

                            {/* Status */}
                            <div className="w-20 text-center">
                                <span className={`font-body text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-md inline-block ${
                                    lawyer.verification_status === "VERIFIED" ? "bg-emerald/10 text-[#226B4B]" :
                                    lawyer.verification_status === "PENDING" ? "bg-gold/12 text-[#96790C]" :
                                    "bg-destructive/10 text-destructive"
                                }`}>
                                    {lawyer.verification_status ?? "PENDING"}
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="w-32 flex justify-center gap-1.5">
                                {lawyer.verification_status === "PENDING" && (
                                    <>
                                        <button onClick={() => handleVerify(lawyer.id, "VERIFIED")}
                                            className="font-body text-[0.6875rem] font-medium px-3 py-1.5 rounded-md bg-emerald/10 text-[#226B4B] hover:bg-emerald/20 transition-colors border-none cursor-pointer">
                                            Verify
                                        </button>
                                        <button onClick={() => handleVerify(lawyer.id, "REJECTED")}
                                            className="font-body text-[0.6875rem] font-medium px-3 py-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border-none cursor-pointer">
                                            Reject
                                        </button>
                                    </>
                                )}
                                {lawyer.verification_status === "VERIFIED" && (
                                    <span className="font-body text-xs text-muted-foreground">Active</span>
                                )}
                                {lawyer.verification_status === "REJECTED" && (
                                    <button onClick={() => handleVerify(lawyer.id, "VERIFIED")}
                                        className="font-body text-[0.6875rem] font-medium px-3 py-1.5 rounded-md bg-primary/5 text-primary hover:bg-primary/10 transition-colors border-none cursor-pointer">
                                        Re-verify
                                    </button>
                                )}
                            </div>
                        </div>
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
