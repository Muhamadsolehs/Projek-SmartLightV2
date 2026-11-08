import React, { useState } from 'react';
import {
  Code2,
  Database,
  Cpu,
  Server,
  Layers,
  Copy,
  Check,
  Radio,
  FileCode,
  Shield,
  Wifi,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { hasPermission } from '../../lib/permissions';
import { AccessDenied } from '../common/AccessDenied';

export const ArchitectureApiView: React.FC<{ onOpenSimulator?: () => void }> = ({ onOpenSimulator }) => {
  const { currentUser } = useDevice();
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeSchemaTab, setActiveSchemaTab] = useState<'sql' | 'api' | 'hardware'>('sql');

  if (!hasPermission(currentUser?.role, 'view:architecture')) {
    return (
      <AccessDenied
        requiredPermissionDescription="Dokumentasi teknis arsitektur perangkat keras dan endpoint API dibatasi untuk Administrator, Operator, dan Analis."
      />
    );
  }

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const sqlSchemaSnippet = `-- ============================================================================
-- SMART LIGHT TRAP IoT AGRITECH DATABASE SCHEMA (PostgreSQL / MySQL 8.0+)
-- Designed for High-Throughput Telemetry, Anti-Duplication, and Pest Analytics
-- Timezone: UTC stored, presentation in Asia/Jakarta (WIB)
-- ============================================================================

-- 1. Tabel Perangkat Lapangan
CREATE TABLE devices (
    id VARCHAR(64) PRIMARY KEY,
    device_code VARCHAR(32) NOT NULL UNIQUE,       -- e.g. 'SLT-KRW-01'
    name VARCHAR(128) NOT NULL,
    farm_sector VARCHAR(128) NOT NULL,            -- e.g. 'Blok A1 - Sawah Irigasi'
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    crop_type VARCHAR(64) NOT NULL,               -- e.g. 'Padi Ciherang HST 42'
    firmware_version VARCHAR(32) NOT NULL,
    esp32_chip_id VARCHAR(32) NOT NULL UNIQUE,
    battery_cutoff_threshold_v DECIMAL(4, 2) DEFAULT 11.80,
    pest_threshold_per_night INT DEFAULT 50,
    api_token_hash VARCHAR(256) NOT NULL,         -- SHA-256 Auth Token
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Telemetri Sensor & INA226 (Time-Series Partition Ready)
CREATE TABLE device_telemetry (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    sequence_number BIGINT NOT NULL,              -- Pencegah duplikasi paket
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    bus_voltage_v DECIMAL(5, 2) NOT NULL,         -- Dari INA226 (e.g. 13.18V)
    shunt_voltage_mv DECIMAL(6, 2) NOT NULL,
    current_ma DECIMAL(8, 2) NOT NULL,            -- (+) Charging, (-) Discharging
    power_mw DECIMAL(8, 2) NOT NULL,
    tray_level_percent INT NOT NULL,              -- 0 - 100%
    tray_level_cm DECIMAL(5, 2) NOT NULL,
    tank_level_percent INT NOT NULL,
    tank_volume_liters DECIMAL(5, 2) NOT NULL,
    turbidity_ntu INT NOT NULL,                   -- DF-Robot Optik
    is_turbid BOOLEAN NOT NULL,
    lamp_is_active BOOLEAN NOT NULL,
    lamp_led_current_ma INT NOT NULL,
    drain_valve_status VARCHAR(16) NOT NULL,      -- 'closed', 'open', 'fault'
    fill_pump_status VARCHAR(24) NOT NULL,        -- 'idle', 'running', 'dry_run_lockout'
    connectivity_type VARCHAR(16) NOT NULL,       -- '4G_LTE', '2G_FALLBACK'
    rssi_dbm INT NOT NULL,
    temperature_c DECIMAL(4, 1),
    humidity_percent INT,
    source VARCHAR(16) DEFAULT 'LTE_ONLINE',      -- 'LTE_ONLINE' atau 'MICROSD_SYNC'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_device_seq UNIQUE(device_id, sequence_number)
);

CREATE INDEX idx_telemetry_device_time ON device_telemetry (device_id, timestamp DESC);
CREATE INDEX idx_telemetry_time ON device_telemetry (timestamp DESC);

-- 3. Tabel Master Spesies Serangga & Hama Sasaran
CREATE TABLE insect_species (
    id VARCHAR(48) PRIMARY KEY,                   -- e.g. 'scirpophaga_incertulas'
    common_name VARCHAR(128) NOT NULL,
    scientific_name VARCHAR(128) NOT NULL,
    family VARCHAR(64) NOT NULL,
    is_target_pest BOOLEAN DEFAULT TRUE,
    economic_threshold_per_night INT NOT NULL,    -- Ambang Kendali PHT
    preferred_wavelength_nm INT DEFAULT 365,
    risk_level VARCHAR(16) NOT NULL
);

-- 4. Tabel Sesi Tangkapan Citra & Hasil Inferensi AI
CREATE TABLE capture_sessions (
    id VARCHAR(64) PRIMARY KEY,                   -- e.g. 'cap_krw02_20261021_2000'
    device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    image_storage_path VARCHAR(256) NOT NULL,
    resolution VARCHAR(32) NOT NULL,
    total_insects INT NOT NULL,
    target_pests_count INT NOT NULL,
    other_insects_count INT NOT NULL,
    avg_confidence DECIMAL(4, 3) NOT NULL,
    model_version VARCHAR(48) NOT NULL,           -- e.g. 'YOLOv8-AgriPest v1.4-Edge'
    is_manually_verified BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(64),
    verified_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_captures_device_time ON capture_sessions (device_id, timestamp DESC);

-- 5. Tabel Bounding Box Serangga Individual (Untuk Training & Validasi)
CREATE TABLE insect_detections (
    id BIGSERIAL PRIMARY KEY,
    capture_id VARCHAR(64) NOT NULL REFERENCES capture_sessions(id) ON DELETE CASCADE,
    species_id VARCHAR(48) NOT NULL REFERENCES insect_species(id),
    confidence DECIMAL(4, 3) NOT NULL,
    bbox_x DECIMAL(5, 2) NOT NULL,                -- Normalisasi 0 - 100%
    bbox_y DECIMAL(5, 2) NOT NULL,
    bbox_width DECIMAL(5, 2) NOT NULL,
    bbox_height DECIMAL(5, 2) NOT NULL,
    is_manually_verified BOOLEAN DEFAULT FALSE,
    corrected_species_id VARCHAR(48) REFERENCES insect_species(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabel Siklus Hidraulik & Pengurasan Air Baki
CREATE TABLE water_change_logs (
    id VARCHAR(64) PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    trigger_reason VARCHAR(32) NOT NULL,          -- 'turbidity_high', 'scheduled', 'manual'
    initial_turbidity_ntu INT NOT NULL,
    final_turbidity_ntu INT NOT NULL,
    water_used_liters DECIMAL(5, 2) NOT NULL,
    status VARCHAR(32) NOT NULL                   -- 'SUCCESS', 'ABORTED_EMPTY_TANK'
);

-- 7. Tabel Antrian Komando Jarak Jauh (Handshake State Machine)
CREATE TABLE device_commands (
    id VARCHAR(64) PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    command_type VARCHAR(48) NOT NULL,            -- 'FORCE_WATER_CHANGE', 'TOGGLE_LAMP'
    parameters_json JSONB,
    status VARCHAR(24) DEFAULT 'PENDING',         -- PENDING -> SENT -> ACKNOWLEDGED -> COMPLETED -> FAILED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    response_message TEXT
);

-- 8. Tabel Keep-Alive Heartbeat Otomatis (Mencegah Pause Supabase Free Tier)
CREATE TABLE system_heartbeat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(64) NOT NULL UNIQUE,     -- 'smart-light-trap'
    status VARCHAR(32) NOT NULL DEFAULT 'healthy',
    last_heartbeat_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);`;

  const apiSnippet = `// ============================================================================
// SMART LIGHT TRAP IoT SUPABASE EDGE FUNCTIONS SPECIFICATION
// Base URL: https://<PROJECT-REF>.supabase.co/functions/v1
// Auth: Bearer Token (X-Device-Token Header) - Verified with SHA-256 hash in DB
// Region Scope: Subang, Jawa Barat
// ============================================================================

// 1. ENDPOINT TELEMETRI REGULER PERANGKAT ESP32-S3 (TIAP 5 MENIT)
// POST /functions/v1/device-telemetry
// Request Headers:
//   Content-Type: application/json
//   X-Device-Code: SLT-SBG-01
//   X-Device-Token: slt_token_sbg01_secret_2026
{
  "device_code": "SLT-SBG-01",
  "timestamp": "2026-10-21T20:45:00+07:00",
  "sequence_number": 4892,
  "battery": {
    "bus_voltage_v": 13.18,
    "shunt_voltage_mv": -42.50,
    "current_ma": -860,
    "power_mw": 11334,
    "is_charging": false,
    "solar_voltage_v": 0.0,
    "solar_current_ma": 0.0
  },
  "water": {
    "tray_level_percent": 82,
    "tray_level_cm": 4.10,
    "tank_level_percent": 78,
    "tank_volume_liters": 39.0,
    "turbidity_ntu": 38,
    "drain_valve_status": "closed",
    "fill_pump_status": "idle",
    "safety_lockout": false
  },
  "lamp": {
    "is_active": true,
    "mode": "schedule_auto",
    "wavelength_nm": 365,
    "led_current_ma": 850,
    "is_healthy": true
  },
  "connectivity": {
    "network_type": "4G_LTE",
    "rssi_dbm": -72,
    "operator": "Telkomsel IoT SIM",
    "unsynced_microsd_packets": 0
  },
  "temperature_c": 25.8,
  "humidity_percent": 88
}

// 2. ENDPOINT UPLOAD HASIL INFERENSI KAMERA & DETEKSI CV
// POST /functions/v1/device-detections
{
  "device_code": "SLT-SBG-02",
  "timestamp": "2026-10-21T20:00:00+07:00",
  "image_storage_path": "devices/SLT-SBG-02/2026/10/photo_01.jpg",
  "resolution": "1920x1080",
  "model_version": "YOLOv8-AgriPest v1.4-Edge",
  "total_detected": 86,
  "detections": [
    {
      "species_code": "scirpophaga_incertulas",
      "confidence": 0.97,
      "bbox": { "x": 22.0, "y": 34.0, "width": 9.0, "height": 12.0 }
    },
    {
      "species_code": "nilaparvata_lugens",
      "confidence": 0.96,
      "bbox": { "x": 55.0, "y": 48.0, "width": 6.0, "height": 7.0 }
    }
  ]
}

// 3. ENDPOINT POLLING KOMANDO JARAK JAUH DARI MIKROKONTROLER
// GET /functions/v1/device-command-poll?device_code=SLT-SBG-01
// Response:
{
  "has_command": true,
  "command": {
    "command_id": "cmd_1742081023",
    "type": "FORCE_WATER_CHANGE",
    "parameters": {
      "drain_seconds": 25,
      "target_tray_level_percent": 85,
      "max_fill_timeout_seconds": 45
    }
  }
}

// 4. ENDPOINT DATABASE KEEP-ALIVE HEARTBEAT (EXTERNAL SCHEDULER / CRON-JOB.ORG)
// POST /functions/v1/system-heartbeat
// Headers:
//   Authorization: Bearer <HEARTBEAT_SECRET>
//   (atau x-heartbeat-secret: <HEARTBEAT_SECRET>)
//   Content-Type: application/json
// Body (opsional):
{
  "trigger": "cron-job.org",
  "client": "smart-light-trap-scheduler"
}
// Response 200 OK:
{
  "success": true,
  "message": "System heartbeat recorded successfully",
  "data": {
    "service_name": "smart-light-trap",
    "status": "healthy",
    "last_heartbeat_at": "2026-11-08T07:30:00.000Z",
    "updated_at": "2026-11-08T07:30:00.000Z"
  }
}`;

  const hardwareSnippet = `// ============================================================================
// ESP32-S3 HARDWARE PINOUT & PERIPHERAL SUBSYSTEM MATRIX
// Microcontroller: ESP32-S3-WROOM-1 (16MB Flash, 8MB Octal PSRAM)
// ============================================================================

1. KOMUNIKASI & SENSOR BUS (I2C 400kHz - Master)
   - GPIO 47 : I2C SDA (Common Bus)
   - GPIO 48 : I2C SCL (Common Bus)
   - Peripherals on Bus:
     * INA226 Bi-directional Current/Power Monitor (Address 0x40)
     * DS3231 High-Precision RTC dengan baterai koin CR2032 (Address 0x68)

2. MODEM 4G LTE CAT-1 (SIMCom SIM7600E-H / A7670E)
   - GPIO 17 : UART2 TX (ESP32 TX -> Modem RX)
   - GPIO 18 : UART2 RX (ESP32 RX -> Modem TX)
   - GPIO 19 : Modem Power Key (Pulldown switch)
   - GPIO 20 : Modem Reset Line

3. KAMERA OV5640 / OV2640 (DVP 8-bit Interface + SCCB)
   - GPIO 11 : CAM_D0
   - GPIO 12 : CAM_D1
   - GPIO 13 : CAM_D2
   - GPIO 14 : CAM_D3
   - GPIO 15 : CAM_D4
   - GPIO 16 : CAM_D5
   - GPIO 21 : CAM_D6
   - GPIO 26 : CAM_D7
   - GPIO 38 : CAM_XCLK (20MHz)
   - GPIO 39 : CAM_PCLK
   - GPIO 40 : CAM_VSYNC
   - GPIO 41 : CAM_HREF

4. PENYIMPANAN OFFLINE LOCAL (MicroSD Card SPI)
   - GPIO 35 : SPI_MOSI
   - GPIO 36 : SPI_MISO
   - GPIO 37 : SPI_SCK
   - GPIO 34 : SPI_CS (MicroSD Chip Select)

5. AKTUATOR HIDRAULIK & LAMPU (MOSFET N-Channel Driver 12V)
   - GPIO 4  : MOSFET Solenoid Katup Pembuangan Air (Drain Valve)
   - GPIO 5  : Relay / MOSFET Pompa Submersibel 12V (Fill Pump)
   - GPIO 6  : PWM Driver LED Lampu UV 365nm (Constant Current 850mA)
   - GPIO 7  : LED Iluminasi Baki 4000K (Untuk Shutter Kamera)

6. SENSOR HIDRAULIK ANALOG & ULTRASONIK
   - GPIO 1  : ADC1_CH0 Sensor Kekeruhan Air DF-Robot Analog (0-3.3V)
   - GPIO 2  : Ultrasonic Baki JSN-SR04T Trig
   - GPIO 42 : Ultrasonic Baki JSN-SR04T Echo
   - GPIO 8  : Ultrasonic Tandon JSN-SR04T Trig
   - GPIO 9  : Ultrasonic Tandon JSN-SR04T Echo`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#52796F]">
        <span className="text-[#718096]">Smart Light Trap</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" />
        <span className="font-semibold text-[#192A20]">Arsitektur & API</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A20]">
            Arsitektur Sistem & Kontrak API
          </h1>
          <p className="text-xs sm:text-sm text-[#52796F] mt-1 max-w-2xl">
            Fondasi rekayasa backend, database relasional PostgreSQL, kontrak payload telemetri REST/MQTT, dan pinout ESP32-S3.
          </p>
        </div>

        {/* Schema Tab Selector (Scrollable horizontally on mobile) */}
        <div className="flex items-center gap-1 p-1 bg-[#F1F5F2] rounded-lg text-xs font-medium overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            onClick={() => setActiveSchemaTab('sql')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
              activeSchemaTab === 'sql'
                ? 'bg-white text-[#192A20] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            <Database className="h-3.5 w-3.5 text-[#2D6A4F]" />
            <span>Skema SQL Database</span>
          </button>
          <button
            onClick={() => setActiveSchemaTab('api')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
              activeSchemaTab === 'api'
                ? 'bg-white text-[#192A20] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            <Server className="h-3.5 w-3.5 text-[#2B6CB0]" />
            <span>Kontrak API JSON</span>
          </button>
          <button
            onClick={() => setActiveSchemaTab('hardware')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 shrink-0 ${
              activeSchemaTab === 'hardware'
                ? 'bg-white text-[#192A20] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            <Cpu className="h-3.5 w-3.5 text-[#D97706]" />
            <span>Pinout ESP32-S3</span>
          </button>
        </div>
      </div>

      {/* Architecture System Diagram Strip */}
      <div className="rounded-xl border border-[#D1DCD6] bg-white p-5 shadow-xs space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F]">
          Diagram Alur Data End-to-End Smart Light Trap IoT
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Node 1 */}
          <div className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-[#192A20]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1B4332] text-white text-[10px]">1</span>
              <span>Hardware Lapangan</span>
            </div>
            <p className="text-[11px] text-[#718096]">
              ESP32-S3 mengontrol lampu UV 365nm, sensor INA226, sensor kekeruhan air, solenoid drain, dan kamera OV5640.
            </p>
          </div>

          {/* Node 2 */}
          <div className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-[#192A20]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2D6A4F] text-white text-[10px]">2</span>
              <span>Transmisi 4G & Buffer</span>
            </div>
            <p className="text-[11px] text-[#718096]">
              Protokol HTTPS / MQTT TLS via modem SIM7600. Jika sinyal drop, telemetri dibuffer ke MicroSD card SPI.
            </p>
          </div>

          {/* Node 3 */}
          <div className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-[#192A20]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#D97706] text-white text-[10px]">3</span>
              <span>Inference & Ingestion</span>
            </div>
            <p className="text-[11px] text-[#718096]">
              Backend PostgreSQL memvalidasi sequence packet. Worker model YOLOv8 mendeteksi hama dan menghitung bounding box.
            </p>
          </div>

          {/* Node 4 */}
          <div className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-[#192A20]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2B6CB0] text-white text-[10px]">4</span>
              <span>Dashboard & PHT</span>
            </div>
            <p className="text-[11px] text-[#718096]">
              Web dashboard memvisualisasikan tren populasi, mengirim peringatan lonjakan hama via Telegram, dan mengeksekusi komando.
            </p>
          </div>
        </div>
      </div>

      {/* Code / Documentation Display Box */}
      <div className="rounded-xl border border-[#E2E8F0] bg-[#1E293B] text-slate-100 shadow-md overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-5 py-3 text-xs">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-[#4ADE80]" />
            <span className="font-mono font-bold text-white">
              {activeSchemaTab === 'sql'
                ? 'schema_v1_smart_light_trap.sql'
                : activeSchemaTab === 'api'
                ? 'api_contract_v1_specification.json'
                : 'esp32s3_pinout_peripheral_matrix.txt'}
            </span>
          </div>

          <button
            onClick={() =>
              copyToClipboard(
                activeSchemaTab === 'sql'
                  ? sqlSchemaSnippet
                  : activeSchemaTab === 'api'
                  ? apiSnippet
                  : hardwareSnippet,
                activeSchemaTab
              )
            }
            className="flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            {copiedSection === activeSchemaTab ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#4ADE80]" />
                <span className="text-[#4ADE80]">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Salin Kontrak</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-5 font-mono text-[11px] leading-relaxed overflow-x-auto text-slate-200 selection:bg-[#2D6A4F] selection:text-white">
          {activeSchemaTab === 'sql' && sqlSchemaSnippet}
          {activeSchemaTab === 'api' && apiSnippet}
          {activeSchemaTab === 'hardware' && hardwareSnippet}
        </pre>
      </div>
    </div>
  );
};
