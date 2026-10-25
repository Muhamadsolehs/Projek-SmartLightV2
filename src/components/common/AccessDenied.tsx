import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, ChevronRight } from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { getRoleMetadata } from '../../lib/permissions';

interface AccessDeniedProps {
  requiredPermissionDescription?: string;
  onGoToOverview?: () => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  requiredPermissionDescription = 'Tindakan atau halaman ini dibatasi oleh kebijakan Role-Based Access Control (RBAC).',
  onGoToOverview,
}) => {
  const { currentUser, setActiveTab } = useDevice();
  const roleMeta = getRoleMetadata(currentUser?.role);

  const handleBack = () => {
    if (onGoToOverview) {
      onGoToOverview();
    } else {
      setActiveTab('overview');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#52796F]">
        <span className="text-[#718096]">Smart Light Trap</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" />
        <span className="font-semibold text-red-700">Akses Ditolak</span>
      </nav>

      <div className="max-w-2xl mx-auto py-12 px-6">
        <div className="rounded-2xl border-2 border-red-200 bg-white p-8 sm:p-10 text-center shadow-lg space-y-6">
          {/* Icon Badge */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 border border-red-200 text-red-600 shadow-inner">
            <Lock className="h-8 w-8" />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold uppercase tracking-wider">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>403 - Akses Ditolak (RBAC)</span>
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-[#132A13]">
              Anda Tidak Memiliki Wewenang Mengakses Halaman Ini
            </h2>
            <p className="text-xs sm:text-sm text-[#4A5568] max-w-lg mx-auto leading-relaxed">
              {requiredPermissionDescription}
            </p>
          </div>

          {/* User Role Card */}
          <div className="p-4 rounded-xl bg-[#F6F9F5] border border-[#90A955]/30 text-left text-xs max-w-md mx-auto space-y-2">
            <div className="text-[11px] font-semibold text-[#718096] uppercase tracking-wider">
              Identitas & Hak Akses Anda Saat Ini:
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-sm text-[#132A13] block">
                  {currentUser?.name || 'Pengguna Tidak Terdaftar'}
                </span>
                <span className="text-[11px] text-[#4F772D]">
                  {currentUser?.email || 'anon@smarttrap.id'}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${roleMeta.badgeBg} ${roleMeta.badgeText} ${roleMeta.badgeBorder}`}>
                {roleMeta.label}
              </span>
            </div>
            <div className="pt-2 border-t border-[#90A955]/20 text-[11px] text-[#718096]">
              {roleMeta.description}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#31572C] text-white text-xs font-bold hover:bg-[#132A13] shadow-md transition-all cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Ringkasan Lahan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
