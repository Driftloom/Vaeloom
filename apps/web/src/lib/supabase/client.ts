export function isSupabaseConfigured(): boolean {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  return Boolean(
    url &&
    anonKey &&
    anonKey !== 'your-supabase-anon-key-here' &&
    !anonKey.includes('your-supabase-anon-key') &&
    (anonKey.startsWith('eyJ') ||
      anonKey.startsWith('sb_publishable_') ||
      anonKey.startsWith('sbp_')),
  );
}

export function createClient() {
  const { createBrowserClient } = require('@supabase/ssr');
  const supabaseUrl =
    process.env['NEXT_PUBLIC_SUPABASE_URL'] || 'https://yygakxcttyaeunvkeybx.supabase.co';
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || '';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
