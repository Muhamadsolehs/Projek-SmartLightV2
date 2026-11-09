import React, { useState } from 'react';
import {
  Search,
  RotateCw,
  Plus,
  Edit2,
  Trash2,
  Key,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Cpu,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { SmartLightTrapDevice } from '../../types';
import { DeviceDetailModal } from './DeviceDetailModal';
import { DeviceFormModal } from './DeviceFormModal';
import { hasPermission } from '../../lib/permissions';

export const DeviceListView: React.FC = () => {
  const {
    devices,
    setSelectedDeviceId,
    devicesLoading,
    devicesError,
    dataSource,
    refreshData,
    setIsLoginModalOpen,
    deleteDevice,
    currentUser,
  } = useDevice();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'warning' | 'offline'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [activeModalDevice, setActiveModalDevice] = useState<SmartLightTrapDevice | null>(null);

  // Form Modal state (Tambah / Edit Perangkat)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [deviceToEdit, setDeviceToEdit] = useState<SmartLightTrapDevice | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const canManageDevices = hasPermission(currentUser?.role, 'manage:devices');

  const handleDeleteDevice = async (device: SmartLightTrapDevice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManageDevices) return;

    const confirmDelete = window.confirm(
      `Hapus unit '${device.code} - ${device.name}' secara permanen dari Supabase?`
    );
    if (!confirmDelete) return;

    try {
      await deleteDevice(device.id);
      setActionNotice(`Perangkat ${device.code} berhasil dihapus.`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      alert(`Gagal menghapus perangkat: ${err?.message}`);
    }
  };

  const handleOpenEdit = (device: SmartLightTrapDevice, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeviceToEdit(device);
    setIsFormModalOpen(true);
  };

  // Status counts
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
    <div className="space-y-4">
      {/* 1. Header Ringkas & Aksi Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#192A20]">
            Armada Perangkat
          </h1>
          <span className="text-xs font-mono text-[#718096] bg-[#F1F5F2] px-2 py-0.5 rounded-full">
            {filteredDevices.length}/{devices.length} unit
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canManageDevices && (
            <button
              onClick={() => {
                setDeviceToEdit(null);
                setIsFormModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#31572C] text-white text-xs font-semibold hover:bg-[#4F772D] transition-all cursor-pointer shadow-xs"
              title="Daftarkan Unit Baru"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Unit</span>
            </button>
          )}

          <button
            onClick={() => refreshData()}
            disabled={devicesLoading}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-[#192A20] hover:bg-[#F8FAF9] transition-all cursor-pointer shadow-xs"
            title="Segarkan data dari Supabase"
          >
            <RotateCw className={`h-3.5 w-3.5 text-[#31572C] ${devicesLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div className="p-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Error Alert */}
      {devicesError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{devicesError}</span>
          </div>
          <button
            onClick={() => refreshData()}
            className="px-2.5 py-1 rounded bg-red-600 text-white text-[11px] font-semibold hover:bg-red-700 shrink-0"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* 2. Unified Search & Status Filter Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-white p-2 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#A0AEC0]" />
          <input
            type="text"
            placeholder="Cari ID (SLT-...), lokasi, atau komoditas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAF9] py-1.5 pl-8 pr-3 text-xs text-[#192A20] placeholder-[#A0AEC0] focus:border-[#2D6A4F] focus:bg-white focus:outline-hidden"
          />
        </div>

        {/* Filter Badges Strip */}
        <div className="flex items-center gap-1 p-0.5 bg-[#F1F5F2] rounded-md text-xs font-medium overflow-x-auto shrink-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-white text-[#192A20] shadow-xs font-bold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Semua ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('online')}
            className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-colors flex items-center gap-1 ${
              statusFilter === 'online'
                ? 'bg-white text-[#2D6A4F] shadow-xs font-bold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#2D6A4F]" />
            Online ({onlineCount})
          </button>
          <button
            onClick={() => setStatusFilter('warning')}
            className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-colors flex items-center gap-1 ${
              statusFilter === 'warning'
                ? 'bg-white text-[#D97706] shadow-xs font-bold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
            Peringatan ({warningCount})
          </button>
          <button
            onClick={() => setStatusFilter('offline')}
            className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-colors flex items-center gap-1 ${
              statusFilter === 'offline'
                ? 'bg-white text-[#DC2626] shadow-xs font-bold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
            Offline ({offlineCount})
          </button>
        </div>
      </div>

      {/* 3. Loading State */}
      {devicesLoading && (
        <div className="p-8 text-center bg-white rounded-lg border border-[#E2E8F0] shadow-xs flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-6 w-6 text-[#31572C] animate-spin" />
          <div className="text-xs font-semibold text-[#192A20]">Menyinkronkan Data Armada...</div>
        </div>
      )}

      {/* 4. Empty State */}
      {!devicesLoading && devices.length === 0 && (
        <div className="p-8 text-center bg-white rounded-lg border-2 border-dashed border-[#CBD5E1] shadow-xs flex flex-col items-center justify-center gap-2">
          <Cpu className="h-8 w-8 text-[#A0AEC0]" />
          <h3 className="text-sm font-bold text-[#192A20]">Belum Ada Perangkat Terdaftar</h3>
          <p className="text-xs text-[#52796F] max-w-sm">
            Tabel <code className="font-mono bg-[#F6F9F5] px-1 py-0.5 rounded text-[#31572C]">public.devices</code> kosong.
          </p>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => refreshData()}
              className="px-3 py-1.5 rounded-md bg-[#31572C] text-white text-xs font-semibold hover:bg-[#4F772D] flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCw className="h-3 w-3" />
              <span>Segarkan</span>
            </button>
            {dataSource !== 'simulation_demo' && (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-3 py-1.5 rounded-md border border-[#CBD5E1] bg-white text-xs font-medium hover:bg-slate-50 cursor-pointer"
              >
                Gunakan Simulasi
              </button>
            )}
          </div>
        </div>
      )}

      {/* 5. Desktop Compact Table */}
      {!devicesLoading && devices.length > 0 && (
        <>
          <div className="hidden lg:block rounded-lg border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAF9] text-[#718096] font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Perangkat</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Lampu</th>
                  <th className="py-2.5 px-3">Baterai</th>
                  <th className="py-2.5 px-3">Air Baki</th>
                  <th className="py-2.5 px-3">Operasi</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredDevices.map((device) => {
                  const tel = device.currentTelemetry;
                  const isOnline = device.status === 'online';
                  const hasWarning = device.status === 'warning';
                  const isBatteryLow = tel.battery.busVoltageV < device.batteryCutoffThresholdV + 0.2;

                  return (
                    <tr
                      key={device.id}
                      className="hover:bg-[#F8FAF9] transition-colors cursor-pointer"
                      onClick={() => handleOpenDetail(device)}
                    >
                      {/* Kolom 1: Perangkat */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-xs text-[#192A20] flex items-center gap-1.5">
                          <span className="font-mono text-[#2D6A4F]">{device.code}</span>
                          <span>·</span>
                          <span>{device.name}</span>
                        </div>
                        <div className="text-[11px] text-[#718096] truncate max-w-[200px]">
                          {device.locationName.split(' ')[0]} ({device.cropType})
                        </div>
                      </td>

                      {/* Kolom 2: Status Koneksi */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isOnline
                              ? 'bg-[#EAF4EE] text-[#2D6A4F]'
                              : hasWarning
                              ? 'bg-[#FEF3C7] text-[#D97706]'
                              : 'bg-[#FEE2E2] text-[#DC2626]'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isOnline ? 'bg-[#2D6A4F]' : hasWarning ? 'bg-[#D97706]' : 'bg-[#DC2626]'
                            }`}
                          />
                          <span>{isOnline ? 'Online' : hasWarning ? 'Peringatan' : 'Offline'}</span>
                        </span>
                      </td>

                      {/* Kolom 3: Lampu */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 font-medium text-[11px] text-[#192A20]">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              tel.lamp.isActive ? 'bg-[#D97706]' : 'bg-[#CBD5E1]'
                            }`}
                          />
                          <span>{tel.lamp.isActive ? 'Menyala' : 'Mati'}</span>
                        </div>
                        <div className="text-[10px] text-[#718096]">
                          {tel.lamp.scheduleStart}–{tel.lamp.scheduleEnd}
                        </div>
                      </td>

                      {/* Kolom 4: Baterai */}
                      <td className="py-2.5 px-3">
                        <div className="font-mono tabular-nums font-bold text-xs text-[#192A20]">
                          {tel.battery.busVoltageV.toFixed(1)}V
                        </div>
                        <div className={`text-[10px] ${isBatteryLow ? 'text-[#DC2626] font-semibold' : 'text-[#718096]'}`}>
                          {isBatteryLow ? 'Rendah' : `${tel.battery.currentMa > 0 ? '+' : ''}${tel.battery.currentMa}mA`}
                        </div>
                      </td>

                      {/* Kolom 5: Air Baki */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-xs text-[#192A20]">
                          Baki <span className="font-mono font-bold">{tel.water.trayLevelPercent}%</span>
                        </div>
                        <div className="text-[10px] text-[#718096]">
                          Tandon {tel.water.tankLevelPercent}% ({tel.water.turbidityNtu} NTU)
                        </div>
                      </td>

                      {/* Kolom 6: Operasi */}
                      <td className="py-2.5 px-3">
                        <span className="text-[11px] font-medium text-[#31572C]">
                          {isOnline ? 'PHT Aktif' : hasWarning ? 'Perlu Tinjauan' : 'Cadangan SD'}
                        </span>
                      </td>

                      {/* Kolom 7: Aksi */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(device);
                            }}
                            className="p-1 rounded hover:bg-[#EAF4EE] text-[#1B4332] transition-colors cursor-pointer"
                            title="Detail"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>

                          {canManageDevices && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDetail(device);
                                }}
                                className="p-1 rounded text-[#2D6A4F] hover:bg-[#EAF4EE] transition-colors cursor-pointer"
                                title="Kredensial & Token"
                              >
                                <Key className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleOpenEdit(device, e)}
                                className="p-1 rounded text-[#31572C] hover:bg-[#ECF39E]/30 transition-colors cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteDevice(device, e)}
                                className="p-1 rounded text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 6. Mobile Compact Cards */}
          <div className="lg:hidden space-y-2">
            {filteredDevices.map((device) => {
              const tel = device.currentTelemetry;
              const isOnline = device.status === 'online';
              const hasWarning = device.status === 'warning';

              return (
                <div
                  key={device.id}
                  onClick={() => handleOpenDetail(device)}
                  className="rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-xs space-y-2 cursor-pointer hover:border-[#2D6A4F] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-[#192A20]">
                        <span className="font-mono text-[#2D6A4F]">{device.code}</span> · {device.name}
                      </div>
                      <div className="text-[11px] text-[#718096]">
                        {device.locationName.split(' ')[0]} ({device.cropType})
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isOnline
                          ? 'bg-[#EAF4EE] text-[#2D6A4F]'
                          : hasWarning
                          ? 'bg-[#FEF3C7] text-[#D97706]'
                          : 'bg-[#FEE2E2] text-[#DC2626]'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isOnline ? 'bg-[#2D6A4F]' : hasWarning ? 'bg-[#D97706]' : 'bg-[#DC2626]'
                        }`}
                      />
                      <span>{isOnline ? 'Online' : hasWarning ? 'Peringatan' : 'Offline'}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-[11px] pt-1 border-t border-[#F1F5F2]">
                    <div>
                      <span className="text-[10px] text-[#718096] block">Baterai</span>
                      <span className="font-mono font-bold text-[#192A20]">{tel.battery.busVoltageV.toFixed(1)}V</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#718096] block">Lampu</span>
                      <span className="font-medium text-[#192A20]">{tel.lamp.isActive ? 'ON' : 'OFF'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#718096] block">Baki / Tandon</span>
                      <span className="font-mono text-[#192A20]">{tel.water.trayLevelPercent}% / {tel.water.tankLevelPercent}%</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredDevices.length === 0 && (
              <div className="p-6 text-center bg-white rounded-lg border border-[#E2E8F0] text-xs text-[#718096]">
                Tidak ada unit yang sesuai pencarian.
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <DeviceDetailModal
        device={activeModalDevice}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <DeviceFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setDeviceToEdit(null);
        }}
        deviceToEdit={deviceToEdit}
      />
    </div>
  );
};
