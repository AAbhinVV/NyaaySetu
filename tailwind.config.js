/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: "#2563EB",
        primaryHover: "#1D4ED8",
        primaryActive: "#1E40AF",

        accent: "#10B981",
        accentHover: "#059669",

        // Surfaces
        background: "#F8FAFC",
        surface: "#FFFFFF",

        // Text
        text: "#0F172A",
        textMuted: "#64748B",

        // Borders
        border: "#E2E8F0",

        // Status
        success: "#16A34A",
        warning: "#F59E0B",
        error: "#DC2626",
        info: "#0EA5E9",
      },
    },
  },
  plugins: [],
};

export default config;
