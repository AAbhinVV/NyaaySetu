"use client"

import { useState } from "react"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"

const SPECIALIZATIONS = [
    { value: "", label: "All Specializations" },
    { value: "CIVIL", label: "Civil" },
    { value: "CRIMINAL", label: "Criminal" },
    { value: "PROPERTY", label: "Property" },
    { value: "FAMILY", label: "Family" },
    { value: "DIGITAL_CRIME", label: "Digital Crime" },
    { value: "CONSUMER", label: "Consumer" },
    { value: "LABOUR", label: "Labour" },
    { value: "CORPORATE", label: "Corporate" },
] as const

const COURT_LEVELS = [
    { value: "", label: "All Courts" },
    { value: "DISTRICT", label: "District Court" },
    { value: "HIGH_COURT", label: "High Court" },
    { value: "SUPREME_COURT", label: "Supreme Court" },
    { value: "TRIBUNAL", label: "Tribunal" },
    { value: "CONSUMER_FORUM", label: "Consumer Forum" },
] as const

const SORT_OPTIONS = [
    { value: "rating", label: "Highest Rated" },
    { value: "experience", label: "Most Experienced" },
    { value: "fee", label: "Lowest Fee" },
    { value: "win_rate", label: "Best Win Rate" },
] as const

export default function FindLawyersPage() {
    const [query, setQuery] = useState("")
    const [category, setCategory] = useState<(typeof SPECIALIZATIONS)[number]['value']>("")
    const [courtLevel, setCourtLevel] = useState<(typeof COURT_LEVELS)[number]['value']>("")
    const [city, setCity] = useState("")
    const [sortBy, setSortBy] = useState<"rating" | "experience" | "fee" | "win_rate">("rating")
    const [page, setPage] = useState(1)

    const lawyers = trpc.lawyer.search.useQuery({
        query: query || undefined,
        category: category || undefined,
        courtLevel: courtLevel || undefined,
        city: city || undefined,
        sortBy,
        sortOrder: sortBy === "fee" ? "asc" : "desc",
        page,
        limit: 12,
    })

    const results = lawyers.data?.lawyers ?? []
    const totalPages = lawyers.data?.totalPages ?? 1
    const total = lawyers.data?.total ?? 0

    return (
        <div className="max-w-[960px]">
            {/* Header */}
            <div className="mb-6">
                <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">Find a Lawyer</h1>
                <p className="font-body text-sm text-muted-foreground mt-1">
                    {total} reviewed lawyer profiles available • Filter by specialization, location, and more
                </p>
            </div>

            {/* Search + Filters */}
            <div className="bg-card rounded-xl shadow-lawyer p-5 mb-6">
                {/* Search Bar */}
                <div className="relative mb-4">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                        value={query}
                        onChange={e => { setQuery(e.target.value); setPage(1) }}
                        placeholder="Search by name, specialization, or keyword…"
                        className="w-full bg-muted rounded-lg pl-10 pr-4 py-3 font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-gold transition-shadow"
                    />
                </div>

                {/* Filter Row */}
                <div className="flex flex-wrap gap-3">
                    <select value={category} onChange={e => { setCategory(e.target.value as typeof category); setPage(1) }}
                        className="font-body text-sm text-foreground bg-muted rounded-lg px-3 py-2 outline-none cursor-pointer border-none focus:ring-1 focus:ring-gold">
                        {SPECIALIZATIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <select value={courtLevel} onChange={e => { setCourtLevel(e.target.value as typeof courtLevel); setPage(1) }}
                        className="font-body text-sm text-foreground bg-muted rounded-lg px-3 py-2 outline-none cursor-pointer border-none focus:ring-1 focus:ring-gold">
                        {COURT_LEVELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <input
                        value={city}
                        onChange={e => { setCity(e.target.value); setPage(1) }}
                        placeholder="City…"
                        className="font-body text-sm text-foreground bg-muted rounded-lg px-3 py-2 outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-gold w-32 border-none"
                    />
                    <select value={sortBy} onChange={e => { setSortBy(e.target.value as typeof sortBy); setPage(1) }}
                        className="font-body text-sm text-foreground bg-muted rounded-lg px-3 py-2 outline-none cursor-pointer border-none focus:ring-1 focus:ring-gold ml-auto">
                        {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Results */}
            {lawyers.isLoading ? (
                <div className="p-12 text-center bg-card rounded-xl shadow-lawyer">
                    <p className="font-body text-sm text-muted-foreground">Searching lawyers…</p>
                </div>
            ) : results.length === 0 ? (
                <div className="text-center py-16 px-8 bg-card rounded-xl shadow-lawyer">
                    <div className="w-14 h-14 bg-primary/[0.06] rounded-xl flex items-center justify-center mx-auto mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <p className="font-body text-base font-semibold text-foreground">No lawyers found</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">Try adjusting your filters or search term.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                    {results.map((l: any) => (
                        <Link key={l.id} href={`/dashboard/client/lawyers/${l.id}`}
                            className="bg-card rounded-xl shadow-lawyer hover:shadow-lg hover:-translate-y-px transition-all p-5 no-underline text-inherit block">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-body text-[0.9375rem] font-semibold text-foreground truncate">{l.full_name}</h3>
                                        {l.verified && (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="2" className="shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                                        )}
                                    </div>
                                    <p className="font-body text-xs text-muted-foreground mt-0.5">{l.city}, {l.state} • {l.years_of_experience}+ yrs</p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-serif-heading text-lg font-bold text-gold">{l.avg_rating?.toFixed(1) || "—"} <span className="text-xs">★</span></p>
                                    <p className="font-body text-[0.625rem] text-muted-foreground/60">{l.review_count} reviews</p>
                                </div>
                            </div>

                            {/* Specializations */}
                            <div className="flex flex-wrap gap-1 mb-3">
                                {(l.specializations ?? []).slice(0, 3).map((s: string) => (
                                    <span key={s} className="font-body text-[0.625rem] font-medium px-2 py-0.5 rounded-md bg-primary/[0.06] text-primary">{s}</span>
                                ))}
                                {(l.specializations?.length ?? 0) > 3 && (
                                    <span className="font-body text-[0.625rem] text-muted-foreground/60">+{l.specializations.length - 3} more</span>
                                )}
                            </div>

                            {/* Stats Row */}
                            <div className="flex items-center justify-between pt-3 border-t border-border">
                                <div className="flex gap-5">
                                    <div>
                                        <p className="font-body text-[0.625rem] text-muted-foreground/60 uppercase tracking-wider">Win Rate</p>
                                        <p className="font-body text-sm font-semibold text-emerald">{l.win_rate}%</p>
                                    </div>
                                    <div>
                                        <p className="font-body text-[0.625rem] text-muted-foreground/60 uppercase tracking-wider">Cases</p>
                                        <p className="font-body text-sm font-semibold text-foreground">{l.total_cases}</p>
                                    </div>
                                </div>
                                <p className="font-serif-heading text-base font-bold text-primary">₹{(l.fee_per_consultation / 100).toLocaleString("en-IN")}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-6 mt-6 font-body">
                    <button className="text-sm font-medium text-primary bg-card px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors border-none cursor-pointer" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
                    <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <button className="text-sm font-medium text-primary bg-card px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors border-none cursor-pointer" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
            )}
        </div>
    )
}
