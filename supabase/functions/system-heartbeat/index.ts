import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

/**
 * Constant-time string comparison to prevent timing analysis attacks.
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Extracts candidate heartbeat secret token from incoming request headers.
 * Accepts:
 *   1. Authorization: Bearer <secret>
 *   2. x-heartbeat-secret: <secret>
 */
function extractSecretToken(req: Request): string | null {
  const customHeader = req.headers.get('x-heartbeat-secret');
  if (customHeader && customHeader.trim().length > 0) {
    return customHeader.trim();
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.trim().split(/\s+/);
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1].trim();
    }
  }

  return null;
}

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 2. Enforce POST only
  if (req.method !== 'POST') {
    console.warn(`[Heartbeat] Rejected method ${req.method}. Only POST is accepted.`);
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Only POST is supported.' }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Allow': 'POST, OPTIONS',
        },
      }
    );
  }

  // 3. Validate Server Secret Configuration
  const configuredSecret = Deno.env.get('HEARTBEAT_SECRET');
  if (!configuredSecret || configuredSecret.trim().length === 0) {
    console.error('[Heartbeat Error] Server configuration error: HEARTBEAT_SECRET environment variable is missing.');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // 4. Authenticate Request Secret
  const providedToken = extractSecretToken(req);
  if (!providedToken || !constantTimeCompare(providedToken, configuredSecret.trim())) {
    console.warn('[Heartbeat] Unauthorized request rejected (invalid or missing secret).');
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid or missing heartbeat secret' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // 5. Parse optional metadata safely
  const nowUtc = new Date().toISOString();
  const serviceName = 'smart-light-trap';
  let metadata: Record<string, unknown> = {
    source: 'system-heartbeat-edge',
    timestamp_utc: nowUtc,
  };

  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (body && typeof body === 'object') {
        if (typeof body.trigger === 'string') {
          metadata.trigger = body.trigger.slice(0, 64);
        }
        if (typeof body.client === 'string') {
          metadata.client = body.client.slice(0, 64);
        }
      }
    }
  } catch {
    // Body is optional; proceed with default metadata
  }

  // 6. Perform Database UPSERT using Service Role
  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('system_heartbeat')
      .upsert(
        {
          service_name: serviceName,
          status: 'healthy',
          last_heartbeat_at: nowUtc,
          metadata,
          updated_at: nowUtc,
        },
        { onConflict: 'service_name' }
      )
      .select('service_name, status, last_heartbeat_at, updated_at')
      .single();

    if (error) {
      console.error('[Heartbeat Error] Database operation failed:', error.message);
      return new Response(
        JSON.stringify({ error: 'Database heartbeat operation failed' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[Heartbeat] Success: Service "${data.service_name}" heartbeat recorded at ${data.last_heartbeat_at}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'System heartbeat recorded successfully',
        data: {
          service_name: data.service_name,
          status: data.status,
          last_heartbeat_at: data.last_heartbeat_at,
          updated_at: data.updated_at,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    console.error('[Heartbeat Error] Unexpected server error:', err?.message || 'Unknown');
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

