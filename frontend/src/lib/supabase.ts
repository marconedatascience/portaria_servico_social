import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

if (typeof window !== 'undefined') {
  const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
  Object.assign(supabase.auth, {
    getSession: async () => {
      try {
        const mock = window.localStorage.getItem('e2e_session');
        if (mock) {
          return { data: { session: JSON.parse(mock) }, error: null };
        }
      } catch {
        // Fallback silencioso
      }
      return originalGetSession();
    },
  });
}
