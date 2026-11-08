import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Shield,
  Clock,
  Server,
  Lock,
  Cpu,
  Activity,
  Info,
} from 'lucide-react';
import { healthCheckService, HealthCheckResult } from '../../services/healthCheckService';

export const SupabaseHealthModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [result, setResult] = useState<HealthCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runTest = async () => {
    setIsLoading(true);
    try {
      const res = await healthCheckService.checkConnection();
      setResult(res);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runTest();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="relative w-full max-w-xl rounded-2xl bg-white border border-[#90A955]/30 shadow-2xl overflow-hidden text-[#132A13]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#132A13] via-[#31572C] to-[#4F772D] p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Database className="h-5 w-5 text-[#ECF39E]" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#ECF39E] uppercase tracking-wider block">
                Diagnostik Pengembangan & Infrastruktur
              </span>
              <h3 className="text-base font-bold text-white leading-tight">
                Status Koneksi Supabase & Uji Baca RLS
              </h3>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Main Status Banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
              result?.isConnected
                ? 'bg-[#EAF4EE] border-[#4F772D]/40 text-[#132A13]'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {result?.isConnected ? (
                <div className="h-9 w-9 rounded-lg bg-[#31572C] text-[#ECF39E] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              ) : (
                <div className="h-9 w-9 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">
                    Status Koneksi: {result ? result.status : 'Memeriksa...'}
                  </span>
                  {result?.isConnected && (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>
                <p className="text-xs text-[#52796F] mt-0.5">
                  {result?.isConnected
                    ? `Kueri PostgreSQL berhasil (HTTP ${result.httpStatus}) dengan latensi ${result.latencyMs}ms.`
                    : result?.sanitizedError || 'Koneksi gagal atau belum terkonfigurasi.'}
                </p>
              </div>
            </div>

            <button
              onClick={runTest}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg border border-[#4F772D]/40 bg-white hover:bg-[#F6F9F5] text-xs font-semibold text-[#132A13] flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#31572C] ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Menguji...' : 'Uji Ulang'}</span>
            </button>
          </div>

          {/* Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAF9]">
              <div className="text-[10px] font-semibold text-[#718096] flex items-center gap-1">
                <Clock className="h-3 w-3 text-[#52796F]" />
                <span>Latensi Respon</span>
              </div>
              <div className="text-sm font-bold font-mono text-[#192A20] mt-1">
                {result ? `${result.latencyMs} ms` : '-'}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAF9]">
              <div className="text-[10px] font-semibold text-[#718096] flex items-center gap-1">
                <Server className="h-3 w-3 text-[#52796F]" />
                <span>Status HTTP</span>
              </div>
              <div className="text-sm font-bold font-mono text-[#192A20] mt-1">
                {result?.httpStatus ? `${result.httpStatus} OK` : '-'}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAF9]">
              <div className="text-[10px] font-semibold text-[#718096] flex items-center gap-1">
                <Shield className="h-3 w-3 text-[#52796F]" />
                <span>Peran Sesi</span>
              </div>
              <div className="text-sm font-bold font-mono text-[#192A20] mt-1 capitalize">
                {result?.authStatus || 'anon'}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAF9]">
              <div className="text-[10px] font-semibold text-[#718096] flex items-center gap-1">
                <Cpu className="h-3 w-3 text-[#52796F]" />
                <span>Baris Terbaca</span>
              </div>
              <div className="text-sm font-bold font-mono text-[#192A20] mt-1">
                {result !== null ? `${result.deviceRowsCount} baris` : '-'}
              </div>
            </div>
          </div>

          {/* Row Level Security (RLS) Analysis Section */}
          <div className="p-4 rounded-xl border border-[#D1DCD6] bg-[#F6F9F5] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#132A13]">
              <Lock className="h-4 w-4 text-[#31572C]" />
              <span>Analisis Kebijakan Row Level Security (RLS) PostgreSQL:</span>
            </div>
            <p className="text-xs text-[#52796F] leading-relaxed">
              {result?.rlsAnalysis.explanation}
            </p>
            {result?.rlsAnalysis.isRestrictedByRls && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                <span>
                  <strong>Catatan RLS:</strong> Tabel <code>devices</code> diproteksi oleh kebijakan{' '}
                  <code>devices_select_authenticated</code>. Sesuai instruksi keamanan, RLS{' '}
                  <strong>tidak dinonaktifkan</strong>. Masuklah dengan akun pengguna terdaftar melalui form login untuk membaca seluruh armada Subang secara langsung.
                </span>
              </div>
            )}
          </div>

          {/* System Keep-Alive Database Heartbeat Status */}
          <div className="p-4 rounded-xl border border-[#90A955]/40 bg-[#F8FAF9] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#132A13]">
                <Activity className="h-4 w-4 text-[#31572C]" />
                <span>Heartbeat Otomatis Supabase Keep-Alive (Free Tier)</span>
              </div>
              {result?.systemHeartbeat ? (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  result.systemHeartbeat.isFresh
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {result.systemHeartbeat.status} ({result.systemHeartbeat.isFresh ? 'Aktif Terjadwal' : 'Perlu Perhatian'})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-600 border border-gray-300">
                  Belum Ada Catatan
                </span>
              )}
            </div>

            {result?.systemHeartbeat ? (
              <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-lg border border-[#E2E8F0]">
                <div>
                  <span className="text-[10px] text-[#718096] block">Layanan:</span>
                  <span className="font-mono font-bold text-[#132A13]">{result.systemHeartbeat.serviceName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#718096] block">Detak Terakhir (WIB):</span>
                  <span className="font-mono text-[11px] text-[#132A13]">
                    {new Date(result.systemHeartbeat.lastHeartbeatAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                  </span>
                </div>
                <div className="col-span-2 text-[10px] text-[#718096] pt-1 border-t border-[#F1F5F9]">
                  <span>UTC: {result.systemHeartbeat.lastHeartbeatAt}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#52796F]">
                Record heartbeat <code>system_heartbeat</code> belum ditemukan atau memerlukan otentikasi.
              </p>
            )}

            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                <strong>Pemberitahuan Arsitektur:</strong> Heartbeat database ini semata-mata menandakan keberhasilan operasi I/O Supabase untuk mencegah auto-pause pada tier Free. Indikator ini <strong>tidak</strong> menyatakan atau menjamin bahwa armada perangkat ESP32 di lapangan sedang aktif/online.
              </span>
            </div>
          </div>

          {/* Live Data Evidence Card (Only if data was truly read) */}
          {result?.sampleDevice && (
            <div className="p-4 rounded-xl border border-[#2D6A4F]/30 bg-white shadow-2xs space-y-2">
              <span className="text-[10px] font-bold text-[#4F772D] uppercase tracking-wider block">
                Bukti Data Riil Berhasil Dibaca dari Database:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-[#718096] block">Kode Unit:</span>
                  <span className="font-mono font-bold text-[#132A13]">{result.sampleDevice.deviceCode}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#718096] block">Nama Perangkat:</span>
                  <span className="font-semibold text-[#132A13] truncate block">{result.sampleDevice.deviceName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#718096] block">Status Operasional:</span>
                  <span className="font-bold text-emerald-700 capitalize">{result.sampleDevice.connectionStatus}</span>
                </div>
              </div>
            </div>
          )}

          {/* Error Details (Sanitized) */}
          {result?.sanitizedError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span>Pesan Kesalahan (Tersanitasi):</span>
              </div>
              <div className="font-mono text-[11px] break-all">{result.sanitizedError}</div>
            </div>
          )}

          {/* Timestamp */}
          <div className="text-[10px] text-[#718096] text-right">
            Terakhir diuji: {result ? new Date(result.timestamp).toLocaleTimeString('id-ID') : '-'}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#F6F9F5] border-t border-[#90A955]/20 flex items-center justify-between text-xs">
          <span className="text-[11px] text-[#52796F]">
            Uji baca aman: <code>SELECT ... FROM devices LIMIT 1</code> (Tanpa mutasi data)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#31572C] hover:bg-[#132A13] text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
