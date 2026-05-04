import { Cormorant_Garamond, DM_Sans, Inter } from "next/font/google"

/** Headings — "Voice of Authority" (serif) */
export const cormorantGaramond = Cormorant_Garamond({
    weight: ["600", "700"],
    subsets: ["latin", "latin-ext"],
    variable: "--font-heading",
    display: "swap",
})

/** Body primary — "Voice of Reason" (Inter per Sovereign Legal DS) */
export const inter = Inter({
    weight: ["400", "500", "600", "700"],
    subsets: ["latin", "latin-ext"],
    variable: "--font-inter",
    display: "swap",
})

/** Body fallback — DM Sans */
export const dmSans = DM_Sans({
    weight: ["400", "500", "600", "700"],
    subsets: ["latin", "latin-ext"],
    variable: "--font-body",
    display: "swap",
})