/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        mk: {
          bg: "#09090B",
          surface: "#18181B",
          border: "#27272A",
          muted: "#71717A",
        },
        emerald: {
          400: "#34D399",
        },
        orange: {
          500: "#F97316",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
