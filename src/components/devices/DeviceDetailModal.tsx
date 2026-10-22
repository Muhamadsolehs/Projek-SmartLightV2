import React, { useState } from 'react';
import {
  X,
  Activity,
  Battery,
  Droplets,
  Lightbulb,
  Radio,
  Clock,
  RotateCcw,
  Play,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Layers,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { SmartLightTrapDevice, DeviceCommand } from '../../types';
import { useDevice } from '../../context/DeviceContext';

export const DeviceDetailModal: React.FC<{
  device: SmartLightTrapDevice | null;
  isOpen: boolean;
  onClose: () => void;
}> = ({ device, isOpen, onClose }) => {
  const { commands, sendCommand, captures, triggerHardwareSimulation } = useDevice();
  const [activeSubTab, setActiveSubTab] = useState<'telemetry' | 'camera' | 'controls' | 'audit'>('telemetry');
  const [isExecutingCmd, setIsExecutingCmd] = useState(false);
  const [cmdFeedback, setCmdFeedback] = useState<string | null>(null);

  if (!isOpen || !device) return null;

  const tel = device.currentTelemetry;
  const deviceCommands = commands.filter((c) => c.deviceId === device.id);
  const latestCapture = captures.find((c) => c.deviceId === device.id) || captures[0];

  const handleCommand = async (cmdType: DeviceCommand['commandType'], params?: Record<string, any>) => {
    setIsExecutingCmd(true);
    setCmdFeedback(`Mengirim perintah ${cmdType} melalui enkripsi TLS...`);
    try {
      const result = await sendCommand(device.id, cmdType, params);
      setCmdFeedback(`Status: ${result.status} — ${result.responseMessage || 'Perintah tuntas'}`);
    } catch {
      setCmdFeedback('Gagal mengirim perintah ke perangkat.');
    } finally {
      setIsExecutingCmd(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-xl border border-[#E2E8F0] bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAF9] px-4 sm:px-6 py-3.5 sm:py-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-[#1B4332] text-white shrink-0">
              <Radio className="h-4 sm:h-5 w-4 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-mono text-xs font-bold text-[#2D6A4F] bg-[#EAF4EE] px-2 py-0.5 rounded shrink-0">
                  {device.code}
                </span>
                <h2 className="text-sm sm:text-base font-bold text-[#192A20] truncate">{device.name}</h2>
              </div>
              <p className="text-xs text-[#718096] mt-0.5 truncate">
                {device.locationName} · {device.farmSector} ({device.cropType})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#718096] hover:bg-[#E2E8F0] hover:text-[#192A20] transition-colors shrink-0"
            aria-label="Tutup detail perangkat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-tab Navigation (Scrollable horizontally on mobile) */}
        <div className="flex border-b border-[#E2E8F0] bg-white px-4 sm:px-6 overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            onClick={() => setActiveSubTab('telemetry')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'telemetry'
                ? 'border-[#2D6A4F] text-[#1B4332]'
                : 'border-transparent text-[#718096] hover:text-[#192A20]'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Telemetri & INA226</span>
          </button>
          <button
            onClick={() => setActiveSubTab('camera')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'camera'
                ? 'border-[#2D6A4F] text-[#1B4332]'
                : 'border-transparent text-[#718096] hover:text-[#192A20]'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>Kamera & CV</span>
          </button>
          <button
            onClick={() => setActiveSubTab('controls')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'controls'
                ? 'border-[#2D6A4F] text-[#1B4332]'
                : 'border-transparent text-[#718096] hover:text-[#192A20]'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Kontrol Jarak Jauh</span>
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeSubTab === 'audit'
                ? 'border-[#2D6A4F] text-[#1B4332]'
                : 'border-transparent text-[#718096] hover:text-[#192A20]'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Log Audit Komando</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* TAB 1: TELEMETRY */}
          {activeSubTab === 'telemetry' && (
            <div className="space-y-6">
              {/* Telemetry Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9]">
                  <div className="text-[11px] text-[#718096]">Tegangan Baterai Bus</div>
                  <div className="font-mono text-lg font-bold tabular-nums text-[#192A20] mt-0.5">
                    {tel.battery.busVoltageV.toFixed(2)} V
                  </div>
                  <div className="text-[10px] text-[#2D6A4F] mt-1 font-semibold">
                    INA226 I2C (0x40) · Shunt: {tel.battery.shuntVoltageMv.toFixed(1)} mV
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9]">
                  <div className="text-[11px] text-[#718096]">Arus Baterai (Netto)</div>
                  <div className="font-mono text-lg font-bold tabular-nums text-[#192A20] mt-0.5">
                    {tel.battery.currentMa > 0 ? `+${tel.battery.currentMa}` : tel.battery.currentMa} mA
                  </div>
                  <div className="text-[10px] text-[#718096] mt-1">
                    {tel.battery.isCharging ? 'Solar Charging' : 'Discharging (Lampu Beban)'}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9]">
                  <div className="text-[11px] text-[#718096]">Kekeruhan Baki Air</div>
                  <div className={`font-mono text-lg font-bold tabular-nums mt-0.5 ${tel.water.isTurbid ? 'text-[#DC2626]' : 'text-[#2D6A4F]'}`}>
                    {tel.water.turbidityNtu} NTU
                  </div>
                  <div className="text-[10px] text-[#718096] mt-1">
                    {tel.water.isTurbid ? 'Perlu Kuras (>100 NTU)' : 'Air Bersih (<50 NTU)'}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9]">
                  <div className="text-[11px] text-[#718096]">Level Tandon Cadangan</div>
                  <div className={`font-mono text-lg font-bold tabular-nums mt-0.5 ${tel.water.tankLevelPercent < 20 ? 'text-[#DC2626]' : 'text-[#192A20]'}`}>
                    {tel.water.tankLevelPercent}% ({tel.water.tankVolumeLiters}L)
                  </div>
                  <div className="text-[10px] text-[#718096] mt-1">
                    Sensor Ultrasonik JSN-SR04T
                  </div>
                </div>
              </div>

              {/* Hardware Subsystem Detail Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Modul Lampu UV */}
                <div className="p-4 rounded-lg border border-[#E2E8F0] bg-white space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                    <span className="font-bold text-[#192A20] flex items-center gap-1.5">
                      <Lightbulb className="h-4 w-4 text-[#D97706]" />
                      Modul Lampu Penarik Serangga
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      tel.lamp.isActive ? 'bg-[#EAF4EE] text-[#2D6A4F]' : 'bg-[#E2E8F0] text-[#718096]'
                    }`}>
                      {tel.lamp.isActive ? 'MENYALA' : 'STANDBY'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-[#718096]">Panjang Gelombang:</span>
                      <p className="font-mono font-bold text-[#192A20]">{tel.lamp.wavelengthNm} nm (Near UV)</p>
                    </div>
                    <div>
                      <span className="text-[#718096]">Jadwal Otomatis:</span>
                      <p className="font-mono font-bold text-[#192A20]">{tel.lamp.scheduleStart} - {tel.lamp.scheduleEnd} WIB</p>
                    </div>
                    <div>
                      <span className="text-[#718096]">Arus Driver LED:</span>
                      <p className="font-mono font-bold text-[#192A20]">{tel.lamp.ledCurrentMa} mA</p>
                    </div>
                    <div>
                      <span className="text-[#718096]">Kondisi Driver:</span>
                      <p className="font-semibold text-[#2D6A4F]">Sehat & Terpantau</p>
                    </div>
                  </div>
                </div>

                {/* Konektivitas 4G & RTC */}
                <div className="p-4 rounded-lg border border-[#E2E8F0] bg-white space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                    <span className="font-bold text-[#192A20] flex items-center gap-1.5">
                      <Wifi className="h-4 w-4 text-[#2D6A4F]" />
                      Konektivitas & Jam Lapangan
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#EAF4EE] text-[#2D6A4F]">
                      {tel.connectivity.networkType}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-[#718096]">Kekuatan Sinyal (RSSI):</span>
                      <p className="font-mono font-bold text-[#192A20]">{tel.connectivity.rssiDbm} dBm</p>
                    </div>
                    <div>
                      <span className="text-[#718096]">Kartu SIM IoT:</span>
                      <p className="font-medium text-[#192A20]">{tel.connectivity.operator}</p>
                    </div>
                    <div>
                      <span className="text-[#718096]">RTC Backup:</span>
                      <p className="font-mono font-bold text-[#2D6A4F]">DS3231 I2C Synced</p>
                    </div>
                    <div>
                      <span className="text-[#718096]">Antrian MicroSD:</span>
                      <p className="font-mono font-bold text-[#192A20]">
                        {tel.connectivity.unsyncedMicroSdPackets} paket tertunda
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Keselamatan Hidraulik */}
              <div className="p-4 rounded-lg border border-[#D1DCD6] bg-[#F8FAF9] text-xs space-y-2">
                <div className="font-bold text-[#192A20] flex items-center justify-between">
                  <span>Proteksi Interlock Hidraulik Baki & Pompa</span>
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                    tel.water.safetyLockout ? 'bg-[#FEE2E2] text-[#DC2626]' : 'bg-[#EAF4EE] text-[#2D6A4F]'
                  }`}>
                    {tel.water.safetyLockout ? 'SAFETY LOCKOUT AKTIF' : 'INTERLOCK AMAN'}
                  </span>
                </div>
                <p className="text-[#52796F] text-[11px]">
                  Firmware memvalidasi 3 syarat sebelum menyalakan pompa: (1) Tandon &ge; 15%, (2) Katup drain tertutup rapat, (3) Timeout maksimal pengisian 45 detik untuk mencegah luapan baki penampung.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: CAMERA & CV */}
          {activeSubTab === 'camera' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <h3 className="font-bold text-[#192A20]">Snapshot Baki Perangkap Terakhir</h3>
                  <p className="text-[#718096]">Diambil pada {latestCapture.timestamp} · Resolusi {latestCapture.resolution}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-xs text-[#2D6A4F]">
                    {latestCapture.modelVersion}
                  </span>
                  <div className="text-[11px] text-[#718096]">
                    Akurasi Rata-rata: {(latestCapture.avgConfidence * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* High-fidelity Vector Representation of Capture Tray with bounding boxes */}
              <div className="relative aspect-video w-full rounded-lg border border-[#CBD5E1] bg-[#1A261F] overflow-hidden flex items-center justify-center shadow-inner">
                {/* Illumination LED gradient effect */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(120,180,140,0.25)_0%,_rgba(10,20,15,0.95)_75%)]" />

                {/* Water surface reflections and grid marker */}
                <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#40916C" strokeWidth="0.3" strokeDasharray="1 1" />
                  <line x1="8" y1="50" x2="92" y2="50" stroke="#40916C" strokeWidth="0.2" />
                  <line x1="50" y1="8" x2="50" y2="92" stroke="#40916C" strokeWidth="0.2" />
                </svg>

                {/* Insect bounding boxes overlay */}
                {latestCapture.bboxes.map((box) => (
                  <div
                    key={box.id}
                    className="absolute border border-[#22C55E] bg-[#22C55E]/10 rounded-xs flex flex-col justify-start group cursor-pointer hover:bg-[#22C55E]/30 transition-all"
                    style={{
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                    }}
                  >
                    <div className="absolute -top-4 left-0 bg-[#22C55E] text-[#0A2213] font-mono text-[9px] font-bold px-1 rounded-xs whitespace-nowrap shadow-xs">
                      {box.speciesId === 'scirpophaga_incertulas' ? 'Penggerek' : 'Wereng'} {(box.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}

                {/* Center Tray Label */}
                <div className="absolute bottom-3 left-4 text-left z-10">
                  <div className="text-[10px] font-mono text-[#A7D7C5]">
                    [OV5640 AF Macro] · LED Iluminasi 4000K Aktif
                  </div>
                  <div className="text-xs font-semibold text-white">
                    {latestCapture.totalPests} Serangga Terdeteksi ({latestCapture.targetPestsCount} Hama Sasaran)
                  </div>
                </div>
              </div>

              {/* Detection breakdown table */}
              <div className="rounded-lg border border-[#E2E8F0] p-3 text-xs bg-[#F8FAF9]">
                <div className="font-semibold text-[#192A20] mb-2">
                  Daftar Deteksi Bounding Box:
                </div>
                <div className="flex flex-wrap gap-2">
                  {latestCapture.bboxes.map((box, i) => (
                    <div
                      key={box.id}
                      className="px-2.5 py-1 rounded bg-white border border-[#E2E8F0] flex items-center gap-1.5 font-mono text-[11px]"
                    >
                      <span className="h-2 w-2 rounded-full bg-[#2D6A4F]" />
                      <span className="font-semibold text-[#192A20]">Objek #{i + 1}:</span>
                      <span className="text-[#52796F]">{box.speciesId.replace('_', ' ')}</span>
                      <span className="text-[#718096]">({(box.confidence * 100).toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SAFE REMOTE CONTROLS */}
          {activeSubTab === 'controls' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg border border-[#FDE68A] bg-[#FEFCE8] text-xs text-[#92400E] flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Protokol Kontrol Jarak Jauh Berautentikasi</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed">
                    Setiap perintah memerlukan token sesi aman dan diverifikasi oleh firmware ESP32-S3 sebelum eksekusi aktuator fisik. Katup dan pompa dilindungi oleh fail-safe limit switch.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Kontrol 1: Force Water Change */}
                <div className="p-4 rounded-lg border border-[#E2E8F0] bg-white space-y-2">
                  <div className="font-bold text-[#192A20] flex items-center gap-1.5">
                    <Droplets className="h-4 w-4 text-[#2B6CB0]" />
                    Paksa Siklus Kuras & Isi Baki
                  </div>
                  <p className="text-[11px] text-[#718096]">
                    Membuka solenoid drain selama 25 detik dan memompa 5L air bersih dari tandon untuk membersihkan bangkai serangga.
                  </p>
                  <button
                    disabled={isExecutingCmd}
                    onClick={() => handleCommand('FORCE_WATER_CHANGE')}
                    className="w-full mt-2 py-2 px-3 bg-[#2D6A4F] text-white rounded-lg font-semibold hover:bg-[#1B4332] disabled:opacity-50 transition-colors"
                  >
                    Kirim Perintah Kuras Air
                  </button>
                </div>

                {/* Kontrol 2: Toggle Lamp */}
                <div className="p-4 rounded-lg border border-[#E2E8F0] bg-white space-y-2">
                  <div className="font-bold text-[#192A20] flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-[#D97706]" />
                    Toggle Saklar Lampu UV (Uji 60s)
                  </div>
                  <p className="text-[11px] text-[#718096]">
                    Nyalakan/matikan lampu LED penarik serangga untuk menguji kesehatan driver arus dan sensor INA226.
                  </p>
                  <button
                    disabled={isExecutingCmd}
                    onClick={() => handleCommand('TOGGLE_LAMP')}
                    className="w-full mt-2 py-2 px-3 border border-[#E2E8F0] bg-[#F8FAF9] text-[#192A20] rounded-lg font-semibold hover:bg-[#E2E8F0] disabled:opacity-50 transition-colors"
                  >
                    Toggle Lampu UV
                  </button>
                </div>

                {/* Kontrol 3: Capture Snapshot */}
                <div className="p-4 rounded-lg border border-[#E2E8F0] bg-white space-y-2">
                  <div className="font-bold text-[#192A20] flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-[#2D6A4F]" />
                    Ambil Foto Baki Saat Ini
                  </div>
                  <p className="text-[11px] text-[#718096]">
                    Nyalakan LED iluminasi baki dan picu kamera OV5640 untuk snapshot instan di luar jadwal reguler.
                  </p>
                  <button
                    disabled={isExecutingCmd}
                    onClick={() => handleCommand('CAPTURE_NOW')}
                    className="w-full mt-2 py-2 px-3 border border-[#E2E8F0] bg-[#F8FAF9] text-[#192A20] rounded-lg font-semibold hover:bg-[#E2E8F0] disabled:opacity-50 transition-colors"
                  >
                    Ambil Snapshot
                  </button>
                </div>

                {/* Kontrol 4: Soft Reboot */}
                <div className="p-4 rounded-lg border border-[#E2E8F0] bg-white space-y-2">
                  <div className="font-bold text-[#192A20] flex items-center gap-1.5">
                    <RotateCcw className="h-4 w-4 text-[#718096]" />
                    Reboot ESP32-S3 Firmware
                  </div>
                  <p className="text-[11px] text-[#718096]">
                    Lakukan soft restart pada mikrokontroler tanpa mereset data konfigurasi RTC dan EEPROM/NVS.
                  </p>
                  <button
                    disabled={isExecutingCmd}
                    onClick={() => handleCommand('REBOOT_ESP32')}
                    className="w-full mt-2 py-2 px-3 border border-[#E2E8F0] bg-[#F8FAF9] text-[#718096] rounded-lg font-semibold hover:bg-[#E2E8F0] disabled:opacity-50 transition-colors"
                  >
                    Soft Restart ESP32
                  </button>
                </div>
              </div>

              {cmdFeedback && (
                <div className="p-3 rounded-lg bg-[#EAF4EE] border border-[#2D6A4F]/30 text-xs text-[#1B4332] flex items-center gap-2">
                  {isExecutingCmd ? (
                    <div className="h-4 w-4 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-[#2D6A4F] shrink-0" />
                  )}
                  <span>{cmdFeedback}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: AUDIT LOG */}
          {activeSubTab === 'audit' && (
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-[#192A20]">
                Riwayat Perintah Terkirim ke {device.code}
              </div>
              <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-lg overflow-hidden">
                {deviceCommands.length === 0 ? (
                  <div className="p-4 text-center text-[#718096]">Belum ada riwayat perintah pada sesi ini.</div>
                ) : (
                  deviceCommands.map((cmd) => (
                    <div key={cmd.id} className="p-3 bg-white flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#192A20]">{cmd.commandType}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            cmd.status === 'COMPLETED'
                              ? 'bg-[#EAF4EE] text-[#2D6A4F]'
                              : cmd.status === 'ACKNOWLEDGED'
                              ? 'bg-[#EBF8FF] text-[#2B6CB0]'
                              : 'bg-[#FEF3C7] text-[#D97706]'
                          }`}>
                            {cmd.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#718096] mt-0.5">
                          {cmd.responseMessage || 'Menunggu respon dari mikrokontroler...'}
                        </div>
                      </div>
                      <div className="font-mono text-[11px] text-[#718096] text-right">
                        {cmd.executedAt ? cmd.executedAt.split('T')[1].slice(0, 8) : 'Pending'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E2E8F0] bg-[#F8FAF9] px-6 py-3 flex items-center justify-between text-xs">
          <span className="text-[#718096] font-mono">
            Firmware: {device.firmwareVersion} · ESP32-S3
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#192A20] text-white font-medium rounded-lg hover:bg-[#2D3748]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
