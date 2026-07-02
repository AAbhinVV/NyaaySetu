"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"

export default function LawyerDocumentsPage() {
    const [selectedCase, setSelectedCase] = useState<string>("")
    const [expandedDoc, setExpandedDoc] = useState<string | null>(null)

    const cases = trpc.case.getAllCases.useQuery({ page: 1, limit: 50 })
    const caseId = selectedCase || (cases.data?.cases?.[0]?.id ?? "")
    const docs = trpc.document.getCaseDocuments.useQuery({ caseId }, { enabled: !!caseId })
    const accessLog = trpc.document.getAccessLog.useQuery({ documentId: expandedDoc ?? "" }, { enabled: !!expandedDoc })

    return (
        <div className="max-w-[960px]">
            {/* Header */}
            <div className="flex max-md:flex-col justify-between items-start gap-4 mb-6">
                <div>
                    <h1 className="font-serif-heading text-[2rem] font-semibold text-primary tracking-tight">Document Vault</h1>
                    <p className="font-body text-sm text-muted-foreground mt-1">Manage case documents • Blockchain verified</p>
                </div>
                <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span className="font-body text-xs font-medium text-emerald">End-to-End Secured</span>
                </div>
            </div>

            {/* Case Selector */}
            <div className="mb-6">
                <label className="font-body text-[0.6875rem] text-muted-foreground/60 uppercase tracking-wider block mb-1.5">Filter by Case</label>
                <select value={selectedCase} onChange={e => setSelectedCase(e.target.value)}
                    className="font-body text-sm text-foreground bg-card rounded-lg px-4 py-2.5 min-w-[280px] outline-none shadow-lawyer focus:ring-1 focus:ring-gold cursor-pointer border-none">
                    <option value="">All Cases</option>
                    {(cases.data?.cases ?? []).map((c: any) => (
                        <option key={c.id} value={c.id}>{c.title || c.e_token} — {c.users?.full_name ?? "Client"}</option>
                    ))}
                </select>
            </div>

            {/* Documents Grid */}
            {docs.isLoading ? (
                <div className="font-body text-sm text-muted-foreground p-12 text-center bg-card rounded-xl">Loading documents…</div>
            ) : !caseId ? (
                <div className="text-center py-16 px-8 bg-card rounded-xl shadow-lawyer">
                    <div className="w-14 h-14 bg-primary/[0.06] rounded-xl flex items-center justify-center mx-auto mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg>
                    </div>
                    <p className="font-body text-base font-semibold text-foreground">No active cases</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">Accept a connection request to start managing documents.</p>
                </div>
            ) : (docs.data ?? []).length === 0 ? (
                <div className="text-center py-16 px-8 bg-card rounded-xl shadow-lawyer">
                    <div className="w-14 h-14 bg-primary/[0.06] rounded-xl flex items-center justify-center mx-auto mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg>
                    </div>
                    <p className="font-body text-base font-semibold text-foreground">No documents uploaded</p>
                    <p className="font-body text-sm text-muted-foreground mt-1">Upload documents from the case detail page.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 max-md:grid-cols-1 gap-4">
                    {(docs.data ?? []).map((d: any) => (
                        <div key={d.id} className="bg-card rounded-xl shadow-lawyer hover:shadow-lg transition-shadow">
                            <div className="p-5">
                                {/* File header */}
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="w-11 h-11 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-body text-[0.9375rem] font-semibold text-foreground truncate">{d.file_name}</h3>
                                        <p className="font-body text-xs text-muted-foreground mt-0.5">
                                            Uploaded by {d.users?.full_name ?? "—"} • {new Date(d.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                                        </p>
                                    </div>
                                </div>

                                {/* Blockchain Badge */}
                                {d.chain_tx_id && (
                                    <div className="bg-emerald/[0.06] rounded-lg px-3 py-2 mb-3">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2E7D5E" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                                            <span className="font-body text-xs font-semibold text-emerald">Blockchain Verified</span>
                                        </div>
                                        <p className="font-mono text-[0.5625rem] text-muted-foreground truncate">TX: {d.chain_tx_id}</p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setExpandedDoc(expandedDoc === d.id ? null : d.id)}
                                        className="font-body text-xs font-medium text-primary px-3 py-1.5 rounded-md bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer border-none">
                                        {expandedDoc === d.id ? "Hide Log" : "Access Log"}
                                    </button>
                                    <a href={`/api/documents/${d.id}/download`} target="_blank" rel="noopener noreferrer"
                                        className="font-body text-xs font-medium text-gold px-3 py-1.5 rounded-md bg-gold/[0.06] hover:bg-gold/10 transition-colors">Download</a>
                                </div>
                            </div>

                            {/* Access Log Expanded */}
                            {expandedDoc === d.id && (
                                <div className="px-5 pb-5">
                                    <div className="bg-muted rounded-lg px-4 py-3">
                                        <p className="font-body text-[0.6875rem] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Access History</p>
                                        {accessLog.isLoading ? (
                                            <p className="font-body text-xs text-muted-foreground">Loading…</p>
                                        ) : (accessLog.data ?? []).length === 0 ? (
                                            <p className="font-body text-xs text-muted-foreground">No access logged yet.</p>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                {(accessLog.data ?? []).map((log: any) => (
                                                    <div key={log.id || log.accessed_at} className="flex justify-between items-baseline">
                                                        <span className="font-body text-xs text-foreground">{log.users?.full_name ?? "Unknown"}</span>
                                                        <span className="font-body text-[0.625rem] text-muted-foreground/60">{new Date(log.accessed_at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
