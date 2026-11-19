// Side-effect stylesheet imports are handled by Next's bundler, not by the
// TypeScript module resolver. TypeScript 6 checks side-effect imports, so the
// asset needs a declaration to stay a valid import target.
declare module '*.css';
