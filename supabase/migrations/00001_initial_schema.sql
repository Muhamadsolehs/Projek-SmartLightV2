-- ============================================================================
-- MIGRATION 00001: INITIAL DATABASE SCHEMA FOR SMART LIGHT TRAP IoT SYSTEM
-- Target Database: PostgreSQL 15+ (Supabase)
-- Timezone: UTC stored, presentation in Asia/Jakarta (WIB)
-- Operational Scope: Subang, Jawa Barat
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (Tied to Supabase Auth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'operator', 'viewer')),
    assigned_region TEXT NOT NULL DEFAULT 'Subang, Jawa Barat',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile upon auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, assigned_region)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        'viewer', -- Keamanan: Wajib selalu 'viewer' untuk pendaftaran baru, mencegah eskalasi hak akses
        COALESCE(NEW.raw_user_meta_data->>'assigned_region', 'Subang, Jawa Barat')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. DEVICES TABLE (Armada Perangkap Lapangan)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_code VARCHAR(64) NOT NULL UNIQUE,       -- e.g. 'SLT-SBG-01'
    device_name VARCHAR(128) NOT NULL,
    location_name VARCHAR(128) NOT NULL,          -- e.g. 'Pusat Benih Padi Subang'
    farm_sector VARCHAR(128) NOT NULL,            -- e.g. 'Sektor Benih Inti IPB 3S (Subang)'
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    crop_type VARCHAR(64) NOT NULL,               -- e.g. 'Padi Varietas Ciherang (HST 42)'
    planting_date DATE,
    firmware_version VARCHAR(32) NOT NULL DEFAULT 'v2.3.1-prod',
    esp32_chip_id VARCHAR(32) UNIQUE,
    api_key_hash VARCHAR(256) NOT NULL,           -- SHA-256 hash of device secret token
    last_seen_at TIMESTAMPTZ,
    connection_status VARCHAR(16) NOT NULL DEFAULT 'offline' CHECK (connection_status IN ('online', 'offline', 'warning', 'maintenance')),
    lamp_status BOOLEAN NOT NULL DEFAULT false,
    operational_status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (operational_status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
    battery_cutoff_threshold_v NUMERIC(4, 2) NOT NULL DEFAULT 11.80,
    pest_threshold_per_night INT NOT NULL DEFAULT 50,
    is_simulated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_devices_updated_at
    BEFORE UPDATE ON public.devices
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_devices_code ON public.devices (device_code);
CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices (connection_status);

-- ============================================================================
-- 3. DEVICE_TELEMETRY TABLE (Data Sensor INA226, Baki Air, Lampu, 4G LTE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.device_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    sequence_number BIGINT NOT NULL,              -- Pencegah duplikasi paket
    recorded_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- INA226 Solar & Battery
    battery_voltage NUMERIC(6, 2) NOT NULL,       -- Bus Voltage (V)
    battery_current NUMERIC(8, 2) NOT NULL,       -- Net Current (mA) (+) Solar, (-) Beban
    shunt_voltage_mv NUMERIC(6, 2),
    solar_voltage NUMERIC(6, 2),
    solar_current NUMERIC(8, 2),
    power_mw NUMERIC(8, 2) NOT NULL DEFAULT 0,
    is_charging BOOLEAN NOT NULL DEFAULT false,
    solar_irradiance_wm2 NUMERIC(6, 2) DEFAULT 0,
    -- Water Hydraulic System
    tray_level NUMERIC(5, 2),                     -- Persentase level baki (0-100%)
    tray_level_cm NUMERIC(5, 2),                  -- Kedalaman air baki (cm)
    tank_level NUMERIC(5, 2),                     -- Persentase tandon cadangan (0-100%)
    tank_volume_liters NUMERIC(6, 2),             -- Volume tandon tersisa (L)
    turbidity NUMERIC(6, 2),                      -- Sensor Kekeruhan Air (NTU)
    is_turbid BOOLEAN NOT NULL DEFAULT false,
    drain_valve_status VARCHAR(16) NOT NULL DEFAULT 'closed' CHECK (drain_valve_status IN ('closed', 'open', 'fault')),
    fill_pump_status VARCHAR(24) NOT NULL DEFAULT 'idle' CHECK (fill_pump_status IN ('idle', 'running', 'fault', 'dry_run_lockout')),
    last_water_change TIMESTAMPTZ,
    safety_lockout BOOLEAN NOT NULL DEFAULT false,
    -- UV Lamp Status
    lamp_status BOOLEAN NOT NULL DEFAULT false,
    lamp_mode VARCHAR(32) NOT NULL DEFAULT 'schedule_auto' CHECK (lamp_mode IN ('schedule_auto', 'manual_override', 'eco_low_battery')),
    lamp_led_current_ma INT NOT NULL DEFAULT 0,
    lamp_wavelength_nm INT NOT NULL DEFAULT 365,
    lamp_is_healthy BOOLEAN NOT NULL DEFAULT true,
    -- Actuators
    pump_status VARCHAR(24) NOT NULL DEFAULT 'idle',
    valve_status VARCHAR(16) NOT NULL DEFAULT 'closed',
    -- Environment & 4G Connectivity
    temperature NUMERIC(4, 1),
    humidity NUMERIC(5, 2),
    network_type VARCHAR(16) NOT NULL DEFAULT '4G_LTE' CHECK (network_type IN ('4G_LTE', '2G_FALLBACK', 'OFFLINE')),
    modem_signal_strength INT,                    -- RSSI dBm
    operator VARCHAR(64),
    unsynced_microsd_packets INT NOT NULL DEFAULT 0,
    -- Metadata
    payload_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_device_telemetry_seq UNIQUE(device_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON public.device_telemetry (device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_time ON public.device_telemetry (recorded_at DESC);

-- ============================================================================
-- 4. CAPTURE_SESSIONS TABLE (Sesi Pengambilan Gambar Baki)
-- ============================================================================
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

CREATE TRIGGER trg_capture_sessions_updated_at
    BEFORE UPDATE ON public.capture_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX IF NOT EXISTS idx_capture_device_time ON public.capture_sessions (device_id, captured_at DESC);

-- ============================================================================
-- 5. INSECT_SPECIES TABLE (Master Spesies Serangga & Hama Padi)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.insect_species (
    id VARCHAR(64) PRIMARY KEY,                   -- e.g. 'scirpophaga_incertulas'
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

-- ============================================================================
-- 6. INSECT_DETECTIONS TABLE (Hasil Klasifikasi & Bounding Box)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.insect_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capture_session_id UUID NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    species_code VARCHAR(64) NOT NULL REFERENCES public.insect_species(id),
    species_name VARCHAR(128) NOT NULL,
    classification VARCHAR(32) NOT NULL DEFAULT 'target_pest' CHECK (classification IN ('target_pest', 'neutral_insect', 'unidentified')),
    count INT NOT NULL DEFAULT 1,
    confidence_score NUMERIC(5, 4) NOT NULL,
    bounding_box JSONB,                           -- { x: 22, y: 34, width: 9, height: 12 }
    verification_status VARCHAR(32) NOT NULL DEFAULT 'ai_detected' CHECK (verification_status IN ('ai_detected', 'human_verified', 'human_corrected')),
    verified_by UUID REFERENCES public.profiles(id),
    verified_at TIMESTAMPTZ,
    model_version VARCHAR(64) NOT NULL DEFAULT 'YOLOv8-AgriPest v1.4-Edge',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detections_session ON public.insect_detections (capture_session_id);
CREATE INDEX IF NOT EXISTS idx_detections_species ON public.insect_detections (species_code);
CREATE INDEX IF NOT EXISTS idx_detections_device ON public.insect_detections (device_id);

-- ============================================================================
-- 7. DEVICE_IMAGES TABLE (Metadata Foto di Supabase Storage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.device_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    capture_session_id UUID REFERENCES public.capture_sessions(id) ON DELETE SET NULL,
    storage_path TEXT NOT NULL,                   -- e.g. 'devices/SLT-SBG-01/2026/10/photo_01.jpg'
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    image_width INT NOT NULL DEFAULT 1920,
    image_height INT NOT NULL DEFAULT 1080,
    content_type VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
    file_size BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_images_device_time ON public.device_images (device_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_session ON public.device_images (capture_session_id);

-- ============================================================================
-- 8. DEVICE_ALERTS TABLE (Peringatan Sistem PHT, Daya, Air & Koneksi)
-- ============================================================================
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

-- ============================================================================
-- 9. DEVICE_COMMANDS TABLE (Antrean Perintah Pengendalian Aktuator)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.device_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    command_type VARCHAR(64) NOT NULL CHECK (command_type IN ('FORCE_WATER_CHANGE', 'TOGGLE_LAMP', 'CAPTURE_NOW', 'SYNC_MICROSD', 'REBOOT_ESP32', 'UPDATE_FIRMWARE_OTA', 'SET_SCHEDULE')),
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

-- ============================================================================
-- 10. DEVICE_SETTINGS TABLE (Konfigurasi Operasional Perangkat)
-- ============================================================================
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

CREATE TRIGGER trg_device_settings_updated_at
    BEFORE UPDATE ON public.device_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 11. WATER_CHANGE_LOGS TABLE (Riwayat Siklus Kuras & Pengisian Baki)
-- ============================================================================
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

-- ============================================================================
-- 12. DEVICE_EVENTS TABLE (Log Audit Kejadian Hardware Lapangan)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.device_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL CHECK (event_type IN ('BOOT', 'NETWORK_LOSS', 'NETWORK_RESTORE', 'SENSOR_FAULT', 'DEVICE_RECOVERY', 'OTA_START', 'OTA_SUCCESS', 'OTA_FAILED', 'DRY_RUN_LOCKOUT')),
    severity VARCHAR(16) NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'warning', 'info')),
    details JSONB DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_device_time ON public.device_events (device_id, occurred_at DESC);
