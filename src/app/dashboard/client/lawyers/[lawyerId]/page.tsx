"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { firstRelation } from '@/lib/utils'

export default function LawyerDetailPage() {
    const { lawyerId } = useParams<{ lawyerId: string }>()
    const [reviewPage, setReviewPage] = useState(1)
    const [paymentConsent, setPaymentConsent] = useState(false)

    const lawyer = trpc.lawyer.getById.useQuery({ id: lawyerId })
    const reviews = trpc.lawyer.getReviews.useQuery({ lawyerId, page: reviewPage, limit: 5 })
    const connectionStatus = trpc.client.getConnectionStatus.useQuery({ lawyerId })
    const checkout = trpc.connection.createConnectionCheckout.useMutation({
        onSuccess: (data) => {
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl
            }
        },
    })

    const l = lawyer.data
    const reviewList = reviews.data?.reviews ?? []
    const reviewTotal = reviews.data?.total ?? 0
    const reviewPages = reviews.data?.totalPages ?? 1
    const connStatus = connectionStatus.data

    if (lawyer.isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Loading…</p></div>
    if (!l) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Lawyer not found.</p></div>

    return (
        <div className="max-w-[960px]">
            <div className="font-body text-sm text-muted-foreground mb-4">
                <Link href="/dashboard/client/lawyers" className="text-primary hover:underline">Find Lawyers</Link>
                <span className="mx-2 text-muted-foreground/40">/</span><span>{l.full_name}</span>
            </div>

            <header className="bg-card rounded-xl shadow-lawyer p-6 mb-6">
                <div className="flex max-md:flex-col gap-6">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="font-serif-heading text-2xl font-semibold text-primary tracking-tight">{l.full_name}</h1>
                            {l.verified && <span className="flex items-center gap-1 font-body text-xs font-semibold text-emerald bg-emerald/[0.06] px-2 py-0.5 rounded-md">✓ Verified</span>}
                        </div>
                        <p className="font-body text-sm text-muted-foreground">{l.city}, {l.state} • {l.years_of_experience}+ yrs</p>
                        {l.bio && <p className="font-body text-sm text-foreground/80 mt-3 leading-relaxed">{l.bio}</p>}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {(l.specializations ?? []).map((s: string) => <span key={s} className="font-body text-[0.6875rem] font-medium px-2 py-0.5 rounded-md bg-primary/[0.06] text-primary">{s}</span>)}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {(l.court_levels ?? []).map((c: string) => <span key={c} className="font-body text-[0.6875rem] font-medium px-2 py-0.5 rounded-md bg-gold/[0.06] text-[#96790C]">{c.replace(/_/g, " ")}</span>)}
                        </div>
                        {l.languages_spoken?.length > 0 && <p className="font-body text-xs text-muted-foreground mt-3">Languages: {l.languages_spoken.join(", ")}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4 shrink-0">
                        {[
                            { val: l.avg_rating?.toFixed(1) ?? "—", unit: "★", label: `${l.review_count} Reviews`, color: "text-gold" },
                            { val: `${l.win_rate}%`, label: "Win Rate", color: "text-emerald" },
                            { val: l.total_cases, label: "Total Cases", color: "text-primary" },
                            { val: `₹${(l.fee_per_consultation / 100).toLocaleString("en-IN")}`, label: "Consult Fee", color: "text-primary" },
                        ].map((s, i) => (
                            <div key={i} className="text-center px-4 py-3 bg-muted rounded-lg">
                                <p className={`font-serif-heading text-2xl font-bold ${s.color}`}>{s.val}{s.unit ? ` ${s.unit}` : ""}</p>
                                <p className="font-body text-[0.6875rem] text-muted-foreground/70 uppercase tracking-wider mt-0.5">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex gap-3 mt-5 pt-5 border-t border-border">
                    {connStatus === "ACTIVE" ? <span className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-emerald/10 text-emerald">✓ Connected</span>
                    : connStatus === "PENDING" ? <span className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-gold/10 text-[#96790C]">Payment or lawyer approval pending</span>
                    : <div className="flex flex-col gap-3 max-w-[460px]">
                        <label className="flex items-start gap-2 font-body text-xs text-muted-foreground leading-relaxed">
                            <input
                                type="checkbox"
                                checked={paymentConsent}
                                onChange={(e) => setPaymentConsent(e.target.checked)}
                                className="mt-0.5"
                            />
                            <span>
                                I understand the ₹499 fee is a connection fee governed by the <Link href="/refund-policy" className="text-primary underline">Refund Policy</Link>, and legal advice is provided only by the independent lawyer after acceptance.
                            </span>
                        </label>
                        <button
                            onClick={() => checkout.mutate({ lawyerId })}
                            disabled={checkout.isPending || !paymentConsent}
                            className="font-body text-sm font-medium px-6 py-2.5 rounded-lg bg-primary-gradient text-white hover:shadow-lg transition-shadow border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {checkout.isPending ? "Opening secure checkout..." : "Connect — ₹499"}
                        </button>
                    </div>}
                    {checkout.error && (
                        <p className="font-body text-sm text-destructive">{checkout.error.message}</p>
                    )}
                </div>
            </header>

            <section>
                <h2 className="font-serif-heading text-[1.375rem] font-semibold text-primary mb-4">Client Reviews ({reviewTotal})</h2>
                {reviewList.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-xl shadow-lawyer"><p className="font-body text-sm text-muted-foreground">No reviews yet.</p></div>
                ) : (
                    <div className="bg-card rounded-xl shadow-lawyer overflow-hidden">
                        {reviewList.map((r: any, i: number) => (
                            <div key={r.id} className={`px-6 py-5 ${i > 0 ? "border-t border-border" : ""}`}>
                                <div className="flex items-baseline justify-between gap-4 mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-body text-sm font-semibold text-foreground">{firstRelation(r.users)?.full_name ?? "Client"}</span>
                                        <span className={`font-body text-[0.625rem] font-semibold px-1.5 py-0.5 rounded ${r.outcome === "WON" ? "bg-emerald/10 text-emerald" : r.outcome === "SETTLED" ? "bg-gold/10 text-[#96790C]" : "bg-destructive/10 text-destructive"}`}>{r.outcome}</span>
                                    </div>
                                    <span className="font-body text-[0.6875rem] text-muted-foreground/60">{new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                                </div>
                                <div className="flex gap-0.5 mb-2">{[1,2,3,4,5].map(n => <svg key={n} width="14" height="14" viewBox="0 0 24 24" fill={n <= r.rating ? "#C9A84C" : "none"} stroke="#C9A84C" strokeWidth="1.5"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>)}</div>
                                <p className="font-body text-sm text-foreground/80 leading-relaxed">{r.body}</p>
                            </div>
                        ))}
                    </div>
                )}
                {reviewPages > 1 && (
                    <div className="flex justify-center items-center gap-6 mt-4 font-body">
                        <button className="text-sm font-medium text-primary bg-card px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 hover:bg-muted transition-colors border-none cursor-pointer" disabled={reviewPage <= 1} onClick={() => setReviewPage(p => p - 1)}>← Previous</button>
                        <span className="text-sm text-muted-foreground">Page {reviewPage} of {reviewPages}</span>
                        <button className="text-sm font-medium text-primary bg-card px-4 py-2 rounded-lg shadow-sm disabled:opacity-40 hover:bg-muted transition-colors border-none cursor-pointer" disabled={reviewPage >= reviewPages} onClick={() => setReviewPage(p => p + 1)}>Next →</button>
                    </div>
                )}
            </section>
        </div>
    )
}
