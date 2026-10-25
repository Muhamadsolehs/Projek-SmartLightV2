/**
 * Type definitions for Smart Light Trap IoT Agritech System
 */

export type InsectSpeciesId =
  | 'scirpophaga_incertulas'  // Penggerek Batang Padi Kuning (Yellow Stem Borer)
  | 'nilaparvata_lugens'      // Wereng Batang Coklat (Brown Planthopper)
  | 'spodoptera_frugiperda'   // Ulat Grayak Jagung / Padi (Fall Armyworm)
  | 'leptocorisa_oratoria'    // Walang Sangit (Rice Bug)
  | 'cnaphalocrocis_medinalis'// Hama Putih Palsu (Rice Leaf Folder)
  | 'other_neutral'           // Serangga Netral / Non-Hama
  | 'unidentified';           // Belum Teridentifikasi

export interface InsectSpecies {
  id: InsectSpeciesId;
  commonName: string;
  scientificName: string;
  family: string;
  isTargetPest: boolean;
  economicThresholdPerNight: number; // Ambang Kendali PHT
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  preferredWavelengthNm: number; // e.g. 365nm UV, 395nm, 420nm
  description: string;
}

export interface BoundingBox {
  id: string;
  speciesId: InsectSpeciesId;
  confidence: number; // 0.0 - 1.0
  x: number; // % relative to image
  y: number;
  width: number;
  height: number;
  isManuallyVerified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface CaptureImage {
  id: string;
  deviceId: string;
  timestamp: string; // ISO Asia/Jakarta
  imageUrl: string;
  resolution: string;
  totalPests: number;
  targetPestsCount: number;
  otherInsectsCount: number;
  avgConfidence: number;
  modelVersion: string; // e.g., "YOLOv8-AgriPest v1.4-Edge"
  isManuallyVerified: boolean;
  bboxes: BoundingBox[];
  notes?: string;
}

export interface INA226Telemetry {
  busVoltageV: number;      // Tegangan Bus (e.g. 12.8V - 14.4V)
  shuntVoltageMv: number;   // Tegangan Shunt (mV)
  currentMa: number;        // Arus (mA) (+ = charging solar, - = discharging beban)
  powerMw: number;          // Daya (mW)
  isCharging: boolean;
  solarIrradianceEstimateWm2: number;
}

export interface WaterSystemTelemetry {
  trayLevelPercent: number;    // 0 - 100%
  trayLevelCm: number;         // Jarak/Kedalaman air di baki (cm)
  tankLevelPercent: number;    // 0 - 100% tandon cadangan
  tankVolumeLiters: number;    // Kapasitas tersisa dari total misal 50L
  turbidityNtu: number;        // Nilai kekeruhan air (NTU)
  isTurbid: boolean;           // > 100 NTU = Perlu dikuras
  drainValveStatus: 'closed' | 'open' | 'fault';
  fillPumpStatus: 'idle' | 'running' | 'fault' | 'dry_run_lockout';
  lastWaterChange: string;     // ISO timestamp
  safetyLockout: boolean;      // True jika tandon < 15% atau baki overflow
}

export interface LampStatus {
  isActive: boolean;
  mode: 'schedule_auto' | 'manual_override' | 'eco_low_battery';
  scheduleStart: string; // "18:00"
  scheduleEnd: string;   // "05:00"
  wavelengthNm: number;  // 365
  ledCurrentMa: number;  // Pemantauan sensor arus driver LED (e.g. 850mA)
  isHealthy: boolean;    // Deteksi jika driver gagal / lampu putus
}

export interface DeviceTelemetry {
  id: string;
  deviceId: string;
  timestamp: string;
  sequenceNumber: number;
  battery: INA226Telemetry;
  water: WaterSystemTelemetry;
  lamp: LampStatus;
  connectivity: {
    networkType: '4G_LTE' | '2G_FALLBACK' | 'OFFLINE';
    rssiDbm: number;
    operator: string;
    unsyncedMicroSdPackets: number; // Antrian data offline
  };
  temperatureC: number;
  humidityPercent: number;
}

export interface DeviceCommand {
  id: string;
  deviceId: string;
  commandType:
    | 'FORCE_WATER_CHANGE'
    | 'TOGGLE_LAMP'
    | 'CAPTURE_NOW'
    | 'SYNC_MICROSD'
    | 'REBOOT_ESP32'
    | 'UPDATE_FIRMWARE_OTA'
    | 'SET_SCHEDULE'
    | 'SET_RELAY';
  parameters?: Record<string, any>;
  status: 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  executedAt?: string;
  responseMessage?: string;
}

export interface DeviceAlert {
  id: string;
  deviceId: string;
  deviceName: string;
  location: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'pest_threshold' | 'battery_low' | 'water_critical' | 'device_offline' | 'sensor_fault' | 'lamp_fault';
  title: string;
  message: string;
  timestamp: string;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  actionTaken?: string;
}

export interface SmartLightTrapDevice {
  id: string;
  code: string;               // e.g. "SLT-KRW-01"
  name: string;
  locationName: string;
  farmSector: string;
  latitude: number;
  longitude: number;
  cropType: string;           // e.g. "Padi Varietas Ciherang", "Inpari 32"
  plantingDate: string;
  status: 'online' | 'offline' | 'warning' | 'maintenance';
  firmwareVersion: string;
  esp32ChipId: string;
  rtcStatus: 'synced_ds3231' | 'drift_detected';
  currentTelemetry: DeviceTelemetry;
  batteryCutoffThresholdV: number; // e.g. 11.8V
  pestThresholdPerNight: number;   // e.g. 50
  lastSyncAt: string;
  isSimulated?: boolean;
}

export interface WaterChangeLog {
  id: string;
  deviceId: string;
  startedAt: string;
  completedAt: string;
  triggerReason: 'turbidity_high' | 'scheduled_interval' | 'manual_operator';
  initialTurbidityNtu: number;
  finalTurbidityNtu: number;
  waterUsedLiters: number;
  status: 'SUCCESS' | 'ABORTED_EMPTY_TANK' | 'OVERFLOW_SAFETY_STOP';
}

export type UserRole = 'admin' | 'operator' | 'analyst' | 'viewer';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
  assignedRegion: string;
}

export interface DailyPestTrend {
  date: string;
  dayLabel: string;
  stemBorer: number;
  planthopper: number;
  armyworm: number;
  riceBug: number;
  leafFolder: number;
  otherInsects: number;
  totalTarget: number;
  totalAll: number;
  thresholdAlert: boolean;
}

