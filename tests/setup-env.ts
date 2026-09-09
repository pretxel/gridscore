// Dummy Supabase env so `lib/env.ts` (which `required()`s these at import) does
// not throw under the node test environment. Unit tests mock the Supabase
// client itself; these values are never used for real requests. Real values
// (CI/prod) take precedence via `||=`.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role-key";
