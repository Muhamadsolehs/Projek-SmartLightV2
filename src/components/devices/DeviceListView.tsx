import React, { useState } from 'react';
import {
  Search,
  Wifi,
  WifiOff,
  Battery,
  Droplets,
  Lightbulb,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { SmartLightTrapDevice } from '../../types';
import { DeviceDetailModal } from './DeviceDetailModal';

export const DeviceListView: React.FC = () => {
  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
  } = useDevice();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'warning' | 'offline'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [activeModalDevice, setActiveModalDevice] = useState<SmartLightTrapDevice | null>(null);

  // Status counts for quick KPI strip
  const totalCount = devices.length;
  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const warningCount = devices.filter((d) => d.status === 'warning').length;
  const offlineCount = devices.filter((d) => d.status === 'offline').length;

  // Filter devices
  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.locationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.cropType.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ? true : device.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleOpenDetail = (device: SmartLightTrapDevice) => {
    setSelectedDeviceId(device.id);
    setActiveModalDevice(device);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Breadcrumb Ramping */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#52796F]">
        <span className="text-[#718096]">Smart Light Trap</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" />
        <span className="font-semibold text-[#192A20]">Monitoring Perangkat</span>
      </nav>

      {/* 2. Judul Halaman dan Deskripsi Singkat */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A20]">
            Monitoring Perangkat
          </h1>
          <p className="text-xs sm:text-sm text-[#52796F] mt-1 max-w-2xl">
            Pemantauan status operasional armada perangkap serangga pintar, sensor energi INA226, baki air, dan transmisi 4G di lahan sawah.
          </p>
        </div>
        <span className="text-xs text-[#718096] self-start sm:self-auto mt-1 sm:mt-0">
          Menampilkan <span className="font-semibold text-[#192A20]">{filteredDevices.length}</span> dari {devices.length} unit
        </span>
      </div>

      {/* 3. Ringkasan Status Perangkat (KPI Status Strip) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total */}
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            statusFilter === 'all'
              ? 'border-[#2D6A4F] bg-[#EAF4EE] shadow-xs'
              : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
          }`}
        >
          <div className="text-xs font-medium text-[#718096]">Total Armada</div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#192A20] mt-1">
            {totalCount} <span className="text-xs font-normal text-[#718096]">unit</span>
          </div>
        </button>

        {/* Online */}
        <button
          onClick={() => setStatusFilter('online')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            statusFilter === 'online'
              ? 'border-[#2D6A4F] bg-[#EAF4EE] shadow-xs'
              : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#2D6A4F]">
            <span className="h-2 w-2 rounded-full bg-[#2D6A4F]" />
            <span>Online</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#2D6A4F] mt-1">
            {onlineCount} <span className="text-xs font-normal text-[#718096]">unit</span>
          </div>
        </button>

        {/* Peringatan */}
        <button
          onClick={() => setStatusFilter('warning')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            statusFilter === 'warning'
              ? 'border-[#D97706] bg-[#FEF3C7] shadow-xs'
              : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#D97706]">
            <span className="h-2 w-2 rounded-full bg-[#D97706]" />
            <span>Peringatan</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#D97706] mt-1">
            {warningCount} <span className="text-xs font-normal text-[#718096]">unit</span>
          </div>
        </button>

        {/* Offline */}
        <button
          onClick={() => setStatusFilter('offline')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            statusFilter === 'offline'
              ? 'border-[#DC2626] bg-[#FEE2E2] shadow-xs'
              : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-[#DC2626]">
            <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
            <span>Offline</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-[#DC2626] mt-1">
            {offlineCount} <span className="text-xs font-normal text-[#718096]">unit</span>
          </div>
        </button>
      </div>

      {/* 4. Kolom Pencarian dan Filter Status */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3.5 sm:p-4 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#A0AEC0]" />
          <input
            type="text"
            placeholder="Cari ID perangkat (SLT-...), lokasi, atau varietas padi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] py-2 pl-9 pr-4 text-xs text-[#192A20] placeholder-[#A0AEC0] focus:border-[#2D6A4F] focus:bg-white focus:outline-hidden"
          />
        </div>

        {/* Status Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-[#F1F5F2] rounded-lg text-xs font-medium overflow-x-auto shrink-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-white text-[#192A20] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Semua ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('online')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
              statusFilter === 'online'
                ? 'bg-white text-[#2D6A4F] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Online ({onlineCount})
          </button>
          <button
            onClick={() => setStatusFilter('warning')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
              statusFilter === 'warning'
                ? 'bg-white text-[#D97706] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Peringatan ({warningCount})
          </button>
          <button
            onClick={() => setStatusFilter('offline')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
              statusFilter === 'offline'
                ? 'bg-white text-[#DC2626] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Offline ({offlineCount})
          </button>
        </div>
      </div>

      {/* 5A. TAMPILAN DESKTOP: TABEL RAMPING 7 KOLOM (hidden on mobile / lg:block) */}
      <div className="hidden lg:block rounded-xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#90A955]/30 bg-[#F6F9F5] text-[#31572C] font-semibold text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4">Perangkat & Lokasi</th>
              <th className="py-3 px-4">Koneksi</th>
              <th className="py-3 px-4">Lampu</th>
              <th className="py-3 px-4">Baterai</th>
              <th className="py-3 px-4">Air</th>
              <th className="py-3 px-4">Status Operasi</th>
              <th className="py-3 px-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {filteredDevices.map((device) => {
              const tel = device.currentTelemetry;
              const isOnline = device.status === 'online';
              const hasWarning = device.status === 'warning';
              const isBatteryLow = tel.battery.busVoltageV < device.batteryCutoffThresholdV + 0.2;
              const isTurbid = tel.water.isTurbid;
              const isDryRun = tel.water.safetyLockout;

              return (
                <tr
                  key={device.id}
                  className="hover:bg-[#F8FAF9] transition-colors cursor-pointer"
                  onClick={() => handleOpenDetail(device)}
                >
                  {/* Kolom 1: Perangkat & Lokasi */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-sm text-[#192A20]">
                      {device.name}
                    </div>
                    <div className="text-xs text-[#718096] flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-medium text-[#2D6A4F]">{device.code}</span>
                      <span>·</span>
                      <span className="truncate max-w-[220px]">{device.locationName}</span>
                    </div>
                    <div className="text-[11px] text-[#A0AEC0]">{device.cropType}</div>
                  </td>

                  {/* Kolom 2: Koneksi */}
                  <td className="py-3.5 px-4">
                    <div className="inline-flex items-center gap-1.5 font-medium">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isOnline
                            ? 'bg-[#2D6A4F]'
                            : hasWarning
                            ? 'bg-[#D97706]'
                            : 'bg-[#DC2626]'
                        }`}
                      />
                      <span
                        className={`font-semibold ${
                          isOnline
                            ? 'text-[#2D6A4F]'
                            : hasWarning
                            ? 'text-[#D97706]'
                            : 'text-[#DC2626]'
                        }`}
                      >
                        {isOnline ? 'Online' : hasWarning ? 'Peringatan' : 'Offline'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-[#718096] mt-0.5">
                      {tel.connectivity.networkType} · {tel.connectivity.rssiDbm} dBm
                    </div>
                  </td>

                  {/* Kolom 3: Lampu */}
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-[#192A20] flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          tel.lamp.isActive ? 'bg-[#D97706]' : 'bg-[#CBD5E1]'
                        }`}
                      />
                      <span>{tel.lamp.isActive ? 'Menyala' : 'Mati'}</span>
                    </div>
                    <div className="text-[11px] text-[#718096] mt-0.5">
                      {tel.lamp.scheduleStart}–{tel.lamp.scheduleEnd} WIB
                    </div>
                  </td>

                  {/* Kolom 4: Baterai */}
                  <td className="py-3.5 px-4">
                    <div className="font-mono tabular-nums font-bold text-sm text-[#192A20]">
                      {tel.battery.busVoltageV.toFixed(2)} V
                    </div>
                    {isBatteryLow ? (
                      <div className="text-[11px] text-[#DC2626] font-semibold mt-0.5">
                        Baterai Rendah
                      </div>
                    ) : (
                      <div className="text-[11px] font-mono text-[#718096] mt-0.5">
                        {tel.battery.currentMa > 0 ? `+${tel.battery.currentMa}` : tel.battery.currentMa} mA
                      </div>
                    )}
                  </td>

                  {/* Kolom 5: Air */}
                  <td className="py-3.5 px-4">
                    <div className="text-xs text-[#192A20] font-medium">
                      Baki: <span className="font-mono font-bold">{tel.water.trayLevelPercent}%</span>
                      <span className="text-[#718096] text-[11px]"> ({tel.water.turbidityNtu} NTU)</span>
                    </div>
                    <div className="text-[11px] text-[#718096] mt-0.5">
                      Tandon: <span className="font-mono font-semibold">{tel.water.tankLevelPercent}%</span> ({tel.water.tankVolumeLiters}/50 L)
                    </div>
                    {isDryRun && (
                      <span className="inline-block mt-0.5 text-[10px] font-bold text-[#DC2626]">
                        Dry-run lock aktif
                      </span>
                    )}
                  </td>

                  {/* Kolom 6: Status Operasi (Tanpa Field Waktu) */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#ECF39E]/40 border border-[#90A955]/30 text-[#132A13]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4F772D]" />
                      <span>{isOnline ? 'PHT Aktif' : hasWarning ? 'Perlu Tinjauan' : 'Cadangan SD'}</span>
                    </span>
                  </td>

                  {/* Kolom 7: Aksi */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(device);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#D1DCD6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1B4332] hover:bg-[#EAF4EE] transition-colors"
                    >
                      <span>Lihat Detail</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 5B. TAMPILAN MOBILE & TABLET: KARTU VERTIKAL RESPONSIVE (lg:hidden) */}
      <div className="lg:hidden space-y-3.5">
        {filteredDevices.map((device) => {
          const tel = device.currentTelemetry;
          const isOnline = device.status === 'online';
          const hasWarning = device.status === 'warning';
          const isBatteryLow = tel.battery.busVoltageV < device.batteryCutoffThresholdV + 0.2;
          const isTurbid = tel.water.isTurbid;
          const isDryRun = tel.water.safetyLockout;

          return (
            <div
              key={device.id}
              className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs space-y-3"
            >
              {/* Baris 1: Nama Perangkat dan Status Koneksi */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-[#192A20] leading-snug">
                    {device.name}
                  </h3>
                  <div className="text-xs text-[#718096] flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="font-mono font-bold text-[#2D6A4F]">{device.code}</span>
                    <span>·</span>
                    <span>{device.locationName}</span>
                  </div>
                </div>

                {/* Badge Status Koneksi */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                    isOnline
                      ? 'bg-[#EAF4EE] text-[#2D6A4F]'
                      : hasWarning
                      ? 'bg-[#FEF3C7] text-[#D97706]'
                      : 'bg-[#FEE2E2] text-[#DC2626]'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      isOnline ? 'bg-[#2D6A4F]' : hasWarning ? 'bg-[#D97706]' : 'bg-[#DC2626]'
                    }`}
                  />
                  <span>{isOnline ? 'Online' : hasWarning ? 'Peringatan' : 'Offline'}</span>
                </span>
              </div>

              {/* Varietas Tanaman */}
              <div className="text-[11px] text-[#52796F]">
                Komoditas: <span className="font-medium text-[#192A20]">{device.cropType}</span>
              </div>

              {/* Bagian Tengah: Grid 2 Kolom untuk Baterai, Lampu, Baki, dan Tandon */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                {/* Box 1: Baterai */}
                <div className="p-2.5 rounded-lg bg-[#F8FAF9] border border-[#E2E8F0] space-y-0.5">
                  <div className="text-[11px] font-medium text-[#718096]">Baterai</div>
                  <div className="font-mono font-bold text-sm text-[#192A20]">
                    {tel.battery.busVoltageV.toFixed(2)} V
                  </div>
                  <div className="text-[10px] font-mono text-[#52796F]">
                    Arus {tel.battery.currentMa > 0 ? `+${tel.battery.currentMa}` : tel.battery.currentMa} mA
                  </div>
                </div>

                {/* Box 2: Lampu */}
                <div className="p-2.5 rounded-lg bg-[#F8FAF9] border border-[#E2E8F0] space-y-0.5">
                  <div className="text-[11px] font-medium text-[#718096]">Lampu UV (365nm)</div>
                  <div className="font-semibold text-sm text-[#192A20]">
                    {tel.lamp.isActive ? 'Menyala' : 'Mati'}
                  </div>
                  <div className="text-[10px] text-[#718096]">
                    {tel.lamp.scheduleStart}–{tel.lamp.scheduleEnd} WIB
                  </div>
                </div>

                {/* Box 3: Air Baki */}
                <div className="p-2.5 rounded-lg bg-[#F8FAF9] border border-[#E2E8F0] space-y-0.5">
                  <div className="text-[11px] font-medium text-[#718096]">Air Baki</div>
                  <div className="font-mono font-bold text-sm text-[#192A20]">
                    {tel.water.trayLevelPercent}%
                  </div>
                  <div className={`text-[10px] font-medium ${isTurbid ? 'text-[#DC2626]' : 'text-[#2D6A4F]'}`}>
                    {isTurbid ? `Keruh (${tel.water.turbidityNtu} NTU)` : `Bersih (${tel.water.turbidityNtu} NTU)`}
                  </div>
                </div>

                {/* Box 4: Tandon */}
                <div className="p-2.5 rounded-lg bg-[#F8FAF9] border border-[#E2E8F0] space-y-0.5">
                  <div className="text-[11px] font-medium text-[#718096]">Tandon Cadangan</div>
                  <div className="font-mono font-bold text-sm text-[#192A20]">
                    {tel.water.tankLevelPercent}%
                  </div>
                  <div className="text-[10px] text-[#718096]">
                    {tel.water.tankVolumeLiters}/50 Liter
                  </div>
                </div>
              </div>

              {/* Baris Peringatan Aktif jika Ada */}
              {(isDryRun || isBatteryLow || hasWarning || !isOnline) && (
                <div className="p-2.5 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-xs text-[#92400E] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[#D97706]" />
                  <span className="font-medium text-[11px]">
                    {isDryRun
                      ? 'Peringatan: Dry-run lock aktif (air tandon kritis).'
                      : isBatteryLow
                      ? 'Peringatan: Tegangan baterai mendekati batas cut-off 11.8V.'
                      : !isOnline
                      ? 'Perangkat offline: Data disimpan sementara di MicroSD.'
                      : 'Perhatian: Tangkapan hama atau kondisi sensor memerlukan evaluasi.'}
                  </span>
                </div>
              )}

              {/* Bagian Bawah: Status Kesiapan PHT (Tanpa Field Waktu) */}
              <div className="pt-2 border-t border-[#90A955]/20 flex items-center justify-between text-xs">
                <span className="text-[#31572C] font-medium">Status Pengendalian:</span>
                <span className="font-semibold text-[#132A13] bg-[#ECF39E]/40 px-2.5 py-0.5 rounded-full border border-[#90A955]/30">
                  {isOnline ? 'PHT Aktif & Terjadwal' : 'Mode Siaga'}
                </span>
              </div>

              <button
                onClick={() => handleOpenDetail(device)}
                className="w-full min-h-[44px] py-2.5 px-4 bg-[#1B4332] text-white rounded-lg text-xs font-semibold hover:bg-[#2D6A4F] transition-colors flex items-center justify-center gap-2"
              >
                <span>Lihat Detail Perangkat</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          );
        })}

        {filteredDevices.length === 0 && (
          <div className="p-8 text-center bg-white rounded-xl border border-[#E2E8F0] text-xs text-[#718096]">
            Tidak ada perangkat yang sesuai dengan kata kunci pencarian atau filter status.
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <DeviceDetailModal
        device={activeModalDevice}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};
