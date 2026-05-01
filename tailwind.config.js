/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#059669",
          dark: "#047857",
          light: "#d1fae5",
          fg: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
