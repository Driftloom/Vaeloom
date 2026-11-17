module.exports = {
  plugins: {
    // Tailwind 4 moved the PostCSS plugin out of the `tailwindcss` package.
    // Autoprefixer is no longer needed: v4 handles vendor prefixing itself.
    '@tailwindcss/postcss': {},
  },
};
