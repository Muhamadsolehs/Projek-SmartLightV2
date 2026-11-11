import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Database,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { DeviceCommand, SmartLightTrapDevice } from '../../types';
import { hasPermission, getRoleMetadata } from '../../lib/permissions';
import { deviceService } from '../../services/deviceService';
import { relayStatusService } from '../../services/relayStatusService';

interface ActuatorCardProps {
  channel: 1 | 2 | 3 | 4;
  name: string;
  hardwarePin: string;
  dbColumn: 'channel_1' | 'channel_2' | 'channel_3' | 'channel_4';
  dbStatus: boolean; // Nilai boolean pada kolom tabel relay_status di Supabase (true = ON, false = OFF)
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
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
  dbColumn,
  dbStatus,
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
  return (
    <div
      title={description || name}
      className={`p-3.5 rounded-xl border transition-all ${
        dbStatus
          ? 'bg-[#EAF4EE]/25 border-[#2D6A4F]/60 shadow-xs ring-1 ring-[#2D6A4F]/20'
          : 'bg-white border-[#E2E8F0] shadow-2xs hover:border-[#D1DCD6]'
      }`}
    >
      {/* Header: Title, Pin, Database Status Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs font-bold transition-colors ${
              dbStatus
                ? 'bg-[#1B4332] text-white shadow-xs'
                : 'bg-[#F1F5F2] text-[#52796F] border border-[#E2E8F0]'
            }`}
          >
            R{channel}
          </div>
          <div>
            <h3 className="font-bold text-xs text-[#192A20] flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 ${dbStatus ? 'text-[#2D6A4F]' : 'text-[#52796F]'}`} />
              <span>{name}</span>
            </h3>
            <p className="text-[10px] text-[#718096] font-mono mt-0.5">
              {hardwarePin.split('·')[0].trim()} · {dbColumn}
            </p>
          </div>
        </div>

        {/* Small Status Badge */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border transition-colors ${
            dbStatus
              ? 'bg-emerald-50 text-[#1B4332] border-emerald-200'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              dbStatus ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`}
          />
          {dbStatus ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Kontrol ON / OFF Buttons */}
      <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={isExecuting || !canControl}
          onClick={onTurnOn}
          className={`py-1.5 px-2.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            dbStatus
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'border border-[#2D6A4F] bg-white text-[#1B4332] hover:bg-[#EAF4EE]'
          }`}
          title={`Nyalakan Relay ${channel}`}
        >
          {isExecuting ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : dbStatus ? (
            <Check className="h-3 w-3 text-white" />
          ) : (
            <Power className="h-3 w-3" />
          )}
          <span>Nyalakan (ON)</span>
        </button>

        <button
          type="button"
          disabled={isExecuting || !canControl}
          onClick={onTurnOff}
          className={`py-1.5 px-2.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            !dbStatus
              ? 'bg-slate-700 text-white shadow-xs'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
          }`}
          title={`Matikan Relay ${channel}`}
        >
          {isExecuting ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : !dbStatus ? (
            <Check className="h-3 w-3 text-white" />
          ) : (
            <Square className="h-3 w-3" />
          )}
          <span>Matikan (OFF)</span>
        </button>
      </div>

      {/* Quick Timed Options */}
      {timedOptions && timedOptions.length > 0 && onTimedAction && (
        <div className="mt-2 pt-2 border-t border-[#E2E8F0] flex items-center justify-between gap-1 text-[10px]">
          <span className="text-[#A0AEC0]">Timer:</span>
          <div className="flex items-center gap-1">
            {timedOptions.map((opt) => (
              <button
                key={opt.seconds}
                type="button"
                disabled={isExecuting || (activeTimer !== undefined && activeTimer !== null) || !canControl}
                onClick={() => onTimedAction(opt.seconds, opt.label)}
                className="px-2 py-0.5 rounded-md bg-[#F1F5F2] text-[#192A20] hover:bg-[#E2E8F0] border border-[#E2E8F0] text-[10px] font-medium disabled:opacity-40 transition-colors cursor-pointer"
                title={`Aktifkan selama ${opt.seconds}s`}
              >
                {activeTimer ? `${activeTimer}s...` : opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
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

  // Default target perangkat ke SLT-SBG-01 saat halaman pertama kali dimuat
  const hasSetDefaultRef = useRef(false);
  useEffect(() => {
    if (!hasSetDefaultRef.current && devices && devices.length > 0) {
      const sbg01 = devices.find((d) => d.code === 'SLT-SBG-01');
      if (sbg01) {
        setSelectedDeviceId(sbg01.id);
        hasSetDefaultRef.current = true;
      }
    }
  }, [devices, setSelectedDeviceId]);

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

  const canControl = currentUser?.role ? hasPermission(currentUser.role, 'control:devices') : true;
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

  // Sinkronisasi status relay seketika dari tabel public.relay_status (id=1)
  const [relayTableStatus, setRelayTableStatus] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
  });
  const [lastRelayUpdatedAt, setLastRelayUpdatedAt] = useState<string | null>(null);
  const [isRefreshingTable, setIsRefreshingTable] = useState(false);

  const fetchRelayTableStatus = async () => {
    setIsRefreshingTable(true);
    try {
      const rec = await relayStatusService.getRelayStatus(1);
      if (rec) {
        setRelayTableStatus({
          1: Boolean(rec.channel_1),
          2: Boolean(rec.channel_2),
          3: Boolean(rec.channel_3),
          4: Boolean(rec.channel_4),
        });
        if (rec.updated_at) {
          setLastRelayUpdatedAt(rec.updated_at);
        }
      }
    } finally {
      setIsRefreshingTable(false);
    }
  };

  useEffect(() => {
    fetchRelayTableStatus();

    const unsubscribe = relayStatusService.subscribeToRelayStatus((rec) => {
      if (rec) {
        setRelayTableStatus({
          1: Boolean(rec.channel_1),
          2: Boolean(rec.channel_2),
          3: Boolean(rec.channel_3),
          4: Boolean(rec.channel_4),
        });
        if (rec.updated_at) {
          setLastRelayUpdatedAt(rec.updated_at);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Actual actuator states derived from live telemetry & device records or relay_status table
  const tel = selectedDevice?.currentTelemetry;
  const actualPumpStatus = relayTableStatus[1] !== undefined
    ? (relayTableStatus[1] ? 'ON' : 'OFF')
    : (tel?.water?.fillPumpStatus === 'running' ? 'ON' : 'OFF');

  const actualDrainStatus = relayTableStatus[2] !== undefined
    ? (relayTableStatus[2] ? 'ON' : 'OFF')
    : (tel?.water?.drainValveStatus === 'open' ? 'ON' : 'OFF');

  // Relay 4 (Lampu LED UV):
  const actualLampStatus = relayTableStatus[4] !== undefined
    ? (relayTableStatus[4] ? 'ON' : 'OFF')
    : (tel?.lamp?.isActive ? 'ON' : 'OFF');

  // Relay 3 (Kipas / Aux): fallback state
  const [actualFanStatus, setActualFanStatus] = useState<'ON' | 'OFF' | 'UNKNOWN'>('OFF');
  const fanStatus = relayTableStatus[3] !== undefined
    ? (relayTableStatus[3] ? 'ON' : 'OFF')
    : actualFanStatus;

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
      (channel === 4 && deviceCommands.find((c) => c.commandType === 'TOGGLE_LAMP')) ||
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

      // Track the command status asynchronously until completed or ACKed by ESP8266 NodeMCU
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
          message: `Perintah terkirim ke antrean cloud. Menunggu konfirmasi polling berikutnya dari ESP8266 NodeMCU ${selectedDevice.code}.`,
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

  // Ubah status channel pada tabel public.relay_status di Supabase (true = ON, false = OFF)
  const handleRelayAction = async (channel: 1 | 2 | 3 | 4, turnOn: boolean) => {
    const channelNames: Record<number, string> = {
      1: 'Pompa Air Pengisi (channel_1)',
      2: 'Katup Solenoid Drain (channel_2)',
      3: 'Kipas Blower / Aux (channel_3)',
      4: 'Lampu LED UV 365nm (channel_4)',
    };
    const chName = channelNames[channel] || `Channel ${channel}`;
    const colName = `channel_${channel}`;

    setIsExecuting(true);
    setActiveCommandName(`SET_${colName.toUpperCase()}`);
    setFeedback({
      type: 'info',
      message: `Menyimpan perubahan ${chName} -> ${turnOn ? 'true (ON)' : 'false (OFF)'} ke tabel relay_status di Supabase...`,
    });

    try {
      // 1. Eksekusi update langsung ke tabel public.relay_status di Supabase (id = 1)
      const res = await relayStatusService.updateChannel(channel, turnOn, 1);

      if (!res.success) {
        throw new Error(res.error || `Gagal mengubah status ${colName}`);
      }

      // 2. Perbarui state lokal seketika
      setRelayTableStatus((prev) => ({ ...prev, [channel]: turnOn }));
      setLastRelayUpdatedAt(new Date().toISOString());

      if (channel === 3) {
        setActualFanStatus(turnOn ? 'ON' : 'OFF');
      }

      setFeedback({
        type: 'success',
        message: `Berhasil! Status ${chName} diubah menjadi ${turnOn ? 'ON (true)' : 'OFF (false)'} pada tabel public.relay_status (id=1).`,
      });

      // 3. Jika unit online & terdaftar, sinkronkan juga antrean perintah ke hardware
      if (selectedDevice && isDeviceOnline && canControl) {
        sendCommand(selectedDevice.id, 'SET_RELAY', { relay: channel, state: turnOn ? 'ON' : 'OFF' }).catch(() => {});
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Gagal mengubah status relay di Supabase.',
      });
    } finally {
      setIsExecuting(false);
      setActiveCommandName(null);
    }
  };

  // Mengubah seluruh channel (1-4) sekaligus ke true (ON) atau false (OFF)
  const handleSetAllRelays = async (turnOn: boolean) => {
    setIsExecuting(true);
    setActiveCommandName(turnOn ? 'ALL_ON' : 'ALL_OFF');
    setFeedback({
      type: 'info',
      message: `Mengubah seluruh channel (1-4) menjadi ${turnOn ? 'true (ON)' : 'false (OFF)'} di tabel relay_status...`,
    });

    try {
      const res = await relayStatusService.setAllChannels(turnOn, 1);
      if (res.success) {
        setRelayTableStatus({ 1: turnOn, 2: turnOn, 3: turnOn, 4: turnOn });
        setLastRelayUpdatedAt(new Date().toISOString());
        setActualFanStatus(turnOn ? 'ON' : 'OFF');
        setFeedback({
          type: 'success',
          message: `Berhasil! Seluruh channel (1-4) diubah menjadi ${turnOn ? 'ON (true)' : 'OFF (false)'} pada tabel public.relay_status.`,
        });
      } else {
        throw new Error(res.error || 'Gagal mengubah status di Supabase');
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Gagal memperbarui seluruh channel relay.',
      });
    } finally {
      setIsExecuting(false);
      setActiveCommandName(null);
    }
  };

  // Timed relay action with auto-OFF countdown
  const handleTimedRelayAction = async (channel: 1 | 2 | 3 | 4, seconds: number, label: string) => {
    if (!canControl) return;

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
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#192A20]">
            Kontrol Manual &amp; Aktuator
          </h1>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isExecuting}
            onClick={async () => {
              setFeedback({ type: 'info', message: 'Memperbarui data status dan telemetri perangkat...' });
              await refreshData();
              setFeedback({ type: 'success', message: 'Data status perangkat berhasil disinkronkan.' });
            }}
            className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAF9] text-xs font-semibold text-[#192A20] flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            title="Muat ulang status telemetri dari cloud"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#52796F] ${isExecuting ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            disabled={!canControl || !isDeviceOnline || isExecuting}
            onClick={() => setIsAllOffModalOpen(true)}
            className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Matikan seluruh aktuator fisik secara serempak"
          >
            <Square className="h-3.5 w-3.5" />
            <span>Matikan Semua (All OFF)</span>
          </button>
        </div>
      </div>

      {/* Role Permission Alert (if viewer or analyst) */}
      {!canControl && (
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-900 flex items-center gap-2.5 shadow-2xs">
          <Lock className="h-4 w-4 text-rose-600 shrink-0" />
          <p className="text-xs text-rose-800">
            <strong>Mode Baca-Saja ({roleMeta.label}):</strong> Tombol pengaktifan relay fisik dinonaktifkan. Hak kendali hanya untuk Operator dan Admin.
          </p>
        </div>
      )}

      {/* Device Selector & Live Telemetry Bar (Simplified Dropdown) */}
      <div className="p-3 sm:p-3.5 rounded-xl border border-[#E2E8F0] bg-white shadow-2xs space-y-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Dropdown with Target Label & Status */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 text-[#192A20]">
              <Radio className="h-4 w-4 text-[#2D6A4F] shrink-0" />
              <label htmlFor="device-target-select" className="font-semibold text-xs whitespace-nowrap">
                Pilih Target Kontrol:
              </label>
            </div>

            <div className="flex items-center gap-2">
              <select
                id="device-target-select"
                value={selectedDevice.id}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="text-xs font-semibold text-[#192A20] bg-[#F8FAF9] hover:bg-[#F1F5F2] border border-[#E2E8F0] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#2D6A4F] focus:border-[#2D6A4F] cursor-pointer transition-colors shadow-2xs"
              >
                {devices.map((dev) => (
                  <option key={dev.id} value={dev.id}>
                    {dev.code} - {dev.name} ({dev.status === 'online' ? 'Online' : 'Offline'})
                  </option>
                ))}
              </select>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  isDeviceOnline
                    ? 'bg-emerald-50 text-[#1B4332] border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${isDeviceOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {isDeviceOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          {/* Right: Live Telemetry Metrics */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#718096] bg-[#F8FAF9] px-3 py-1.5 rounded-lg border border-[#E2E8F0]">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] text-[#718096]">Tegangan:</span>
              <strong className="font-mono text-[#192A20]">
                {(tel?.battery?.busVoltageV ?? selectedDevice.currentTelemetry?.battery?.busVoltageV ?? 12.8).toFixed(2)} V
              </strong>
            </span>
            <span className="text-[#E2E8F0]">|</span>
            <span className="flex items-center gap-1.5">
              <Droplets className="h-3.5 w-3.5 text-[#2D6A4F]" />
              <span className="text-[11px] text-[#718096]">Tandon:</span>
              <strong className="font-mono text-[#192A20]">
                {tel?.water?.tankLevelPercent ?? selectedDevice.currentTelemetry?.water?.tankLevelPercent ?? 0}%
              </strong>
            </span>
            <span className="text-[#E2E8F0]">|</span>
            <span className="flex items-center gap-1.5 text-[11px] text-[#A0AEC0]">
              <Clock className="h-3 w-3" />
              <span className="font-mono">
                {selectedDevice.lastSyncAt ? selectedDevice.lastSyncAt.split('T')[1]?.slice(0, 8) : 'Real-time'} WIB
              </span>
            </span>
          </div>
        </div>

        {/* Offline Warning Notice (Subtle, Compact 1-liner) */}
        {!isDeviceOnline && (
          <div className="px-2.5 py-1 bg-amber-50/80 border border-amber-200/80 rounded-lg text-[11px] text-amber-900 flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>Perangkat offline. Perintah relay akan disimpan di Supabase dan disinkronkan saat terhubung kembali.</span>
          </div>
        )}
      </div>

      {/* Real-Time Command Feedback Alert */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-[#1B4332]'
              : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : feedback.type === 'error' ? (
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          ) : (
            <RefreshCw className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
          )}
          <span className="flex-1 font-medium">{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Supabase relay_status database live control bar */}
      <div className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[#2D6A4F]" />
            <h2 className="text-xs font-bold text-[#192A20] tracking-wide flex items-center gap-1.5">
              <span>Status Database Relay</span>
              <code className="text-[#1B4332] bg-[#EAF4EE] px-1.5 py-0.5 rounded font-mono text-[10px]">relay_status</code>
            </h2>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" title="Realtime Aktif" />
            <span className="text-[10px] text-[#718096] font-mono hidden sm:inline">
              · {selectedDevice.code}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isExecuting || !canControl}
              onClick={() => handleSetAllRelays(true)}
              className="px-2.5 py-1 rounded-lg bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs disabled:opacity-40"
            >
              <Power className="h-3 w-3" />
              <span>Semua ON</span>
            </button>
            <button
              type="button"
              disabled={isExecuting || !canControl}
              onClick={() => handleSetAllRelays(false)}
              className="px-2.5 py-1 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs disabled:opacity-40"
            >
              <Square className="h-3 w-3" />
              <span>Semua OFF</span>
            </button>
            <button
              type="button"
              disabled={isRefreshingTable}
              onClick={fetchRelayTableStatus}
              className="p-1 rounded-lg border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#718096] text-xs transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
              title="Refresh tabel relay"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingTable ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Channel Status Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
          {[
            { ch: 1, name: 'Pompa Air', state: relayTableStatus[1] },
            { ch: 2, name: 'Solenoid Drain', state: relayTableStatus[2] },
            { ch: 3, name: 'Kipas Blower', state: relayTableStatus[3] },
            { ch: 4, name: 'Lampu LED UV', state: relayTableStatus[4] },
          ].map((item) => (
            <div key={item.ch} className="p-2 rounded-lg bg-[#F8FAF9] border border-[#E2E8F0] flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[9px] text-[#A0AEC0] block font-mono">channel_{item.ch}</span>
                <span className="text-[11px] font-semibold text-[#192A20] truncate block">{item.name}</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${
                  item.state ? 'bg-emerald-50 text-[#1B4332] border-emerald-200' : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {item.state ? 'ON' : 'OFF'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 4 Dedicated Actuator Control Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#192A20] flex items-center gap-1.5">
            <Cpu className="h-4 w-4 text-[#2D6A4F]" />
            Panel Aktuator Fisik (4-Channel Relay NodeMCU)
          </h2>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[#F1F5F2] border border-[#E2E8F0] text-[#52796F]">
            Active LOW
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 1. POMPA AIR PENGISI */}
          <ActuatorCard
            channel={1}
            name="Pompa Air Pengisi Baki"
            hardwarePin="D1 / GPIO5 · 12V DC"
            dbColumn="channel_1"
            dbStatus={Boolean(relayTableStatus[1])}
            icon={Droplets}
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
          />

          {/* 2. KATUP SOLENOID DRAIN */}
          <ActuatorCard
            channel={2}
            name="Katup Solenoid Drain Baki"
            hardwarePin="D2 / GPIO4 · Solenoid NC"
            dbColumn="channel_2"
            dbStatus={Boolean(relayTableStatus[2])}
            icon={ArrowDownCircle}
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
          />

          {/* 3. KIPAS BLOWER / AUXILIARY */}
          <ActuatorCard
            channel={3}
            name="Kipas Blower / Port Aux"
            hardwarePin="D7 / GPIO13 · DC Fan / Aux"
            dbColumn="channel_3"
            dbStatus={Boolean(relayTableStatus[3])}
            icon={Fan}
            actualStatus={fanStatus}
            lastCommand={getLastCommandForRelay(3)}
            isExecuting={isExecuting}
            canControl={canControl}
            isDeviceOnline={isDeviceOnline}
            onTurnOn={() => handleRelayAction(3, true)}
            onTurnOff={() => handleRelayAction(3, false)}
            timedOptions={[
              { label: 'Nyalakan 30s', seconds: 30 },
            ]}
            onTimedAction={(sec, label) => handleTimedRelayAction(3, sec, label)}
            activeTimer={channelTimers[3]}
          />

          {/* 4. LAMPU LED UV PENARIK */}
          <ActuatorCard
            channel={4}
            name="Lampu LED Perangkap (UV 365nm)"
            hardwarePin="D0 / GPIO16 · High Power UV"
            dbColumn="channel_4"
            dbStatus={Boolean(relayTableStatus[4])}
            icon={Lightbulb}
            actualStatus={actualLampStatus}
            lastCommand={getLastCommandForRelay(4)}
            isExecuting={isExecuting}
            canControl={canControl}
            isDeviceOnline={isDeviceOnline}
            onTurnOn={() => handleRelayAction(4, true)}
            onTurnOff={() => handleRelayAction(4, false)}
            timedOptions={[
              { label: 'Uji Nyala 60s', seconds: 60 },
            ]}
            onTimedAction={(sec, label) => handleTimedRelayAction(4, sec, label)}
            activeTimer={channelTimers[4]}
          />
        </div>
      </div>

      {/* Makro Lapangan, Kamera, & Reboot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Kamera Manual Snapshot */}
        <div className="p-3.5 rounded-xl border border-[#E2E8F0] bg-white shadow-2xs hover:border-[#D1DCD6] transition-colors space-y-3">
          <div className="flex items-center gap-2 text-[#192A20]">
            <Camera className="h-4 w-4 text-[#2D6A4F]" />
            <h3 className="font-semibold text-xs text-[#192A20]">Kamera Baki OV5640</h3>
          </div>
          <button
            type="button"
            disabled={!canControl || !isDeviceOnline || isExecuting}
            onClick={() => executeActuatorCommand('CAPTURE_NOW', undefined, 'Snapshot kamera baki berhasil diambil dan diunggah.')}
            className="w-full py-1.5 px-3 rounded-lg bg-white border border-[#2D6A4F] text-[#1B4332] font-semibold text-xs hover:bg-[#EAF4EE] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5 text-[#2D6A4F]" />
            <span>Ambil Snapshot Baki</span>
          </button>
        </div>

        {/* Card 2: Siklus Cuci & Kuras Lengkap */}
        <div className="p-3.5 rounded-xl border border-[#E2E8F0] bg-white shadow-2xs hover:border-[#D1DCD6] transition-colors space-y-3">
          <div className="flex items-center gap-2 text-[#192A20]">
            <RefreshCw className="h-4 w-4 text-[#2D6A4F]" />
            <h3 className="font-semibold text-xs text-[#192A20]">Siklus Cuci Baki Lengkap</h3>
          </div>
          <button
            type="button"
            disabled={!canControl || !isDeviceOnline || isExecuting}
            onClick={() => executeActuatorCommand('FORCE_WATER_CHANGE', undefined, 'Siklus pengurasan dan pengisian tandon berhasil dijalankan.')}
            className="w-full py-1.5 px-3 rounded-lg bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-semibold text-xs disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Droplets className="h-3.5 w-3.5" />
            <span>Jalankan Siklus Cuci</span>
          </button>
        </div>

        {/* Card 3: Soft Restart ESP8266 */}
        <div className="p-3.5 rounded-xl border border-[#E2E8F0] bg-white shadow-2xs hover:border-[#D1DCD6] transition-colors space-y-3">
          <div className="flex items-center gap-2 text-[#192A20]">
            <RotateCcw className="h-4 w-4 text-[#52796F]" />
            <h3 className="font-semibold text-xs text-[#192A20]">Soft Restart ESP8266</h3>
          </div>
          <button
            type="button"
            disabled={!canControl || !isDeviceOnline || isExecuting}
            onClick={() => setIsRebootModalOpen(true)}
            className="w-full py-1.5 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] hover:bg-[#E2E8F0] text-[#192A20] font-semibold text-xs disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#52796F]" />
            <span>Soft Reboot ESP8266</span>
          </button>
        </div>
      </div>

      {/* Session Command Audit Log */}
      <div className="p-3.5 rounded-xl border border-[#E2E8F0] bg-white shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
          <h3 className="font-semibold text-xs text-[#192A20] flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-[#2D6A4F]" />
            Riwayat Perintah ({selectedDevice.code})
          </h3>
          <span className="text-[11px] text-[#A0AEC0] font-mono">
            {deviceCommands.length} perintah tercatat
          </span>
        </div>

        <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-lg overflow-hidden bg-white max-h-60 overflow-y-auto">
          {deviceCommands.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#A0AEC0]">
              Belum ada riwayat perintah pada sesi ini untuk unit {selectedDevice.code}.
            </div>
          ) : (
            deviceCommands.map((cmd) => (
              <div
                key={cmd.id}
                className="p-2.5 hover:bg-[#F8FAF9] transition-colors flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#192A20] text-[11px]">{cmd.commandType}</span>
                    {cmd.parameters?.relay && (
                      <span className="font-mono text-[9px] bg-[#F1F5F2] text-[#192A20] border border-[#E2E8F0] px-1.5 py-0.5 rounded font-semibold">
                        R{cmd.parameters.relay} → {cmd.parameters.state}
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${
                        cmd.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-[#1B4332] border-emerald-200'
                          : cmd.status === 'ACKNOWLEDGED'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : cmd.status === 'FAILED'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {cmd.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#718096] truncate mt-0.5">
                    {cmd.responseMessage || 'Menunggu polling...'}
                  </div>
                </div>
                <div className="font-mono text-[10px] text-[#A0AEC0] text-right shrink-0">
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
          <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-[#192A20]">
                  Konfirmasi Matikan Semua Aktuator
                </h3>
                <p className="text-xs text-[#718096] mt-1 leading-relaxed">
                  Tindakan ini akan mengirimkan perintah <strong>OFF</strong> ke seluruh 4 channel relay fisik pada unit <strong>{selectedDevice.code}</strong> (Pompa, Solenoid Drain, Lampu UV, dan Kipas Blower).
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
              <strong>Catatan Keselamatan:</strong> Setiap aktuator akan dikirim perintah OFF satu per satu ke database Supabase agar status kegagalan parsial dapat terpantau secara transparan.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setIsAllOffModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[#192A20] text-xs font-semibold hover:bg-[#F8FAF9] transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteAllOff}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all cursor-pointer shadow-2xs"
              >
                Matikan Seluruh Aktuator Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI: SOFT REBOOT ESP8266                                     */}
      {/* ========================================================================= */}
      {isRebootModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF4EE] text-[#1B4332] border border-emerald-200 shrink-0">
                <RotateCcw className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-[#192A20]">
                  Konfirmasi Soft Reboot: {selectedDevice.code}
                </h3>
                <p className="text-xs text-[#718096] mt-1 leading-relaxed">
                  Perangkat fisik akan melakukan soft restart via perintah mikrokontroler. Selama proses reboot (~5 detik), perangkat tidak dapat menerima perintah.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setIsRebootModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[#192A20] text-xs font-semibold hover:bg-[#F8FAF9] transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsRebootModalOpen(false);
                  await executeActuatorCommand('REBOOT_ESP32', undefined, 'Perintah reboot ESP8266 telah diterima perangkat.');
                }}
                className="px-4 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-bold hover:bg-[#2D6A4F] transition-all cursor-pointer shadow-2xs"
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
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-base font-bold text-[#192A20]">
                Laporan Eksekusi: Matikan Semua Aktuator
              </h3>
              <button
                type="button"
                onClick={() => setAllOffResults(null)}
                className="p-1 rounded-lg text-[#718096] hover:text-[#192A20] hover:bg-[#F8FAF9] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="divide-y divide-[#E2E8F0] border border-[#E2E8F0] rounded-xl overflow-hidden">
              {allOffResults.map((res) => (
                <div key={res.relay} className="p-3 bg-white flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {res.success ? (
                      <Check className="h-4 w-4 text-[#2D6A4F] shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-semibold text-[#192A20]">{res.name}</span>
                  </div>
                  <span
                    className={`font-mono text-[11px] ${
                      res.success ? 'text-[#1B4332] font-semibold' : 'text-rose-700 font-bold'
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
                className="px-4 py-2 rounded-lg bg-[#1B4332] text-white text-xs font-bold hover:bg-[#2D6A4F] transition-all cursor-pointer shadow-2xs"
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
