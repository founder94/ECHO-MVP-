/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          dark: "#0a0a0a",
          muted: "#6b7280",
          accent: "#ff5a1f",
        },
        fontFamily: {
          sans: ['"Inter"', "system-ui", "sans-serif"],
          display: ['"Playfair Display"', "Georgia", "serif"],
          mono: ['"JetBrains Mono"', "Menlo", "monospace"],
        },
        transitionDuration: {
          '400': '400ms',
          '600': '600ms',
          '800': '800ms',
          '900': '900ms',
        },
      },
    },
    plugins: [],
  }