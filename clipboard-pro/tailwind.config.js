/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./index.tsx",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Granular Dark theme (default)
        primary: '#0D1117',
        secondary: '#161B22',
        accent: '#58A6FF',
        highlight: '#21262D',
        'text-primary': '#C9D1D9',
        'text-secondary': '#8B949E',
        'border-color': '#30363D',
        
        // Africa Dark theme colors
        'africa-bg': '#2d3133',
        'africa-container': '#393D3F',
        'africa-surface': '#505456',
        'africa-primary': '#A5787A',
        'africa-text': '#F6F0ED',
        'africa-text-muted': '#9ca3af',
        'africa-success': '#22c55e',
        'africa-warning': '#f59e0b',
        'africa-danger': '#ef4444',
        'africa-info': '#3b82f6',
        'africa-code': '#1f2937',
        'africa-gray': '#6b7280',
        'africa-viewer-bg': '#1f2324',
        'africa-viewer-content': '#0f1213',
        'africa-viewer-text': '#e5e7eb',
      },
    },
  },
  plugins: [],
};
