import React, { useState } from 'react';
import { Menu, Bell, ChevronRight, User, LogOut, Shield, ChevronDown, Globe } from 'lucide-react';
import { useDevice, NavigationTab } from '../../context/DeviceContext';
import { getRoleMetadata } from '../../lib/permissions';

const TAB_TITLES: Record<NavigationTab, string> = {
  overview: 'Ringkasan Lahan',
  devices: 'Perangkat',
  controls: 'Kontrol Manual & Aktuator',
  pests: 'Analisis Hama PHT',
  gallery: 'Galeri Foto & CV',
  energy: 'Daya & Baterai',
  water: 'Siklus & Air Baki',
  alerts: 'Pusat Notifikasi',
  settings: 'Pengaturan & OTA',
  architecture: 'Arsitektur & API',
  users: 'Pengguna & Role',
};

export const Header: React.FC<{
  onToggleMobile: () => void;
}> = ({ onToggleMobile }) => {
  const {
    activeTab,
    setActiveTab,
    setAppMode,
    alerts,
    devices,
    currentUser,
    isAuthenticated,
    logout,
    setIsLoginModalOpen,
    isLiveConnected,
    dataSource,
  } = useDevice();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const unacknowledgedAlerts = alerts.filter((a) => !a.isAcknowledged).length;
  const onlineCount = devices.filter((d) => d.status === 'online').length;

  return (
    <header className="sticky top-0 z-40 flex h-14 sm:h-16 w-full items-center justify-between border-b border-[#90A955]/30 bg-white/95 px-4 backdrop-blur-md sm:px-6 text-[#132A13] shadow-xs">
      {/* Sisi Kiri: Hamburger Menu Mobile + Breadcrumb Desktop */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobile}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#31572C] hover:bg-[#ECF39E]/30 transition-colors lg:hidden shrink-0 cursor-pointer"
          aria-label="Buka navigasi menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb Desktop */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-[#4F772D] truncate">
          <span className="font-medium text-[#90A955]">Smart Light Trap</span>
          <ChevronRight className="h-3.5 w-3.5 text-[#90A955]/60 shrink-0" />
          <span className="font-semibold text-[#132A13] truncate">
            {TAB_TITLES[activeTab]}
          </span>
        </nav>

        {/* Judul Mobile Ringkas */}
        <div className="sm:hidden font-bold text-sm text-[#132A13] truncate">
          {TAB_TITLES[activeTab]}
        </div>
      </div>

      {/* Sisi Kanan: Status Unit Online, Notifikasi & Profil / Autentikasi */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Indikator Status Database Supabase */}
        <div
          className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
            dataSource === 'simulation_demo'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : isLiveConnected
              ? 'bg-[#EAF4EE] border-[#4F772D]/30 text-[#132A13]'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              dataSource === 'simulation_demo'
                ? 'bg-amber-500'
                : isLiveConnected
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          <span>
            {dataSource === 'simulation_demo'
              ? 'Mode Simulasi (Mock)'
              : isLiveConnected
              ? 'Supabase Terhubung'
              : 'Koneksi Terputus'}
          </span>
        </div>

        {/* Indikator Status Armada Ringkas */}
        <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ECF39E]/40 border border-[#90A955]/40 text-[#132A13] text-xs font-medium">
          <span className="h-2 w-2 rounded-full bg-[#4F772D] shrink-0" />
          <span className="tabular-nums font-bold">{onlineCount}/{devices.length}</span>
          <span className="text-[#31572C]">Unit Aktif</span>
        </div>

        {/* Tombol Notifikasi */}
        <button
          onClick={() => setActiveTab('alerts')}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#31572C] hover:bg-[#ECF39E]/30 transition-colors cursor-pointer"
          aria-label="Lihat notifikasi"
          title="Pusat Peringatan & Notifikasi"
        >
          <Bell className="h-4.5 w-4.5" />
          {unacknowledgedAlerts > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#DC2626] px-1 text-[10px] font-bold text-white tabular-nums leading-none">
              {unacknowledgedAlerts}
            </span>
          )}
        </button>

        {/* Profil Pengguna Operator & Logout */}
        {currentUser && (
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-[#90A955]/30 cursor-pointer group"
            >
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#31572C] to-[#4F772D] text-[#ECF39E] flex items-center justify-center text-xs font-bold shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                {currentUser.avatarInitials}
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-xs font-bold text-[#132A13] block leading-tight">
                  {currentUser.name}
                </span>
                <span className="text-[10px] font-semibold text-[#4F772D] block leading-none mt-0.5">
                  {getRoleMetadata(currentUser.role).label}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-[#90A955] hidden sm:block" />
            </button>

            {/* Profile Dropdown Popup */}
            {isProfileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProfileMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white border border-[#90A955]/40 shadow-xl p-3 z-50 text-xs">
                  <div className="pb-2.5 mb-2 border-b border-[#90A955]/20">
                    <div className="font-bold text-[#132A13]">{currentUser.name}</div>
                    <div className="text-[11px] text-[#4F772D]">{currentUser.email}</div>
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border bg-[#ECF39E]/40 text-[#132A13] border-[#90A955]/40">
                      <Shield className="h-3 w-3 text-[#31572C]" />
                      <span>{getRoleMetadata(currentUser.role).label}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setAppMode('landing');
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#F6F9F5] text-[#31572C] flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Globe className="h-3.5 w-3.5 text-[#4F772D]" />
                      <span>Halaman Utama (Landing Page)</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsLoginModalOpen(true);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#F6F9F5] text-[#31572C] flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>Ganti Akun Operator</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 text-red-700 flex items-center gap-2 font-semibold cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Keluar (Logout)</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
