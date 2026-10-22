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
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { WaterChangeLog } from '../../types';

export const WaterManagementView: React.FC = () => {
  const {
    selectedDevice,
    devices,
    setSelectedDeviceId,
    waterLogs,
    sendCommand,
    triggerHardwareSimulation,
    isSimulatingAction,
  } = useDevice();

  const [isCycling, setIsCycling] = useState(false);
  const [cycleStatus, setCycleStatus] = useState<string | null>(null);

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
      setCycleStatus(`Berhasil: ${res.responseMessage || 'Pergantian air selesai.'}`);
    } catch {
      setCycleStatus('Gagal menghubungkan ke mikrokontroler.');
    } finally {
      setIsCycling(false);
    }
  };

  const deviceLogs = waterLogs.filter((l) => l.deviceId === selectedDevice.id);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#52796F]">
        <span className="text-[#718096]">Smart Light Trap</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" />
        <span className="font-semibold text-[#192A20]">Siklus & Air Baki</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A20]">
            Monitoring Air & Siklus Baki
          </h1>
          <p className="text-xs sm:text-sm text-[#52796F] mt-1 max-w-2xl">
            Sensor level baki, sensor kekeruhan optik, katup solenoid 12V, dan pompa submersibel tandon cadangan.
          </p>
        </div>

        {/* Device Picker */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#718096]">Unit:</span>
          <select
            value={selectedDevice.id}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 font-mono text-xs font-bold text-[#192A20] focus:border-[#2D6A4F] focus:outline-hidden"
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tray Visual Card */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F] flex items-center gap-1.5">
              <Droplets className="h-4 w-4 text-[#2B6CB0]" />
              <span>Baki Penangkap Serangga</span>
            </h2>
            <span className="font-mono text-xs font-bold text-[#192A20]">
              {w.trayLevelPercent}%
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Visual Tray Cylinder */}
            <div className="relative h-36 w-20 rounded-lg border-2 border-[#CBD5E1] bg-[#F1F5F2] overflow-hidden flex flex-col justify-end p-1">
              <div
                className={`w-full rounded transition-all duration-700 ${
                  w.isTurbid ? 'bg-[#92400E]/70' : 'bg-[#38BDF8]/80'
                }`}
                style={{ height: `${w.trayLevelPercent}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="font-mono text-xs font-bold text-white drop-shadow-xs">
                  {w.trayLevelCm} cm
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-2 text-xs">
              <div>
                <span className="text-[#718096] block text-[11px]">Kekeruhan Air (Turbidity):</span>
                <span className={`font-mono text-base font-bold ${w.isTurbid ? 'text-[#DC2626]' : 'text-[#2D6A4F]'}`}>
                  {w.turbidityNtu} NTU
                </span>
                <p className="text-[10px] text-[#718096]">
                  {w.isTurbid ? 'Bangkai serangga menumpuk (>100 NTU)' : 'Kondisi air optimal (<50 NTU)'}
                </p>
              </div>

              <div>
                <span className="text-[#718096] block text-[11px]">Katup Buang (Solenoid 12V):</span>
                <span className="font-mono text-xs font-bold text-[#192A20] uppercase">
                  {w.drainValveStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tank Visual Card */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F] flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-[#2D6A4F]" />
              <span>Tandon Air Cadangan (50L)</span>
            </h2>
            <span className={`font-mono text-xs font-bold ${w.tankLevelPercent < 20 ? 'text-[#DC2626]' : 'text-[#192A20]'}`}>
              {w.tankLevelPercent}%
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Visual Tank Tank */}
            <div className="relative h-36 w-20 rounded-lg border-2 border-[#CBD5E1] bg-[#F1F5F2] overflow-hidden flex flex-col justify-end p-1">
              <div
                className={`w-full rounded transition-all duration-700 ${
                  w.tankLevelPercent < 20 ? 'bg-[#EF4444]' : 'bg-[#0EA5E9]'
                }`}
                style={{ height: `${w.tankLevelPercent}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="font-mono text-xs font-bold text-white drop-shadow-xs">
                  {w.tankVolumeLiters} L
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-2 text-xs">
              <div>
                <span className="text-[#718096] block text-[11px]">Sensor Level:</span>
                <span className="font-mono font-bold text-[#192A20]">
                  Ultrasonik JSN-SR04T (Waterproof)
                </span>
              </div>

              <div>
                <span className="text-[#718096] block text-[11px]">Status Pompa Pengisi:</span>
                <span className={`font-mono text-xs font-bold uppercase ${
                  w.fillPumpStatus === 'dry_run_lockout' ? 'text-[#DC2626]' : 'text-[#192A20]'
                }`}>
                  {w.fillPumpStatus.replace('_', ' ')}
                </span>
              </div>

              {w.safetyLockout && (
                <div className="p-1.5 bg-[#FEE2E2] rounded text-[10px] text-[#DC2626] font-semibold">
                  Dry-Run Lockout Aktif!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hydraulic Safety & Execution Card */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F] flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#2D6A4F]" />
                <span>Interlock & Aksi Kuras</span>
              </h2>
            </div>
            <p className="text-xs text-[#718096] leading-relaxed">
              Siklus pengurasan otomatis membuka katup buang 25s, lalu memompa 5L air segar dari tandon hingga baki mencapai 85%.
            </p>
            <div className="mt-3 text-[11px] text-[#52796F]">
              Waktu pergantian terakhir:{' '}
              <span className="font-mono font-semibold text-[#192A20]">
                {w.lastWaterChange ? w.lastWaterChange.split('T')[0] : 'Belum pernah'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              disabled={isCycling || isSimulatingAction || w.safetyLockout}
              onClick={handleStartCycle}
              className="w-full py-2.5 px-3 bg-[#2D6A4F] text-white rounded-lg text-xs font-semibold hover:bg-[#1B4332] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <RotateCcw className={`h-4 w-4 ${isCycling ? 'animate-spin' : ''}`} />
              <span>Jalankan Kuras & Isi Baki Sekarang</span>
            </button>

            {cycleStatus && (
              <div className="p-2.5 rounded-lg bg-[#F8FAF9] border border-[#E2E8F0] text-[11px] text-[#192A20]">
                {cycleStatus}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hydraulic Safety Protocol Rules */}
      <div className="rounded-xl border border-[#D1DCD6] bg-[#F8FAF9] p-5 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#192A20] mb-3">
          Aturan Keselamatan Hidraulik (Safety Interlock Matrix)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
            <div className="flex items-center gap-2 font-semibold text-[#192A20] mb-1">
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
              <span>1. Dry-Run Protection</span>
            </div>
            <p className="text-[11px] text-[#718096]">
              Jika tandon air di bawah 15% (7.5 Liter), relay pompa submersibel diputus secara mekanis dan firmware mengirim peringatan ke cloud.
            </p>
          </div>

          <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
            <div className="flex items-center gap-2 font-semibold text-[#192A20] mb-1">
              <span className="h-2 w-2 rounded-full bg-[#D97706]" />
              <span>2. Overflow Lockout</span>
            </div>
            <p className="text-[11px] text-[#718096]">
              Jika sensor baki membaca &ge; 95% atau waktu pengisian melebihi 45 detik, katup pengisian dimatikan darurat untuk mencegah tumpah ke rangkaian lampu.
            </p>
          </div>

          <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
            <div className="flex items-center gap-2 font-semibold text-[#192A20] mb-1">
              <span className="h-2 w-2 rounded-full bg-[#2D6A4F]" />
              <span>3. Logika Kekeruhan (NTU)</span>
            </div>
            <p className="text-[11px] text-[#718096]">
              Sensor optik membaca serapan cahaya. Bila kekeruhan &gt; 100 NTU selama 30 menit, jadwal siklus kuras dimajukan ke pukul 05:30 WIB.
            </p>
          </div>
        </div>
      </div>

      {/* Water Change Activity Logs Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <h2 className="text-sm font-bold text-[#192A20]">
            Riwayat Log Pergantian Air & Kekeruhan
          </h2>
          <span className="text-xs text-[#718096]">
            Total {waterLogs.length} Aktivitas Tercatat
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAF9] text-[#52796F] font-semibold text-[11px] uppercase">
                <th className="py-2.5 px-3">Waktu Mulai - Selesai</th>
                <th className="py-2.5 px-3">Unit</th>
                <th className="py-2.5 px-3">Pemicu</th>
                <th className="py-2.5 px-3 text-right">Kekeruhan Awal / Akhir</th>
                <th className="py-2.5 px-3 text-right">Air Terpakai</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {waterLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F8FAF9] transition-colors">
                  <td className="py-3 px-3 font-mono text-[11px] text-[#192A20]">
                    <div>{log.startedAt.split('T')[1].slice(0, 8)} WIB</div>
                    <div className="text-[10px] text-[#718096]">{log.startedAt.split('T')[0]}</div>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-[#192A20]">
                    {log.deviceId}
                  </td>
                  <td className="py-3 px-3 text-[#52796F]">
                    {log.triggerReason === 'turbidity_high'
                      ? 'Kekeruhan Baki Tinggi (>100 NTU)'
                      : log.triggerReason === 'scheduled_interval'
                      ? 'Jadwal Rutin Subuh'
                      : 'Manual Operator'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    <span className="text-[#DC2626]">{log.initialTurbidityNtu} NTU</span>
                    <span className="text-[#718096]"> &rarr; </span>
                    <span className="text-[#2D6A4F] font-bold">{log.finalTurbidityNtu} NTU</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-[#192A20]">
                    {log.waterUsedLiters.toFixed(1)} Liter
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
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
      </div>
    </div>
  );
};
