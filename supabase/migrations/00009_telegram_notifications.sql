-- ============================================================================
-- MIGRATION 00009: TELEGRAM NOTIFICATIONS & OFFLINE DETECTION
-- Target Database: PostgreSQL 15+ (Supabase)
-- ============================================================================

-- 1. Create table public.telegram_notification_logs
CREATE TABLE IF NOT EXISTS public.telegram_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key VARCHAR(255) NOT NULL UNIQUE,       -- Strict deduplication key
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,              -- e.g. 'DEVICE_ONLINE', 'DEVICE_OFFLINE', 'RELAY_STATUS', etc.
    message TEXT NOT NULL,                        -- Rendered HTML message sent to Telegram
    delivery_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
    telegram_message_id BIGINT,                   -- Returned Telegram message_id
    error_message TEXT,                           -- Error details if failed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

-- Indexes for telegram_notification_logs
CREATE INDEX IF NOT EXISTS idx_telegram_logs_device_id ON public.telegram_notification_logs (device_id);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_status ON public.telegram_notification_logs (delivery_status);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_created_at ON public.telegram_notification_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_event_type ON public.telegram_notification_logs (event_type);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.telegram_notification_logs ENABLE ROW LEVEL SECURITY;

-- Policy 1: Authenticated users can view notification logs
DROP POLICY IF EXISTS "telegram_logs_select_authenticated" ON public.telegram_notification_logs;
CREATE POLICY "telegram_logs_select_authenticated" ON public.telegram_notification_logs
    FOR SELECT TO authenticated
    USING (true);

-- Policy 2: Admin can perform all operations
DROP POLICY IF EXISTS "telegram_logs_admin_all" ON public.telegram_notification_logs;
CREATE POLICY "telegram_logs_admin_all" ON public.telegram_notification_logs
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 3. Stored Procedure: check_and_mark_offline_devices
-- Detects devices that missed heartbeat intervals, atomically transitions them from
-- 'online'/'warning' to 'offline', logs alert, and returns list for Telegram dispatch.
CREATE OR REPLACE FUNCTION public.check_and_mark_offline_devices(
    p_timeout_seconds INT DEFAULT 180 -- 3 minutes (3 missed 60s heartbeats)
)
RETURNS TABLE (
    device_id UUID,
    device_code VARCHAR(64),
    device_name VARCHAR(128),
    location_name VARCHAR(128),
    last_seen_at TIMESTAMPTZ,
    previous_status VARCHAR(16)
) AS $$
BEGIN
    RETURN QUERY
    WITH timed_out_devices AS (
        SELECT 
            d.id,
            d.device_code,
            d.device_name,
            d.location_name,
            d.last_seen_at,
            d.connection_status AS old_status
        FROM public.devices d
        WHERE d.operational_status = 'active'
          AND d.connection_status IN ('online', 'warning')
          AND (d.last_seen_at IS NULL OR d.last_seen_at < (NOW() - (p_timeout_seconds || ' seconds')::INTERVAL))
        FOR UPDATE SKIP LOCKED
    ),
    updated AS (
        UPDATE public.devices d
        SET connection_status = 'offline',
            updated_at = NOW()
        FROM timed_out_devices t
        WHERE d.id = t.id
        RETURNING d.id, d.device_code, d.device_name, d.location_name, d.last_seen_at, t.old_status
    ),
    inserted_alerts AS (
        INSERT INTO public.device_alerts (
            device_id,
            alert_type,
            severity,
            title,
            message,
            status,
            metadata
        )
        SELECT 
            u.id,
            'device_offline',
            'critical',
            'Perangkat Hilang Kontak (Offline)',
            'Perangkat ' || u.device_code || ' tidak mengirimkan heartbeat selama lebih dari ' || (p_timeout_seconds / 60)::TEXT || ' menit. Terakhir terdeteksi pada: ' || COALESCE(TO_CHAR(u.last_seen_at AT TIME ZONE 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI:SS') || ' WIB', 'Belum Pernah'),
            'triggered',
            jsonb_build_object(
                'timeout_seconds', p_timeout_seconds,
                'last_seen_at', u.last_seen_at,
                'detected_at', NOW()
            )
        FROM updated u
    )
    SELECT 
        u.id AS device_id,
        u.device_code,
        u.device_name,
        u.location_name,
        u.last_seen_at,
        u.old_status AS previous_status
    FROM updated u;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

