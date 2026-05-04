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
        heading: ["var(--font-heading)", "Cormorant Garamond", "Newsreader", "serif"],
        body: ["var(--font-inter)", "var(--font-body)", "Inter", "DM Sans", "sans-serif"],
      },
      boxShadow: {
        lawyer: "0 12px 40px rgba(27, 28, 25, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
