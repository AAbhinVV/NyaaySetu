import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { TRPCProvider } from "@/lib/trpc/provider";
import { cormorantGaramond, inter, dmSans } from "@/lib/font";
import "./globals.css";

export const metadata: Metadata = {
    title: "NyaaySetu — Connect with Verified Lawyers in India",
    description:
        "Find manually reviewed lawyer profiles, manage cases digitally, and secure documents with blockchain-backed verification.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <ClerkProvider
            publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_placeholder"}
            afterSignOutUrl="/sign-in"
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
        >
            <html lang="en">
                <body
                    suppressHydrationWarning
                    className={`${cormorantGaramond.variable} ${inter.variable} ${dmSans.variable} font-body antialiased`}
                >
                    <TRPCProvider>
                        {children}
                    </TRPCProvider>
                    <Analytics />
                </body>
            </html>
        </ClerkProvider>
    );
}
