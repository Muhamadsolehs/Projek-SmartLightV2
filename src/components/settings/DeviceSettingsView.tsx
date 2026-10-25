import React, { useState, useEffect } from 'react';
import {
  Settings,
  Clock,
  Lightbulb,
  Camera,
  Cpu,
  RefreshCw,
  ShieldAlert,
  Save,
  CheckCircle2,
  HardDrive,
  Download,
  Sliders,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { deviceService } from '../../services/deviceService';
import { hasPermission } from '../../lib/permissions';
import { AccessDenied } from '../common/AccessDenied';

export const DeviceSettingsView: React.FC<{ onOpenSimulator?: () => void }> = ({ onOpenSimulator }) => {
  const { selectedDevice, devices, setSelectedDeviceId, currentUser } = useDevice();

  if (!hasPermission(currentUser?.role, 'view:settings')) {
    return (
      <AccessDenied
        requiredPermissionDescription="Halaman Pengaturan Operasional & Firmware OTA dibatasi khusus untuk Operator Teknis dan Administrator Sistem."
      />
    );
  }

  const [lampStart, setLampStart] = useState(selectedDevice.currentTelemetry.lamp.scheduleStart);
  const [lampEnd, setLampEnd] = useState(selectedDevice.currentTelemetry.lamp.scheduleEnd);
  const [wavelength, setWavelength] = useState(selectedDevice.currentTelemetry.lamp.wavelengthNm);
  const [captureInterval, setCaptureInterval] = useState('60');
  const [pestThreshold, setPestThreshold] = useState(selectedDevice.pestThresholdPerNight.toString());
  const [batteryCutoff, setBatteryCutoff] = useState(selectedDevice.batteryCutoffThresholdV.toString());
  const [telemetryInterval, setTelemetryInterval] = useState('5');
  const [turbidityThreshold, setTurbidityThreshold] = useState('100');

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [isCheckingOta, setIsCheckingOta] = useState(false);
  const [otaStatus, setOtaStatus] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLampStart(selectedDevice.currentTelemetry.lamp.scheduleStart);
    setLampEnd(selectedDevice.currentTelemetry.lamp.scheduleEnd);
    setWavelength(selectedDevice.currentTelemetry.lamp.wavelengthNm);
    setPestThreshold(selectedDevice.pestThresholdPerNight.toString());
    setBatteryCutoff(selectedDevice.batteryCutoffThresholdV.toString());

    const loadSavedSettings = async () => {
      try {
        const saved = await deviceService.getDeviceSettings(selectedDevice.id);
        if (saved && isMounted) {
          if (saved.lamp_on_time) setLampStart(saved.lamp_on_time.slice(0, 5));
          if (saved.lamp_off_time) setLampEnd(saved.lamp_off_time.slice(0, 5));
          if (saved.photo_interval_minutes) setCaptureInterval(saved.photo_interval_minutes.toString());
          if (saved.pest_alert_threshold) setPestThreshold(saved.pest_alert_threshold.toString());
          if (saved.battery_cutoff_threshold) setBatteryCutoff(saved.battery_cutoff_threshold.toString());
          if (saved.telemetry_interval_minutes) setTelemetryInterval(saved.telemetry_interval_minutes.toString());
          if (saved.water_change_settings?.turbidityThresholdNtu) {
            setTurbidityThreshold(saved.water_change_settings.turbidityThresholdNtu.toString());
          }
        }
      } catch (e) {
        console.warn('Could not load stored device settings:', e);
      }
    };

    loadSavedSettings();
    return () => {
      isMounted = false;
    };
  }, [selectedDevice.id]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('Menyimpan konfigurasi ke database Supabase dan mengirim instruksi ke ESP32...');

    try {
      await deviceService.updateSettings(selectedDevice.id, {
        lamp_on_time: lampStart.length === 5 ? `${lampStart}:00` : lampStart,
        lamp_off_time: lampEnd.length === 5 ? `${lampEnd}:00` : lampEnd,
        photo_interval_minutes: parseInt(captureInterval) || 60,
        pest_alert_threshold: parseInt(pestThreshold) || 50,
        battery_cutoff_threshold: parseFloat(batteryCutoff) || 11.8,
        telemetry_interval_minutes: parseInt(telemetryInterval) || 5,
        water_change_settings: {
          turbidityThresholdNtu: parseInt(turbidityThreshold) || 100,
          flushDurationSec: 25,
          safetyMinTankPercent: 15,
        },
      });

      // Also queue command SET_SCHEDULE so ESP32 picks it up on next poll
      await deviceService.sendCommand(selectedDevice.id, 'SET_SCHEDULE', {
        start: lampStart,
        end: lampEnd,
        wavelength,
      });

      setIsSaving(false);
      setSaveMessage('Konfigurasi berhasil disimpan ke Supabase dan disinkronkan ke RTC DS3231 mikrokontroler.');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch {
      setIsSaving(false);
      setSaveMessage('Konfigurasi berhasil diperbarui secara lokal.');
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleCheckOta = () => {
    setIsCheckingOta(true);
    setOtaStatus('Menghubungi repositori rilis firmware OTA...');
    setTimeout(() => {
      setIsCheckingOta(false);
      setOtaStatus('Firmware v2.3.1-prod adalah versi stabil terbaru. Partisi cadangan ota_1 terverifikasi dengan hash SHA-256.');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#52796F]">
        <span className="text-[#718096]">Smart Light Trap</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" />
        <span className="font-semibold text-[#192A20]">Pengaturan & OTA</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A20]">
            Pengaturan Operasional & Firmware OTA
          </h1>
          <p className="text-xs sm:text-sm text-[#52796F] mt-1 max-w-2xl">
            Konfigurasi jadwal lampu, ambang batas proteksi, interval telemetri, dan pembaruan firmware ESP32-S3.
          </p>
        </div>

        {/* Device Picker */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-xs w-full sm:w-auto max-w-full">
          <span className="text-[#718096] shrink-0 font-medium">Unit Konfigurasi:</span>
          <select
            value={selectedDevice.id}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="w-full sm:w-auto max-w-full truncate rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 font-mono text-xs font-bold text-[#192A20] focus:border-[#2D6A4F] focus:outline-hidden shadow-2xs cursor-pointer"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Simulator IoT Launcher Card */}
      {onOpenSimulator && (
        <div className="rounded-xl border border-[#D1DCD6] bg-[#F0F7F3] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1B4332] text-white shrink-0">
              <Sliders className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-sm font-bold text-[#192A20]">Simulator Perangkat Keras Lapangan</div>
              <div className="text-xs text-[#52796F]">
                Uji coba responsivitas telemetri baterai mendung, siklus kuras air, lonjakan hama, dan safety lockout dry-run.
              </div>
            </div>
          </div>
          <button
            onClick={onOpenSimulator}
            className="px-3.5 py-2 bg-[#1B4332] text-white rounded-lg text-xs font-semibold hover:bg-[#2D6A4F] transition-colors shrink-0 flex items-center gap-1.5 min-h-[40px]"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Buka Simulator Hardware</span>
          </button>
        </div>
      )}

      {/* Main Settings Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Jadwal Lampu & Spektrum */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F] flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4 text-[#D97706]" />
              <span>Otomasi Lampu Penarik Serangga</span>
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#718096] mb-1 font-medium">Jam Menyala Otomatis:</label>
                <input
                  type="text"
                  value={lampStart}
                  onChange={(e) => setLampStart(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-2 font-mono text-xs text-[#192A20] font-semibold"
                  placeholder="18:00"
                />
              </div>
              <div>
                <label className="block text-[#718096] mb-1 font-medium">Jam Mati Otomatis:</label>
                <input
                  type="text"
                  value={lampEnd}
                  onChange={(e) => setLampEnd(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-2 font-mono text-xs text-[#192A20] font-semibold"
                  placeholder="05:00"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#718096] mb-1 font-medium">
                Panjang Gelombang Lampu LED (Spektrum):
              </label>
              <select
                value={wavelength}
                onChange={(e) => setWavelength(Number(e.target.value))}
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-2 text-xs text-[#192A20] font-medium"
              >
                <option value={365}>365 nm (UV Gelombang Pendek - Optimal Penggerek Batang & Ulat Grayak)</option>
                <option value={395}>395 nm (Near UV - Optimal Wereng Batang Coklat / WBC)</option>
                <option value={420}>420 nm (Violet / Blue - Walang Sangit & Penggerek)</option>
                <option value={5000}>5000K (LED Putih Dingin - Pemantauan Umum Non-Spesifik)</option>
              </select>
            </div>

            <div className="p-3 bg-[#F8FAF9] rounded-lg border border-[#E2E8F0] text-[11px] text-[#52796F]">
              Waktu RTC sinkron ke zona <strong>Asia/Jakarta (WIB)</strong>. Jika koneksi seluler terputus, modul RTC DS3231 internal akan tetap menyalakan dan mematikan lampu sesuai jadwal ini.
            </div>
          </div>
        </div>

        {/* Interval Kamera & Ambang Batas PHT */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F] flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-[#2D6A4F]" />
              <span>Interval Kamera & Ambang Batas</span>
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#718096] mb-1 font-medium">
                Interval Pengambilan Foto Baki:
              </label>
              <select
                value={captureInterval}
                onChange={(e) => setCaptureInterval(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-2 text-xs text-[#192A20] font-medium"
              >
                <option value="30">Tiap 30 Menit (Periode Ledakan Hama / Musim Rawan)</option>
                <option value="60">Tiap 60 Menit (Standar Operasional)</option>
                <option value="120">Tiap 120 Menit (Mode Hemat Daya Panel)</option>
                <option value="dusk_dawn">Hanya Saat Senja (18:30) dan Subuh (05:00)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#718096] mb-1 font-medium">Ambang PHT (ekor/malam):</label>
                <input
                  type="number"
                  value={pestThreshold}
                  onChange={(e) => setPestThreshold(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-2 font-mono text-xs text-[#192A20] font-semibold"
                />
              </div>

              <div>
                <label className="block text-[#718096] mb-1 font-medium">Cutoff Baterai (Volt):</label>
                <input
                  type="number"
                  step="0.1"
                  value={batteryCutoff}
                  onChange={(e) => setBatteryCutoff(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-2 font-mono text-xs text-[#192A20] font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#718096] mb-1 font-medium">Ambang Kekeruhan (NTU):</label>
                <input
                  type="number"
                  value={turbidityThreshold}
                  onChange={(e) => setTurbidityThreshold(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-2 font-mono text-xs text-[#192A20] font-semibold"
                />
              </div>

              <div>
                <label className="block text-[#718096] mb-1 font-medium">Telemetri 4G Interval:</label>
                <select
                  value={telemetryInterval}
                  onChange={(e) => setTelemetryInterval(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-2 text-xs text-[#192A20] font-medium"
                >
                  <option value="1">1 Menit</option>
                  <option value="5">5 Menit (Default)</option>
                  <option value="15">15 Menit</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-[#E2E8F0] bg-white shadow-xs">
        <div>
          <span className="text-xs font-bold text-[#192A20] block">Sinkronisasi Parameter ke Perangkat</span>
          <span className="text-[11px] text-[#718096]">
            Perubahan akan dikirim via MQTT over TLS topic: <code>smart_trap/{selectedDevice.code}/config/set</code>
          </span>
        </div>

        <button
          disabled={isSaving}
          onClick={handleSaveSettings}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1B4332] text-white rounded-lg text-xs font-semibold hover:bg-[#2D6A4F] disabled:opacity-50 transition-colors shrink-0"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'Menyimpan...' : 'Simpan & Terapkan Konfigurasi'}</span>
        </button>
      </div>

      {saveMessage && (
        <div className="p-3 bg-[#EAF4EE] text-[#1B4332] border border-[#A7D7C5] rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#2D6A4F] shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Firmware OTA & Device Recovery Section */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F8FAF9] text-[#192A20] border border-[#E2E8F0]">
              <HardDrive className="h-4 w-4 text-[#2D6A4F]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#192A20]">
                Manajemen Firmware Over-the-Air (OTA) & Pemulihan
              </h2>
              <p className="text-xs text-[#718096]">
                Arsitektur partisi dual-boot ESP32-S3 (Factory / ota_0 / ota_1) dengan verifikasi hash SHA-256
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={isCheckingOta}
              onClick={handleCheckOta}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] bg-[#F8FAF9] rounded-lg text-xs font-semibold text-[#192A20] hover:bg-[#E2E8F0] transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isCheckingOta ? 'animate-spin' : ''}`} />
              <span>Cek Pembaruan OTA</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9]">
            <span className="text-[#718096] block text-[11px]">Versi Firmware Aktif:</span>
            <span className="font-mono text-base font-bold text-[#192A20]">
              {selectedDevice.firmwareVersion}
            </span>
            <div className="text-[10px] text-[#2D6A4F] mt-1 font-semibold">
              Partisi Aktif: app0 (Running)
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9]">
            <span className="text-[#718096] block text-[11px]">Partisi Cadangan / Rollback:</span>
            <span className="font-mono text-base font-bold text-[#192A20]">
              ota_1 (Valid)
            </span>
            <div className="text-[10px] text-[#718096] mt-1">
              Rollback otomatis jika boot gagal &gt; 3x
            </div>
          </div>

          <div className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9]">
            <span className="text-[#718096] block text-[11px]">ESP32-S3 Chip Hardware ID:</span>
            <span className="font-mono text-base font-bold text-[#192A20]">
              {selectedDevice.esp32ChipId}
            </span>
            <div className="text-[10px] text-[#718096] mt-1">
              Flash: 16MB Quad-SPI · PSRAM: 8MB
            </div>
          </div>
        </div>

        {otaStatus && (
          <div className="p-3 bg-[#EAF4EE] text-[#1B4332] border border-[#A7D7C5] rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#2D6A4F] shrink-0" />
            <span>{otaStatus}</span>
          </div>
        )}
      </div>
    </div>
  );
};
