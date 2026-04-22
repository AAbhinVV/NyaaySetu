import { Cormorant_Garamond, DM_Sans } from "next/font/google"

/** Headings — authoritative, legal feel */
export const cormorantGaramond = Cormorant_Garamond({
    weight: ["600", "700"],
    subsets: ["latin", "latin-ext"],
    variable: "--font-heading",
    display: "swap",
})

/** Body — clean, readable */
export const dmSans = DM_Sans({
    weight: ["400", "500", "600", "700"],
    subsets: ["latin", "latin-ext"],
    variable: "--font-body",
    display: "swap",
})