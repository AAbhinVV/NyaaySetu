/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-heading)", "Cormorant Garamond", "serif"],
        body: ["var(--font-body)", "DM Sans", "sans-serif"],
      },
      colors: {
        // Brand — Deep navy + warm gold (prestigious law firm feel)
        primary: {
          DEFAULT: "#1B2A4A",
          hover: "#243760",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "#C9A84C",
          hover: "#B8953F",
          foreground: "#1B2A4A",
        },

        // Surfaces
        background: "#F8F6F1",     // warm ivory
        surface: "#FFFFFF",

        // Text
        text: {
          DEFAULT: "#1C1C2E",
          secondary: "#4A5568",
          muted: "#718096",
        },

        // Borders
        border: "#E2E0D9",

        // Status
        success: "#2E7D5E",         // muted emerald (verified)
        warning: "#D4A017",
        error: "#C53030",
        info: "#2B6CB0",

        // Gradient endpoints
        gradient: {
          from: "#1B2A4A",          // navy
          to: "#2D3F6B",            // slate blue
        },
      },
      borderRadius: {
        card: "0.75rem",            // 12px — cards
        button: "0.5rem",           // 8px — buttons
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)",
        "card-hover": "0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.06)",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [],
};

export default config;
