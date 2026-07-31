"use client"

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { trpc } from "@/lib/trpc/client"
import { firstRelation } from '@/lib/utils'

const pillClass = (s: string) =>
    s === "IN_PROGRESS" ? "bg-primary/10 text-primary" : s === "HEARING_SET" ? "bg-gold/10 text-[#96790C]" :
    s === "VERDICT" ? "bg-emerald/10 text-emerald" : "bg-muted text-muted-foreground"
const statusLabel = (s: string) =>
    s === "IN_PROGRESS" ? "In Progress" : s === "HEARING_SET" ? "Hearing Set" : s === "VERDICT" ? "Verdict" : s === "CLOSED" ? "Closed" : s

export default function LawyerCaseDetailPage() {
    const { caseId } = useParams<{ caseId: string }>()
    const [tab, setTab] = useState<"timeline" | "messages" | "documents">("timeline")
    const [msg, setMsg] = useState("")
    const [showHearing, setShowHearing] = useState(false)
    const [hearingDate, setHearingDate] = useState("")
    const [courtName, setCourtName] = useState("")
    const [showVerdict, setShowVerdict] = useState(false)
    const [verdictOutcome, setVerdictOutcome] = useState<"WON" | "LOST" | "SETTLED">("WON")
    const [verdictSummary, setVerdictSummary] = useState("")

    const caseDetail = trpc.case.getCaseById.useQuery({ caseId })
    const timeline = trpc.case.getTimeline.useQuery({ caseId })
    const documents = trpc.document.getCaseDocuments.useQuery({ caseId })

    const sendMessage = trpc.case.sendMessage.useMutation({
        onSuccess: () => { setMsg(""); timeline.refetch() },
    })
    const updateStatus = trpc.case.updateStatus.useMutation({
        onSuccess: () => { caseDetail.refetch(); timeline.refetch() },
    })
    const addHearing = trpc.case.addHearingDate.useMutation({
        onSuccess: () => { caseDetail.refetch(); timeline.refetch(); setShowHearing(false); setHearingDate(""); setCourtName("") },
    })
    const recordVerdict = trpc.case.recordVerdict.useMutation({
        onSuccess: () => { caseDetail.refetch(); timeline.refetch(); setShowVerdict(false) },
    })

    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState("")
    const [documentConsent, setDocumentConsent] = useState(false)

    const c = caseDetail.data
    const isClosed = c?.status === "CLOSED"

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
            documents.refetch()
        } catch (err: unknown) {
            setUploadError(err instanceof Error ? err.message : "Upload failed")
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    if (caseDetail.isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Loading case…</p></div>
    if (!c) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Case not found.</p></div>

    return (
        <div className="max-w-[960px]">
            {/* Breadcrumb */}
            <div className="font-body text-sm text-muted-foreground mb-4">
                <Link href="/dashboard/lawyer/cases" className="text-primary hover:underline">Cases</Link>
                <span className="mx-2 text-muted-foreground/40">/</span><span>{c.title || c.e_token}</span>
            </div>

            {/* Header */}
            <header className="bg-card rounded-xl shadow-lawyer p-6 mb-6">
                <div className="flex max-md:flex-col justify-between gap-4 mb-4">
                    <div>
                        <h1 className="font-serif-heading text-2xl font-semibold text-primary tracking-tight">{c.title || "Untitled Case"}</h1>
                        <p className="font-body text-sm text-muted-foreground mt-0.5">
                            e-Token: {c.e_token} • {c.jurisdiction_city}, {c.jurisdiction_state}
                        </p>
                    </div>
                    <span className={`font-body text-[0.6875rem] font-semibold px-3 py-1.5 rounded-md self-start ${pillClass(c.status)}`}>{statusLabel(c.status)}</span>
                </div>
                {/* Client info */}
                <div className="flex items-center gap-3 px-4 py-3 bg-muted rounded-lg mb-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div>
                        <p className="font-body text-sm font-semibold text-foreground">{firstRelation(c.users)?.full_name ?? "Client"}</p>
                        <p className="font-body text-xs text-muted-foreground">{firstRelation(c.users)?.email} • {firstRelation(c.users)?.phone ?? "—"}</p>
                    </div>
                </div>
                {c.next_hearing_at && (
                    <div className="px-4 py-2.5 bg-gold/[0.06] rounded-lg mb-4">
                        <p className="font-body text-sm text-[#96790C]">
                            <span className="font-semibold">Next hearing:</span> {new Date(c.next_hearing_at).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                        </p>
                    </div>
                )}

                {/* Action buttons */}
                {!isClosed && (
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setShowHearing(true)} className="font-body text-[0.8125rem] font-medium px-4 py-2 rounded-lg bg-gold/10 text-[#96790C] hover:bg-gold/20 transition-colors border-none cursor-pointer">📅 Schedule Hearing</button>
                        <button onClick={() => setShowVerdict(true)} className="font-body text-[0.8125rem] font-medium px-4 py-2 rounded-lg bg-emerald/10 text-emerald hover:bg-emerald/20 transition-colors border-none cursor-pointer">⚖️ Record Verdict</button>
                        {c.status !== "IN_PROGRESS" && (
                            <button onClick={() => updateStatus.mutate({ caseId, status: "IN_PROGRESS" })} disabled={updateStatus.isPending}
                                className="font-body text-[0.8125rem] font-medium px-4 py-2 rounded-lg bg-primary/5 text-primary hover:bg-primary/10 transition-colors border-none cursor-pointer disabled:opacity-50">↩ Back to In Progress</button>
                        )}
                    </div>
                )}
            </header>

            {/* Hearing Modal */}
            {showHearing && (
                <div className="bg-card rounded-xl shadow-lawyer p-6 mb-6">
                    <h3 className="font-serif-heading text-lg font-semibold text-primary mb-4">Schedule Hearing</h3>
                    <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4 mb-4">
                        <div>
                            <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1">Court Name</label>
                            <input value={courtName} onChange={e => setCourtName(e.target.value)} placeholder="e.g. Delhi District Court"
                                className="w-full bg-muted rounded-lg px-4 py-2.5 font-body text-sm outline-none focus:ring-1 focus:ring-gold border-none" />
                        </div>
                        <div>
                            <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1">Date & Time</label>
                            <input type="datetime-local" value={hearingDate} onChange={e => setHearingDate(e.target.value)}
                                className="w-full bg-muted rounded-lg px-4 py-2.5 font-body text-sm outline-none focus:ring-1 focus:ring-gold border-none" />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => addHearing.mutate({ caseId, courtName, hearingDate: new Date(hearingDate).toISOString() })}
                            disabled={!courtName || !hearingDate || addHearing.isPending}
                            className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-primary-gradient text-white border-none cursor-pointer disabled:opacity-50">{addHearing.isPending ? "Scheduling…" : "Schedule"}</button>
                        <button onClick={() => setShowHearing(false)} className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-muted text-muted-foreground border-none cursor-pointer">Cancel</button>
                    </div>
                </div>
            )}

            {/* Verdict Modal */}
            {showVerdict && (
                <div className="bg-card rounded-xl shadow-lawyer p-6 mb-6">
                    <h3 className="font-serif-heading text-lg font-semibold text-primary mb-4">Record Verdict</h3>
                    <div className="mb-4">
                        <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1.5">Outcome</label>
                        <div className="flex gap-2">
                            {(["WON", "LOST", "SETTLED"] as const).map(o => (
                                <button key={o} onClick={() => setVerdictOutcome(o)}
                                    className={`font-body text-sm font-medium px-4 py-2 rounded-lg border-none cursor-pointer transition-all ${verdictOutcome === o ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>{o}</button>
                            ))}
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1">Summary (optional)</label>
                        <textarea value={verdictSummary} onChange={e => setVerdictSummary(e.target.value)} rows={3} maxLength={1000}
                            className="w-full bg-muted rounded-lg px-4 py-2.5 font-body text-sm outline-none focus:ring-1 focus:ring-gold resize-none border-none" />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => recordVerdict.mutate({ caseId, outcome: verdictOutcome, summary: verdictSummary || undefined })}
                            disabled={recordVerdict.isPending}
                            className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-primary-gradient text-white border-none cursor-pointer disabled:opacity-50">{recordVerdict.isPending ? "Recording…" : "Record Verdict"}</button>
                        <button onClick={() => setShowVerdict(false)} className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-muted text-muted-foreground border-none cursor-pointer">Cancel</button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-5 bg-card rounded-lg p-1 shadow-lawyer w-fit">
                {(["timeline", "messages", "documents"] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`font-body text-[0.8125rem] font-medium px-4 py-2 rounded-md border-none cursor-pointer capitalize transition-all ${tab === t ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>{t}</button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-card rounded-xl shadow-lawyer overflow-hidden">
                {tab === "timeline" && (
                    <div className="p-6">
                        {timeline.isLoading ? <p className="font-body text-sm text-muted-foreground">Loading…</p> :
                        (timeline.data ?? []).length === 0 ? <p className="font-body text-sm text-muted-foreground">No timeline events.</p> :
                        <div className="space-y-4">
                            {(timeline.data ?? []).map((e) => (
                                <div key={e.id} className="flex gap-3">
                                    <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />
                                    <div>
                                        <p className="font-body text-sm text-foreground">{e.description}</p>
                                        <p className="font-body text-[0.6875rem] text-muted-foreground/60 mt-0.5">{new Date(e.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                                    </div>
                                </div>
                            ))}
                        </div>}
                    </div>
                )}

                {tab === "messages" && (
                    <div className="p-6">
                        <p className="font-body text-sm text-muted-foreground mb-4">Secure case messaging</p>
                        {!isClosed && (
                            <form onSubmit={e => { e.preventDefault(); if (msg.trim()) sendMessage.mutate({ caseId, body: msg.trim() }) }} className="flex gap-2 mb-4">
                                <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Type a message…" maxLength={2000}
                                    className="flex-1 bg-muted rounded-lg px-4 py-2.5 font-body text-sm outline-none focus:ring-1 focus:ring-gold border-none" />
                                <button type="submit" disabled={!msg.trim() || sendMessage.isPending}
                                    className="font-body text-sm font-medium px-5 py-2.5 rounded-lg bg-primary-gradient text-white border-none cursor-pointer disabled:opacity-50">{sendMessage.isPending ? "…" : "Send"}</button>
                            </form>
                        )}
                        <p className="font-body text-xs text-muted-foreground/60">Messages appear in the timeline tab.</p>
                    </div>
                )}

                {tab === "documents" && (
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-serif-heading text-base font-semibold text-primary">Documents</h3>
                            {!isClosed && (
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
                                            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload</>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                        {uploadError && (
                            <div className="mb-4 px-4 py-2.5 rounded-lg bg-destructive/10 text-destructive font-body text-sm">{uploadError}</div>
                        )}
                        {documents.isLoading ? <p className="font-body text-sm text-muted-foreground">Loading…</p> :
                        (documents.data ?? []).length === 0 ? (
                            <div className="text-center py-8">
                                <p className="font-body text-sm text-muted-foreground">No documents uploaded.</p>
                                {!isClosed && <p className="font-body text-xs text-muted-foreground/60 mt-1">Upload case evidence using the button above.</p>}
                            </div>
                        ) :
                        <div className="space-y-3">
                            {(documents.data ?? []).map((d) => (
                                <div key={d.id} className="flex items-center gap-3 px-4 py-3 bg-muted rounded-lg">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-body text-sm font-medium text-foreground truncate">{d.file_name}</p>
                                        <p className="font-body text-[0.6875rem] text-muted-foreground/60">by {firstRelation(d.users)?.full_name ?? "—"} • {new Date(d.created_at).toLocaleDateString("en-IN")}</p>
                                    </div>
                                    {d.chain_tx_id && <span className="font-body text-[0.625rem] font-semibold px-2 py-0.5 rounded bg-emerald/10 text-emerald shrink-0">On-chain</span>}
                                    <a href={`/api/documents/${d.id}/download`} target="_blank" rel="noopener noreferrer" className="font-body text-[0.625rem] text-primary hover:underline shrink-0">↓</a>
                                </div>
                            ))}
                        </div>}
                    </div>
                )}
            </div>
        </div>
    )
}
