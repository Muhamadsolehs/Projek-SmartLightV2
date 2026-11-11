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
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Layers,
  Wifi,
  Lock,
  Cpu,
  Power,
  Zap,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  RefreshCw,
  Sliders,
  MapPin,
  Calendar,
  AlertCircle,
  Shield,
  Gauge,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { SmartLightTrapDevice, DeviceCommand, DeviceProvisioningCredentials } from '../../types';
import { useDevice } from '../../context/DeviceContext';
import { hasPermission, getRoleMetadata } from '../../lib/permissions';

export const DeviceDetailModal: React.FC<{
  device: SmartLightTrapDevice | null;
  isOpen: boolean;
  onClose: () => void;
}> = ({ device, isOpen, onClose }) => {
  const { commands, sendCommand, captures, currentUser, rotateDeviceToken } = useDevice();
  const [activeSubTab, setActiveSubTab] = useState<'telemetry' | 'camera' | 'controls' | 'audit'>('telemetry');
  const [isExecutingCmd, setIsExecutingCmd] = useState(false);
  const [cmdFeedback, setCmdFeedback] = useState<string | null>(null);

  // Hardware Token Rotation states
  const [rotatedCredentials, setRotatedCredentials] = useState<DeviceProvisioningCredentials | null>(null);
  const [isRotatingToken, setIsRotatingToken] = useState(false);
  const [rotationConfirmOpen, setRotationConfirmOpen] = useState(false);
  const [showRotatedToken, setShowRotatedToken] = useState(false);
  const [rotatedTokenCopied, setRotatedTokenCopied] = useState(false);
  const [rotatedSnippetCopied, setRotatedSnippetCopied] = useState(false);
  const [rotationError, setRotationError] = useState<string | null>(null);
  const [rotationSuccess, setRotationSuccess] = useState<string | null>(null);

  const [relayStates, setRelayStates] = useState<Record<number, boolean>>({
    1: device?.currentTelemetry?.water?.fillPumpStatus === 'running',
    2: device?.currentTelemetry?.water?.drainValveStatus === 'open',
    3: device?.currentTelemetry?.lamp?.isActive || false,
    4: false,
  });

  const canControl = hasPermission(currentUser?.role, 'control:devices');
  const canManage = hasPermission(currentUser?.role, 'manage:devices');
  const roleMeta = getRoleMetadata(currentUser?.role);

  if (!isOpen || !device) return null;

  const handleRotateToken = async () => {
    if (!device) return;
    setIsRotatingToken(true);
    setRotationError(null);
    setRotationSuccess(null);
    try {
      const creds = await rotateDeviceToken(device.code);
      setRotatedCredentials(creds);
      setRotationConfirmOpen(false);
      setRotationSuccess(`Token API perangkat ${device.code} berhasil diperbarui di server.`);
    } catch (err: any) {
      setRotationError(err?.message || 'Gagal merotasi token perangkat di server.');
    } finally {
      setIsRotatingToken(false);
    }
  };

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

  const toggleRelay = async (channel: number) => {
    const nextState = !relayStates[channel];
    const strState = nextState ? 'ON' : 'OFF';
    setRelayStates((prev) => ({ ...prev, [channel]: nextState }));
    await handleCommand('SET_RELAY', { relay: channel, state: strState });
  };

  // Helper calculation for battery condition
  const getBatteryHealth = (voltage: number) => {
    if (voltage >= 12.6) return { label: 'Optimal', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (voltage >= 11.9) return { label: 'Normal', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (voltage >= 11.8) return { label: 'Waspada (Batas Cutoff)', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Kritis (Cutoff Aktif)', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  };

  const batteryHealth = getBatteryHealth(tel.battery.busVoltageV);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* ========================================================================= */}
        {/* MODAL HEADER                                                             */}
        {/* ========================================================================= */}
        <div className="border-b border-slate-200 bg-gradient-to-r from-[#F8FAF9] via-white to-[#F4F9F6] px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Device Icon with Status Pulse */}
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#1B4332] text-white shadow-md shadow-[#1B4332]/10 shrink-0">
              <Radio className="h-5 w-5 text-[#ECF39E]" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                {device.status === 'online' && (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
                  </>
                )}
                {device.status === 'warning' && (
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-white" />
                )}
                {device.status === 'offline' && (
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500 border-2 border-white" />
                )}
                {device.status === 'maintenance' && (
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-slate-400 border-2 border-white" />
                )}
              </span>
            </div>

            {/* Device Info */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#1B4332] bg-[#EAF4EE] px-2.5 py-0.5 rounded-md border border-[#2D6A4F]/25 shrink-0">
                  {device.code}
                </span>
                <h2 className="text-base sm:text-lg font-bold text-[#192A20] truncate">
                  {device.name}
                </h2>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  device.status === 'online'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : device.status === 'warning'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  {device.status.toUpperCase()}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#718096] mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-[#52796F]" />
                  <span>{device.locationName} · {device.farmSector}</span>
                </span>
                <span>•</span>
                <span className="text-[#2D6A4F] font-medium">{device.cropType}</span>
                <span>•</span>
                <span className="font-mono text-[11px] text-[#94A3B8]">Sync: {device.lastSyncAt ? device.lastSyncAt.split('T')[1]?.slice(0, 8) : 'Real-time'} WIB</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
            <button
              id="btn-rotate-token"
              data-testid="rotate-token-btn"
              onClick={() => {
                setRotationError(null);
                setRotationConfirmOpen(true);
              }}
              disabled={isRotatingToken}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                canManage
                  ? 'bg-[#1B4332] text-white hover:bg-[#2D6A4F] active:scale-95'
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
              }`}
              title={
                canManage
                  ? `Rotasi token kredensial hardware untuk ${device.code}`
                  : 'Akses Terbatas: Hanya Administrator yang berwenang merotasi token perangkat'
              }
            >
              <Key className="h-3.5 w-3.5 text-[#ECF39E]" />
              <span>Rotate Token</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors shrink-0 cursor-pointer"
              aria-label="Tutup detail perangkat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUB-TAB NAVIGATION BAR                                                   */}
        {/* ========================================================================= */}
        <div className="flex border-b border-slate-200 bg-white px-4 sm:px-6 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0 gap-1 sm:gap-2">
          <button
            onClick={() => setActiveSubTab('telemetry')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSubTab === 'telemetry'
                ? 'border-[#2D6A4F] text-[#1B4332] bg-[#F4F9F6]'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Activity className="h-4 w-4 text-[#2D6A4F]" />
            <span>Telemetri & Sensor INA226</span>
          </button>
          <button
            onClick={() => setActiveSubTab('camera')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSubTab === 'camera'
                ? 'border-[#2D6A4F] text-[#1B4332] bg-[#F4F9F6]'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Camera className="h-4 w-4 text-[#2D6A4F]" />
            <span>Kamera & Deteksi CV</span>
            {latestCapture && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-[#1B4332] font-mono font-bold">
                {latestCapture.totalPests}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('controls')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSubTab === 'controls'
                ? 'border-[#2D6A4F] text-[#1B4332] bg-[#F4F9F6]'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Sliders className="h-4 w-4 text-[#2D6A4F]" />
            <span>Kontrol Aktuator Relay</span>
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSubTab === 'audit'
                ? 'border-[#2D6A4F] text-[#1B4332] bg-[#F4F9F6]'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-[#2D6A4F]" />
            <span>Keamanan & Log Audit</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB BODY (Scrollable Container)                                           */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#F8FAF9]">
          
          {/* ======================================================================= */}
          {/* TAB 1: TELEMETRY & HARDWARE SUBSYSTEM                                   */}
          {/* ======================================================================= */}
          {activeSubTab === 'telemetry' && (
            <div className="space-y-6">
              
              {/* 4 Primary KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                
                {/* 1. Tegangan Baterai Bus */}
                <div className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-xs space-y-2 hover:border-[#2D6A4F]/40 transition-colors">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Battery className="h-4 w-4 text-[#2D6A4F]" />
                      Tegangan Baterai Bus
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${batteryHealth.color}`}>
                      {batteryHealth.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-2xl font-extrabold tabular-nums text-[#192A20]">
                      {tel.battery.busVoltageV.toFixed(2)}
                    </span>
                    <span className="text-xs font-bold text-slate-500">Volt DC</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                    <span className="font-mono">INA226 (0x40)</span>
                    <span className="font-mono text-[#2D6A4F] font-semibold">{tel.battery.shuntVoltageMv.toFixed(1)} mV Shunt</span>
                  </div>
                </div>

                {/* 2. Arus Baterai (Netto) */}
                <div className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-xs space-y-2 hover:border-[#2D6A4F]/40 transition-colors">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-[#D97706]" />
                      Arus Baterai (Netto)
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      tel.battery.isCharging
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {tel.battery.isCharging ? 'Solar Charging' : 'Discharging'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`font-mono text-2xl font-extrabold tabular-nums ${
                      tel.battery.currentMa > 0 ? 'text-emerald-700' : 'text-[#192A20]'
                    }`}>
                      {tel.battery.currentMa > 0 ? `+${tel.battery.currentMa}` : tel.battery.currentMa}
                    </span>
                    <span className="text-xs font-bold text-slate-500">mA</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Estimasi Daya:</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {Math.abs((tel.battery.busVoltageV * (tel.battery.currentMa / 1000))).toFixed(2)} Watt
                    </span>
                  </div>
                </div>

                {/* 3. Kekeruhan Baki Air */}
                <div className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-xs space-y-2 hover:border-[#2D6A4F]/40 transition-colors">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Droplets className="h-4 w-4 text-[#2B6CB0]" />
                      Kekeruhan Baki Air
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      tel.water.isTurbid
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {tel.water.isTurbid ? 'Perlu Kuras (>100)' : 'Air Bersih'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`font-mono text-2xl font-extrabold tabular-nums ${
                      tel.water.isTurbid ? 'text-rose-600' : 'text-[#2D6A4F]'
                    }`}>
                      {tel.water.turbidityNtu}
                    </span>
                    <span className="text-xs font-bold text-slate-500">NTU</span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Ambang Kuras:</span>
                    <span className="font-mono font-semibold text-slate-700">100 NTU</span>
                  </div>
                </div>

                {/* 4. Level Tandon Cadangan */}
                <div className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-xs space-y-2 hover:border-[#2D6A4F]/40 transition-colors">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-[#2D6A4F]" />
                      Level Tandon Cadangan
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      tel.water.tankLevelPercent < 20
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {tel.water.tankLevelPercent < 20 ? 'Kritis (<20%)' : 'Aman'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`font-mono text-2xl font-extrabold tabular-nums ${
                      tel.water.tankLevelPercent < 20 ? 'text-rose-600' : 'text-[#192A20]'
                    }`}>
                      {tel.water.tankLevelPercent}%
                    </span>
                    <span className="text-xs font-bold text-slate-500">({tel.water.tankVolumeLiters} Liter)</span>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        tel.water.tankLevelPercent < 20 ? 'bg-rose-500' : 'bg-[#2D6A4F]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, tel.water.tankLevelPercent))}%` }}
                    />
                  </div>
                </div>

              </div>

              {/* Subsystems Details (Grid of 2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Card 1: Modul Lampu Penarik Serangga */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60">
                        <Lightbulb className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-[#192A20]">Modul Lampu Penarik Serangga</h4>
                        <p className="text-[11px] text-slate-400">LED Ultraviolet Khusus Nokturnal</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 ${
                      tel.lamp.isActive
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${tel.lamp.isActive ? 'bg-amber-500 animate-pulse' : 'bg-slate-400'}`} />
                      {tel.lamp.isActive ? 'MENYALA' : 'STANDBY'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 block">Panjang Gelombang</span>
                      <p className="font-mono font-bold text-[#192A20]">{tel.lamp.wavelengthNm} nm (Near UV)</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 block">Jadwal Operasional</span>
                      <p className="font-mono font-bold text-[#192A20]">{tel.lamp.scheduleStart} - {tel.lamp.scheduleEnd} WIB</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 block">Arus Driver LED</span>
                      <p className="font-mono font-bold text-[#192A20]">{tel.lamp.ledCurrentMa} mA</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 block">Kondisi Driver</span>
                      <p className="font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Sehat & Terpantau
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card 2: Konektivitas 4G & RTC Lapangan */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[#2D6A4F] border border-emerald-200/60">
                        <Wifi className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-[#192A20]">Konektivitas & Jam Lapangan</h4>
                        <p className="text-[11px] text-slate-400">Modem SIMCOM 4G &amp; RTC Hardware</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#EAF4EE] text-[#1B4332] border border-[#2D6A4F]/30">
                      {tel.connectivity.networkType}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 block">Kekuatan Sinyal (RSSI)</span>
                      <p className="font-mono font-bold text-[#192A20]">{tel.connectivity.rssiDbm} dBm (Bagus)</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 block">Operator IoT</span>
                      <p className="font-medium text-[#192A20] truncate">{tel.connectivity.operator}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 block">RTC Presisi Lapangan</span>
                      <p className="font-mono font-bold text-[#2D6A4F] flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        DS3231 Synced
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 space-y-0.5">
                      <span className="text-[10px] text-slate-500 block">Antrean Buffer MicroSD</span>
                      <p className="font-mono font-bold text-[#192A20]">
                        {tel.connectivity.unsyncedMicroSdPackets} paket tertunda
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Bottom Card: Proteksi Interlock Hidraulik */}
              <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-[#F4F9F6] shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2D6A4F] text-white">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-[#1B4332]">
                        Proteksi Interlock Hidraulik Baki &amp; Pompa
                      </h4>
                      <p className="text-[11px] text-slate-500">Mekanisme Pengamanan Mandiri Firmware ESP8266 NodeMCU</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full font-mono text-[10px] font-bold self-start sm:self-center ${
                    tel.water.safetyLockout
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-[#EAF4EE] text-[#1B4332] border border-[#2D6A4F]/30'
                  }`}>
                    {tel.water.safetyLockout ? 'SAFETY LOCKOUT AKTIF' : 'INTERLOCK AMAN'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-800 block text-[11px]">Syarat Tandon &ge; 15%</span>
                      <p className="text-[10px] text-slate-500">Mencegah kerusakan pompa akibat dry-run saat air habis.</p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-800 block text-[11px]">Katup Drain Tertutup</span>
                      <p className="text-[10px] text-slate-500">Memastikan air bilasan tidak terbuang sia-sia.</p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-800 block text-[11px]">Timeout Pompa 45 Detik</span>
                      <p className="text-[10px] text-slate-500">Batas durasi otomatis mencegah luapan air di baki penampung.</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 2: CAMERA & COMPUTER VISION                                         */}
          {/* ======================================================================= */}
          {activeSubTab === 'camera' && (
            latestCapture ? (
              <div className="space-y-4">
                {/* Header Information */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-white border border-slate-200">
                  <div>
                    <h3 className="font-bold text-sm text-[#192A20] flex items-center gap-1.5">
                      <Camera className="h-4 w-4 text-[#2D6A4F]" />
                      Snapshot Baki Perangkap Terakhir
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Diambil: <span className="font-semibold text-slate-700">{latestCapture.timestamp}</span> · Resolusi: <span className="font-mono">{latestCapture.resolution}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#EAF4EE] text-[#1B4332] font-mono text-xs font-bold border border-[#2D6A4F]/20">
                      {latestCapture.modelVersion}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-mono text-xs font-bold border border-emerald-200">
                      Akurasi: {(latestCapture.avgConfidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Viewfinder Vector Display */}
                <div className="relative aspect-video w-full rounded-2xl border border-slate-800 bg-[#0B1510] overflow-hidden flex items-center justify-center shadow-xl">
                  {/* Water glow simulation */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(45,106,79,0.35)_0%,_rgba(10,20,15,0.98)_80%)]" />

                  {/* Tray circular boundary & crosshair */}
                  <svg className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="#52B788" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
                    <line x1="6" y1="50" x2="94" y2="50" stroke="#52B788" strokeWidth="0.2" />
                    <line x1="50" y1="6" x2="50" y2="94" stroke="#52B788" strokeWidth="0.2" />
                  </svg>

                  {/* Bounding boxes overlay */}
                  {latestCapture.bboxes.map((box) => (
                    <div
                      key={box.id}
                      className="absolute border border-emerald-400 bg-emerald-500/15 rounded-xs transition-all hover:bg-emerald-500/30 cursor-pointer group"
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`,
                      }}
                    >
                      <div className="absolute -top-5 left-0 bg-emerald-500 text-[#091E13] font-mono text-[9px] font-extrabold px-1.5 py-0.2 rounded-xs whitespace-nowrap shadow-md">
                        {box.speciesId === 'scirpophaga_incertulas' ? 'Penggerek Batang' : 'Wereng Coklat'} {(box.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}

                  {/* Live viewfinder HUD footer */}
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs pointer-events-none">
                    <span className="font-mono text-[11px] text-[#A7D7C5] bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-xs">
                      [OV5640 Macro 5MP] · LED Iluminasi 4000K Aktif
                    </span>
                    <span className="font-semibold text-white bg-[#1B4332]/80 px-2.5 py-0.5 rounded-md backdrop-blur-xs border border-emerald-500/30">
                      {latestCapture.totalPests} Serangga ({latestCapture.targetPestsCount} Hama Sasaran)
                    </span>
                  </div>
                </div>

                {/* Bounding Box Species Breakdown */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-xs">
                  <div className="font-bold text-xs text-[#192A20] flex items-center justify-between">
                    <span>Daftar Deteksi Spesimen Serangga (YOLOv8 Edge):</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      Klik kotak untuk melihat detail confidence
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {latestCapture.bboxes.map((box, i) => (
                      <div
                        key={box.id}
                        className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2 font-mono text-xs hover:border-[#2D6A4F] transition-colors"
                      >
                        <span className="h-2 w-2 rounded-full bg-emerald-600" />
                        <span className="font-bold text-[#192A20]">#{i + 1}</span>
                        <span className="text-slate-600 font-sans font-medium">{box.speciesId.replace('_', ' ')}</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-[#1B4332] font-bold text-[10px]">
                          {(box.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <Camera className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-[#192A20]">Belum Ada Snapshot Kamera</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Belum ada sesi tangkapan citra baki air untuk unit {device.code}. Sesi pemotretan otomatis dijalankan setiap malam saat lampu UV aktif.
                </p>
              </div>
            )
          )}

          {/* ======================================================================= */}
          {/* TAB 3: REMOTE CONTROLS & 4-CHANNEL RELAYS                               */}
          {/* ======================================================================= */}
          {activeSubTab === 'controls' && (
            <div className="space-y-5">
              
              {/* Permission Banner */}
              {!canControl ? (
                <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-900 flex items-start gap-3 shadow-xs">
                  <Lock className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-rose-950">Mode Baca-Saja (Akses Kontrol Terbatas)</div>
                    <p className="text-[11px] text-rose-700 leading-relaxed">
                      Role Anda saat ini adalah <strong>{roleMeta.label}</strong>. Eksekusi perintah aktuator fisik dibatasi demi keselamatan operasional dan hanya dapat dijalankan oleh <strong>Operator Teknis Lapangan</strong> atau <strong>Administrator Sistem</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900 flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-950">Protokol Kontrol Jarak Jauh Berautentikasi</div>
                    <p className="mt-0.5 text-[11px] text-amber-800 leading-relaxed">
                      Setiap perintah dikirim melalui saluran aman TLS dan diverifikasi oleh firmware ESP8266 NodeMCU sebelum saklar relay fisik digerakkan.
                    </p>
                  </div>
                </div>
              )}

              {/* 4-Channel Active LOW Relay Panel */}
              <div className="p-4 sm:p-5 rounded-2xl border border-[#2D6A4F]/25 bg-white shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-[#1B4332] flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-[#2D6A4F]" />
                      Kontrol Fisik 4-Channel Relay ESP8266 NodeMCU
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Terkoneksi via Supabase HTTPS Polling &amp; Persistensi EEPROM
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="bg-[#EAF4EE] text-[#1B4332] font-mono px-2 py-0.5 rounded font-bold border border-[#2D6A4F]/30">
                      Active LOW: 0V=ON | 3.3V=OFF
                    </span>
                    <span className={`font-mono px-2 py-0.5 rounded font-bold ${
                      device.status === 'online' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {device.status === 'online' ? '● Node Online' : '○ Node Offline (Antrean)'}
                    </span>
                  </div>
                </div>

                {/* 4 Relay Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  
                  {/* Relay 1: Pompa Pengisi */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    relayStates[1] ? 'bg-emerald-50/50 border-[#2D6A4F] shadow-xs' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                          relayStates[1] ? 'bg-[#2D6A4F] text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          R1
                        </span>
                        <div>
                          <div className="font-bold text-xs sm:text-sm text-[#192A20]">Relay 1: Pompa Pengisi</div>
                          <div className="text-[10px] font-mono text-slate-500">D1 / GPIO5 · Submersible Tandon</div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        relayStates[1] ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {relayStates[1] ? 'ON (0V)' : 'OFF (3.3V)'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-[10px] text-slate-400">Kontak: NO ↔ COM</span>
                      <button
                        disabled={!canControl || isExecutingCmd}
                        onClick={() => toggleRelay(1)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          relayStates[1]
                            ? 'bg-rose-600 text-white hover:bg-rose-700'
                            : 'bg-[#2D6A4F] text-white hover:bg-[#1B4332]'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {relayStates[1] ? 'Matikan Pompa' : 'Nyalakan Pompa'}
                      </button>
                    </div>
                  </div>

                  {/* Relay 2: Katup Solenoid Drain */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    relayStates[2] ? 'bg-emerald-50/50 border-[#2D6A4F] shadow-xs' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                          relayStates[2] ? 'bg-[#2D6A4F] text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          R2
                        </span>
                        <div>
                          <div className="font-bold text-xs sm:text-sm text-[#192A20]">Relay 2: Katup Solenoid</div>
                          <div className="text-[10px] font-mono text-slate-500">D2 / GPIO4 · Drain Kuras Baki</div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        relayStates[2] ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {relayStates[2] ? 'OPEN (0V)' : 'CLOSED (3.3V)'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-[10px] text-slate-400">Kontak: NO ↔ COM</span>
                      <button
                        disabled={!canControl || isExecutingCmd}
                        onClick={() => toggleRelay(2)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          relayStates[2]
                            ? 'bg-rose-600 text-white hover:bg-rose-700'
                            : 'bg-[#2D6A4F] text-white hover:bg-[#1B4332]'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {relayStates[2] ? 'Tutup Katup' : 'Buka Katup'}
                      </button>
                    </div>
                  </div>

                  {/* Relay 3: Kipas / Auxiliary */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    relayStates[3] ? 'bg-emerald-50/50 border-[#2D6A4F] shadow-xs' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                          relayStates[3] ? 'bg-[#2D6A4F] text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          R3
                        </span>
                        <div>
                          <div className="font-bold text-xs sm:text-sm text-[#192A20]">Relay 3: Kipas Blower / Aux</div>
                          <div className="text-[10px] font-mono text-slate-500">D7 / GPIO13 · Output Kipas / Aux</div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        relayStates[3] ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {relayStates[3] ? 'ON (0V)' : 'OFF (3.3V)'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-[10px] text-slate-400">Kontak: NO ↔ COM</span>
                      <button
                        disabled={!canControl || isExecutingCmd}
                        onClick={() => toggleRelay(3)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          relayStates[3]
                            ? 'bg-rose-600 text-white hover:bg-rose-700'
                            : 'bg-[#2D6A4F] text-white hover:bg-[#1B4332]'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {relayStates[3] ? 'Matikan Kipas' : 'Nyalakan Kipas'}
                      </button>
                    </div>
                  </div>

                  {/* Relay 4: LED UV Penarik */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    relayStates[4] ? 'bg-amber-50/50 border-amber-300 shadow-xs' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                          relayStates[4] ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          R4
                        </span>
                        <div>
                          <div className="font-bold text-xs sm:text-sm text-[#192A20]">Relay 4: Lampu UV 365nm</div>
                          <div className="text-[10px] font-mono text-slate-500">D0 / GPIO16 · LED Nokturnal</div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        relayStates[4] ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {relayStates[4] ? 'ON (0V)' : 'OFF (3.3V)'}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                      <span className="text-[10px] text-slate-400">Kontak: NO ↔ COM</span>
                      <button
                        disabled={!canControl || isExecutingCmd}
                        onClick={() => toggleRelay(4)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          relayStates[4]
                            ? 'bg-rose-600 text-white hover:bg-rose-700'
                            : 'bg-[#2D6A4F] text-white hover:bg-[#1B4332]'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {relayStates[4] ? 'Matikan Lampu' : 'Nyalakan Lampu'}
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* 4 Macro Quick Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Macro 1: Force Water Change */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-xs">
                  <div className="font-bold text-xs text-[#192A20] flex items-center gap-1.5">
                    <Droplets className="h-4 w-4 text-[#2B6CB0]" />
                    Paksa Siklus Kuras &amp; Isi Baki
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Membuka solenoid drain selama 25 detik dan memompa 5L air bersih dari tandon untuk membersihkan bangkai serangga.
                  </p>
                  <button
                    disabled={!canControl || isExecutingCmd}
                    onClick={() => handleCommand('FORCE_WATER_CHANGE')}
                    className="w-full mt-2 py-2 px-3 bg-[#2D6A4F] text-white rounded-lg font-semibold hover:bg-[#1B4332] disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs cursor-pointer shadow-xs"
                  >
                    {!canControl ? 'Dibatasi (Hanya Operator/Admin)' : 'Kirim Perintah Kuras Air'}
                  </button>
                </div>

                {/* Macro 2: Toggle Lamp */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-xs">
                  <div className="font-bold text-xs text-[#192A20] flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4 text-[#D97706]" />
                    Toggle Saklar Lampu UV (Uji 60s)
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Nyalakan/matikan lampu LED penarik serangga untuk menguji kesehatan driver arus dan sensor INA226.
                  </p>
                  <button
                    disabled={!canControl || isExecutingCmd}
                    onClick={() => handleCommand('TOGGLE_LAMP')}
                    className="w-full mt-2 py-2 px-3 border border-slate-200 bg-slate-50 text-[#192A20] rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs cursor-pointer"
                  >
                    {!canControl ? 'Dibatasi (Hanya Operator/Admin)' : 'Toggle Lampu UV'}
                  </button>
                </div>

                {/* Macro 3: Capture Snapshot */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-xs">
                  <div className="font-bold text-xs text-[#192A20] flex items-center gap-1.5">
                    <Camera className="h-4 w-4 text-[#2D6A4F]" />
                    Ambil Foto Baki Saat Ini
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Nyalakan LED iluminasi baki dan picu kamera OV5640 untuk snapshot instan di luar jadwal reguler.
                  </p>
                  <button
                    disabled={!canControl || isExecutingCmd}
                    onClick={() => handleCommand('CAPTURE_NOW')}
                    className="w-full mt-2 py-2 px-3 border border-slate-200 bg-slate-50 text-[#192A20] rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs cursor-pointer"
                  >
                    {!canControl ? 'Dibatasi (Hanya Operator/Admin)' : 'Ambil Snapshot Kamera'}
                  </button>
                </div>

                {/* Macro 4: Soft Reboot ESP32 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-xs">
                  <div className="font-bold text-xs text-[#192A20] flex items-center gap-1.5">
                    <RotateCcw className="h-4 w-4 text-slate-600" />
                    Reboot ESP8266 NodeMCU Firmware
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Lakukan soft restart pada mikrokontroler tanpa mereset data konfigurasi RTC dan penyimpanan NVS Flash.
                  </p>
                  <button
                    disabled={!canControl || isExecutingCmd}
                    onClick={() => handleCommand('REBOOT_ESP32')}
                    className="w-full mt-2 py-2 px-3 border border-slate-200 bg-slate-50 text-slate-700 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs cursor-pointer"
                  >
                    {!canControl ? 'Dibatasi (Hanya Operator/Admin)' : 'Soft Restart Mikrokontroler'}
                  </button>
                </div>

              </div>

              {/* Real-time Command Feedback Banner */}
              {cmdFeedback && (
                <div className="p-3.5 rounded-xl bg-[#EAF4EE] border border-[#2D6A4F]/30 text-xs text-[#1B4332] flex items-center gap-2.5 animate-in fade-in">
                  {isExecutingCmd ? (
                    <div className="h-4 w-4 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-[#2D6A4F] shrink-0" />
                  )}
                  <span className="font-medium">{cmdFeedback}</span>
                </div>
              )}

            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 4: AUDIT LOG & HARDWARE SECURITY                                    */}
          {/* ======================================================================= */}
          {activeSubTab === 'audit' && (
            <div className="space-y-5 text-xs">
              
              {/* Seksi Keamanan & Autentikasi Kredensial Hardware */}
              <div className="rounded-2xl border border-[#2D6A4F]/25 bg-gradient-to-br from-white to-[#F4F9F6] p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-[#1B4332] text-[#ECF39E] flex items-center justify-center font-bold shadow-xs">
                      <Key className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#132A13]">Keamanan &amp; Autentikasi Hardware ESP8266 NodeMCU</div>
                      <div className="text-[11px] text-[#52796F]">Verifikasi kriptografi SHA-256 via Supabase Edge Functions</div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold font-mono">
                    SHA-256 Secured
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px] font-medium">Header X-Device-Code</span>
                    <span className="font-mono font-bold text-[#192A20] mt-0.5 block">{device.code}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px] font-medium">Penyimpanan Token Cloud</span>
                    <span className="font-semibold text-emerald-700 mt-0.5 block">Hash SHA-256 (Tanpa Plaintext)</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px] font-medium">ESP32 Hardware Chip ID</span>
                    <span className="font-mono text-[#192A20] mt-0.5 block">{device.esp32ChipId || 'ESP32S3-HW'}</span>
                  </div>
                </div>

                {rotationError && (
                  <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl flex items-center gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{rotationError}</span>
                  </div>
                )}

                {rotationSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{rotationSuccess}</span>
                  </div>
                )}

                {/* Rotasi Token Action for Admin */}
                <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Rotasi token API perangkat jika mikrokontroler mengalami error HTTP 401 atau token firmware lama perlu diganti secara berkala.
                  </p>
                  <button
                    disabled={!canManage || isRotatingToken}
                    onClick={() => {
                      setRotationError(null);
                      setRotationConfirmOpen(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#1B4332] text-white font-semibold hover:bg-[#2D6A4F] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0 cursor-pointer text-xs shadow-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRotatingToken ? 'animate-spin' : ''}`} />
                    <span>{!canManage ? 'Akses Terbatas (Admin)' : 'Rotate Token Hardware'}</span>
                  </button>
                </div>
              </div>

              {/* Riwayat Perintah Terkirim */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs sm:text-sm text-[#192A20]">
                    Riwayat Perintah Terkirim ke {device.code}
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Total: {deviceCommands.length} perintah
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  {deviceCommands.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">Belum ada riwayat perintah pada sesi ini.</div>
                  ) : (
                    deviceCommands.map((cmd) => (
                      <div key={cmd.id} className="p-3.5 bg-white hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-[#192A20]">{cmd.commandType}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              cmd.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : cmd.status === 'ACKNOWLEDGED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {cmd.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 truncate">
                            {cmd.responseMessage || 'Menunggu respon dari mikrokontroler...'}
                          </div>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 text-right shrink-0">
                          {cmd.executedAt ? cmd.executedAt.split('T')[1]?.slice(0, 8) : 'Pending'} WIB
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER                                                             */}
        {/* ========================================================================= */}
        <div className="border-t border-slate-200 bg-[#F8FAF9] px-6 py-3 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
            <Cpu className="h-3.5 w-3.5 text-[#2D6A4F]" />
            <span>Firmware: {device.firmwareVersion} · ESP32-S3 WROOM-1</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#192A20] text-white font-medium rounded-xl hover:bg-[#2D3748] transition-colors cursor-pointer text-xs shadow-xs"
          >
            Tutup
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI ROTASI TOKEN (Tampil saat Admin klik Rotate Token)        */}
      {/* ========================================================================= */}
      {rotationConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-amber-300 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shrink-0">
                <Key className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">
                    Konfirmasi Rotasi Token Kredensial
                  </h3>
                  <span className="font-mono text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                    {device.code}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Tindakan ini akan meng-generate token acak baru secara kriptografis (CSPRNG 24-byte), menghitung SHA-256 hash, dan menyimpannya ke <code>public.devices.api_key_hash</code> pada Supabase Cloud.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5 text-amber-950">
                <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                <span>Dampak Terhadap Firmware Hardware:</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed pl-5">
                Perangkat fisik ESP8266 NodeMCU <strong>{device.code}</strong> akan langsung merespons dengan <strong>HTTP 401 Unauthorized</strong> sampai Anda mengunggah token baru ke file <code>credentials.h</code> firmware ESP8266 dan melakukan flash/reboot.
              </p>
            </div>

            {rotationError && (
              <div className="p-3.5 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-medium">
                  {rotationError}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                disabled={isRotatingToken}
                onClick={() => setRotationConfirmOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-rotate"
                data-testid="btn-confirm-rotate"
                type="button"
                disabled={isRotatingToken}
                onClick={handleRotateToken}
                className="px-4 py-2 rounded-lg bg-amber-700 text-white text-xs font-bold hover:bg-amber-800 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {isRotatingToken ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Memproses di Server...</span>
                  </>
                ) : (
                  <>
                    <Key className="h-3.5 w-3.5" />
                    <span>Lanjutkan Rotasi Token</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL HASIL ROTASI TOKEN (Single-View Display - Tidak Disimpan di Storage) */}
      {/* ========================================================================= */}
      {rotatedCredentials && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border-2 border-emerald-500 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5 text-emerald-800 font-bold text-sm">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">Token API Berhasil Dirotasi</div>
                  <div className="text-[11px] font-normal text-emerald-700">Kredensial Baru untuk Perangkat {rotatedCredentials.deviceCode}</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-mono text-xs font-bold">
                {rotatedCredentials.deviceCode}
              </span>
            </div>

            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>PERHATIAN KEAMANAN TINGGI:</strong> Token mentah ini <u>HANYA DITAMPILKAN SATU KALI</u> sekarang. Token tidak disimpan di database (hanya hash SHA-256 yang tersimpan) dan tidak disimpan di browser localStorage/sessionStorage. Jika Anda menutup jendela ini, token tidak dapat dipulihkan kembali.
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Token Mentah (Header X-Device-Token):</span>
                <button
                  type="button"
                  onClick={() => setShowRotatedToken(!showRotatedToken)}
                  className="text-xs text-[#2D6A4F] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {showRotatedToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  <span>{showRotatedToken ? 'Sembunyikan' : 'Tampilkan'}</span>
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  id="rotated-raw-token-input"
                  data-testid="rotated-raw-token-input"
                  type={showRotatedToken ? 'text' : 'password'}
                  readOnly
                  value={rotatedCredentials.rawToken}
                  className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-900 font-bold select-all focus:outline-none"
                />
                <button
                  id="btn-copy-raw-token"
                  data-testid="btn-copy-raw-token"
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(rotatedCredentials.rawToken);
                    setRotatedTokenCopied(true);
                    setTimeout(() => setRotatedTokenCopied(false), 2500);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#2D6A4F] text-white font-semibold hover:bg-[#1B4332] transition-colors flex items-center gap-1.5 text-xs shrink-0 cursor-pointer"
                >
                  {rotatedTokenCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{rotatedTokenCopied ? 'Tersalin!' : 'Salin Token'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">Snippet Konfigurasi config.h / credentials.h:</span>
                <button
                  id="btn-copy-config-snippet"
                  data-testid="btn-copy-config-snippet"
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(rotatedCredentials.configHSnippet);
                    setRotatedSnippetCopied(true);
                    setTimeout(() => setRotatedSnippetCopied(false), 2500);
                  }}
                  className="text-xs text-[#2D6A4F] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {rotatedSnippetCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{rotatedSnippetCopied ? 'Tersalin!' : 'Salin Snippet'}</span>
                </button>
              </div>
              <pre className="p-3 bg-[#192A20] text-[#ECF39E] font-mono text-xs rounded-xl overflow-x-auto select-all">
                <code>{rotatedCredentials.configHSnippet}</code>
              </pre>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[11px] text-gray-500">
                Simpan ke <code>firmware/SmartLightTrap_ESP8266/credentials.h</code>
              </span>
              <button
                id="btn-close-rotated-modal"
                data-testid="btn-close-rotated-modal"
                type="button"
                onClick={() => {
                  setRotatedCredentials(null);
                  setShowRotatedToken(false);
                }}
                className="px-4 py-2 rounded-lg bg-[#192A20] text-white font-semibold hover:bg-[#2D3748] transition-colors text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Saya Telah Menyalin & Mengamankan Token</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
