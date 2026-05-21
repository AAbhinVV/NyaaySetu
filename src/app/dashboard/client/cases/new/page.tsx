"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function NewCaseRedirect() {
    const router = useRouter()

    useEffect(() => {
        router.replace("/dashboard/client/lawyers")
    }, [router])

    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <p className="font-body text-sm text-muted-foreground">Redirecting to lawyer directory…</p>
        </div>
    )
}
