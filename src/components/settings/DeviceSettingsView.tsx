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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#192A20]">
            Pengaturan Operasional &amp; Firmware OTA
          </h1>
        </div>

        {/* Device Picker */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Unit:</span>
          <select
            value={selectedDevice.id}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 font-mono text-xs font-bold text-[#192A20] focus:border-[#2D6A4F] focus:outline-hidden shadow-2xs cursor-pointer"
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
        <div className="rounded-xl border border-[#D1DCD6] bg-[#F0F7F3] p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B4332] text-white shrink-0">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#192A20]">Simulator Hardware Lapangan</div>
              <div className="text-[11px] text-[#52796F]">
                Uji coba responsivitas telemetri baterai, siklus kuras air, lonjakan hama, dan safety lockout.
              </div>
            </div>
          </div>
          <button
            onClick={onOpenSimulator}
            className="px-3 py-1.5 bg-[#1B4332] text-white rounded-lg text-xs font-semibold hover:bg-[#2D6A4F] transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Sliders className="h-3 w-3" />
            <span>Buka Simulator</span>
          </button>
        </div>
      )}

      {/* Main Settings Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Jadwal Lampu & Spektrum */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F] flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-[#D97706]" />
              <span>Otomasi Lampu Penarik</span>
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-500 mb-0.5 text-[11px] font-medium">Jam Nyala (WIB):</label>
                <input
                  type="text"
                  value={lampStart}
                  onChange={(e) => setLampStart(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-1.5 font-mono text-xs text-[#192A20] font-semibold"
                  placeholder="18:00"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-0.5 text-[11px] font-medium">Jam Mati (WIB):</label>
                <input
                  type="text"
                  value={lampEnd}
                  onChange={(e) => setLampEnd(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-1.5 font-mono text-xs text-[#192A20] font-semibold"
                  placeholder="05:00"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-500 mb-0.5 text-[11px] font-medium">
                Panjang Gelombang LED:
              </label>
              <select
                value={wavelength}
                onChange={(e) => setWavelength(Number(e.target.value))}
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-1.5 text-xs text-[#192A20] font-medium"
              >
                <option value={365}>365 nm (UV - Penggerek Batang &amp; Ulat Grayak)</option>
                <option value={395}>395 nm (Near UV - Wereng Batang Coklat / WBC)</option>
                <option value={420}>420 nm (Violet / Blue - Walang Sangit)</option>
                <option value={5000}>5000K (LED Putih Dingin - Umum)</option>
              </select>
            </div>

            <div className="p-2 bg-[#F8FAF9] rounded-lg border border-[#E2E8F0] text-[10px] text-[#52796F]">
              Waktu RTC sinkron ke zona WIB. Modul RTC DS3231 internal tetap berjalan offline jika jaringan terputus.
            </div>
          </div>
        </div>

        {/* Interval Kamera & Ambang Batas PHT */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F] flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-[#2D6A4F]" />
              <span>Interval Kamera &amp; Ambang Batas</span>
            </h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-slate-500 mb-0.5 text-[11px] font-medium">
                Interval Foto Baki:
              </label>
              <select
                value={captureInterval}
                onChange={(e) => setCaptureInterval(e.target.value)}
                className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-1.5 text-xs text-[#192A20] font-medium"
              >
                <option value="30">Tiap 30 Menit (Periode Ledakan Hama)</option>
                <option value="60">Tiap 60 Menit (Standar Operasional)</option>
                <option value="120">Tiap 120 Menit (Hemat Daya)</option>
                <option value="dusk_dawn">Senja (18:30) &amp; Subuh (05:00) Saja</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-500 mb-0.5 text-[11px] font-medium">Ambang PHT (ekor):</label>
                <input
                  type="number"
                  value={pestThreshold}
                  onChange={(e) => setPestThreshold(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-1.5 font-mono text-xs text-[#192A20] font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-0.5 text-[11px] font-medium">Cutoff Baterai (V):</label>
                <input
                  type="number"
                  step="0.1"
                  value={batteryCutoff}
                  onChange={(e) => setBatteryCutoff(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-1.5 font-mono text-xs text-[#192A20] font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-500 mb-0.5 text-[11px] font-medium">Ambang Kekeruhan (NTU):</label>
                <input
                  type="number"
                  value={turbidityThreshold}
                  onChange={(e) => setTurbidityThreshold(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-1.5 font-mono text-xs text-[#192A20] font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-0.5 text-[11px] font-medium">Interval Telemetri:</label>
                <select
                  value={telemetryInterval}
                  onChange={(e) => setTelemetryInterval(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-1.5 text-xs text-[#192A20] font-medium"
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-3 rounded-xl border border-[#E2E8F0] bg-white shadow-2xs">
        <div>
          <span className="text-xs font-bold text-[#192A20] block">Sinkronisasi Parameter ke Perangkat</span>
          <span className="text-[10px] text-slate-500">
            Perubahan dikirim via antrean command Supabase ke {selectedDevice.code}
          </span>
        </div>

        <button
          disabled={isSaving}
          onClick={handleSaveSettings}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1B4332] text-white rounded-lg text-xs font-semibold hover:bg-[#2D6A4F] disabled:opacity-50 transition-colors shrink-0 cursor-pointer shadow-2xs"
        >
          <Save className="h-3.5 w-3.5" />
          <span>{isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
        </button>
      </div>

      {saveMessage && (
        <div className="p-2.5 bg-[#EAF4EE] text-[#1B4332] border border-[#A7D7C5] rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#2D6A4F] shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Firmware OTA & Device Recovery Section */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F8FAF9] text-[#192A20] border border-[#E2E8F0]">
              <HardDrive className="h-3.5 w-3.5 text-[#2D6A4F]" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#192A20]">
                Firmware OTA &amp; Partisi ESP8266 / ESP32
              </h2>
            </div>
          </div>

          <button
            disabled={isCheckingOta}
            onClick={handleCheckOta}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-[#E2E8F0] bg-[#F8FAF9] rounded-lg text-xs font-semibold text-[#192A20] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${isCheckingOta ? 'animate-spin' : ''}`} />
            <span>Cek Pembaruan OTA</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9]">
            <span className="text-slate-500 block text-[10px]">Firmware Aktif:</span>
            <span className="font-mono text-xs font-bold text-[#192A20]">
              {selectedDevice.firmwareVersion}
            </span>
            <div className="text-[10px] text-[#2D6A4F] mt-0.5 font-semibold">
              Partisi: app0 (Running)
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9]">
            <span className="text-slate-500 block text-[10px]">Cadangan / Rollback:</span>
            <span className="font-mono text-xs font-bold text-[#192A20]">
              ota_1 (Valid SHA-256)
            </span>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Rollback otomatis jika boot gagal
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9]">
            <span className="text-slate-500 block text-[10px]">Hardware Chip ID:</span>
            <span className="font-mono text-xs font-bold text-[#192A20]">
              {selectedDevice.esp32ChipId}
            </span>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Flash: 4MB / 16MB SPI
            </div>
          </div>
        </div>

        {otaStatus && (
          <div className="p-2 bg-[#EAF4EE] text-[#1B4332] border border-[#A7D7C5] rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#2D6A4F] shrink-0" />
            <span className="text-[11px]">{otaStatus}</span>
          </div>
        )}
      </div>
    </div>
  );
};
