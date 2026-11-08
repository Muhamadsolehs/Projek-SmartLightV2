-- ============================================================================
-- MIGRATION 00008: SYSTEM HEARTBEAT FOR AUTOMATED SUPABASE KEEP-ALIVE
-- Target: PostgreSQL 15+ (Supabase)
-- Purpose: Keep Supabase Free tier active via periodic automated database write,
--          completely isolated from ESP32 field telemetry and device credentials.
-- ============================================================================

-- 1. Create table public.system_heartbeat (Singleton per service_name)
CREATE TABLE IF NOT EXISTS public.system_heartbeat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'maintenance')),
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on service_name
CREATE INDEX IF NOT EXISTS idx_system_heartbeat_service ON public.system_heartbeat (service_name);

-- 2. Attach existing handle_updated_at trigger
DROP TRIGGER IF EXISTS trg_system_heartbeat_updated_at ON public.system_heartbeat;
CREATE TRIGGER trg_system_heartbeat_updated_at
    BEFORE UPDATE ON public.system_heartbeat
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Stored function for atomic idempotent UPSERT
CREATE OR REPLACE FUNCTION public.record_system_heartbeat(
    p_service_name VARCHAR(64) DEFAULT 'smart-light-trap',
    p_status VARCHAR(32) DEFAULT 'healthy',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    service_name VARCHAR(64),
    status VARCHAR(32),
    last_heartbeat_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO public.system_heartbeat (service_name, status, last_heartbeat_at, metadata, updated_at)
    VALUES (p_service_name, p_status, NOW(), p_metadata, NOW())
    ON CONFLICT (service_name) DO UPDATE
    SET status = EXCLUDED.status,
        last_heartbeat_at = NOW(),
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING 
        system_heartbeat.service_name, 
        system_heartbeat.status, 
        system_heartbeat.last_heartbeat_at, 
        system_heartbeat.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.system_heartbeat ENABLE ROW LEVEL SECURITY;

-- Policy 1: Authenticated users can view heartbeat status on dashboard/diagnostics
DROP POLICY IF EXISTS "system_heartbeat_select_authenticated" ON public.system_heartbeat;
CREATE POLICY "system_heartbeat_select_authenticated" ON public.system_heartbeat
    FOR SELECT TO authenticated
    USING (true);

-- Policy 2: Admin can perform all operations
DROP POLICY IF EXISTS "system_heartbeat_admin_all" ON public.system_heartbeat;
CREATE POLICY "system_heartbeat_admin_all" ON public.system_heartbeat
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Notice: Anonymous users (anon) have NO access.
-- IoT Edge Function runs via getAdminClient() using SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS securely on the server.

-- 5. Seed initial record for 'smart-light-trap'
INSERT INTO public.system_heartbeat (service_name, status, last_heartbeat_at, metadata)
VALUES (
    'smart-light-trap',
    'healthy',
    NOW(),
    '{"service": "smart-light-trap", "description": "Automated Supabase database heartbeat anchor", "source": "migration_00008"}'::jsonb
)
ON CONFLICT (service_name) DO UPDATE
SET status = EXCLUDED.status,
    last_heartbeat_at = EXCLUDED.last_heartbeat_at,
    updated_at = NOW();

