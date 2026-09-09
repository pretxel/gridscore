// Test shim for the `server-only` marker package. Its real entry throws on
// import outside a React Server Component; under vitest (node env) that breaks
// any test importing a server module (e.g. the cron route). Aliased in
// vitest.config.ts so server modules import cleanly in tests.
export {};
