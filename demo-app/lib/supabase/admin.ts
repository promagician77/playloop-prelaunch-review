import { createClient } from '@supabase/supabase-js';
// Admin client so saving works without RLS errors
export function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!);
}
