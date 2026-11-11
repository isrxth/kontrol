/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          surface: 'rgba(15, 23, 42, 0.65)',
          border: 'rgba(255, 255, 255, 0.15)',
        },
        risk: {
          safe: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        }
      },
    },
  },
  plugins: [],
}