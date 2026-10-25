-- ============================================================================
-- MIGRATION 00002: ROW LEVEL SECURITY (RLS) & ACCESS CONTROL POLICIES
-- Target: Supabase PostgreSQL
-- Roles: admin, operator, viewer
-- ============================================================================

-- 1. Helper function to check role of current authenticated user
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
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

-- 2. Device API Token Verification for Edge Functions & IoT Devices
CREATE OR REPLACE FUNCTION public.verify_device_token(
    p_device_code VARCHAR,
    p_raw_token TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_stored_hash VARCHAR(256);
    v_computed_hash VARCHAR(256);
BEGIN
    SELECT api_key_hash INTO v_stored_hash
    FROM public.devices
    WHERE device_code = p_device_code AND operational_status != 'decommissioned';

    IF v_stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Compute SHA-256 hash of provided token
    v_computed_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

    RETURN (v_stored_hash = v_computed_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger to prevent non-admins from updating their own role
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- If role is changing, verify current user is admin
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Hanya akun Administrator yang memiliki wewenang mengubah peran pengguna.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_check_role_change
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================
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

-- ============================================================================
-- RLS POLICIES: profiles
-- ============================================================================
-- Authenticated users can view profiles
CREATE POLICY "profiles_select_authenticated" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

-- Users can update their own profile (name, avatar), role protected by trigger
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Admin full access on profiles
CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- RLS POLICIES: devices
-- ============================================================================
-- Authenticated users can read devices
CREATE POLICY "devices_select_authenticated" ON public.devices
    FOR SELECT TO authenticated
    USING (true);

-- Operators and admins can update operational status, lamp, etc.
CREATE POLICY "devices_update_operator" ON public.devices
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

-- Admin can insert and delete devices
CREATE POLICY "devices_insert_admin" ON public.devices
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "devices_delete_admin" ON public.devices
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- ============================================================================
-- RLS POLICIES: device_telemetry
-- ============================================================================
-- Authenticated users can read telemetry
CREATE POLICY "telemetry_select_authenticated" ON public.device_telemetry
    FOR SELECT TO authenticated
    USING (true);

-- Insert via service_role or admin (IoT Edge Functions use service_role)
CREATE POLICY "telemetry_insert_admin" ON public.device_telemetry
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- ============================================================================
-- RLS POLICIES: capture_sessions
-- ============================================================================
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

-- ============================================================================
-- RLS POLICIES: insect_species
-- ============================================================================
CREATE POLICY "species_select_authenticated" ON public.insect_species
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "species_manage_admin" ON public.insect_species
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- RLS POLICIES: insect_detections
-- ============================================================================
CREATE POLICY "detections_select_authenticated" ON public.insect_detections
    FOR SELECT TO authenticated
    USING (true);

-- Operator can update verification status & correction
CREATE POLICY "detections_update_operator" ON public.insect_detections
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "detections_insert_operator" ON public.insect_detections
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- ============================================================================
-- RLS POLICIES: device_images
-- ============================================================================
CREATE POLICY "images_select_authenticated" ON public.device_images
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "images_manage_admin" ON public.device_images
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- RLS POLICIES: device_alerts
-- ============================================================================
CREATE POLICY "alerts_select_authenticated" ON public.device_alerts
    FOR SELECT TO authenticated
    USING (true);

-- Operator can acknowledge and update alerts
CREATE POLICY "alerts_update_operator" ON public.device_alerts
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "alerts_insert_operator" ON public.device_alerts
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- ============================================================================
-- RLS POLICIES: device_commands
-- ============================================================================
CREATE POLICY "commands_select_authenticated" ON public.device_commands
    FOR SELECT TO authenticated
    USING (true);

-- Operator & Admin can send commands
CREATE POLICY "commands_insert_operator" ON public.device_commands
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "commands_update_operator" ON public.device_commands
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

-- ============================================================================
-- RLS POLICIES: device_settings
-- ============================================================================
CREATE POLICY "settings_select_authenticated" ON public.device_settings
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "settings_update_operator" ON public.device_settings
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

-- ============================================================================
-- RLS POLICIES: water_change_logs
-- ============================================================================
CREATE POLICY "water_logs_select_authenticated" ON public.water_change_logs
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "water_logs_insert_operator" ON public.water_change_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- ============================================================================
-- RLS POLICIES: device_events
-- ============================================================================
CREATE POLICY "events_select_authenticated" ON public.device_events
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "events_insert_operator" ON public.device_events
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());
