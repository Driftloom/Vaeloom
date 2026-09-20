# 35. Deprecation Policy & Lifecycle

## 1. Lifecycle Phases

Components and tokens in Vaeloom evolve through four structured phases:

1. **Experimental**: New components under trial. May change without breaking
   change warnings. Annotated with `@alpha` or `@beta`.
2. **Stable**: Production-ready, fully documented, covered by 100% test gates.
   Breaking changes require a major version bump.
3. **Deprecated**: Slated for removal. Annotated with `@deprecated` in JSDoc,
   console warnings in development mode, and documented replacement paths.
   Supported for a minimum of 2 minor releases.
4. **Removed**: Completely deleted from codebase.

## 2. Deprecation Protocol

When deprecating a component or token:

1. Add JSDoc `@deprecated Use <NewComponent> instead.`
2. Add a development-only console warning via `warnOnce()`.
3. Update the migration guide with before/after examples.
4. Schedule removal for the next planned major version release.
