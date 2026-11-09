-- ============================================================================
-- MIGRATION 00010: RECONCILE SCHEMA, RLS POLICIES & SEED DATA
-- Target: Supabase PostgreSQL (Project: SMART LIGHT - POLSUB)
-- Description:
--   1. Ensures all missing tables from 00001-00009 exist with correct schema.
--   2. Enforces RBAC functions and triggers (preventing role self-escalation).
--   3. Establishes robust Row Level Security (RLS) policies on all tables.
--   4. Grants necessary execution rights for device authentication.
--   5. Seeds essential master data: insect_species, 4 baseline devices, and settings.
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- 2. SCHEMA UPDATE FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. PROFILES ROLE CONSTRAINT & TRIGGER
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'operator', 'analyst', 'viewer'));

ALTER TABLE public.profiles
    ALTER COLUMN role SET DEFAULT 'viewer';

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. RBAC HELPER FUNCTIONS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN 'anon';
    END IF;

    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN COALESCE(v_role, 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (public.get_current_user_role() = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_operator_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (public.get_current_user_role() IN ('admin', 'operator'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_analyst_or_above()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (public.get_current_user_role() IN ('admin', 'operator', 'analyst'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger to prevent non-admins from escalating their own role
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Akses ditolak: Hanya akun Administrator yang berhak mengubah peran (role) pengguna.';
        END IF;

        IF OLD.id = auth.uid() AND OLD.role = 'admin' AND NEW.role != 'admin' THEN
            IF (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin') <= 1 THEN
                RAISE EXCEPTION 'Operasi dibatalkan: Anda adalah satu-satunya Administrator di sistem.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_role_change ON public.profiles;
CREATE TRIGGER trg_check_role_change
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- Auto create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, assigned_region)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        'viewer',
        COALESCE(NEW.raw_user_meta_data->>'assigned_region', 'Subang, Jawa Barat')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. DEVICE TOKEN VERIFICATION FUNCTION
CREATE OR REPLACE FUNCTION public.verify_device_token(
    p_device_code VARCHAR(64),
    p_raw_token TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_stored_hash VARCHAR(256);
    v_computed_hash VARCHAR(256);
    v_is_active BOOLEAN;
BEGIN
    SELECT api_key_hash, (operational_status = 'active')
    INTO v_stored_hash, v_is_active
    FROM public.devices
    WHERE device_code = p_device_code;

    IF v_stored_hash IS NULL OR v_is_active IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    v_computed_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

    RETURN (v_stored_hash = v_computed_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION public.verify_device_token(VARCHAR, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_device_token(VARCHAR, TEXT) TO postgres;

-- 6. MISSING TABLES CREATION

-- Devices trigger & indices (table already exists)
DROP TRIGGER IF EXISTS trg_devices_updated_at ON public.devices;
CREATE TRIGGER trg_devices_updated_at
    BEFORE UPDATE ON public.devices
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_devices_code ON public.devices (device_code);
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices (connection_status);

-- Table: device_telemetry
CREATE TABLE IF NOT EXISTS public.device_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    sequence_number BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    battery_voltage NUMERIC(6, 2) NOT NULL,
    battery_current NUMERIC(8, 2) NOT NULL,
    shunt_voltage_mv NUMERIC(6, 2),
    solar_voltage NUMERIC(6, 2),
    solar_current NUMERIC(8, 2),
    power_mw NUMERIC(8, 2) NOT NULL DEFAULT 0,
    is_charging BOOLEAN NOT NULL DEFAULT false,
    solar_irradiance_wm2 NUMERIC(6, 2) DEFAULT 0,
    tray_level NUMERIC(5, 2),
    tray_level_cm NUMERIC(5, 2),
    tank_level NUMERIC(5, 2),
    tank_volume_liters NUMERIC(6, 2),
    turbidity NUMERIC(6, 2),
    is_turbid BOOLEAN NOT NULL DEFAULT false,
    drain_valve_status VARCHAR(16) NOT NULL DEFAULT 'closed' CHECK (drain_valve_status IN ('closed', 'open', 'fault')),
    fill_pump_status VARCHAR(24) NOT NULL DEFAULT 'idle' CHECK (fill_pump_status IN ('idle', 'running', 'fault', 'dry_run_lockout')),
    last_water_change TIMESTAMPTZ,
    safety_lockout BOOLEAN NOT NULL DEFAULT false,
    lamp_status BOOLEAN NOT NULL DEFAULT false,
    lamp_mode VARCHAR(32) NOT NULL DEFAULT 'schedule_auto' CHECK (lamp_mode IN ('schedule_auto', 'manual_override', 'eco_low_battery')),
    lamp_led_current_ma INT NOT NULL DEFAULT 0,
    lamp_wavelength_nm INT NOT NULL DEFAULT 365,
    lamp_is_healthy BOOLEAN NOT NULL DEFAULT true,
    pump_status VARCHAR(24) NOT NULL DEFAULT 'idle',
    valve_status VARCHAR(16) NOT NULL DEFAULT 'closed',
    temperature NUMERIC(4, 1),
    humidity NUMERIC(5, 2),
    network_type VARCHAR(16) NOT NULL DEFAULT '4G_LTE' CHECK (network_type IN ('4G_LTE', '2G_FALLBACK', 'OFFLINE')),
    modem_signal_strength INT,
    operator VARCHAR(64),
    unsynced_microsd_packets INT NOT NULL DEFAULT 0,
    payload_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_device_telemetry_seq UNIQUE(device_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON public.device_telemetry (device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_time ON public.device_telemetry (recorded_at DESC);

-- Table: capture_sessions
CREATE TABLE IF NOT EXISTS public.capture_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    session_code VARCHAR(64) UNIQUE,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'verified')),
    model_version VARCHAR(64) NOT NULL DEFAULT 'YOLOv8-AgriPest v1.4-Edge',
    total_pests INT NOT NULL DEFAULT 0,
    target_pests_count INT NOT NULL DEFAULT 0,
    other_insects_count INT NOT NULL DEFAULT 0,
    avg_confidence NUMERIC(5, 4) DEFAULT 0,
    is_manually_verified BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_capture_sessions_updated_at ON public.capture_sessions;
CREATE TRIGGER trg_capture_sessions_updated_at
    BEFORE UPDATE ON public.capture_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_capture_device_time ON public.capture_sessions (device_id, captured_at DESC);

-- Table: insect_species
CREATE TABLE IF NOT EXISTS public.insect_species (
    id VARCHAR(64) PRIMARY KEY,
    common_name VARCHAR(128) NOT NULL,
    scientific_name VARCHAR(128) NOT NULL,
    family VARCHAR(64) NOT NULL,
    is_target_pest BOOLEAN NOT NULL DEFAULT true,
    economic_threshold_per_night INT NOT NULL DEFAULT 50,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
    preferred_wavelength_nm INT NOT NULL DEFAULT 365,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: insect_detections
CREATE TABLE IF NOT EXISTS public.insect_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capture_session_id UUID NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    species_code VARCHAR(64) NOT NULL REFERENCES public.insect_species(id),
    species_name VARCHAR(128) NOT NULL,
    classification VARCHAR(32) NOT NULL DEFAULT 'target_pest' CHECK (classification IN ('target_pest', 'neutral_insect', 'unidentified')),
    count INT NOT NULL DEFAULT 1,
    confidence_score NUMERIC(5, 4) NOT NULL,
    bounding_box JSONB,
    verification_status VARCHAR(32) NOT NULL DEFAULT 'ai_detected' CHECK (verification_status IN ('ai_detected', 'human_verified', 'human_corrected')),
    verified_by UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    model_version VARCHAR(64) NOT NULL DEFAULT 'YOLOv8-AgriPest v1.4-Edge',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detections_session ON public.insect_detections (capture_session_id);
CREATE INDEX IF NOT EXISTS idx_detections_species ON public.insect_detections (species_code);
CREATE INDEX IF NOT EXISTS idx_detections_device ON public.insect_detections (device_id);

-- Table: device_images
CREATE TABLE IF NOT EXISTS public.device_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    capture_session_id UUID REFERENCES public.capture_sessions(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    image_width INT NOT NULL DEFAULT 1920,
    image_height INT NOT NULL DEFAULT 1080,
    content_type VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
    file_size BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_device_time ON public.device_images (device_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_session ON public.device_images (capture_session_id);

-- Table: device_alerts
CREATE TABLE IF NOT EXISTS public.device_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    alert_type VARCHAR(64) NOT NULL CHECK (alert_type IN ('pest_threshold', 'battery_low', 'water_critical', 'device_offline', 'sensor_fault', 'lamp_fault')),
    severity VARCHAR(16) NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'triggered' CHECK (status IN ('triggered', 'acknowledged', 'resolved')),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES public.profiles(id),
    acknowledged_by_name VARCHAR(128),
    resolved_at TIMESTAMPTZ,
    action_taken TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_device ON public.device_alerts (device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.device_alerts (status);
CREATE INDEX IF NOT EXISTS idx_alerts_time ON public.device_alerts (triggered_at DESC);

-- Table: device_commands
CREATE TABLE IF NOT EXISTS public.device_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    command_type VARCHAR(64) NOT NULL CHECK (command_type IN (
        'FORCE_WATER_CHANGE',
        'TOGGLE_LAMP',
        'CAPTURE_NOW',
        'SYNC_MICROSD',
        'REBOOT_ESP32',
        'UPDATE_FIRMWARE_OTA',
        'SET_SCHEDULE',
        'SET_RELAY'
    )),
    parameters JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'acknowledged', 'completed', 'expired', 'failed')),
    requested_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    acknowledged_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    result JSONB,
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_commands_device_status ON public.device_commands (device_id, status);
CREATE INDEX IF NOT EXISTS idx_commands_created ON public.device_commands (created_at DESC);

-- Table: device_settings
CREATE TABLE IF NOT EXISTS public.device_settings (
    device_id UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
    lamp_on_time TIME NOT NULL DEFAULT '18:00:00',
    lamp_off_time TIME NOT NULL DEFAULT '05:00:00',
    timezone VARCHAR(32) NOT NULL DEFAULT 'Asia/Jakarta',
    photo_interval_minutes INT NOT NULL DEFAULT 60 CHECK (photo_interval_minutes >= 5 AND photo_interval_minutes <= 1440),
    pest_alert_threshold INT NOT NULL DEFAULT 50 CHECK (pest_alert_threshold > 0),
    battery_cutoff_threshold NUMERIC(4, 2) NOT NULL DEFAULT 11.80 CHECK (battery_cutoff_threshold >= 10.0 AND battery_cutoff_threshold <= 13.0),
    telemetry_interval_minutes INT NOT NULL DEFAULT 5 CHECK (telemetry_interval_minutes >= 1 AND telemetry_interval_minutes <= 60),
    water_change_settings JSONB NOT NULL DEFAULT '{"turbidityThresholdNtu": 100, "flushDurationSec": 25, "safetyMinTankPercent": 15}'::jsonb,
    updated_by UUID REFERENCES public.profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_device_settings_updated_at ON public.device_settings;
CREATE TRIGGER trg_device_settings_updated_at
    BEFORE UPDATE ON public.device_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Table: water_change_logs
CREATE TABLE IF NOT EXISTS public.water_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    trigger_reason VARCHAR(64) NOT NULL DEFAULT 'turbidity_high' CHECK (trigger_reason IN ('turbidity_high', 'scheduled_interval', 'manual_operator')),
    initial_turbidity_ntu NUMERIC(6, 2),
    final_turbidity_ntu NUMERIC(6, 2),
    water_used_liters NUMERIC(6, 2) DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'ABORTED_EMPTY_TANK', 'OVERFLOW_SAFETY_STOP', 'FAILED')),
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_water_logs_device ON public.water_change_logs (device_id, started_at DESC);

-- Table: device_events
CREATE TABLE IF NOT EXISTS public.device_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL CHECK (event_type IN ('BOOT', 'NETWORK_LOSS', 'NETWORK_RESTORE', 'SENSOR_FAULT', 'DEVICE_RECOVERY', 'OTA_START', 'OTA_SUCCESS', 'OTA_FAILED', 'DRY_RUN_LOCKOUT')),
    severity VARCHAR(16) NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info')),
    details JSONB DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_device_time ON public.device_events (device_id, occurred_at DESC);

-- Table: system_heartbeat (from Migration 00008)
CREATE TABLE IF NOT EXISTS public.system_heartbeat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'maintenance')),
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_heartbeat_service ON public.system_heartbeat (service_name);

DROP TRIGGER IF EXISTS trg_system_heartbeat_updated_at ON public.system_heartbeat;
CREATE TRIGGER trg_system_heartbeat_updated_at
    BEFORE UPDATE ON public.system_heartbeat
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

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

-- Table: telegram_notification_logs (from Migration 00009)
CREATE TABLE IF NOT EXISTS public.telegram_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key VARCHAR(255) NOT NULL UNIQUE,
    device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    delivery_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
    telegram_message_id BIGINT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_telegram_logs_device_id ON public.telegram_notification_logs (device_id);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_status ON public.telegram_notification_logs (delivery_status);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_created_at ON public.telegram_notification_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_event_type ON public.telegram_notification_logs (event_type);

-- Offline device checker stored procedure
CREATE OR REPLACE FUNCTION public.check_and_mark_offline_devices(
    p_timeout_seconds INT DEFAULT 180
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

-- 7. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insect_species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insect_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_heartbeat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relay_status ENABLE ROW LEVEL SECURITY;

-- 8. ROW LEVEL SECURITY POLICIES (DROP OLD, CREATE ROBUST)

-- A. PROFILES
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

CREATE POLICY "profiles_select_authenticated" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- B. DEVICES
DROP POLICY IF EXISTS "devices_select_authenticated" ON public.devices;
DROP POLICY IF EXISTS "devices_update_operator" ON public.devices;
DROP POLICY IF EXISTS "devices_insert_admin" ON public.devices;
DROP POLICY IF EXISTS "devices_delete_admin" ON public.devices;

CREATE POLICY "devices_select_authenticated" ON public.devices
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "devices_update_operator" ON public.devices
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "devices_insert_admin" ON public.devices
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "devices_delete_admin" ON public.devices
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- C. DEVICE_TELEMETRY
DROP POLICY IF EXISTS "telemetry_select_authenticated" ON public.device_telemetry;
DROP POLICY IF EXISTS "telemetry_insert_admin" ON public.device_telemetry;

CREATE POLICY "telemetry_select_authenticated" ON public.device_telemetry
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "telemetry_insert_admin" ON public.device_telemetry
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- D. CAPTURE_SESSIONS
DROP POLICY IF EXISTS "captures_select_authenticated" ON public.capture_sessions;
DROP POLICY IF EXISTS "captures_update_operator" ON public.capture_sessions;
DROP POLICY IF EXISTS "captures_insert_operator" ON public.capture_sessions;

CREATE POLICY "captures_select_authenticated" ON public.capture_sessions
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "captures_update_operator" ON public.capture_sessions
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "captures_insert_operator" ON public.capture_sessions
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- E. INSECT_SPECIES
DROP POLICY IF EXISTS "species_select_authenticated" ON public.insect_species;
DROP POLICY IF EXISTS "species_manage_admin" ON public.insect_species;

CREATE POLICY "species_select_authenticated" ON public.insect_species
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "species_manage_admin" ON public.insect_species
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- F. INSECT_DETECTIONS
DROP POLICY IF EXISTS "detections_select_authenticated" ON public.insect_detections;
DROP POLICY IF EXISTS "detections_update_operator" ON public.insect_detections;
DROP POLICY IF EXISTS "detections_insert_operator" ON public.insect_detections;

CREATE POLICY "detections_select_authenticated" ON public.insect_detections
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "detections_update_operator" ON public.insect_detections
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "detections_insert_operator" ON public.insect_detections
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- G. DEVICE_IMAGES
DROP POLICY IF EXISTS "images_select_authenticated" ON public.device_images;
DROP POLICY IF EXISTS "images_manage_admin" ON public.device_images;

CREATE POLICY "images_select_authenticated" ON public.device_images
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "images_manage_admin" ON public.device_images
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- H. DEVICE_ALERTS
DROP POLICY IF EXISTS "alerts_select_authenticated" ON public.device_alerts;
DROP POLICY IF EXISTS "alerts_update_operator" ON public.device_alerts;
DROP POLICY IF EXISTS "alerts_insert_operator" ON public.device_alerts;

CREATE POLICY "alerts_select_authenticated" ON public.device_alerts
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "alerts_update_operator" ON public.device_alerts
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "alerts_insert_operator" ON public.device_alerts
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- I. DEVICE_COMMANDS
DROP POLICY IF EXISTS "commands_select_authenticated" ON public.device_commands;
DROP POLICY IF EXISTS "commands_insert_operator" ON public.device_commands;
DROP POLICY IF EXISTS "commands_update_operator" ON public.device_commands;

CREATE POLICY "commands_select_authenticated" ON public.device_commands
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "commands_insert_operator" ON public.device_commands
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "commands_update_operator" ON public.device_commands
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

-- J. DEVICE_SETTINGS
DROP POLICY IF EXISTS "settings_select_authenticated" ON public.device_settings;
DROP POLICY IF EXISTS "settings_update_operator" ON public.device_settings;

CREATE POLICY "settings_select_authenticated" ON public.device_settings
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "settings_update_operator" ON public.device_settings
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

-- K. WATER_CHANGE_LOGS
DROP POLICY IF EXISTS "water_logs_select_authenticated" ON public.water_change_logs;
DROP POLICY IF EXISTS "water_logs_insert_operator" ON public.water_change_logs;

CREATE POLICY "water_logs_select_authenticated" ON public.water_change_logs
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "water_logs_insert_operator" ON public.water_change_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- L. DEVICE_EVENTS
DROP POLICY IF EXISTS "events_select_authenticated" ON public.device_events;
DROP POLICY IF EXISTS "events_insert_operator" ON public.device_events;

CREATE POLICY "events_select_authenticated" ON public.device_events
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "events_insert_operator" ON public.device_events
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- M. SYSTEM_HEARTBEAT
DROP POLICY IF EXISTS "system_heartbeat_select_authenticated" ON public.system_heartbeat;
DROP POLICY IF EXISTS "system_heartbeat_admin_all" ON public.system_heartbeat;

CREATE POLICY "system_heartbeat_select_authenticated" ON public.system_heartbeat
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "system_heartbeat_admin_all" ON public.system_heartbeat
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- N. TELEGRAM_NOTIFICATION_LOGS
DROP POLICY IF EXISTS "telegram_logs_select_authenticated" ON public.telegram_notification_logs;
DROP POLICY IF EXISTS "telegram_logs_admin_all" ON public.telegram_notification_logs;

CREATE POLICY "telegram_logs_select_authenticated" ON public.telegram_notification_logs
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "telegram_logs_admin_all" ON public.telegram_notification_logs
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- O. RELAY_STATUS (Accessible by dashboard & ESP8266 REST API)
DROP POLICY IF EXISTS "relay_status_select" ON public.relay_status;
DROP POLICY IF EXISTS "relay_status_update" ON public.relay_status;
DROP POLICY IF EXISTS "relay_status_insert" ON public.relay_status;

CREATE POLICY "relay_status_select" ON public.relay_status
    FOR SELECT USING (true);

CREATE POLICY "relay_status_update" ON public.relay_status
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "relay_status_insert" ON public.relay_status
    FOR INSERT WITH CHECK (true);

-- 9. ESSENTIAL SEED DATA

-- Master Insect Species
INSERT INTO public.insect_species (id, common_name, scientific_name, family, is_target_pest, economic_threshold_per_night, risk_level, preferred_wavelength_nm, description)
VALUES
    ('scirpophaga_incertulas', 'Penggerek Batang Padi Kuning', 'Scirpophaga incertulas', 'Crambidae (Lepidoptera)', true, 50, 'critical', 365, 'Hama utama tanaman padi yang menyebabkan sundep dan beluk.'),
    ('nilaparvata_lugens', 'Wereng Batang Coklat (WBC)', 'Nilaparvata lugens', 'Delphacidae (Hemiptera)', true, 80, 'critical', 395, 'Vektor virus kerdil rumput dan kerdil hampa yang memicu hopperburn.'),
    ('spodoptera_frugiperda', 'Ulat Grayak / Fall Armyworm', 'Spodoptera frugiperda', 'Noctuidae (Lepidoptera)', true, 35, 'high', 365, 'Ngengat nokturnal invasif menyerang daun dan pucuk titik tumbuh padi.'),
    ('leptocorisa_oratoria', 'Walang Sangit', 'Leptocorisa oratoria', 'Alydidae (Hemiptera)', true, 40, 'medium', 420, 'Menghisap bulir padi saat fase matang susu sehingga gabah hampa.'),
    ('cnaphalocrocis_medinalis', 'Hama Putih Palsu / Penggulung Daun', 'Cnaphalocrocis medinalis', 'Pyralidae (Lepidoptera)', true, 45, 'medium', 365, 'Larva menggulung daun padi dan memakan klorofil daun.'),
    ('other_neutral', 'Serangga Netral / Non-Hama', 'Non-Target Arthropoda', 'Aneka Ordo (Coleoptera/Diptera)', false, 500, 'low', 400, 'Serangga malam non-hama yang tertarik spektrum cahaya lampu.')
ON CONFLICT (id) DO UPDATE SET
    common_name = EXCLUDED.common_name,
    economic_threshold_per_night = EXCLUDED.economic_threshold_per_night;

-- 4 Baseline Devices (Subang, Jawa Barat)
INSERT INTO public.devices (
    id,
    device_code,
    device_name,
    location_name,
    farm_sector,
    latitude,
    longitude,
    crop_type,
    planting_date,
    firmware_version,
    esp32_chip_id,
    api_key_hash,
    last_seen_at,
    connection_status,
    lamp_status,
    operational_status,
    battery_cutoff_threshold_v,
    pest_threshold_per_night,
    is_simulated
) VALUES
    (
        'a1111111-1111-1111-1111-111111111111',
        'SLT-SBG-01',
        'Smart Trap Unit 1 (Subang Sawah Inti)',
        'Pusat Benih Padi Subang',
        'Sektor Benih Inti IPB 3S (Subang)',
        -6.5512000,
        107.7588000,
        'Padi Varietas Ciherang (HST 42)',
        '2026-09-08',
        'v2.3.1-prod',
        'ESP32S3-7C2A31',
        encode(extensions.digest('slt_token_sbg01_secret_2026', 'sha256'), 'hex'),
        NOW(),
        'online',
        true,
        'active',
        11.80,
        50,
        false
    ),
    (
        'a2222222-2222-2222-2222-222222222222',
        'SLT-SBG-02',
        'Smart Trap Unit 2 (Pagaden Subang)',
        'Kelompok Tani Pagaden Subang',
        'Blok Sawah Pagaden Barat',
        -6.5381000,
        107.7423000,
        'Padi Inpari 32 HDB (HST 35)',
        '2026-09-15',
        'v2.3.1-prod',
        'ESP32S3-8D1F90',
        encode(extensions.digest('slt_token_sbg02_secret_2026', 'sha256'), 'hex'),
        NOW() - INTERVAL '5 minutes',
        'warning',
        true,
        'active',
        11.80,
        50,
        false
    ),
    (
        'a3333333-3333-3333-3333-333333333333',
        'SLT-SBG-03',
        'Smart Trap Unit 3 (Binong Subang)',
        'Sentra Pertanian Binong Subang',
        'Blok Irigasi Teknis Binong',
        -6.4912000,
        107.7812000,
        'Padi Varietas IPB 3S (HST 50)',
        '2026-08-30',
        'v2.3.0-rc2',
        'ESP32S3-5A99B2',
        encode(extensions.digest('slt_token_sbg03_secret_2026', 'sha256'), 'hex'),
        NOW() - INTERVAL '3 minutes',
        'warning',
        true,
        'active',
        11.80,
        40,
        false
    ),
    (
        'a4444444-4444-4444-4444-444444444444',
        'SLT-SBG-04',
        'Smart Trap Unit 4 (Ciasem Subang)',
        'Demplot Organik Ciasem Subang',
        'Kawasan Organik Sawah Ciasem',
        -6.4215000,
        107.6984000,
        'Padi Sintanur Organik (HST 28)',
        '2026-09-22',
        'v2.2.8-prod',
        'ESP32S3-118CE4',
        encode(extensions.digest('slt_token_sbg04_secret_2026', 'sha256'), 'hex'),
        NOW() - INTERVAL '4 hours',
        'offline',
        false,
        'active',
        11.80,
        40,
        false
    )
ON CONFLICT (id) DO UPDATE SET
    device_name = EXCLUDED.device_name,
    last_seen_at = EXCLUDED.last_seen_at,
    connection_status = EXCLUDED.connection_status;

-- Device Settings for 4 Devices
INSERT INTO public.device_settings (
    device_id,
    lamp_on_time,
    lamp_off_time,
    timezone,
    photo_interval_minutes,
    pest_alert_threshold,
    battery_cutoff_threshold,
    telemetry_interval_minutes,
    water_change_settings
) VALUES
    ('a1111111-1111-1111-1111-111111111111', '18:00:00', '05:00:00', 'Asia/Jakarta', 60, 50, 11.80, 5, '{"turbidityThresholdNtu": 100, "flushDurationSec": 25, "safetyMinTankPercent": 15}'),
    ('a2222222-2222-2222-2222-222222222222', '18:00:00', '05:00:00', 'Asia/Jakarta', 60, 50, 11.80, 5, '{"turbidityThresholdNtu": 100, "flushDurationSec": 25, "safetyMinTankPercent": 15}'),
    ('a3333333-3333-3333-3333-333333333333', '18:00:00', '05:00:00', 'Asia/Jakarta', 60, 40, 11.80, 5, '{"turbidityThresholdNtu": 100, "flushDurationSec": 25, "safetyMinTankPercent": 15}'),
    ('a4444444-4444-4444-4444-444444444444', '18:00:00', '05:00:00', 'Asia/Jakarta', 60, 40, 11.80, 5, '{"turbidityThresholdNtu": 100, "flushDurationSec": 25, "safetyMinTankPercent": 15}')
ON CONFLICT (device_id) DO NOTHING;

-- Initial Baseline Telemetry
INSERT INTO public.device_telemetry (
    device_id,
    sequence_number,
    recorded_at,
    battery_voltage,
    battery_current,
    shunt_voltage_mv,
    solar_voltage,
    solar_current,
    power_mw,
    is_charging,
    solar_irradiance_wm2,
    tray_level,
    tray_level_cm,
    tank_level,
    tank_volume_liters,
    turbidity,
    is_turbid,
    drain_valve_status,
    fill_pump_status,
    last_water_change,
    safety_lockout,
    lamp_status,
    lamp_mode,
    lamp_led_current_ma,
    temperature,
    humidity,
    network_type,
    modem_signal_strength,
    operator,
    unsynced_microsd_packets
) VALUES
    ('a1111111-1111-1111-1111-111111111111', 4892, NOW(), 13.18, -860, -42.5, 0, 0, 11334, false, 0, 82, 4.1, 78, 39, 38, false, 'closed', 'idle', NOW() - INTERVAL '1 day', false, true, 'schedule_auto', 850, 25.8, 88, '4G_LTE', -72, 'Telkomsel IoT SIM', 0),
    ('a2222222-2222-2222-2222-222222222222', 3914, NOW() - INTERVAL '5 minutes', 12.65, -880, -44.1, 0, 0, 11132, false, 0, 71, 3.5, 62, 31, 124, true, 'closed', 'idle', NOW() - INTERVAL '2 days', false, true, 'schedule_auto', 852, 26.1, 91, '4G_LTE', -84, 'Indosat Ooredoo IoT', 0),
    ('a3333333-3333-3333-3333-333333333333', 2844, NOW() - INTERVAL '3 minutes', 11.92, -420, -20.5, 0, 0, 5006, false, 0, 88, 4.4, 18, 9, 45, false, 'closed', 'dry_run_lockout', NOW() - INTERVAL '1 day', true, true, 'eco_low_battery', 420, 24.9, 86, '4G_LTE', -78, 'Telkomsel IoT SIM', 0),
    ('a4444444-4444-4444-4444-444444444444', 1952, NOW() - INTERVAL '4 hours', 12.85, 240, 12.0, 18.2, 450, 3084, true, 120, 65, 3.2, 82, 41, 52, false, 'closed', 'idle', NOW() - INTERVAL '3 days', false, false, 'schedule_auto', 0, 28.4, 74, 'OFFLINE', -115, 'XL Axiata IoT', 18)
ON CONFLICT (device_id, sequence_number) DO NOTHING;

-- Initial Alerts
INSERT INTO public.device_alerts (
    id,
    device_id,
    alert_type,
    severity,
    title,
    message,
    status,
    triggered_at,
    metadata
) VALUES
    (
        'b1111111-1111-1111-1111-111111111111',
        'a2222222-2222-2222-2222-222222222222',
        'pest_threshold',
        'critical',
        'Lonjakan Populasi Penggerek Batang Padi',
        'Tangkapan malam ini mencapai 74 ekor (Ambang kendali: 50 ekor/malam). Potensi serangan sundep tinggi pada fase vegetatif.',
        'triggered',
        NOW() - INTERVAL '30 minutes',
        '{"current_count": 74, "threshold": 50, "species": "scirpophaga_incertulas"}'
    ),
    (
        'b2222222-2222-2222-2222-222222222222',
        'a3333333-3333-3333-3333-333333333333',
        'battery_low',
        'warning',
        'Tegangan Baterai Rendah (11.92V)',
        'Sistem mengaktifkan Eco Mode (peredupan arus UV ke 420mA) untuk mencegah over-discharge sebelum cutoff 11.8V.',
        'triggered',
        NOW() - INTERVAL '1 hour',
        '{"bus_voltage_v": 11.92, "cutoff_threshold_v": 11.80}'
    ),
    (
        'b3333333-3333-3333-3333-333333333333',
        'a3333333-3333-3333-3333-333333333333',
        'water_critical',
        'warning',
        'Level Tandon Air Kritis (18% / 9 Liter)',
        'Pompa pengisian otomatis dikunci (dry-run lockout). Perlu pengisian tandon manual oleh operator lapangan.',
        'acknowledged',
        NOW() - INTERVAL '2 hours',
        '{"tank_level_percent": 18, "tank_liters": 9}'
    ),
    (
        'b4444444-4444-4444-4444-444444444444',
        'a4444444-4444-4444-4444-444444444444',
        'device_offline',
        'warning',
        'Koneksi 4G Terputus (Fallback MicroSD Aktif)',
        'Perangkat tidak mengirim heartbeat selama > 4 jam. 18 paket telemetri dan log kamera disimpan di MicroSD lokal.',
        'triggered',
        NOW() - INTERVAL '4 hours',
        '{"unsynced_packets": 18, "rssi_dbm": -115}'
    )
ON CONFLICT (id) DO NOTHING;

-- Initial System Heartbeat Anchor
INSERT INTO public.system_heartbeat (service_name, status, last_heartbeat_at, metadata)
VALUES (
    'smart-light-trap',
    'healthy',
    NOW(),
    '{"service": "smart-light-trap", "description": "Automated Supabase database heartbeat anchor", "source": "migration_00010"}'::jsonb
)
ON CONFLICT (service_name) DO UPDATE
SET status = EXCLUDED.status,
    last_heartbeat_at = EXCLUDED.last_heartbeat_at,
    updated_at = NOW();

