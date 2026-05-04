// ─── TOMBSTONE ────────────────────────────────────────────────────────────────
// This file previously handled Razorpay payment webhooks.
// Razorpay has been replaced by Stripe — see /api/webhooks/stripe/route.ts
// This directory is kept to avoid 404s on any lingering Razorpay webhook retries.
// Safe to delete after 2026-06-01.

import { NextResponse } from "next/server"

export async function POST() {
    return NextResponse.json(
        { error: "Razorpay webhooks are deprecated. Use Stripe." },
        { status: 410 } // HTTP 410 Gone
    )
}