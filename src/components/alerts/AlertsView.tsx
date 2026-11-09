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
  Lock,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { DeviceAlert } from '../../types';
import { hasPermission } from '../../lib/permissions';

export const AlertsView: React.FC = () => {
  const {
    alerts,
    acknowledgeAlert,
    telegramConfig,
    updateTelegramConfig,
    testTelegramNotification,
    currentUser,
  } = useDevice();

  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  const canAcknowledge = hasPermission(currentUser?.role, 'action:acknowledge_alert');
  const canManageSettings = hasPermission(currentUser?.role, 'manage:system_settings');

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#192A20]">
            Pusat Peringatan &amp; Notifikasi
          </h1>
        </div>

        {/* Severity Filter Controls */}
        <div className="flex items-center gap-0.5 p-0.5 bg-[#F1F5F2] rounded-lg text-xs font-medium">
          <button
            onClick={() => setSeverityFilter('all')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs ${
              severityFilter === 'all'
                ? 'bg-white text-[#192A20] shadow-2xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Semua ({alerts.length})
          </button>
          <button
            onClick={() => setSeverityFilter('critical')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs ${
              severityFilter === 'critical'
                ? 'bg-white text-[#DC2626] shadow-2xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Kritis ({alerts.filter((a) => a.severity === 'critical').length})
          </button>
          <button
            onClick={() => setSeverityFilter('warning')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs ${
              severityFilter === 'warning'
                ? 'bg-white text-[#D97706] shadow-2xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Peringatan ({alerts.filter((a) => a.severity === 'warning').length})
          </button>
        </div>
      </div>

      {/* Telegram Notification Webhook Card */}
      <div className="rounded-xl border border-[#D1DCD6] bg-white p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EBF8FF] text-[#2B6CB0]">
              <Send className="h-3.5 w-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#192A20]">
                Integrasi Bot Telegram (@Lighrice_bot)
              </h2>
            </div>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-[#192A20]">
            <input
              type="checkbox"
              checked={telegramConfig.enabled}
              onChange={(e) => updateTelegramConfig({ enabled: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-[#CBD5E1] text-[#2D6A4F] focus:ring-[#2D6A4F]"
            />
            <span>Aktifkan Bot Telegram</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-[#718096] mb-0.5">
              Bot Token:
            </label>
            <input
              type="text"
              value={telegramConfig.botToken}
              onChange={(e) => updateTelegramConfig({ botToken: e.target.value })}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-1.5 font-mono text-xs text-[#192A20]"
              placeholder="123456:ABC-DEF1234ghIkl..."
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[#718096] mb-0.5">
              Chat ID / Target Grup:
            </label>
            <input
              type="text"
              value={telegramConfig.chatId}
              onChange={(e) => updateTelegramConfig({ chatId: e.target.value })}
              className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-1.5 font-mono text-xs text-[#192A20]"
              placeholder="1523500422"
            />
          </div>

          <div className="flex items-end">
            <button
              disabled={isTestingTelegram || !telegramConfig.enabled}
              onClick={handleTestSend}
              className="w-full py-1.5 px-3 bg-[#2B6CB0] text-white rounded-lg font-semibold hover:bg-[#2C5282] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Send className="h-3 w-3" />
              <span>{isTestingTelegram ? 'Mengirim...' : 'Kirim Uji Coba'}</span>
            </button>
          </div>
        </div>

        {telegramConfig.lastTestMessage && (
          <div className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
            telegramConfig.lastTestStatus === 'success'
              ? 'bg-[#EAF4EE] text-[#1B4332] border border-[#A7D7C5]'
              : 'bg-[#F8FAF9] text-[#718096] border border-[#E2E8F0]'
          }`}>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#2D6A4F] shrink-0" />
            <span className="text-[11px]">{telegramConfig.lastTestMessage}</span>
          </div>
        )}
      </div>

      {/* Alerts Feed */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-[#192A20]">
              Daftar Riwayat Notifikasi
            </h2>
            {unackCount > 0 && (
              <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#FEE2E2] text-[#DC2626]">
                {unackCount} Menunggu Konfirmasi
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#718096]">
            {filteredAlerts.length} peringatan
          </span>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#718096] bg-[#F8FAF9] rounded-lg border border-dashed border-[#E2E8F0]">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-[#2D6A4F]" />
            <p className="font-semibold text-[#192A20]">Semua Sistem Normal</p>
            <p className="text-[11px] text-[#52796F] mt-0.5">
              Tidak ada peringatan aktif saat ini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0] max-h-72 overflow-y-auto">
            {filteredAlerts.map((alert) => {
              const isCrit = alert.severity === 'critical';
              const isWarn = alert.severity === 'warning';

              return (
                <div key={alert.id} className="py-2.5 space-y-1 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isCrit ? 'bg-[#DC2626]' : isWarn ? 'bg-[#D97706]' : 'bg-[#2B6CB0]'
                        }`}
                      />
                      <span className="font-bold text-[#192A20] text-xs">{alert.title}</span>
                      <span className="font-mono text-[10px] text-[#718096]">· {alert.deviceName}</span>
                    </div>

                    <div className="flex items-center gap-2 pl-4 sm:pl-0">
                      <span className="font-mono text-[10px] text-[#718096] flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {alert.timestamp.split('T')[1].slice(0, 8)} WIB
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
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

                  <p className="text-[#4A5568] pl-4 text-[11px] leading-normal">
                    {alert.message}
                  </p>

                  <div className="pl-4 pt-0.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                    <div className="text-[10px] text-[#718096]">
                      Lokasi: <span className="font-semibold text-[#192A20]">{alert.location}</span>
                    </div>

                    {alert.isAcknowledged ? (
                      <div className="flex items-center gap-1 text-[10px] text-[#2D6A4F] font-semibold">
                        <Check className="h-3 w-3" />
                        <span>Dikonfirmasi oleh {alert.acknowledgedBy || 'Operator'}</span>
                      </div>
                    ) : canAcknowledge ? (
                      <button
                        onClick={() => acknowledgeAlert(alert.id, currentUser?.name || 'Operator Lapangan')}
                        className="self-start sm:self-auto inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#1B4332] text-white rounded text-xs font-semibold hover:bg-[#2D6A4F] transition-colors cursor-pointer"
                      >
                        <Check className="h-3 w-3" />
                        <span>Konfirmasi</span>
                      </button>
                    ) : (
                      <span className="self-start sm:self-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                        <Lock className="h-2.5 w-2.5 text-[#D97706]" />
                        <span>Menunggu Operator</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
