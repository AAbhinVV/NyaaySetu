"use client"

import { useState } from "react"
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
    const [tab, setTab] = useState<"timeline" | "messages" | "documents">("timeline")
    const [newMsg, setNewMsg] = useState("")

    const detail = trpc.client.getCaseById.useQuery({ caseId })
    const messages = trpc.client.getCaseMessages.useQuery({ caseId })
    const docs = trpc.document.getCaseDocuments.useQuery({ caseId })
    const sendMsg = trpc.client.sendMessage.useMutation({ onSuccess: () => { setNewMsg(""); messages.refetch() } })
    const utils = trpc.useUtils()

    const c = detail.data
    if (detail.isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Loading case details…</p></div>
    if (!c) return <div className="flex items-center justify-center min-h-[50vh]"><p className="font-body text-sm text-muted-foreground">Case not found.</p></div>

    const tabBtn = (t: typeof tab, label: string) => (
        <button onClick={() => setTab(t)} className={`font-body text-sm font-medium px-4 py-2 rounded-lg transition-all border-none cursor-pointer ${tab === t ? "bg-primary text-white shadow-lawyer" : "bg-transparent text-muted-foreground hover:bg-muted"}`}>{label}</button>
    )

    return (
        <div className="max-w-[960px]">
            {/* Breadcrumb */}
            <div className="font-body text-sm text-muted-foreground mb-4">
                <Link href="/client/cases" className="text-primary hover:underline">My Cases</Link>
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
                    <p className="font-body text-sm text-muted-foreground mt-1">{c.category || "General"} • E-Token: {c.e_token}</p>
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
            <div className="flex gap-2 mb-6">
                {tabBtn("timeline", "Timeline")}
                {tabBtn("messages", `Messages (${messages.data?.length ?? 0})`)}
                {tabBtn("documents", `Documents (${docs.data?.length ?? 0})`)}
            </div>

            {/* Tab: Timeline */}
            {tab === "timeline" && (
                <section className="bg-card rounded-xl shadow-lawyer p-6">
                    <h2 className="font-serif-heading text-lg font-semibold text-primary mb-5">Case Timeline</h2>
                    {(c.timeline && c.timeline.length > 0) ? (
                        <div className="relative pl-6">
                            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-muted"/>
                            {c.timeline.map((ev: any, i: number) => (
                                <div key={i} className="relative flex items-start gap-4 py-3">
                                    <div className="absolute left-[-17px] top-4 w-[7px] h-[7px] rounded-full bg-primary ring-[3px] ring-card"/>
                                    <div>
                                        <p className="font-body text-sm font-semibold text-foreground">{ev.event}</p>
                                        <p className="font-body text-xs text-muted-foreground mt-0.5">{new Date(ev.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</p>
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
                        {(messages.data ?? []).length === 0 ? (
                            <p className="font-body text-sm text-muted-foreground text-center py-8">No messages yet. Start the conversation.</p>
                        ) : (
                            (messages.data ?? []).map((m: any) => {
                                const isOwn = m.sender_role === "CLIENT"
                                return (
                                    <div key={m.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                                        <div className={`max-w-[70%] px-4 py-2.5 rounded-xl text-sm ${isOwn ? "bg-primary text-white rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                                            <p>{m.body}</p>
                                            <p className={`text-[0.625rem] mt-1 ${isOwn ? "text-white/50" : "text-muted-foreground/60"}`}>{new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                    <div className="px-6 py-4 bg-muted flex gap-3">
                        <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="Type your message…"
                            className="flex-1 bg-card rounded-lg px-4 py-2.5 font-body text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-gold"
                            onKeyDown={e => { if (e.key === "Enter" && newMsg.trim()) sendMsg.mutate({ caseId, body: newMsg.trim() }) }}/>
                        <button disabled={!newMsg.trim() || sendMsg.isPending}
                            onClick={() => sendMsg.mutate({ caseId, body: newMsg.trim() })}
                            className="px-5 py-2.5 rounded-lg bg-primary-gradient text-white text-sm font-medium disabled:opacity-50 cursor-pointer hover:shadow-lg transition-shadow">Send</button>
                    </div>
                </section>
            )}

            {/* Tab: Documents */}
            {tab === "documents" && (
                <section className="bg-card rounded-xl shadow-lawyer p-6">
                    <h2 className="font-serif-heading text-lg font-semibold text-primary mb-5">Case Documents</h2>
                    {(docs.data ?? []).length === 0 ? (
                        <p className="font-body text-sm text-muted-foreground">No documents uploaded yet.</p>
                    ) : (
                        <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                            {(docs.data ?? []).map((d: any) => (
                                <div key={d.id} className="flex items-start gap-3 p-4 rounded-lg bg-muted">
                                    <div className="w-10 h-10 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-body text-sm font-semibold text-foreground truncate">{d.file_name}</p>
                                        <p className="font-body text-xs text-muted-foreground mt-0.5">{d.document_type} • {new Date(d.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</p>
                                        {d.blockchain_hash && (
                                            <div className="flex items-center gap-1 mt-1.5">
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                                                <span className="font-body text-[0.625rem] text-emerald font-medium">Blockchain Verified</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    )
}
