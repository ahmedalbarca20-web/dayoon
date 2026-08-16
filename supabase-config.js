window.SUPABASE_CONFIG = {
  SUPABASE_URL: "https://odfipwpljqvefhkwqfjw.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_tnvn-l7ItzfNAeRL7misnA_ZhJCpxky"
};

window.supabaseClient = window.supabase.createClient(
  window.SUPABASE_CONFIG.SUPABASE_URL,
  window.SUPABASE_CONFIG.SUPABASE_ANON_KEY
);