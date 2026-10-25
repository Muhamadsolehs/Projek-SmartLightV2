/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DeviceProvider, useDevice } from './context/DeviceContext';
import { LandingPageView } from './components/landing/LandingPageView';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { OverviewView } from './components/overview/OverviewView';
import { DeviceListView } from './components/devices/DeviceListView';
import { PestAnalyticsView } from './components/pests/PestAnalyticsView';
import { PhotoGalleryView } from './components/gallery/PhotoGalleryView';
import { EnergyMonitoringView } from './components/energy/EnergyMonitoringView';
import { WaterManagementView } from './components/water/WaterManagementView';
import { AlertsView } from './components/alerts/AlertsView';
import { DeviceSettingsView } from './components/settings/DeviceSettingsView';
import { ArchitectureApiView } from './components/architecture/ArchitectureApiView';
import { UserManagementView } from './components/users/UserManagementView';
import { HardwareSimulatorModal } from './components/simulator/HardwareSimulatorModal';
import { LoginModal } from './components/auth/LoginModal';
import { SupabaseHealthModal } from './components/common/SupabaseHealthModal';
import { AccessDenied } from './components/common/AccessDenied';
import { canAccessTab, hasPermission } from './lib/permissions';
import { Sliders, Database } from 'lucide-react';

const AppContent: React.FC = () => {
  const { activeTab, appMode, isAuthenticated, currentUser } = useDevice();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  // ROUTE PROTECTION:
  // Jika pengguna belum login (!isAuthenticated) ATAU sedang dalam mode landing,
  // blokir akses ke dashboard dan tampilkan Landing Page dengan LoginModal.
  // Akses ke dashboard data operasional hanya diizinkan setelah berhasil login.
  if (!isAuthenticated || appMode === 'landing') {
    return (
      <>
        <LandingPageView />
        <LoginModal />

        {/* Development & Diagnostics Buttons on Landing Page */}
        <div className="fixed bottom-4 left-4 z-30">
          <button
            onClick={() => setIsHealthModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#4F772D]/40 bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#132A13] shadow-md hover:bg-[#ECF39E]/30 transition-all cursor-pointer backdrop-blur-xs"
            title="Diagnostik Koneksi Supabase & Uji RLS"
          >
            <Database className="h-3.5 w-3.5 text-[#31572C]" />
            <span className="hidden sm:inline">Status Supabase</span>
            <span className="sm:hidden">DB</span>
          </button>
        </div>

        <SupabaseHealthModal
          isOpen={isHealthModalOpen}
          onClose={() => setIsHealthModalOpen(false)}
        />
      </>
    );
  }

  // Cek apakah role pengguna memiliki izin membuka activeTab yang diminta
  const isAllowedTab = canAccessTab(currentUser?.role, activeTab);

  // Dashboard Mode with Fixed Sidebar & Independent Main Content Scrolling
  return (
    <div className="min-h-screen bg-[#F6F9F5] text-[#132A13]">
      {/* Permanently Fixed Sidebar Navigation */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area: Offset by lg:pl-64 to accommodate fixed sidebar */}
      <div className="flex flex-col min-h-screen lg:pl-64 transition-all duration-200">
        {/* Minimalist Top Header */}
        <Header
          onToggleMobile={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Dynamic Main Viewport (Responsive, protected by RBAC) */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {!isAllowedTab ? (
            <AccessDenied />
          ) : (
            <>
              {activeTab === 'overview' && <OverviewView />}
              {activeTab === 'devices' && <DeviceListView />}
              {activeTab === 'pests' && <PestAnalyticsView />}
              {activeTab === 'gallery' && <PhotoGalleryView />}
              {activeTab === 'energy' && <EnergyMonitoringView />}
              {activeTab === 'water' && <WaterManagementView />}
              {activeTab === 'alerts' && <AlertsView />}
              {activeTab === 'settings' && <DeviceSettingsView onOpenSimulator={() => setIsSimulatorOpen(true)} />}
              {activeTab === 'architecture' && <ArchitectureApiView onOpenSimulator={() => setIsSimulatorOpen(true)} />}
              {activeTab === 'users' && <UserManagementView />}
            </>
          )}
        </main>
      </div>

      {/* Floating Diagnostics Button (Bottom Left) */}
      <div className="fixed bottom-4 left-4 z-30 lg:left-68">
        <button
          onClick={() => setIsHealthModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#4F772D]/40 bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#132A13] shadow-md hover:bg-[#ECF39E]/30 transition-all cursor-pointer backdrop-blur-xs"
          title="Diagnostik Koneksi Supabase & Uji RLS"
        >
          <Database className="h-3.5 w-3.5 text-[#31572C]" />
          <span className="hidden sm:inline">Status Supabase</span>
          <span className="sm:hidden">DB</span>
        </button>
      </div>

      {/* Discreet Development / Testing Floating Button (Bottom Right) - Only for Operator & Admin */}
      {hasPermission(currentUser?.role, 'manage:system_settings') && (
        <div className="fixed bottom-4 right-4 z-30">
          <button
            onClick={() => setIsSimulatorOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#4F772D]/40 bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#132A13] shadow-md hover:bg-[#ECF39E]/30 transition-all cursor-pointer backdrop-blur-xs"
            title="Buka Simulator Hardware ESP32-S3 Lapangan (Mode Pengujian)"
          >
            <Sliders className="h-3.5 w-3.5 text-[#31572C]" />
            <span className="hidden sm:inline">Uji Hardware</span>
            <span className="sm:hidden">Sim</span>
          </button>
        </div>
      )}

      {/* Interactive Hardware & ESP32-S3 Simulator Modal */}
      {hasPermission(currentUser?.role, 'manage:system_settings') && (
        <HardwareSimulatorModal
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
        />
      )}

      {/* Supabase Health & Diagnostics Modal */}
      <SupabaseHealthModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
      />

      {/* Authentication Login Modal */}
      <LoginModal />
    </div>
  );
};

export default function App() {
  return (
    <DeviceProvider>
      <AppContent />
    </DeviceProvider>
  );
}
