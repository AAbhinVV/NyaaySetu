"use client"

import { useState } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"

const CATEGORIES = ["", "CIVIL", "CRIMINAL", "PROPERTY", "FAMILY", "DIGITAL_CRIME", "CONSUMER", "LABOUR", "CORPORATE"] as const
const COURT_LEVELS = ["", "DISTRICT", "HIGH_COURT", "SUPREME_COURT", "TRIBUNAL", "CONSUMER_FORUM"] as const

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
                <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill={s <= Math.round(rating) ? "#C9A84C" : "none"} stroke="#C9A84C" strokeWidth="1.5">
                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                </svg>
            ))}
        </div>
    )
}

export default function PublicLawyerDirectoryPage() {
    const [query, setQuery] = useState("")
    const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("")
    const [courtLevel, setCourtLevel] = useState<(typeof COURT_LEVELS)[number]>("")
    const [page, setPage] = useState(1)

    const { data, isLoading } = trpc.lawyer.search.useQuery({
        query: query || undefined,
        category: category || undefined,
        courtLevel: courtLevel || undefined,
        verifiedOnly: true,
        page,
        limit: 12,
        sortBy: "rating",
        sortOrder: "desc",
    })

    const lawyers = data?.lawyers ?? []
    const totalPages = data?.totalPages ?? 1

    return (
        <div className="max-w-[960px] mx-auto py-12 px-6">
            {/* Header */}
            <section className="text-center mb-10">
                <h1 className="font-serif-heading text-[2.5rem] max-md:text-[2rem] font-bold text-primary tracking-tight">Find a Lawyer</h1>
                <p className="font-body text-base text-muted-foreground mt-2">Browse manually reviewed lawyer profiles across India.</p>
            </section>

            {/* Search & Filters */}
            <section className="bg-card rounded-2xl shadow-lawyer p-6 mb-8">
                <div className="flex max-md:flex-col gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input value={query} onChange={e => { setQuery(e.target.value); setPage(1) }} placeholder="Search by name or bio…"
                            className="w-full bg-muted rounded-lg pl-10 pr-4 py-2.5 font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-gold border-none" />
                    </div>
                    {/* Category */}
                    <select value={category} onChange={e => { setCategory(e.target.value as (typeof CATEGORIES)[number]); setPage(1) }}
                        className="bg-muted rounded-lg px-4 py-2.5 font-body text-sm text-foreground outline-none focus:ring-1 focus:ring-gold cursor-pointer border-none min-w-[160px]">
                        <option value="">All Specializations</option>
                        {CATEGORIES.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {/* Court Level */}
                    <select value={courtLevel} onChange={e => { setCourtLevel(e.target.value as (typeof COURT_LEVELS)[number]); setPage(1) }}
                        className="bg-muted rounded-lg px-4 py-2.5 font-body text-sm text-foreground outline-none focus:ring-1 focus:ring-gold cursor-pointer border-none min-w-[160px]">
                        <option value="">All Courts</option>
                        {COURT_LEVELS.filter(Boolean).map(c => <option key={c} value={c}>{c!.replace(/_/g, " ")}</option>)}
                    </select>
                </div>
            </section>

            {/* Results */}
            {isLoading ? (
                <div className="font-body text-sm text-muted-foreground p-16 text-center bg-card rounded-xl">Loading lawyers…</div>
            ) : lawyers.length === 0 ? (
                <div className="text-center py-16 px-8 bg-card rounded-xl shadow-lawyer">
                    <p className="font-body text-base font-semibold text-foreground">No lawyers found</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">Try adjusting your search or filters.</p>
                </div>
            ) : (
                <div className="grid grid-cols-3 max-md:grid-cols-1 gap-5">
                    {lawyers.map((lawyer: any) => (
                        <Link key={lawyer.id} href={`/lawyers/${lawyer.id}`} className="bg-card rounded-xl shadow-lawyer p-5 hover:shadow-lg transition-shadow block no-underline text-inherit group">
                            {/* Avatar + Name */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-11 h-11 rounded-full bg-primary/[0.08] flex items-center justify-center shrink-0 group-hover:bg-primary/[0.12] transition-colors">
                                    <span className="font-serif-heading text-lg font-bold text-primary">{(lawyer.full_name?.[0] ?? "L").toUpperCase()}</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="font-body text-[0.9375rem] font-semibold text-foreground truncate">{lawyer.full_name}</p>
                                    <p className="font-body text-xs text-muted-foreground">{lawyer.city}, {lawyer.state}</p>
                                </div>
                            </div>

                            {/* Rating */}
                            <div className="flex items-center gap-2 mb-3">
                                <StarRating rating={lawyer.avg_rating ?? 0} />
                                <span className="font-body text-xs text-muted-foreground">({lawyer.review_count ?? 0})</span>
                            </div>

                            {/* Stats */}
                            <div className="flex gap-4 mb-3">
                                <div>
                                    <p className="font-body text-[0.625rem] text-muted-foreground/60 uppercase tracking-wider">Experience</p>
                                    <p className="font-body text-sm font-semibold text-foreground">{lawyer.years_of_experience}y</p>
                                </div>
                                <div>
                                    <p className="font-body text-[0.625rem] text-muted-foreground/60 uppercase tracking-wider">Win Rate</p>
                                    <p className="font-body text-sm font-semibold text-emerald">{lawyer.win_rate}%</p>
                                </div>
                                <div>
                                    <p className="font-body text-[0.625rem] text-muted-foreground/60 uppercase tracking-wider">Fee</p>
                                    <p className="font-body text-sm font-semibold text-foreground">₹{((lawyer.fee_per_consultation ?? 0) / 100).toLocaleString("en-IN")}</p>
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1">
                                {(lawyer.specializations ?? []).slice(0, 2).map((s: string) => (
                                    <span key={s} className="font-body text-[0.625rem] font-medium px-2 py-0.5 rounded-md bg-primary/[0.06] text-primary">{s}</span>
                                ))}
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-6 mt-8 font-body">
                    <button className="text-sm font-medium text-primary bg-card px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
                    <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <button className="text-sm font-medium text-primary bg-card px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
            )}
        </div>
    )
}
