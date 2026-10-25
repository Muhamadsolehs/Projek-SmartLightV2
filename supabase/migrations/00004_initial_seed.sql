-- ============================================================================
-- MIGRATION 00004: INITIAL SEED DATA FOR SUBANG, JAWA BARAT
-- Target: Master species, initial devices, telemetry, settings, and alerts
-- ============================================================================

-- 1. Master Spesies Serangga PHT Padi
INSERT INTO public.insect_species (id, common_name, scientific_name, family, is_target_pest, economic_threshold_per_night, risk_level, preferred_wavelength_nm, description)
VALUES
    ('scirpophaga_incertulas', 'Penggerek Batang Padi Kuning', 'Scirpophaga incertulas', 'Crambidae (Lepidoptera)', true, 50, 'critical', 365, 'Hama utama tanaman padi yang menyebabkan gejala sundep (fase vegetatif) dan beluk (fase generatif/malai hampa).'),
    ('nilaparvata_lugens', 'Wereng Batang Coklat (WBC)', 'Nilaparvata lugens', 'Delphacidae (Hemiptera)', true, 80, 'critical', 395, 'Hama penghisap cairan batang padi, vektor virus kerdil rumput dan kerdil hampa yang memicu hopperburn.'),
    ('spodoptera_frugiperda', 'Ulat Grayak / Fall Armyworm', 'Spodoptera frugiperda', 'Noctuidae (Lepidoptera)', true, 35, 'high', 365, 'Ngengat nokturnal invasif yang menyerang daun dan titik tumbuh padi serta jagung secara masif.'),
    ('leptocorisa_oratoria', 'Walang Sangit', 'Leptocorisa oratoria', 'Alydidae (Hemiptera)', true, 40, 'medium', 420, 'Menghisap bulir padi saat fase matang susu sehingga menyebabkan beras bernoda coklat atau gabah hampa.'),
    ('cnaphalocrocis_medinalis', 'Hama Putih Palsu / Penggulung Daun', 'Cnaphalocrocis medinalis', 'Pyralidae (Lepidoptera)', true, 45, 'medium', 365, 'Larva menggulung daun padi dan memakan jaringan klorofil sehingga daun tampak putih bergaris.'),
    ('other_neutral', 'Serangga Netral / Non-Hama', 'Non-Target Arthropoda', 'Aneka Ordo (Coleoptera/Diptera)', false, 500, 'low', 400, 'Serangga malam yang tertarik cahaya lampu namun bukan hama pembawa risiko ekonomis bagi tanaman padi.')
ON CONFLICT (id) DO UPDATE SET
    common_name = EXCLUDED.common_name,
    economic_threshold_per_night = EXCLUDED.economic_threshold_per_night;

-- 2. Armada Perangkat Smart Light Trap di Subang
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
        encode(digest('slt_token_sbg01_secret_2026', 'sha256'), 'hex'),
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
        encode(digest('slt_token_sbg02_secret_2026', 'sha256'), 'hex'),
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
        encode(digest('slt_token_sbg03_secret_2026', 'sha256'), 'hex'),
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
        encode(digest('slt_token_sbg04_secret_2026', 'sha256'), 'hex'),
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

-- 3. Pengaturan Awal Perangkat
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

-- 4. Telemetri Sensor Terkini
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

-- 5. Data Peringatan Awal
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

-- 6. Log Siklus Air Baki
INSERT INTO public.water_change_logs (
    device_id,
    started_at,
    completed_at,
    trigger_reason,
    initial_turbidity_ntu,
    final_turbidity_ntu,
    water_used_liters,
    status
) VALUES
    ('a1111111-1111-1111-1111-111111111111', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '70 seconds', 'turbidity_high', 118, 38, 4.8, 'SUCCESS'),
    ('a2222222-2222-2222-2222-222222222222', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '75 seconds', 'scheduled_interval', 88, 24, 5.1, 'SUCCESS'),
    ('a3333333-3333-3333-3333-333333333333', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '65 seconds', 'turbidity_high', 142, 45, 4.6, 'SUCCESS');
