import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  Bug,
  Camera,
  BatteryCharging,
  Droplets,
  Bell,
  Settings,
  Code2,
  X,
  Zap,
  LogOut,
} from 'lucide-react';
import { useDevice, NavigationTab } from '../../context/DeviceContext';
import { SystemLogo } from '../common/SystemLogo';

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
}

export const Sidebar: React.FC<{ isMobileOpen?: boolean; onCloseMobile?: () => void }> = ({
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const {
    activeTab,
    setActiveTab,
    alerts,
    devices,
    setAppMode,
    currentUser,
    isAuthenticated,
    logout,
    setIsLoginModalOpen,
  } = useDevice();

  const unacknowledgedAlerts = alerts.filter((a) => !a.isAcknowledged).length;

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Ringkasan Lahan', icon: LayoutDashboard },
    { id: 'devices', label: 'Monitoring Perangkat', icon: Cpu, badgeCount: devices.length },
    { id: 'pests', label: 'Analisis Hama PHT', icon: Bug },
    { id: 'gallery', label: 'Galeri Foto & CV', icon: Camera },
    { id: 'energy', label: 'Daya & Baterai', icon: BatteryCharging },
    { id: 'water', label: 'Siklus & Air Baki', icon: Droplets },
    { id: 'alerts', label: 'Pusat Notifikasi', icon: Bell, badgeCount: unacknowledgedAlerts },
    { id: 'settings', label: 'Pengaturan & OTA', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Permanently Fixed Sidebar (Tidak ikut tergulir/scroll bersama konten utama) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col justify-between border-r border-[#90A955]/30 bg-white transition-transform duration-200 ease-in-out text-[#132A13] shadow-xs ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header & Navigation Section */}
        <div className="flex flex-col min-h-0">
          {/* Brand Area with Official System Logo */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#90A955]/25 px-4 bg-gradient-to-r from-white to-[#F6F9F5]">
            <SystemLogo size="sm" showText={true} theme="light" />

            {/* Mobile Close Button */}
            {isMobileOpen && (
              <button
                onClick={onCloseMobile}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#31572C] hover:bg-[#ECF39E]/30 lg:hidden cursor-pointer"
                aria-label="Tutup menu"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Main Navigation Items */}
          <nav className="px-3 py-1 space-y-0.5 overflow-y-auto lg:overflow-visible">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    onCloseMobile?.();
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#ECF39E]/50 to-[#ECF39E]/30 text-[#132A13] border-l-4 border-[#31572C] shadow-xs'
                      : 'text-[#31572C] hover:bg-[#F0F5ED] hover:text-[#132A13]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive ? 'text-[#31572C]' : 'text-[#90A955]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span
                      className={`tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                        item.id === 'alerts'
                          ? 'bg-[#DC2626] text-white'
                          : 'bg-[#90A955]/20 text-[#31572C]'
                      }`}
                    >
                      {item.badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Account & Logout Footer */}
        <div className="p-3 border-t border-[#90A955]/30 bg-[#F6F9F5] shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-[#31572C] text-[#ECF39E] font-bold text-xs flex items-center justify-center shrink-0">
                {currentUser?.avatarInitials || 'OP'}
              </div>
              <div className="truncate">
                <span className="font-bold text-xs text-[#132A13] block truncate leading-tight">
                  {currentUser?.name || 'Operator Lapangan'}
                </span>
                <span className="text-[10px] text-[#4F772D] block truncate leading-none mt-0.5">
                  {currentUser?.role || 'Agronomis Lapangan'}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-[#4F772D] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
              title="Keluar (Logout)"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 pt-2 border-t border-[#90A955]/15 flex items-center justify-between text-[10px] text-[#90A955]">
            <span>IoT PHT Subang</span>
            <span className="font-mono text-[#4F772D] font-semibold">v2.3.1</span>
          </div>
        </div>
      </aside>
    </>
  );
};
