import 'server-only';
import { createClient } from '@supabase/supabase-js';
// Server-only admin client. Bypasses row-level security: use for jobs that genuinely need it, never for user requests.
export function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
