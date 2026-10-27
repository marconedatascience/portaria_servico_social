import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://mlzclvxlqiepvxzsxxgn.supabase.co";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_c_xiPCaKv07_80YCmWZJUQ_wdH4dmgm";

export const createClient = () =>
  createBrowserClient(
    supabaseUrl,
    supabaseKey
  );
