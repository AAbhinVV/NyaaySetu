import { NextResponse } from "next/server"

export async function POST() {
    return NextResponse.json({ message: "Upload completion endpoint coming soon" }, { status: 501 })
}
