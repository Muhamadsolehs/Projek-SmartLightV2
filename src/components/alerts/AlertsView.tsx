import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Send,
  Sliders,
  Check,
  Clock,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { DeviceAlert } from '../../types';

export const AlertsView: React.FC = () => {
  const {
    alerts,
    acknowledgeAlert,
    telegramConfig,
    updateTelegramConfig,
    testTelegramNotification,
  } = useDevice();

  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter === 'all') return true;
    return a.severity === severityFilter;
  });

  const unackCount = alerts.filter((a) => !a.isAcknowledged).length;

  const handleTestSend = async () => {
    setIsTestingTelegram(true);
    await testTelegramNotification();
    setIsTestingTelegram(false);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#52796F]">
        <span className="text-[#718096]">Smart Light Trap</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" />
        <span className="font-semibold text-[#192A20]">Pusat Notifikasi</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A20]">
            Pusat Peringatan & Notifikasi
          </h1>
          <p className="text-xs sm:text-sm text-[#52796F] mt-1 max-w-2xl">
            Notifikasi kritis ambang batas hama PHT, anomali daya baterai LiFePO4, keselamatan hidraulik, dan integrasi bot Telegram.
          </p>
        </div>

        {/* Severity Filter Controls */}
        <div className="flex items-center gap-1 p-1 bg-[#F1F5F2] rounded-lg text-xs font-medium">
          <button
            onClick={() => setSeverityFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              severityFilter === 'all'
                ? 'bg-white text-[#192A20] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Semua ({alerts.length})
          </button>
          <button
            onClick={() => setSeverityFilter('critical')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              severityFilter === 'critical'
                ? 'bg-white text-[#DC2626] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Kritis ({alerts.filter((a) => a.severity === 'critical').length})
          </button>
          <button
            onClick={() => setSeverityFilter('warning')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              severityFilter === 'warning'
                ? 'bg-white text-[#D97706] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Peringatan ({alerts.filter((a) => a.severity === 'warning').length})
          </button>
        </div>
      </div>

      {/* Telegram Notification Webhook Card */}
      <div className="rounded-xl border border-[#D1DCD6] bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EBF8FF] text-[#2B6CB0]">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#192A20]">
                Integrasi Notifikasi Bot Telegram Poktan & Agronomis
              </h2>
              <p className="text-xs text-[#718096]">
                Peringatan kritis diteruskan secara real-time ke saluran Telegram tim lapangan
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#192A20]">
            <input
              type="checkbox"
              checked={telegramConfig.enabled}
              onChange={(e) => updateTelegramConfig({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-[#CBD5E1] text-[#2D6A4F] focus:ring-[#2D6A4F]"
            />
            <span>Aktifkan Bot Telegram</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[#718096] mb-1">
              Telegram Bot Token:
            </label>
            <input
              type="text"
              value={telegramConfig.botToken}
              onChange={(e) => updateTelegramConfig({ botToken: e.target.value })}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-2 font-mono text-xs text-[#192A20]"
              placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#718096] mb-1">
              Chat ID / Target Grup Telegram:
            </label>
            <input
              type="text"
              value={telegramConfig.chatId}
              onChange={(e) => updateTelegramConfig({ chatId: e.target.value })}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-2 font-mono text-xs text-[#192A20]"
              placeholder="-100123456789"
            />
          </div>

          <div className="flex items-end">
            <button
              disabled={isTestingTelegram || !telegramConfig.enabled}
              onClick={handleTestSend}
              className="w-full py-2 px-3 bg-[#2B6CB0] text-white rounded-lg font-semibold hover:bg-[#2C5282] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isTestingTelegram ? 'Mengirim...' : 'Kirim Uji Coba Telegram'}</span>
            </button>
          </div>
        </div>

        {telegramConfig.lastTestMessage && (
          <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            telegramConfig.lastTestStatus === 'success'
              ? 'bg-[#EAF4EE] text-[#1B4332] border border-[#A7D7C5]'
              : 'bg-[#F8FAF9] text-[#718096] border border-[#E2E8F0]'
          }`}>
            <CheckCircle2 className="h-4 w-4 text-[#2D6A4F] shrink-0" />
            <span>{telegramConfig.lastTestMessage}</span>
          </div>
        )}
      </div>

      {/* Alerts Feed */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#192A20]">
              Daftar Riwayat Notifikasi Sistem
            </h2>
            {unackCount > 0 && (
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#DC2626]">
                {unackCount} Menunggu Konfirmasi
              </span>
            )}
          </div>
          <span className="text-xs text-[#718096]">
            Menampilkan {filteredAlerts.length} peringatan
          </span>
        </div>

        <div className="divide-y divide-[#E2E8F0]">
          {filteredAlerts.map((alert) => {
            const isCrit = alert.severity === 'critical';
            const isWarn = alert.severity === 'warning';

            return (
              <div key={alert.id} className="py-4 space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        isCrit ? 'bg-[#DC2626]' : isWarn ? 'bg-[#D97706]' : 'bg-[#2B6CB0]'
                      }`}
                    />
                    <span className="font-bold text-[#192A20] text-sm">{alert.title}</span>
                    <span className="font-mono text-[11px] text-[#718096]">· {alert.deviceName}</span>
                  </div>

                  <div className="flex items-center gap-2 pl-4 sm:pl-0">
                    <span className="font-mono text-[11px] text-[#718096] flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {alert.timestamp.split('T')[1].slice(0, 8)} WIB
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isCrit
                          ? 'bg-[#FEE2E2] text-[#DC2626]'
                          : isWarn
                          ? 'bg-[#FEF3C7] text-[#D97706]'
                          : 'bg-[#EBF8FF] text-[#2B6CB0]'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                </div>

                <p className="text-[#4A5568] pl-4 leading-relaxed">
                  {alert.message}
                </p>

                <div className="pl-4 pt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="text-[11px] text-[#718096]">
                    Lokasi: <span className="font-semibold text-[#192A20]">{alert.location}</span>
                  </div>

                  {alert.isAcknowledged ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-[#2D6A4F] font-semibold">
                      <Check className="h-3.5 w-3.5" />
                      <span>Dikonfirmasi oleh {alert.acknowledgedBy || 'Operator'}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => acknowledgeAlert(alert.id, 'Pak Rahmat (Agronomis)')}
                      className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 bg-[#1B4332] text-white rounded text-xs font-semibold hover:bg-[#2D6A4F] transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Konfirmasi Tindakan</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
