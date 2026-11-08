import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SystemHeartbeatInfo {
  serviceName: string;
  status: string;
  lastHeartbeatAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
  isFresh: boolean;
}

export interface HealthCheckResult {
  isConnected: boolean;
  status: 'Connected' | 'Not connected';
  latencyMs: number;
  httpStatus: number;
  authStatus: 'authenticated' | 'anon';
  currentUserEmail?: string;
  deviceRowsCount: number;
  sampleDevice?: {
    id: string;
    deviceCode: string;
    deviceName: string;
    connectionStatus: string;
  };
  systemHeartbeat?: SystemHeartbeatInfo | null;
  rlsAnalysis: {
    isRestrictedByRls: boolean;
    policyName: string;
    explanation: string;
  };
  sanitizedError: string | null;
  timestamp: string;
}

/**
 * Sanitizes any error message to ensure no API keys, tokens, or sensitive credentials
 * are ever exposed to the client interface or logs.
 */
function sanitizeErrorMessage(rawMessage: string): string {
  if (!rawMessage) return 'Unknown error occurred';

  let sanitized = rawMessage;

  // Remove any JWT strings
  sanitized = sanitized.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]');

  // Remove potential URL parameters or secret tokens
  sanitized = sanitized.replace(/apikey=[^&\s]+/gi, 'apikey=[REDACTED]');
  sanitized = sanitized.replace(/secret=[^&\s]+/gi, 'secret=[REDACTED]');
  sanitized = sanitized.replace(/bearer\s+[^\s]+/gi, 'Bearer [REDACTED]');

  return sanitized;
}

export const healthCheckService = {
  /**
   * Safe read-only health check to verify Supabase connection via the 'devices' table.
   * Constrained to LIMIT 1 and does NOT mutate or insert any records.
   */
  async checkConnection(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();

    if (!isSupabaseConfigured) {
      return {
        isConnected: false,
        status: 'Not connected',
        latencyMs: 0,
        httpStatus: 0,
        authStatus: 'anon',
        deviceRowsCount: 0,
        rlsAnalysis: {
          isRestrictedByRls: false,
          policyName: 'none',
          explanation: 'Variabel lingkungan VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY belum terkonfigurasi di file .env.',
        },
        sanitizedError: 'Klien Supabase belum terkonfigurasi pada file .env',
        timestamp,
      };
    }

    const startTime = performance.now();

    try {
      // 1. Check current authentication session
      const { data: { session } } = await supabase.auth.getSession();
      const authStatus = session?.user ? 'authenticated' : 'anon';
      const currentUserEmail = session?.user?.email;

      // 2. Perform safe read query: SELECT id, device_code, device_name, connection_status FROM devices LIMIT 1
      const { data, error, status, statusText } = await supabase
        .from('devices')
        .select('id, device_code, device_name, connection_status')
        .limit(1);

      const latencyMs = Math.round(performance.now() - startTime);

      if (error) {
        // Query failed with PostgreSQL / PostgREST error
        const isRlsError = error.code === '42501' || error.message.toLowerCase().includes('row-level security');
        return {
          isConnected: false,
          status: 'Not connected',
          latencyMs,
          httpStatus: status || 500,
          authStatus,
          currentUserEmail,
          deviceRowsCount: 0,
          rlsAnalysis: {
            isRestrictedByRls: isRlsError,
            policyName: 'devices_select_authenticated',
            explanation: isRlsError
              ? 'Query ditolak oleh Row Level Security (RLS) PostgreSQL untuk sesi saat ini.'
              : 'Terjadi error saat mengakses tabel devices.',
          },
          sanitizedError: sanitizeErrorMessage(error.message || statusText),
          timestamp,
        };
      }

      // Query succeeded (HTTP 200 OK)
      const rows = data || [];
      const hasRows = rows.length > 0;

      // Analyze RLS behavior:
      // If authStatus is 'anon' and rows count is 0, this indicates RLS policy "devices_select_authenticated"
      // is successfully enforcing authenticated-only access (standard PostgreSQL behavior: returns 200 with []).
      const isRestrictedByRls = !hasRows && authStatus === 'anon';

      let rlsExplanation = 'Izin RLS berhasil: Pengguna terautentikasi dapat membaca data perangkat.';
      if (isRestrictedByRls) {
        rlsExplanation =
          'Koneksi HTTP 200 OK berhasil. RLS aktif: Kebijakan "devices_select_authenticated" mengizinkan pembacaan khusus untuk pengguna login. Sesi saat ini adalah anonim (anon), sehingga tabel mengembalikan 0 baris.';
      } else if (hasRows) {
        rlsExplanation = `Berhasil membaca ${rows.length} baris perangkat secara live dari Supabase.`;
      }

      // 3. Fetch system keep-alive heartbeat if authenticated or permitted
      let systemHeartbeat: SystemHeartbeatInfo | null = null;
      try {
        const { data: hbData } = await supabase
          .from('system_heartbeat')
          .select('service_name, status, last_heartbeat_at, metadata, updated_at')
          .eq('service_name', 'smart-light-trap')
          .maybeSingle();

        if (hbData) {
          const lastBeatTime = new Date(hbData.last_heartbeat_at).getTime();
          const ageHours = (Date.now() - lastBeatTime) / (1000 * 60 * 60);
          systemHeartbeat = {
            serviceName: hbData.service_name,
            status: hbData.status,
            lastHeartbeatAt: hbData.last_heartbeat_at,
            updatedAt: hbData.updated_at,
            metadata: hbData.metadata || {},
            isFresh: ageHours <= 24,
          };
        }
      } catch {
        // Silently skip if table or permissions not yet provisioned
      }

      return {
        isConnected: true,
        status: 'Connected',
        latencyMs,
        httpStatus: status || 200,
        authStatus,
        currentUserEmail,
        deviceRowsCount: rows.length,
        sampleDevice: hasRows
          ? {
              id: rows[0].id,
              deviceCode: rows[0].device_code,
              deviceName: rows[0].device_name,
              connectionStatus: rows[0].connection_status,
            }
          : undefined,
        systemHeartbeat,
        rlsAnalysis: {
          isRestrictedByRls,
          policyName: 'devices_select_authenticated',
          explanation: rlsExplanation,
        },
        sanitizedError: null,
        timestamp,
      };
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        isConnected: false,
        status: 'Not connected',
        latencyMs,
        httpStatus: 0,
        authStatus: 'anon',
        deviceRowsCount: 0,
        rlsAnalysis: {
          isRestrictedByRls: false,
          policyName: 'unknown',
          explanation: 'Kegagalan jaringan atau koneksi host Supabase tidak dapat dijangkau.',
        },
        sanitizedError: sanitizeErrorMessage(err?.message || 'Gagal menghubungi server Supabase'),
        timestamp,
      };
    }
  },

  /**
   * Fetches the system keep-alive heartbeat record.
   * NOTE: This heartbeat exclusively reflects automated database keep-alive activity
   * and does NOT signify the operational or online status of physical ESP32 devices.
   */
  async getSystemHeartbeat(serviceName = 'smart-light-trap'): Promise<SystemHeartbeatInfo | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase
        .from('system_heartbeat')
        .select('service_name, status, last_heartbeat_at, metadata, updated_at')
        .eq('service_name', serviceName)
        .maybeSingle();

      if (error || !data) return null;

      const lastBeatTime = new Date(data.last_heartbeat_at).getTime();
      const ageHours = (Date.now() - lastBeatTime) / (1000 * 60 * 60);

      return {
        serviceName: data.service_name,
        status: data.status,
        lastHeartbeatAt: data.last_heartbeat_at,
        updatedAt: data.updated_at,
        metadata: data.metadata || {},
        isFresh: ageHours <= 24,
      };
    } catch {
      return null;
    }
  },
};
