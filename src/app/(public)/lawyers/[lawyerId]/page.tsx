"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { firstRelation } from '@/lib/utils'

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(s => (
                <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill={s <= Math.round(rating) ? "#C9A84C" : "none"} stroke="#C9A84C" strokeWidth="1.5">
                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                </svg>
            ))}
        </div>
    )
}

export default function PublicLawyerProfilePage() {
    const { lawyerId } = useParams<{ lawyerId: string }>()
    const profile = trpc.lawyer.getById.useQuery({ id: lawyerId })
    const reviews = trpc.lawyer.getReviews.useQuery({ lawyerId, page: 1, limit: 10 })

    const p = profile.data
    const reviewList = reviews.data?.reviews ?? []

    if (profile.isLoading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <p className="font-body text-sm text-muted-foreground">Loading profile…</p>
        </div>
    )

    if (!p) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
            <p className="font-body text-base font-semibold text-foreground">Lawyer not found</p>
            <Link href="/lawyers" className="font-body text-sm text-primary hover:underline">← Back to directory</Link>
        </div>
    )

    return (
        <div className="max-w-[960px] mx-auto py-12 px-6">
            {/* Breadcrumb */}
            <div className="font-body text-sm text-muted-foreground mb-6">
                <Link href="/lawyers" className="text-primary hover:underline">Find Lawyers</Link>
                <span className="mx-2 text-muted-foreground/40">/</span>
                <span>{p.full_name}</span>
            </div>

            {/* Profile Header */}
            <header className="bg-card rounded-2xl shadow-lawyer p-6 md:p-8 mb-8">
                <div className="flex max-md:flex-col gap-6">
                    {/* Avatar */}
                    <div className="w-20 h-20 rounded-2xl bg-primary/[0.08] flex items-center justify-center shrink-0">
                        <span className="font-serif-heading text-3xl font-bold text-primary">{(p.full_name?.[0] ?? "L").toUpperCase()}</span>
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap mb-2">
                            <h1 className="font-serif-heading text-2xl font-semibold text-primary tracking-tight">{p.full_name}</h1>
                            {p.verified && (
                                <span className="flex items-center gap-1 font-body text-xs font-semibold text-emerald bg-emerald/[0.06] px-2.5 py-1 rounded-md">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                                    Verified
                                </span>
                            )}
                        </div>
                        <p className="font-body text-sm text-muted-foreground">{p.city}, {p.state}</p>
                        {p.bio && <p className="font-body text-sm text-foreground/80 mt-3 leading-relaxed">{p.bio}</p>}
                    </div>

                    {/* CTA */}
                    <div className="flex flex-col gap-2 shrink-0">
                        <Link href="/sign-up" className="px-6 py-2.5 rounded-lg bg-primary-gradient text-white font-body text-sm font-medium text-center hover:shadow-lg transition-shadow">
                            Connect — ₹499
                        </Link>
                        <p className="font-body text-[0.625rem] text-muted-foreground text-center">One-time connection fee</p>
                    </div>
                </div>
            </header>

            {/* Stats Grid */}
            <section className="grid grid-cols-4 max-md:grid-cols-2 gap-4 mb-8">
                {[
                    { label: `${p.review_count ?? 0} Reviews`, value: p.avg_rating?.toFixed(1) ?? "—", color: "text-gold" },
                    { label: "Win Rate", value: `${p.win_rate ?? 0}%`, color: "text-emerald" },
                    { label: "Experience", value: `${p.years_of_experience ?? 0}y`, color: "text-primary" },
                    { label: "Consult Fee", value: `₹${((p.fee_per_consultation ?? 0) / 100).toLocaleString("en-IN")}`, color: "text-primary" },
                ].map((s, i) => (
                    <div key={i} className="bg-card rounded-xl p-5 shadow-lawyer text-center">
                        <p className={`font-serif-heading text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="font-body text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wider mt-1">{s.label}</p>
                    </div>
                ))}
            </section>

            {/* Details */}
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-6 mb-8">
                {/* Specializations */}
                <div className="bg-card rounded-xl shadow-lawyer p-6">
                    <h2 className="font-serif-heading text-lg font-semibold text-primary mb-4">Specializations</h2>
                    <div className="flex flex-wrap gap-1.5">
                        {(p.specializations ?? []).map((s: string) => (
                            <span key={s} className="font-body text-[0.6875rem] font-medium px-2.5 py-1 rounded-md bg-primary/[0.06] text-primary">{s}</span>
                        ))}
                    </div>
                </div>

                {/* Court Levels */}
                <div className="bg-card rounded-xl shadow-lawyer p-6">
                    <h2 className="font-serif-heading text-lg font-semibold text-primary mb-4">Court Levels</h2>
                    <div className="flex flex-wrap gap-1.5">
                        {(p.court_levels ?? []).map((c: string) => (
                            <span key={c} className="font-body text-[0.6875rem] font-medium px-2.5 py-1 rounded-md bg-gold/[0.06] text-[#96790C]">{c.replace(/_/g, " ")}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Languages */}
            {p.languages_spoken?.length > 0 && (
                <div className="bg-card rounded-xl shadow-lawyer p-6 mb-8">
                    <h2 className="font-serif-heading text-lg font-semibold text-primary mb-3">Languages Spoken</h2>
                    <p className="font-body text-sm text-foreground">{p.languages_spoken.join(", ")}</p>
                </div>
            )}

            {/* Reviews */}
            <section>
                <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary mb-4">Client Reviews ({reviews.data?.total ?? 0})</h2>
                {reviewList.length === 0 ? (
                    <div className="text-center py-10 bg-card rounded-xl shadow-lawyer">
                        <p className="font-body text-sm text-muted-foreground">No reviews yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reviewList.map((r) => (
                            <div key={r.id} className="bg-card rounded-xl shadow-sm p-5">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <StarRating rating={r.rating} size={12} />
                                        <span className={`font-body text-[0.6875rem] font-semibold px-2 py-0.5 rounded-md ${
                                            r.outcome === "WON" ? "bg-emerald/10 text-[#226B4B]" : r.outcome === "SETTLED" ? "bg-gold/12 text-[#96790C]" : "bg-destructive/10 text-destructive"
                                        }`}>{r.outcome}</span>
                                    </div>
                                    <span className="font-body text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                                </div>
                                <p className="font-body text-sm text-foreground/80 leading-relaxed">{r.body}</p>
                                <p className="font-body text-xs text-muted-foreground mt-2">— {firstRelation(r.users)?.full_name ?? "Client"}</p>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
