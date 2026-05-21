"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=EB+Garamond:wght@400;500&display=swap');

        .nyaya-root {
          min-height: 100vh;
          background-color: #f5f0e8;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: 'EB Garamond', serif;
          position: relative;
          overflow: hidden;
          padding: 2rem 1rem;
        }

        /* Subtle background pattern */
        .nyaya-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            radial-gradient(circle at 20% 20%, rgba(26, 35, 79, 0.04) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(26, 35, 79, 0.04) 0%, transparent 50%);
          pointer-events: none;
        }

        /* Decorative corner border */
        .nyaya-root::after {
          content: '';
          position: fixed;
          inset: 16px;
          border: 1px solid rgba(26, 35, 79, 0.15);
          pointer-events: none;
          z-index: 0;
        }

        .nyaya-header {
          text-align: center;
          margin-bottom: 2rem;
          z-index: 1;
          animation: fadeUp 0.6s ease both;
        }

        .nyaya-logo {
          font-family: 'Playfair Display', serif;
          font-size: 1.75rem;
          font-weight: 600;
          color: #1a234f;
          letter-spacing: 0.02em;
          margin: 0 0 0.25rem;
        }

        .nyaya-tagline {
          font-family: 'Cormorant Garamond', serif;
          font-size: 0.65rem;
          font-weight: 300;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #1a234f;
          opacity: 0.65;
          margin: 0;
        }

        .nyaya-card {
          background: #ffffff;
          border-radius: 4px;
          padding: 2.5rem 2rem;
          width: 100%;
          max-width: 460px;
          box-shadow:
            0 1px 3px rgba(26, 35, 79, 0.06),
            0 8px 32px rgba(26, 35, 79, 0.08);
          z-index: 1;
          animation: fadeUp 0.6s ease 0.1s both;
        }

        .nyaya-card-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.6rem;
          font-style: italic;
          font-weight: 400;
          color: #1a234f;
          text-align: center;
          margin: 0 0 1.75rem;
        }

        /* Clerk component overrides */
        .nyaya-card .cl-rootBox {
          width: 100%;
        }

        .nyaya-card .cl-card {
          box-shadow: none !important;
          padding: 0 !important;
          background: transparent !important;
          border: none !important;
        }

        .nyaya-card .cl-headerTitle,
        .nyaya-card .cl-headerSubtitle {
          display: none !important;
        }

        .nyaya-card .cl-socialButtonsBlockButton {
          border: 1px solid #d6d0c4 !important;
          border-radius: 3px !important;
          background: #faf8f4 !important;
          color: #1a234f !important;
          font-family: 'EB Garamond', serif !important;
          font-size: 0.95rem !important;
          height: 44px !important;
          transition: all 0.2s ease !important;
        }

        .nyaya-card .cl-socialButtonsBlockButton:hover {
          background: #f0ece3 !important;
          border-color: #1a234f !important;
        }

        .nyaya-card .cl-dividerText {
          font-family: 'Cormorant Garamond', serif !important;
          font-size: 0.8rem !important;
          letter-spacing: 0.1em !important;
          color: #9a9080 !important;
        }

        .nyaya-card .cl-dividerLine {
          background: #e4dfd5 !important;
        }

        .nyaya-card .cl-formFieldLabel {
          font-family: 'EB Garamond', serif !important;
          font-size: 0.7rem !important;
          font-weight: 400 !important;
          letter-spacing: 0.15em !important;
          text-transform: uppercase !important;
          color: #1a234f !important;
          opacity: 0.75 !important;
        }

        .nyaya-card .cl-formFieldInput {
          border: 1px solid #d6d0c4 !important;
          border-radius: 3px !important;
          background: #faf8f4 !important;
          font-family: 'EB Garamond', serif !important;
          font-size: 1rem !important;
          color: #1a234f !important;
          height: 44px !important;
          padding: 0 12px !important;
          transition: border-color 0.2s ease !important;
        }

        .nyaya-card .cl-formFieldInput:focus {
          border-color: #1a234f !important;
          outline: none !important;
          box-shadow: 0 0 0 2px rgba(26, 35, 79, 0.08) !important;
        }

        .nyaya-card .cl-formButtonPrimary {
          background: #1a234f !important;
          border-radius: 3px !important;
          font-family: 'EB Garamond', serif !important;
          font-size: 1rem !important;
          font-weight: 400 !important;
          letter-spacing: 0.08em !important;
          height: 48px !important;
          transition: background 0.2s ease !important;
          box-shadow: none !important;
        }

        .nyaya-card .cl-formButtonPrimary:hover {
          background: #111830 !important;
        }

        .nyaya-card .cl-footerActionText {
          font-family: 'EB Garamond', serif !important;
          font-size: 0.9rem !important;
          color: #6b6355 !important;
        }

        .nyaya-card .cl-footerActionLink {
          font-family: 'EB Garamond', serif !important;
          font-size: 0.9rem !important;
          font-weight: 500 !important;
          color: #1a234f !important;
          text-decoration: underline !important;
          text-underline-offset: 2px !important;
        }

        .nyaya-card .cl-identityPreviewText,
        .nyaya-card .cl-identityPreviewEditButton {
          font-family: 'EB Garamond', serif !important;
        }

        .nyaya-card .cl-otpCodeField input {
          border: 1px solid #d6d0c4 !important;
          border-radius: 3px !important;
          background: #faf8f4 !important;
          font-family: 'EB Garamond', serif !important;
          font-size: 1.2rem !important;
          color: #1a234f !important;
          width: 44px !important;
          height: 52px !important;
        }

        .nyaya-card .cl-otpCodeField input:focus {
          border-color: #1a234f !important;
          box-shadow: 0 0 0 2px rgba(26, 35, 79, 0.08) !important;
        }

        /* Internal Clerk branding */
        .nyaya-card .cl-internal-b3fm6y,
        .nyaya-card [class*="cl-branded"],
        .nyaya-card .cl-footer {
          font-family: 'EB Garamond', serif !important;
        }

        .nyaya-footer {
          z-index: 1;
          margin-top: 2rem;
          text-align: center;
          animation: fadeUp 0.6s ease 0.2s both;
        }

        .nyaya-badges {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1.5rem;
          margin-bottom: 1rem;
        }

        .nyaya-badge {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-family: 'Cormorant Garamond', serif;
          font-size: 0.65rem;
          font-weight: 300;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #1a234f;
          opacity: 0.55;
        }

        .nyaya-badge svg {
          opacity: 0.7;
        }

        .nyaya-copyright {
          font-family: 'Cormorant Garamond', serif;
          font-size: 0.6rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1a234f;
          opacity: 0.35;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="nyaya-root">
        {/* Header */}
        <header className="nyaya-header">
          <h1 className="nyaya-logo">Nyaya Setu</h1>
          <p className="nyaya-tagline">Preserving the Digital Jurist</p>
        </header>

        {/* Card */}
        <div className="nyaya-card">
          <h2 className="nyaya-card-title">Welcome Back</h2>

          <SignIn
            appearance={{
              variables: {
                colorPrimary: "#1a234f",
                colorBackground: "transparent",
                colorInputBackground: "#faf8f4",
                colorInputText: "#1a234f",
                colorText: "#1a234f",
                colorTextSecondary: "#6b6355",
                fontFamily: "'EB Garamond', serif",
                borderRadius: "3px",
              },
              elements: {
                card: "nyaya-clerk-card",
                rootBox: { width: "100%" },
              },
            }}
          />
        </div>

        {/* Footer */}
        <footer className="nyaya-footer">
          <div className="nyaya-badges">
            <span className="nyaya-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Blockchain Secured
            </span>
            <span className="nyaya-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Privacy Protected
            </span>
          </div>
          <p className="nyaya-copyright">
            © 2024 Nyaya Setu. Preserving the Digital Jurist. All rights reserved.
          </p>
        </footer>
      </div>
    </>
  );
}