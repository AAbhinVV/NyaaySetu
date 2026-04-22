import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { cormorantGaramond, dmSans } from "@/lib/font";
import "./globals.css";

export const metadata: Metadata = {
    title: "NyaaySetu — Connect with Verified Lawyers in India",
    description:
        "Find verified lawyers, manage cases digitally, and secure documents with blockchain. Transparent fees, real reviews, real justice.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <ClerkProvider
            afterSignOutUrl="/sign-in"
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
        >
            <html lang="en">
                <body
                    className={`${cormorantGaramond.variable} ${dmSans.variable} font-body antialiased`}
                >
                    {children}
                    <Analytics />
                </body>
            </html>
        </ClerkProvider>
    );
}
