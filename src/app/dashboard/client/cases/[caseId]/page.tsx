"use client"

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"

function statusLabel(s: string) {
    const m: Record<string, string> = { IN_PROGRESS: "In Progress", HEARING_SET: "Hearing Scheduled", VERDICT: "Verdict", CLOSED: "Closed" }
    return m[s] ?? s
}
function statusPill(s: string) {
    return s === "HEARING_SET" ? "bg-gold/12 text-[#96790C]" : s === "IN_PROGRESS" ? "bg-emerald/10 text-[#226B4B]" : "bg-primary/[0.08] text-primary"
}

export default function CaseDetailPage() {
    const { caseId } = useParams<{ caseId: string }>()
    const [tab, setTab] = useState<"timeline" | "messages" | "documents" | "review">("timeline")
    const [newMsg, setNewMsg] = useState("")
    const [reviewRating, setReviewRating] = useState(0)
    const [reviewOutcome, setReviewOutcome] = useState<"WON" | "LOST" | "SETTLED">("WON")
    const [reviewBody, setReviewBody] = useState("")
    const [reviewHover, setReviewHover] = useState(0)

    const detail = trpc.client.getCaseById.useQuery({ caseId })
    const timeline = trpc.client.getCaseTimeline.useQuery({ caseId })
    const messages = trpc.client.getCaseMessages.useQuery({ caseId, page: 1, limit: 30 })
    const docs = trpc.document.getCaseDocuments.useQuery({ caseId })
    const sendMsg = trpc.client.sendMessage.useMutation({ onSuccess: () => { setNewMsg(""); messages.refetch() } })
    const submitReview = trpc.review.submitReview.useMutation({
        onSuccess: () => { setReviewRating(0); setReviewBody(""); detail.refetch() },
    })

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState("")
    const [documentConsent, setDocumentConsent] = useState(false)

    const c = detail.data
    const msgList = messages.data?.messages ?? []
    const timelineEvents = timeline.data ?? []
    const docList = docs.data ?? []

    const handleUpload = async (file: File) => {
        if (!documentConsent) {
            setUploadError("Please confirm the document upload consent before uploading")
            if (fileInputRef.current) fileInputRef.current.value = ""
            return
        }
        setUploading(true)
        setUploadError("")
        try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("caseId", caseId)
            const res = await fetch("/api/upload/complete", { method: "POST", body: formData })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Upload failed")
            docs.refetch()
        } catch (err: any) {
            setUploadError(err.message || "Upload failed")
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    if (detail.isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Loading case details…</p></div>
    if (!c) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Case not found.</p></div>

    const tabBtn = (t: typeof tab, label: string) => (
        <button onClick={() => setTab(t)} className={`font-body text-sm font-medium px-4 py-2 rounded-lg transition-all border-none cursor-pointer ${tab === t ? "bg-primary text-white shadow-lawyer" : "bg-transparent text-muted-foreground hover:bg-muted"}`}>{label}</button>
    )

    return (
        <div className="max-w-[960px]">
            {/* Breadcrumb */}
            <div className="font-body text-sm text-muted-foreground mb-4">
                <Link href="/dashboard/client/cases" className="text-primary hover:underline">My Cases</Link>
                <span className="mx-2 text-muted-foreground/40">/</span>
                <span>{c.title || "Untitled"}</span>
            </div>

            {/* Header */}
            <header className="flex max-md:flex-col justify-between items-start gap-4 mb-8 bg-card rounded-xl p-6 shadow-lawyer">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="font-serif-heading text-2xl font-semibold text-primary tracking-tight">{c.title || "Untitled Case"}</h1>
                        <span className={`font-body text-[0.6875rem] font-semibold px-2.5 py-0.5 rounded-md ${statusPill(c.status)}`}>{statusLabel(c.status)}</span>
                    </div>
                    <p className="font-body text-sm text-muted-foreground mt-1">{c.category || "General"} • E-Token: {c.e_tokens?.token || c.e_token || "—"}</p>
                    {c.description && <p className="font-body text-sm text-foreground/80 mt-3 leading-relaxed">{c.description}</p>}
                </div>
                <div className="flex gap-6 shrink-0">
                    <div>
                        <p className="font-body text-[0.625rem] text-muted-foreground/60 uppercase tracking-wider">Counsel</p>
                        <p className="font-body text-sm font-semibold text-foreground mt-px">{c.lawyers?.full_name ?? "Unassigned"}</p>
                    </div>
                    {c.next_hearing_at && (
                        <div>
                            <p className="font-body text-[0.625rem] text-muted-foreground/60 uppercase tracking-wider">Next Hearing</p>
                            <p className="font-body text-sm font-semibold text-foreground mt-px">{new Date(c.next_hearing_at).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}</p>
                        </div>
                    )}
                    <div>
                        <p className="font-body text-[0.625rem] text-muted-foreground/60 uppercase tracking-wider">Jurisdiction</p>
                        <p className="font-body text-sm font-semibold text-foreground mt-px">{c.court_name || c.jurisdiction || "—"}</p>
                    </div>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {tabBtn("timeline", "Timeline")}
                {tabBtn("messages", `Messages (${messages.data?.total ?? 0})`)}
                {tabBtn("documents", `Documents (${docList.length})`)}
                {c.status === "CLOSED" && tabBtn("review", "Leave Review")}
            </div>

            {/* Tab: Timeline */}
            {tab === "timeline" && (
                <section className="bg-card rounded-xl shadow-lawyer p-6">
                    <h2 className="font-serif-heading text-lg font-semibold text-primary mb-5">Case Timeline</h2>
                    {timelineEvents.length > 0 ? (
                        <div className="relative pl-6">
                            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-muted"/>
                            {timelineEvents.map((ev: any, i: number) => (
                                <div key={i} className="relative flex items-start gap-4 py-3">
                                    <div className="absolute left-[-17px] top-4 w-[7px] h-[7px] rounded-full bg-primary ring-[3px] ring-card"/>
                                    <div>
                                        <p className="font-body text-sm font-semibold text-foreground">{ev.event || ev.title}</p>
                                        <p className="font-body text-xs text-muted-foreground mt-0.5">{new Date(ev.created_at || ev.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</p>
                                        {ev.description && <p className="font-body text-xs text-foreground/70 mt-1">{ev.description}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="font-body text-sm text-muted-foreground">No timeline events yet.</p>
                    )}
                </section>
            )}

            {/* Tab: Messages */}
            {tab === "messages" && (
                <section className="bg-card rounded-xl shadow-lawyer flex flex-col max-h-[600px]">
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
                        {msgList.length === 0 ? (
                            <p className="font-body text-sm text-muted-foreground text-center py-8">No messages yet. Start the conversation.</p>
                        ) : (
                            msgList.map((m: any) => {
                                const isOwn = m.sender_id === detail.data?.client_id
                                return (
                                    <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[70%] px-4 py-2.5 rounded-xl text-sm ${isOwn ? "bg-primary text-white rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                                            <p>{m.content}</p>
                                            <p className={`text-[0.625rem] mt-1 ${isOwn ? "text-white/50" : "text-muted-foreground/60"}`}>{new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                    {c.status !== "CLOSED" && (
                        <div className="px-6 py-4 bg-muted flex gap-3">
                            <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type your message…"
                                className="flex-1 bg-card rounded-lg px-4 py-2.5 font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-gold"
                                onKeyDown={e => { if (e.key === "Enter" && newMsg.trim()) sendMsg.mutate({ caseId, body: newMsg.trim() }) }}/>
                            <button disabled={!newMsg.trim() || sendMsg.isPending}
                                onClick={() => sendMsg.mutate({ caseId, body: newMsg.trim() })}
                                className="px-5 py-2.5 rounded-lg bg-primary-gradient text-white text-sm font-medium disabled:opacity-50 cursor-pointer hover:shadow-lg transition-shadow">Send</button>
                        </div>
                    )}
                </section>
            )}

            {/* Tab: Documents */}
            {tab === "documents" && (
                <section className="bg-card rounded-xl shadow-lawyer p-6">
                    <div className="flex justify-between items-center mb-5">
                        <h2 className="font-serif-heading text-lg font-semibold text-primary">Case Documents</h2>
                        {c.status !== "CLOSED" && (
                            <div className="flex flex-col items-end gap-2 max-w-[420px]">
                                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
                                <label className="flex items-start gap-2 font-body text-xs text-muted-foreground leading-relaxed text-left">
                                    <input type="checkbox" checked={documentConsent} onChange={(e) => setDocumentConsent(e.target.checked)} className="mt-0.5" />
                                    <span>I have the right to upload this file and consent to secure storage, hashing, and blockchain anchoring. See <Link href="/document-retention-policy" className="text-primary underline">retention policy</Link>.</span>
                                </label>
                                <button onClick={() => fileInputRef.current?.click()} disabled={uploading || !documentConsent}
                                    className="font-body text-sm font-medium px-4 py-2 rounded-lg bg-primary-gradient text-white hover:shadow-lg transition-shadow border-none cursor-pointer disabled:opacity-50 flex items-center gap-2">
                                    {uploading ? (
                                        <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
                                    ) : (
                                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload Document</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                    {uploadError && (
                        <div className="mb-4 px-4 py-2.5 rounded-lg bg-destructive/10 text-destructive font-body text-sm">{uploadError}</div>
                    )}
                    {docList.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="w-14 h-14 bg-primary/[0.06] rounded-xl flex items-center justify-center mx-auto mb-3">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg>
                            </div>
                            <p className="font-body text-sm text-muted-foreground">No documents uploaded yet.</p>
                            {c.status !== "CLOSED" && (
                                <p className="font-body text-xs text-muted-foreground/60 mt-1">Click &quot;Upload Document&quot; to add case evidence.</p>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                            {docList.map((d: any) => (
                                <div key={d.id} className="flex items-start gap-3 p-4 rounded-lg bg-muted">
                                    <div className="w-10 h-10 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-body text-sm font-semibold text-foreground truncate">{d.file_name}</p>
                                        <p className="font-body text-xs text-muted-foreground mt-0.5">Uploaded {new Date(d.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</p>
                                        {d.chain_tx_id && (
                                            <div className="flex items-center gap-1 mt-1.5">
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                                                <span className="font-body text-[0.625rem] text-emerald font-medium">Blockchain Verified</span>
                                            </div>
                                        )}
                                        <a href={`/api/documents/${d.id}/download`} target="_blank" rel="noopener noreferrer" className="font-body text-[0.625rem] text-primary hover:underline mt-1 inline-block">Download ↓</a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Tab: Review */}
            {tab === "review" && c.status === "CLOSED" && (
                <section className="bg-card rounded-xl shadow-lawyer p-6">
                    <h2 className="font-serif-heading text-lg font-semibold text-primary mb-5">Review Your Lawyer</h2>
                    {submitReview.isSuccess ? (
                        <div className="text-center py-10">
                            <div className="w-14 h-14 bg-emerald/10 rounded-xl flex items-center justify-center mx-auto mb-3 text-2xl">✅</div>
                            <p className="font-body text-base font-semibold text-foreground">Thank you for your review!</p>
                            <p className="font-body text-sm text-muted-foreground mt-1">Your feedback helps other clients make informed decisions.</p>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Star Rating */}
                            <div>
                                <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-2">Rating</label>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <button key={n} type="button"
                                            onMouseEnter={() => setReviewHover(n)}
                                            onMouseLeave={() => setReviewHover(0)}
                                            onClick={() => setReviewRating(n)}
                                            className="border-none bg-transparent cursor-pointer p-0.5 transition-transform hover:scale-110">
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill={(reviewHover || reviewRating) >= n ? "#C9A84C" : "none"} stroke="#C9A84C" strokeWidth="1.5">
                                                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                                            </svg>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Outcome */}
                            <div>
                                <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1">Case Outcome</label>
                                <select value={reviewOutcome} onChange={e => setReviewOutcome(e.target.value as any)}
                                    className="font-body text-sm text-foreground bg-muted rounded-lg px-4 py-2.5 outline-none border-none cursor-pointer focus:ring-1 focus:ring-gold">
                                    <option value="WON">Won</option>
                                    <option value="LOST">Lost</option>
                                    <option value="SETTLED">Settled</option>
                                </select>
                            </div>

                            {/* Body */}
                            <div>
                                <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1">Your Review</label>
                                <textarea value={reviewBody} onChange={e => setReviewBody(e.target.value)} rows={4} maxLength={1000}
                                    placeholder="Share your experience with this lawyer…"
                                    className="w-full bg-muted rounded-lg px-4 py-2.5 font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-gold resize-none border-none" />
                                <p className="font-body text-[0.625rem] text-muted-foreground/50 text-right mt-1">{reviewBody.length}/1000</p>
                            </div>

                            {submitReview.error && (
                                <div className="px-4 py-2.5 rounded-lg bg-destructive/10 text-destructive font-body text-sm">{submitReview.error.message}</div>
                            )}

                            <button
                                onClick={() => submitReview.mutate({ caseId, rating: reviewRating, outcome: reviewOutcome, body: reviewBody })}
                                disabled={submitReview.isPending || reviewRating === 0 || reviewBody.length < 10}
                                className="font-body text-sm font-medium px-6 py-2.5 rounded-lg bg-primary-gradient text-white hover:shadow-lg transition-shadow border-none cursor-pointer disabled:opacity-50">
                                {submitReview.isPending ? "Submitting…" : "Submit Review"}
                            </button>
                        </div>
                    )}
                </section>
            )}
        </div>
    )
}
