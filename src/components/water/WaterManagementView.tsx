import React, { useState } from 'react';
import {
  Droplets,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Play,
  Layers,
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { waterService } from '../../services/waterService';
import { WaterChangeLog } from '../../types';
import { hasPermission } from '../../lib/permissions';

export const WaterManagementView: React.FC = () => {
  const {
    selectedDevice,
    devices,
    setSelectedDeviceId,
    waterLogs,
    sendCommand,
    triggerHardwareSimulation,
    isSimulatingAction,
    currentUser,
    refreshData,
  } = useDevice();

  const [isCycling, setIsCycling] = useState(false);
  const [cycleStatus, setCycleStatus] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<'all' | 'selected'>('all');

  const canControlWater = hasPermission(currentUser?.role, 'control:devices');

  const tel = selectedDevice.currentTelemetry;
  const w = tel.water;

  const handleStartCycle = async () => {
    if (w.tankLevelPercent < 15) {
      setCycleStatus('Peringatan: Tandon cadangan kritis (<15%). Siklus dibatalkan demi keselamatan pompa.');
      return;
    }
    setIsCycling(true);
    setCycleStatus('Mengirim perintah siklus hidraulik ke ESP32...');
    try {
      const res = await sendCommand(selectedDevice.id, 'FORCE_WATER_CHANGE');
      
      // Catat hasil ke log database Supabase
      await waterService.recordWaterChange({
        deviceId: selectedDevice.id,
        startedAt: new Date(Date.now() - 25000).toISOString(),
        completedAt: new Date().toISOString(),
        triggerReason: 'manual_operator',
        initialTurbidityNtu: w.turbidityNtu,
        finalTurbidityNtu: 25,
        waterUsedLiters: 5.0,
        status: 'SUCCESS',
      });
      await refreshData();

      setCycleStatus(`Berhasil: ${res.responseMessage || 'Pergantian air selesai dan dicatat dalam log.'}`);
    } catch (err: any) {
      setCycleStatus(`Gagal: ${err.message || 'Gagal menghubungkan ke mikrokontroler.'}`);
    } finally {
      setIsCycling(false);
    }
  };

  const displayedLogs =
    logFilter === 'selected'
      ? waterLogs.filter((l) => l.deviceId === selectedDevice.id)
      : waterLogs;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#192A20]">
            Monitoring Air &amp; Siklus Baki
          </h1>
        </div>

        {/* Device Picker */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Unit:</span>
          <select
            value={selectedDevice.id}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 font-mono text-xs font-bold text-[#192A20] focus:border-[#2D6A4F] focus:outline-hidden"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.locationName.split(' ')[0]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hydraulic Graphic Status Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Tray Visual Card */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F] flex items-center gap-1.5">
              <Droplets className="h-3.5 w-3.5 text-[#2B6CB0]" />
              <span>Baki Penangkap Serangga</span>
            </h2>
            <span className="font-mono text-xs font-bold text-[#192A20]">
              {w.trayLevelPercent}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Visual Tray Cylinder */}
            <div className="relative h-28 w-16 rounded-lg border-2 border-[#CBD5E1] bg-[#F1F5F2] overflow-hidden flex flex-col justify-end p-0.5 shrink-0">
              <div
                className={`w-full rounded transition-all duration-700 ${
                  w.isTurbid ? 'bg-[#92400E]/70' : 'bg-[#38BDF8]/80'
                }`}
                style={{ height: `${w.trayLevelPercent}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="font-mono text-[11px] font-bold text-white drop-shadow-xs">
                  {w.trayLevelCm} cm
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Kekeruhan (Turbidity):</span>
                <span className={`font-mono text-sm font-bold ${w.isTurbid ? 'text-[#DC2626]' : 'text-[#2D6A4F]'}`}>
                  {w.turbidityNtu} NTU
                </span>
                <p className="text-[10px] text-slate-500">
                  {w.isTurbid ? 'Kotor (>100 NTU)' : 'Bersih (<50 NTU)'}
                </p>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">Katup Solenoid:</span>
                <span className="font-mono text-xs font-bold text-[#192A20] uppercase">
                  {w.drainValveStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tank Visual Card */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F] flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#2D6A4F]" />
              <span>Tandon Air Cadangan (50L)</span>
            </h2>
            <span className={`font-mono text-xs font-bold ${w.tankLevelPercent < 20 ? 'text-[#DC2626]' : 'text-[#192A20]'}`}>
              {w.tankLevelPercent}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Visual Tank */}
            <div className="relative h-28 w-16 rounded-lg border-2 border-[#CBD5E1] bg-[#F1F5F2] overflow-hidden flex flex-col justify-end p-0.5 shrink-0">
              <div
                className={`w-full rounded transition-all duration-700 ${
                  w.tankLevelPercent < 20 ? 'bg-[#EF4444]' : 'bg-[#0EA5E9]'
                }`}
                style={{ height: `${w.tankLevelPercent}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="font-mono text-[11px] font-bold text-white drop-shadow-xs">
                  {w.tankVolumeLiters} L
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Sensor Level:</span>
                <span className="font-mono font-semibold text-slate-800 text-[11px]">
                  Ultrasonik JSN-SR04T
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">Status Pompa:</span>
                <span className={`font-mono text-xs font-bold uppercase ${
                  w.fillPumpStatus === 'dry_run_lockout' ? 'text-[#DC2626]' : 'text-[#192A20]'
                }`}>
                  {w.fillPumpStatus.replace('_', ' ')}
                </span>
              </div>

              {w.safetyLockout && (
                <div className="p-1 bg-[#FEE2E2] rounded text-[10px] text-[#DC2626] font-semibold">
                  Dry-Run Lockout Aktif!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hydraulic Safety & Execution Card */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs flex flex-col justify-between space-y-2.5">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5 mb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F] flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#2D6A4F]" />
                <span>Interlock &amp; Aksi Kuras</span>
              </h2>
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              Buka katup buang 25s, lalu isi ulang 5L air segar dari tandon hingga level baki 85%.
            </p>
            <div className="mt-2 text-[10px] text-slate-500">
              Terakhir ganti: <span className="font-mono font-semibold text-slate-700">{w.lastWaterChange ? w.lastWaterChange.split('T')[0] : 'Belum pernah'}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {!canControlWater && (
              <div className="p-2 rounded-lg border border-red-200 bg-red-50 text-[10px] text-red-800 flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-red-600 shrink-0" />
                <span>Aksi kuras dibatasi untuk Operator &amp; Admin.</span>
              </div>
            )}

            <button
              disabled={!canControlWater || isCycling || isSimulatingAction || w.safetyLockout}
              onClick={handleStartCycle}
              className="w-full py-1.5 px-3 bg-[#2D6A4F] text-white rounded-lg text-xs font-semibold hover:bg-[#1B4332] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${isCycling ? 'animate-spin' : ''}`} />
              <span>{!canControlWater ? 'Dibatasi' : 'Jalankan Kuras & Isi Baki'}</span>
            </button>

            {cycleStatus && (
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-800">
                {cycleStatus}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hydraulic Safety Protocol Rules */}
      <div className="rounded-xl border border-[#D1DCD6] bg-[#F8FAF9] p-3 shadow-2xs">
        <h3 className="text-xs font-bold text-[#192A20] mb-2">
          Aturan Keselamatan Hidraulik (Safety Interlock)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0]">
            <div className="flex items-center gap-1.5 font-semibold text-[#192A20] mb-0.5 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
              <span>1. Dry-Run Protection</span>
            </div>
            <p className="text-[11px] text-[#718096]">
              Tandon &lt; 15% (7.5L) memutus relay pompa secara mekanis demi keselamatan.
            </p>
          </div>

          <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0]">
            <div className="flex items-center gap-1.5 font-semibold text-[#192A20] mb-0.5 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
              <span>2. Overflow Lockout</span>
            </div>
            <p className="text-[11px] text-[#718096]">
              Baki &ge; 95% atau pengisian &gt; 45s otomatis mematikan katup.
            </p>
          </div>

          <div className="p-2.5 bg-white rounded-lg border border-[#E2E8F0]">
            <div className="flex items-center gap-1.5 font-semibold text-[#192A20] mb-0.5 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2D6A4F]" />
              <span>3. Logika NTU</span>
            </div>
            <p className="text-[11px] text-[#718096]">
              Kekeruhan &gt; 100 NTU selama 30 menit otomatis memajukan jadwal kuras.
            </p>
          </div>
        </div>
      </div>

      {/* Water Change Activity Logs Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-2">
          <h2 className="text-xs font-bold text-[#192A20]">
            Riwayat Log Pergantian Air &amp; Kekeruhan
          </h2>

          <div className="flex items-center gap-0.5 p-0.5 bg-[#F1F5F2] rounded-lg text-xs font-medium">
            <button
              onClick={() => setLogFilter('all')}
              className={`px-2.5 py-0.5 rounded-md transition-colors text-xs ${
                logFilter === 'all'
                  ? 'bg-white text-[#192A20] shadow-2xs font-semibold'
                  : 'text-[#52796F] hover:text-[#192A20]'
              }`}
            >
              Semua ({waterLogs.length})
            </button>
            <button
              onClick={() => setLogFilter('selected')}
              className={`px-2.5 py-0.5 rounded-md transition-colors text-xs ${
                logFilter === 'selected'
                  ? 'bg-white text-[#2D6A4F] shadow-2xs font-semibold'
                  : 'text-[#52796F] hover:text-[#192A20]'
              }`}
            >
              {selectedDevice.code} ({waterLogs.filter((l) => l.deviceId === selectedDevice.id).length})
            </button>
          </div>
        </div>

        {displayedLogs.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#718096] bg-[#F8FAF9] rounded-lg border border-dashed border-[#E2E8F0]">
            <Droplets className="h-5 w-5 mx-auto mb-1 text-[#A0AEC0]" />
            <p className="font-semibold text-[#192A20]">Belum Ada Log Siklus Air</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAF9] text-[#52796F] font-semibold text-[10px] uppercase">
                  <th className="py-2 px-2.5">Waktu</th>
                  <th className="py-2 px-2.5">Unit</th>
                  <th className="py-2 px-2.5">Pemicu</th>
                  <th className="py-2 px-2.5 text-right">Kekeruhan Awal / Akhir</th>
                  <th className="py-2 px-2.5 text-right">Air Terpakai</th>
                  <th className="py-2 px-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {displayedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F8FAF9] transition-colors">
                    <td className="py-2 px-2.5 font-mono text-[11px] text-[#192A20]">
                      <div>{log.startedAt.split('T')[1].slice(0, 8)} WIB</div>
                      <div className="text-[9px] text-[#718096]">{log.startedAt.split('T')[0]}</div>
                    </td>
                    <td className="py-2 px-2.5 font-mono font-bold text-[#192A20]">
                      {log.deviceId}
                    </td>
                    <td className="py-2 px-2.5 text-[#52796F]">
                      {log.triggerReason === 'turbidity_high'
                        ? 'Kekeruhan Baki (>100 NTU)'
                        : log.triggerReason === 'scheduled_interval'
                        ? 'Jadwal Rutin Subuh'
                        : 'Manual Operator'}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[11px]">
                      <span className="text-[#DC2626]">{log.initialTurbidityNtu} NTU</span>
                      <span className="text-[#718096]"> &rarr; </span>
                      <span className="text-[#2D6A4F] font-bold">{log.finalTurbidityNtu} NTU</span>
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-[#192A20]">
                      {log.waterUsedLiters.toFixed(1)} L
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                          log.status === 'SUCCESS'
                            ? 'bg-[#EAF4EE] text-[#2D6A4F]'
                            : 'bg-[#FEE2E2] text-[#DC2626]'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
