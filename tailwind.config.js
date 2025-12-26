/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tu paleta de ventas
        ventas: {
          50:  "#fff9e8",
          100: "#fff4cd",
          300: "#ffe184",
          400: "#fbd25c",
          500: "#f6c445", // Color Primario
          600: "#daab22",
          700: "#7c5b00",
        },
        // Definimos el color de marca basado en tu primario
        'huevo-santo': '#f6c445', 
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,.06)",
      },
      borderRadius: {
        'xl2': "1rem",
      },
    },
  },
  plugins: [],
}