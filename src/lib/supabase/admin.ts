import { type SupabaseClient, createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS entirely.
 * Use only in server-side code for admin operations:
 * - Bot user creation (auth.admin.createUser)
 * - User deletion during account linking
 * - Admin data queries
 *
 * Lazily initialized to avoid crashing during build when env vars are absent.
 */
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }
  return _supabaseAdmin;
}
