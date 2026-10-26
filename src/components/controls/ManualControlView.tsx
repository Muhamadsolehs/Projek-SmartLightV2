import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  Power,
  Droplets,
  Lightbulb,
  Fan,
  Camera,
  RotateCcw,
  Shield,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Cpu,
  Zap,
  Layers,
  ChevronRight,
  Lock,
  Radio,
  Timer,
  Play,
  Square,
  RefreshCw,
  Sparkles,
  ArrowDownCircle,
  HelpCircle,
  Info,
  Wifi,
  WifiOff,
  Flame,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { DeviceCommand, SmartLightTrapDevice } from '../../types';
import { hasPermission, getRoleMetadata } from '../../lib/permissions';
import { deviceService } from '../../services/deviceService';

interface ActuatorCardProps {
  channel: number;
  name: string;
  hardwarePin: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  actualStatus: 'ON' | 'OFF' | 'UNKNOWN';
  lastCommand: DeviceCommand | null;
  isExecuting: boolean;
  canControl: boolean;
  isDeviceOnline: boolean;
  onTurnOn: () => Promise<void>;
  onTurnOff: () => Promise<void>;
  timedOptions?: { label: string; seconds: number }[];
  onTimedAction?: (seconds: number, label: string) => Promise<void>;
  activeTimer?: number | null;
  protectionNote?: string;
}

const ActuatorCard: React.FC<ActuatorCardProps> = ({
  channel,
  name,
  hardwarePin,
  icon: Icon,
  description,
  actualStatus,
  lastCommand,
  isExecuting,
  canControl,
  isDeviceOnline,
  onTurnOn,
  onTurnOff,
  timedOptions,
  onTimedAction,
  activeTimer,
  protectionNote,
}) => {
  // Determine if requested command differs from current actual status
  const isPendingSync =
    lastCommand &&
    (lastCommand.status === 'PENDING' || lastCommand.status === 'SENT') &&
    lastCommand.parameters?.state &&
    lastCommand.parameters.state !== actualStatus;

  return (
    <div
      className={`p-5 rounded-2xl border transition-all ${
        actualStatus === 'ON'
          ? 'bg-emerald-50/40 border-[#2D6A4F] shadow-sm'
          : 'bg-white border-slate-200 shadow-xs'
      } ${!isDeviceOnline ? 'opacity-85' : ''}`}
    >
      {/* Header: Title, Pin, Actual Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl font-mono text-sm font-bold shadow-xs transition-colors ${
              actualStatus === 'ON'
                ? 'bg-[#2D6A4F] text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            R{channel}
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#192A20] flex items-center gap-1.5">
              <Icon className={`h-4 w-4 ${actualStatus === 'ON' ? 'text-[#2D6A4F]' : 'text-slate-500'}`} />
              {name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {hardwarePin} · Active LOW (0V=ON)
            </p>
          </div>
        </div>

        {/* Actual Hardware Status Badge */}
        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${
              actualStatus === 'ON'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : actualStatus === 'OFF'
                ? 'bg-slate-100 text-slate-600 border-slate-200'
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                actualStatus === 'ON'
                  ? 'bg-emerald-500 animate-pulse'
                  : actualStatus === 'OFF'
                  ? 'bg-slate-400'
                  : 'bg-amber-500'
              }`}
            />
            {actualStatus === 'ON' ? 'AKTIF (0V)' : actualStatus === 'OFF' ? 'STANDBY (3.3V)' : 'UNKNOWN'}
          </span>
          <div className="text-[10px] text-slate-400 mt-1">Status Aktual Fisik</div>
        </div>
      </div>

      {/* Description / Function */}
      <p className="text-xs text-slate-600 mt-3 leading-relaxed">{description}</p>

      {/* Protection or Interlock Banner */}
      {protectionNote && (
        <div className="mt-2.5 p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
          <span className="text-slate-500">Mekanisme Proteksi:</span>
          <span className="font-semibold text-slate-700">{protectionNote}</span>
        </div>
      )}

      {/* Discrepancy / Command Pending Warning */}
      {isPendingSync && (
        <div className="mt-2.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-1.5 animate-in fade-in">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-600 shrink-0" />
          <span>
            Perintah <strong>{lastCommand?.parameters?.state}</strong> sedang diproses di antrean ESP32...
          </span>
        </div>
      )}

      {/* Action Buttons: ON and OFF */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!canControl || !isDeviceOnline || isExecuting || actualStatus === 'ON'}
          onClick={onTurnOn}
          className="py-2.5 px-3 rounded-xl bg-[#2D6A4F] text-white font-semibold text-xs hover:bg-[#1B4332] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          title={!isDeviceOnline ? 'Perangkat sedang offline' : 'Nyalakan aktuator'}
        >
          <Power className="h-3.5 w-3.5" />
          <span>Nyalakan (ON)</span>
        </button>
        <button
          type="button"
          disabled={!canControl || !isDeviceOnline || isExecuting || actualStatus === 'OFF'}
          onClick={onTurnOff}
          className="py-2.5 px-3 rounded-xl bg-slate-800 text-white font-semibold text-xs hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          title={!isDeviceOnline ? 'Perangkat sedang offline' : 'Matikan aktuator'}
        >
          <Square className="h-3.5 w-3.5" />
          <span>Matikan (OFF)</span>
        </button>
      </div>

      {/* Quick Timed Actions (e.g. Isi 15s, Kuras 25s, Uji 60s) */}
      {timedOptions && timedOptions.length > 0 && onTimedAction && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400 font-medium">Operasi Berbatas Waktu:</span>
          <div className="flex items-center gap-1.5">
            {timedOptions.map((opt) => (
              <button
                key={opt.seconds}
                type="button"
                disabled={!canControl || !isDeviceOnline || isExecuting || activeTimer !== undefined && activeTimer !== null}
                onClick={() => onTimedAction(opt.seconds, opt.label)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer"
                title={`Jalankan selama ${opt.seconds} detik`}
              >
                {activeTimer ? `${activeTimer}s...` : opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Command Status & Timestamp Footer */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1 truncate">
          <Clock className="h-3 w-3 text-slate-400 shrink-0" />
          <span>Perintah Terakhir:</span>
          <span className="font-mono text-slate-600 font-medium truncate">
            {lastCommand ? `${lastCommand.commandType} (${lastCommand.parameters?.state || 'EXEC'})` : 'Belum ada'}
          </span>
        </div>
        {lastCommand && (
          <span
            className={`font-mono px-1.5 py-0.2 rounded text-[10px] font-bold ${
              lastCommand.status === 'COMPLETED'
                ? 'bg-emerald-50 text-emerald-700'
                : lastCommand.status === 'ACKNOWLEDGED'
                ? 'bg-blue-50 text-blue-700'
                : lastCommand.status === 'FAILED'
                ? 'bg-rose-50 text-rose-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {lastCommand.status}
          </span>
        )}
      </div>
    </div>
  );
};

export const ManualControlView: React.FC = () => {
  const {
    devices,
    selectedDevice,
    setSelectedDeviceId,
    commands,
    sendCommand,
    currentUser,
    refreshData,
  } = useDevice();

  const [isExecuting, setIsExecuting] = useState(false);
  const [activeCommandName, setActiveCommandName] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Active timers per relay channel
  const [channelTimers, setChannelTimers] = useState<Record<number, number | null>>({});

  // All-Off Emergency Confirmation Modal
  const [isAllOffModalOpen, setIsAllOffModalOpen] = useState(false);
  const [allOffResults, setAllOffResults] = useState<{
    relay: number;
    name: string;
    success: boolean;
    message: string;
  }[] | null>(null);

  // Soft Reboot Confirmation Modal
  const [isRebootModalOpen, setIsRebootModalOpen] = useState(false);

  const canControl = hasPermission(currentUser?.role, 'control:devices');
  const roleMeta = getRoleMetadata(currentUser?.role);

  // Evaluate connection status strictly based on last_seen_at heartbeat (< 5 minutes)
  const isDeviceOnline = useMemo(() => {
    if (!selectedDevice) return false;
    if (selectedDevice.status === 'offline') return false;
    if (!selectedDevice.lastSyncAt) return selectedDevice.status === 'online';

    const lastSeenMs = new Date(selectedDevice.lastSyncAt).getTime();
    const diffMinutes = (Date.now() - lastSeenMs) / (1000 * 60);
    // Jika heartbeat lebih dari 5 menit lalu, tandai stale / offline
    return diffMinutes <= 5;
  }, [selectedDevice]);

  // Actual actuator states derived from live telemetry & device records
  const tel = selectedDevice?.currentTelemetry;
  const actualPumpStatus = tel?.water?.fillPumpStatus === 'running' ? 'ON' : 'OFF';
  const actualDrainStatus = tel?.water?.drainValveStatus === 'open' ? 'ON' : 'OFF';
  const actualLampStatus = tel?.lamp?.isActive ? 'ON' : 'OFF';
  // Relay 4 (Kipas / Aux): fallback state
  const [actualFanStatus, setActualFanStatus] = useState<'ON' | 'OFF' | 'UNKNOWN'>('OFF');

  // Filter commands for selected device
  const deviceCommands = useMemo(() => {
    return commands.filter((c) => c.deviceId === selectedDevice?.id);
  }, [commands, selectedDevice]);

  // Find last command for each actuator
  const getLastCommandForRelay = (channel: number) => {
    return (
      deviceCommands.find(
        (c) =>
          c.commandType === 'SET_RELAY' &&
          Number(c.parameters?.relay) === channel
      ) ||
      (channel === 1 && deviceCommands.find((c) => c.commandType === 'FORCE_WATER_CHANGE')) ||
      (channel === 3 && deviceCommands.find((c) => c.commandType === 'TOGGLE_LAMP')) ||
      null
    );
  };

  // Helper execution with verified lifecycle tracking
  const executeActuatorCommand = async (
    cmdType: DeviceCommand['commandType'],
    params?: Record<string, any>,
    successMessage?: string
  ) => {
    if (!canControl) {
      setFeedback({
        type: 'error',
        message: 'Akses Ditolak: Role Anda tidak memiliki izin untuk mengontrol aktuator perangkat.',
      });
      return;
    }

    if (!isDeviceOnline) {
      setFeedback({
        type: 'error',
        message: `Perangkat ${selectedDevice.code} saat ini offline. Perintah tidak dapat dieksekusi.`,
      });
      return;
    }

    setIsExecuting(true);
    setActiveCommandName(cmdType);
    setFeedback({
      type: 'info',
      message: `Mengirim perintah ${cmdType} ke ${selectedDevice.code} melalui enkripsi TLS...`,
    });

    try {
      const initialCmd = await sendCommand(selectedDevice.id, cmdType, params);

      // Track the command status asynchronously until completed or ACKed by ESP32
      const finalCmd = await deviceService.trackCommandStatus(initialCmd.id, 12000);

      if (finalCmd.status === 'COMPLETED' || finalCmd.status === 'ACKNOWLEDGED') {
        setFeedback({
          type: 'success',
          message: successMessage || finalCmd.responseMessage || `Perintah ${cmdType} berhasil dieksekusi oleh hardware.`,
        });
      } else if (finalCmd.status === 'FAILED') {
        setFeedback({
          type: 'error',
          message: finalCmd.responseMessage || `Mikrokontroler melaporkan kegagalan eksekusi perintah ${cmdType}.`,
        });
      } else {
        setFeedback({
          type: 'info',
          message: `Perintah terkirim ke antrean cloud. Menunggu konfirmasi polling berikutnya dari ESP32 ${selectedDevice.code}.`,
        });
      }

      await refreshData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || `Gagal mengirimkan perintah ke backend Supabase.`,
      });
    } finally {
      setIsExecuting(false);
      setActiveCommandName(null);
    }
  };

  // Turn relay ON / OFF
  const handleRelayAction = async (channel: number, turnOn: boolean) => {
    // Interlock check for Pump
    if (channel === 1 && turnOn && (tel?.water?.tankLevelPercent || 0) < 15) {
      setFeedback({
        type: 'error',
        message: 'Interlock Keamanan Aktif: Level tandon air < 15%. Pompa dilarang menyala untuk mencegah kerusakan dry-run.',
      });
      return;
    }

    const stateStr = turnOn ? 'ON' : 'OFF';
    await executeActuatorCommand(
      'SET_RELAY',
      { relay: channel, state: stateStr },
      `Relay ${channel} berhasil diubah ke ${stateStr} (Active LOW).`
    );

    if (channel === 4) {
      setActualFanStatus(turnOn ? 'ON' : 'OFF');
    }
  };

  // Timed relay action with auto-OFF countdown
  const handleTimedRelayAction = async (channel: number, seconds: number, label: string) => {
    if (!canControl || !isDeviceOnline) return;

    if (channel === 1 && (tel?.water?.tankLevelPercent || 0) < 15) {
      setFeedback({
        type: 'error',
        message: 'Interlock Keamanan Aktif: Tandon cadangan < 15%. Operasi pompa dibatalkan.',
      });
      return;
    }

    await handleRelayAction(channel, true);
    setChannelTimers((prev) => ({ ...prev, [channel]: seconds }));

    let remaining = seconds;
    const interval = setInterval(async () => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        setChannelTimers((prev) => ({ ...prev, [channel]: null }));
        await handleRelayAction(channel, false);
        setFeedback({
          type: 'success',
          message: `Operasi berbatas waktu ${label} (${seconds}s) tuntas. Relay ${channel} dimatikan kembali secara otomatis.`,
        });
      } else {
        setChannelTimers((prev) => ({ ...prev, [channel]: remaining }));
      }
    }, 1000);
  };

  // Emergency All-Off Execution
  const handleExecuteAllOff = async () => {
    setIsAllOffModalOpen(false);
    setIsExecuting(true);
    setFeedback({
      type: 'info',
      message: `Mengirimkan instruksi darurat Matikan Semua ke perangkat ${selectedDevice.code}...`,
    });

    try {
      const results = await deviceService.emergencyStopActuators(selectedDevice.id);
      setAllOffResults(results);

      const hasFailures = results.some((r) => !r.success);
      if (hasFailures) {
        setFeedback({
          type: 'error',
          message: 'Sebagian aktuator gagal menerima perintah OFF. Periksa tabel hasil di bawah.',
        });
      } else {
        setFeedback({
          type: 'success',
          message: 'Seluruh aktuator (Relay 1-4) berhasil dikirim perintah OFF.',
        });
      }
      setActualFanStatus('OFF');
      await refreshData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Gagal menjalankan prosedur Matikan Semua.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#52796F]">
        <span className="text-[#718096]">Smart Light Trap</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" />
        <span className="font-semibold text-[#192A20]">Kontrol Manual &amp; Aktuator</span>
      </nav>

      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A20] flex items-center gap-2.5">
            <Sliders className="h-7 w-7 text-[#2D6A4F]" />
            Kontrol Manual &amp; Aktuator
          </h1>
          <p className="text-xs sm:text-sm text-[#52796F] mt-1 max-w-3xl leading-relaxed">
            Pengendalian langsung saklar 4-channel relay fisik ESP32 (Active LOW), pompa pengisi tandon, katup solenoid drain baki, lampu UV 365nm, kipas blower, dan makro siklus operasional lapangan.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isExecuting}
            onClick={async () => {
              setFeedback({ type: 'info', message: 'Memperbarui data status dan telemetri perangkat...' });
              await refreshData();
              setFeedback({ type: 'success', message: 'Data status perangkat berhasil disinkronkan.' });
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            title="Muat ulang status telemetri dari cloud"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isExecuting ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </button>

          <button
            type="button"
            disabled={!canControl || !isDeviceOnline || isExecuting}
            onClick={() => setIsAllOffModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Matikan seluruh aktuator fisik secara serempak"
          >
            <Square className="h-3.5 w-3.5" />
            <span>Matikan Semua (All OFF)</span>
          </button>
        </div>
      </div>

      {/* Role Permission Alert (if viewer or analyst) */}
      {!canControl && (
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-xs text-rose-900 flex items-start gap-3 shadow-xs">
          <Lock className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-rose-950">Mode Baca-Saja (Akses Kontrol Terbatas)</div>
            <p className="text-[11px] text-rose-700 leading-relaxed">
              Anda saat ini masuk sebagai <strong>{roleMeta.label}</strong>. Tombol pengaktifan relay fisik, pompa baki, saklar lampu, dan reboot mikrokontroler dinonaktifkan demi keselamatan operasional lapangan. Hak kendali hanya diberikan kepada <strong>Operator Teknis Lapangan</strong> dan <strong>Administrator Sistem</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DEVICE SELECTOR & ONLINE / OFFLINE INTEGRITY STRIP                         */}
      {/* ========================================================================= */}
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-[#2D6A4F]" />
            <h2 className="font-bold text-sm text-[#192A20]">Pilih Perangkat Target Kontrol:</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Status Armada:</span>
            <span className="font-mono font-bold text-slate-700">
              {devices.filter((d) => d.status === 'online').length} Online / {devices.length} Total
            </span>
          </div>
        </div>

        {/* Device Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {devices.map((dev) => {
            const isSelected = dev.id === selectedDevice.id;
            const isOnline = dev.status === 'online';

            return (
              <button
                key={dev.id}
                type="button"
                onClick={() => setSelectedDeviceId(dev.id)}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-[#2D6A4F] bg-[#F4F9F6] shadow-sm ring-2 ring-[#2D6A4F]/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#1B4332] bg-[#EAF4EE] px-2 py-0.5 rounded border border-[#2D6A4F]/20">
                    {dev.code}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                      isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="font-bold text-xs text-[#192A20] mt-2 truncate">{dev.name}</div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {dev.locationName} · {dev.farmSector}
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Bat: {dev.currentTelemetry?.battery?.busVoltageV?.toFixed(1) || '12.8'}V</span>
                  <span>Tandon: {dev.currentTelemetry?.water?.tankLevelPercent || 0}%</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Device Banner & Offline Warning */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Target Kontrol Aktif:</span>
              <span className="font-mono font-bold text-[#1B4332] bg-white px-2.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                {selectedDevice.code} ({selectedDevice.name})
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isDeviceOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {isDeviceOnline ? '● Terhubung (Heartbeat Aktif)' : '○ Koneksi Terputus / Stale'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-600" />
                Bus: <strong className="font-mono text-slate-900">{tel?.battery?.busVoltageV?.toFixed(2)} V</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#2D6A4F]" />
                Tandon: <strong className="font-mono text-slate-900">{tel?.water?.tankLevelPercent}% ({tel?.water?.tankVolumeLiters}L)</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                Sync: <strong className="font-mono text-slate-900">{selectedDevice.lastSyncAt ? selectedDevice.lastSyncAt.split('T')[1]?.slice(0, 8) : 'Real-time'} WIB</strong>
              </span>
            </div>
          </div>

          {!isDeviceOnline && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 flex items-center gap-2 animate-in fade-in">
              <WifiOff className="h-4 w-4 text-rose-600 shrink-0" />
              <span>
                <strong>Perhatian:</strong> Perangkat {selectedDevice.code} belum mengirimkan heartbeat dalam 5 menit terakhir atau berstatus offline. Seluruh tombol kontrol fisik dinonaktifkan demi keselamatan untuk mencegah pengiriman perintah yang tidak dapat dieksekusi.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Real-Time Command Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start gap-3 transition-all animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : feedback.type === 'error' ? (
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <RefreshCw className="h-5 w-5 text-blue-600 animate-spin shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-bold">
              {feedback.type === 'success' ? 'Berhasil Terkirim & Terkonfirmasi' : feedback.type === 'error' ? 'Peringatan / Kegagalan' : 'Sedang Memproses'}
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4 DEDICATED ACTUATOR CONTROL CARDS                                        */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-[#192A20] flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[#2D6A4F]" />
            Panel Aktuator Fisik (4-Channel Relay ESP32)
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            Protokol: Active LOW (0V=ON, 3.3V=OFF)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* 1. POMPA AIR PENGISI (Relay 1 - GPIO 12) */}
          <ActuatorCard
            channel={1}
            name="Pompa Air Pengisi Baki"
            hardwarePin="GPIO 12 · Submersible 12V DC"
            icon={Droplets}
            description="Mengalirkan air bersih dari tandon cadangan ke baki penampung bangkai serangga untuk menjaga kejernihan air pantulan."
            actualStatus={actualPumpStatus}
            lastCommand={getLastCommandForRelay(1)}
            isExecuting={isExecuting}
            canControl={canControl}
            isDeviceOnline={isDeviceOnline}
            onTurnOn={() => handleRelayAction(1, true)}
            onTurnOff={() => handleRelayAction(1, false)}
            timedOptions={[
              { label: 'Isi 15s (~3L)', seconds: 15 },
              { label: 'Isi 30s (~6L)', seconds: 30 },
            ]}
            onTimedAction={(sec, label) => handleTimedRelayAction(1, sec, label)}
            activeTimer={channelTimers[1]}
            protectionNote="Interlock Tandon ≥15% · Auto-Cutoff Timeout Maks 45s"
          />

          {/* 2. KATUP SOLENOID DRAIN (Relay 2 - GPIO 14) */}
          <ActuatorCard
            channel={2}
            name="Katup Solenoid Drain Baki"
            hardwarePin="GPIO 14 · Solenoid NC 12V"
            icon={ArrowDownCircle}
            description="Membuka saluran pembuangan air kotor baki perangkap untuk menguras kotoran dan bangkai serangga yang menumpuk."
            actualStatus={actualDrainStatus}
            lastCommand={getLastCommandForRelay(2)}
            isExecuting={isExecuting}
            canControl={canControl}
            isDeviceOnline={isDeviceOnline}
            onTurnOn={() => handleRelayAction(2, true)}
            onTurnOff={() => handleRelayAction(2, false)}
            timedOptions={[
              { label: 'Kuras Otomatis 25s', seconds: 25 },
            ]}
            onTimedAction={(sec, label) => handleTimedRelayAction(2, sec, label)}
            activeTimer={channelTimers[2]}
            protectionNote="Normally Closed (Aman Tertutup Saat Mati Daya)"
          />

          {/* 3. LAMPU LED UV PENARIK (Relay 3 - GPIO 27) */}
          <ActuatorCard
            channel={3}
            name="Lampu LED Perangkap (UV 365nm)"
            hardwarePin="GPIO 27 · High Power LED Near-UV"
            icon={Lightbulb}
            description="Menyalakan modul lampu ultraviolet 365nm nokturnal penarik serangga hama wereng dan penggerek batang padi."
            actualStatus={actualLampStatus}
            lastCommand={getLastCommandForRelay(3)}
            isExecuting={isExecuting}
            canControl={canControl}
            isDeviceOnline={isDeviceOnline}
            onTurnOn={() => handleRelayAction(3, true)}
            onTurnOff={() => handleRelayAction(3, false)}
            timedOptions={[
              { label: 'Uji Nyala 60s', seconds: 60 },
            ]}
            onTimedAction={(sec, label) => handleTimedRelayAction(3, sec, label)}
            activeTimer={channelTimers[3]}
            protectionNote="Driver Arus ~850 mA · Tanpa PWM (Kontrol Saklar Relay)"
          />

          {/* 4. KIPAS BLOWER / AUXILIARY (Relay 4 - GPIO 26) */}
          <ActuatorCard
            channel={4}
            name="Kipas Blower / Port Aux"
            hardwarePin="GPIO 26 · DC Fan / Auxiliary Port"
            icon={Fan}
            description="Mengaktifkan kipas sirkulasi blower atau port beban cadangan untuk menjaga sirkulasi udara dan anti-embun pada kaca kamera."
            actualStatus={actualFanStatus}
            lastCommand={getLastCommandForRelay(4)}
            isExecuting={isExecuting}
            canControl={canControl}
            isDeviceOnline={isDeviceOnline}
            onTurnOn={() => handleRelayAction(4, true)}
            onTurnOff={() => handleRelayAction(4, false)}
            timedOptions={[
              { label: 'Nyalakan 30s', seconds: 30 },
            ]}
            onTimedAction={(sec, label) => handleTimedRelayAction(4, sec, label)}
            activeTimer={channelTimers[4]}
            protectionNote="Kontrol Saklar Relay ON/OFF (Tanpa PWM Slider)"
          />

        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: MAKRO LAPANGAN, KAMERA, & REBOOT                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Kamera Manual Snapshot */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[#192A20]">
            <Camera className="h-5 w-5 text-[#2D6A4F]" />
            <h3 className="font-bold text-sm">Kamera Baki OV5640</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Picukan pemotretan baki instan dengan LED iluminasi 4000K untuk inspeksi visual kondisi air dan bangkai serangga di luar jadwal rutin.
          </p>
          <div className="pt-2">
            <button
              type="button"
              disabled={!canControl || !isDeviceOnline || isExecuting}
              onClick={() => executeActuatorCommand('CAPTURE_NOW', undefined, 'Snapshot kamera baki berhasil diambil dan diunggah.')}
              className="w-full py-2.5 px-3 rounded-xl bg-white border border-[#2D6A4F] text-[#1B4332] font-semibold text-xs hover:bg-[#EAF4EE] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Camera className="h-4 w-4 text-[#2D6A4F]" />
              <span>Ambil Foto Baki Sekarang</span>
            </button>
          </div>
        </div>

        {/* Card 2: Siklus Cuci & Kuras Lengkap */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[#192A20]">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-sm">Siklus Cuci Baki Lengkap</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Menjalankan urutan terkoordinasi: katup drain dibuka 25 detik untuk membuang air kotor, lalu pompa mengisi ulang 5L air bersih dari tandon.
          </p>
          <div className="pt-2">
            <button
              type="button"
              disabled={!canControl || !isDeviceOnline || isExecuting}
              onClick={() => executeActuatorCommand('FORCE_WATER_CHANGE', undefined, 'Siklus pengurasan dan pengisian tandon berhasil dijalankan.')}
              className="w-full py-2.5 px-3 rounded-xl bg-[#2D6A4F] text-white font-semibold text-xs hover:bg-[#1B4332] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Droplets className="h-4 w-4" />
              <span>Jalankan Siklus Kuras &amp; Isi</span>
            </button>
          </div>
        </div>

        {/* Card 3: Soft Reboot ESP32 */}
        <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[#192A20]">
            <RotateCcw className="h-5 w-5 text-slate-700" />
            <h3 className="font-bold text-sm">Soft Restart Mikrokontroler</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Lakukan soft restart pada firmware ESP32-S3 tanpa menghapus konfigurasi kalibrasi sensor, kredensial Wi-Fi, dan waktu RTC DS3231.
          </p>
          <div className="pt-2">
            <button
              type="button"
              disabled={!canControl || !isDeviceOnline || isExecuting}
              onClick={() => setIsRebootModalOpen(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4 text-slate-600" />
              <span>Soft Reboot ESP32-S3</span>
            </button>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: SESSION COMMAND AUDIT LOG                                      */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-sm text-[#192A20] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#2D6A4F]" />
              Riwayat Perintah Kontrol Manual ({selectedDevice.code})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Log audit instruksi aktuator yang dikirimkan ke mikrokontroler melalui antrean Supabase
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {deviceCommands.length} perintah tercatat
          </span>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
          {deviceCommands.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Belum ada riwayat perintah kontrol manual pada sesi ini untuk unit {selectedDevice.code}.
            </div>
          ) : (
            deviceCommands.map((cmd) => (
              <div
                key={cmd.id}
                className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{cmd.commandType}</span>
                    {cmd.parameters?.relay && (
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                        Relay {cmd.parameters.relay} → {cmd.parameters.state}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        cmd.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : cmd.status === 'ACKNOWLEDGED'
                          ? 'bg-blue-100 text-blue-800'
                          : cmd.status === 'FAILED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {cmd.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">
                    {cmd.responseMessage || 'Menunggu konfirmasi polling dari mikrokontroler...'}
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

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI: MATIKAN SEMUA (EMERGENCY ALL-OFF)                       */}
      {/* ========================================================================= */}
      {isAllOffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-rose-300 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-800 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900">
                  Konfirmasi Matikan Semua Aktuator
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Tindakan ini akan mengirimkan perintah <strong>OFF</strong> ke seluruh 4 channel relay fisik pada unit <strong>{selectedDevice.code}</strong> (Pompa, Solenoid Drain, Lampu UV, dan Kipas Blower).
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
              <strong>Catatan Keselamatan:</strong> Setiap aktuator akan dikirim perintah OFF satu per satu ke database Supabase agar status kegagalan parsial dapat terpantau secara transparan.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsAllOffModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteAllOff}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all cursor-pointer shadow-xs"
              >
                Matikan Seluruh Aktuator Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI: SOFT REBOOT ESP32                                       */}
      {/* ========================================================================= */}
      {isRebootModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 shrink-0">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900">
                  Konfirmasi Soft Reboot: {selectedDevice.code}
                </h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  Perangkat fisik akan melakukan soft restart via perintah mikrokontroler. Selama proses reboot (~5 detik), perangkat tidak dapat menerima perintah.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsRebootModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsRebootModalOpen(false);
                  await executeActuatorCommand('REBOOT_ESP32', undefined, 'Perintah reboot ESP32 telah diterima perangkat.');
                }}
                className="px-4 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-bold hover:bg-[#2D6A4F] transition-all cursor-pointer shadow-xs"
              >
                Lanjutkan Reboot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Laporan Hasil Matikan Semua */}
      {allOffResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                Laporan Eksekusi: Matikan Semua Aktuator
              </h3>
              <button
                type="button"
                onClick={() => setAllOffResults(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {allOffResults.map((res) => (
                <div key={res.relay} className="p-3 bg-white flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {res.success ? (
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-800">{res.name}</span>
                  </div>
                  <span
                    className={`font-mono text-[11px] ${
                      res.success ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-bold'
                    }`}
                  >
                    {res.message}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setAllOffResults(null)}
                className="px-4 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-bold hover:bg-[#2D6A4F] transition-all cursor-pointer shadow-xs"
              >
                Tutup Laporan
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
