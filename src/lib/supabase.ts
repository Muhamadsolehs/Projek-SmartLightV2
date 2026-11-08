import { createClient } from '@supabase/supabase-js';

/**
 * Membersihkan URL Supabase agar selalu merujuk ke origin root project
 * (contoh: "https://xzzjfwstrpayhnpymqpq.supabase.co"),
 * meskipun pengguna memasukkan URL REST API lengkap seperti
 * "https://xzzjfwstrpayhnpymqpq.supabase.co/rest/v1/relay_status?id=eq.1".
 */
export function sanitizeSupabaseUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const parsed = new URL(trimmed);
      return parsed.origin;
    }
    return trimmed;
  } catch {
    return trimmed.replace(/\/rest\/v1.*$/i, '').replace(/\/functions\/v1.*$/i, '');
  }
}

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);
export const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseUrl.includes('placeholder')
);

// Fallback dummy URL so createClient does not throw at initialization if not configured yet
const validUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const validKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const OPERATIONAL_REGION =
  import.meta.env.VITE_OPERATIONAL_REGION || 'Subang, Jawa Barat';
