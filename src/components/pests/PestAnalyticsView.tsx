import React, { useState, useEffect } from 'react';
import {
  Bug,
  Calendar,
  Filter,
  ArrowUpRight,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Info,
  Camera,
  ChevronRight,
  Download,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { pestService } from '../../services/pestService';
import { DailyPestTrend, InsectSpeciesId } from '../../types';
import { hasPermission } from '../../lib/permissions';
import { INSECT_SPECIES_LIST } from '../../data/mockData';

export const PestAnalyticsView: React.FC = () => {
  const { devices, captures, setActiveTab, currentUser, dataSourceMode } = useDevice();
  const [selectedRange, setSelectedRange] = useState<'7d' | '14d'>('14d');
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState<string>('all');
  const [selectedDeviceFilter, setSelectedDeviceFilter] = useState<string>('all');
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<DailyPestTrend[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(true);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  const canExport = hasPermission(currentUser?.role, 'export:reports');

  const fetchTrends = async () => {
    setIsLoadingTrends(true);
    setTrendsError(null);
    try {
      const days = selectedRange === '7d' ? 7 : 14;
      const deviceId = selectedDeviceFilter === 'all' ? undefined : selectedDeviceFilter;
      const data = await pestService.getDailyPestTrends(deviceId, days);
      setTrendData(data);
    } catch (err: any) {
      setTrendsError(err.message || 'Gagal memuat tren hama dari database');
    } finally {
      setIsLoadingTrends(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [selectedRange, selectedDeviceFilter, dataSourceMode]);

  const handleExportCSV = () => {
    if (!canExport || trendData.length === 0) return;
    const rows = trendData.map((d) => [
      d.date,
      d.dayLabel,
      d.totalTarget,
      d.stemBorer,
      d.planthopper,
      d.armyworm,
      d.otherInsects,
      d.totalAll,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Tanggal,Hari,Hama Sasaran,Penggerek Batang,Wereng Batang Coklat,Ulat Grayak,Serangga Netral,Total']
        .concat(rows.map((r) => r.join(',')))
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `laporan_pht_subang_${selectedRange}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportNotice('Laporan CSV tren hama berhasil diunduh.');
    setTimeout(() => setExportNotice(null), 3000);
  };

  const latestDay = trendData.length > 0 ? trendData[trendData.length - 1] : null;
  const previousDay = trendData.length > 1 ? trendData[trendData.length - 2] : null;

  const targetDiff = latestDay && previousDay ? latestDay.totalTarget - previousDay.totalTarget : 0;
  const targetDiffPercent =
    previousDay && previousDay.totalTarget > 0 ? Math.round((targetDiff / previousDay.totalTarget) * 100) : 0;

  const filteredCaptures =
    selectedDeviceFilter === 'all'
      ? captures
      : captures.filter((c) => c.deviceId === selectedDeviceFilter);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#52796F]">
        <span className="text-[#718096]">Smart Light Trap</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" />
        <span className="font-semibold text-[#192A20]">Analisis Hama PHT</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A20]">
            Analisis Populasi Hama & PHT
          </h1>
          <p className="text-xs sm:text-sm text-[#52796F] mt-1 max-w-2xl">
            Data deteksi nocturnal light trap untuk keputusan Pengendalian Hama Terpadu (PHT) tanaman padi.
          </p>
        </div>

        {/* Range & Filter Segmented Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Perangkat Filter */}
          <select
            value={selectedDeviceFilter}
            onChange={(e) => setSelectedDeviceFilter(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#192A20] focus:border-[#2D6A4F] focus:outline-hidden font-medium"
          >
            <option value="all">Semua Perangkat</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>

          {/* Time range */}
          <div className="flex items-center gap-1 p-1 bg-[#F1F5F2] rounded-lg text-xs font-medium">
            <button
              onClick={() => setSelectedRange('7d')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                selectedRange === '7d'
                  ? 'bg-white text-[#192A20] shadow-xs font-semibold'
                  : 'text-[#52796F] hover:text-[#192A20]'
              }`}
            >
              7 Hari Terakhir
            </button>
            <button
              onClick={() => setSelectedRange('14d')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                selectedRange === '14d'
                  ? 'bg-white text-[#192A20] shadow-xs font-semibold'
                  : 'text-[#52796F] hover:text-[#192A20]'
              }`}
            >
              14 Hari Terakhir
            </button>
          </div>

          <button
            onClick={fetchTrends}
            disabled={isLoadingTrends}
            className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[#52796F] hover:text-[#192A20] hover:bg-[#F8FAF9] disabled:opacity-50"
            title="Muat ulang data tren hama"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingTrends ? 'animate-spin' : ''}`} />
          </button>

          {/* Export Report Action (Guarded by RBAC) */}
          {canExport ? (
            <button
              onClick={handleExportCSV}
              disabled={trendData.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#90A955]/40 bg-white text-xs font-semibold text-[#132A13] hover:bg-[#ECF39E]/20 transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="Ekspor Data Tren PHT ke CSV"
            >
              <Download className="h-3.5 w-3.5 text-[#31572C]" />
              <span>Ekspor CSV</span>
            </button>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs font-medium text-gray-400 cursor-not-allowed"
              title="Ekspor laporan dibatasi untuk Analis, Operator, dan Administrator"
            >
              <Lock className="h-3.5 w-3.5 text-gray-400" />
              <span>Ekspor Dibatasi</span>
            </span>
          )}
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 bg-[#EAF4EE] text-[#1B4332] border border-[#A7D7C5] rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-[#2D6A4F] shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {trendsError && (
        <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{trendsError}</span>
          </div>
          <button
            onClick={fetchTrends}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-900 rounded font-semibold text-[11px]"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoadingTrends && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-xs text-[#52796F]">
          <RefreshCw className="h-6 w-6 mx-auto animate-spin text-[#2D6A4F] mb-2" />
          <p>Memuat analitik data hama dari Supabase...</p>
        </div>
      )}

      {!isLoadingTrends && trendData.length === 0 && !trendsError && (
        <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-12 text-center">
          <Bug className="mx-auto h-12 w-12 text-[#94A3B8]" />
          <h3 className="mt-4 text-base font-bold text-[#192A20]">Belum Ada Data Tren Hama</h3>
          <p className="mt-1 text-xs text-[#52796F] max-w-md mx-auto">
            Tidak ditemukan sesi tangkapan serangga pada rentang waktu yang dipilih.
            {selectedDeviceFilter !== 'all' && ' Coba ganti filter perangkat atau pilih rentang waktu yang lebih luas.'}
          </p>
        </div>
      )}

      {/* KPI Metric Strip */}
      {!isLoadingTrends && latestDay && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
              <span>Tangkapan Hama Sasaran</span>
              <Bug className="h-4 w-4 text-[#D97706]" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#192A20]">
              {latestDay.totalTarget} <span className="text-xs font-normal text-[#718096]">ekor/malam</span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#DC2626]">
              <ArrowUpRight className="h-3 w-3" />
              <span>
                {targetDiff >= 0 ? `+${targetDiffPercent}%` : `${targetDiffPercent}%`} vs hari sebelumnya
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
              <span>Penggerek Batang Kuning</span>
              <span className="font-mono text-[10px] text-[#2D6A4F] font-bold">365nm UV</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#192A20]">
              {latestDay.stemBorer} <span className="text-xs font-normal text-[#718096]">ekor</span>
            </div>
            <div className={`mt-1 text-[11px] font-medium ${latestDay.stemBorer >= 50 ? 'text-[#DC2626]' : 'text-[#2D6A4F]'}`}>
              {latestDay.stemBorer >= 50 ? 'Melebihi ambang kendali (50 ekor)' : 'Di bawah ambang kritis (<50 ekor)'}
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
              <span>Wereng Batang Coklat (WBC)</span>
              <span className="font-mono text-[10px] text-[#2D6A4F] font-bold">395nm</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#192A20]">
              {latestDay.planthopper} <span className="text-xs font-normal text-[#718096]">ekor</span>
            </div>
            <div className="mt-1 text-[11px] text-[#52796F] font-medium">
              {latestDay.planthopper > 20 ? 'Waspada hopperburn & kerdil hampa' : 'Populasi terpantau terkendali'}
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
              <span>Rasio Hama vs Netral</span>
              <Layers className="h-4 w-4 text-[#52796F]" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#192A20]">
              {latestDay.totalAll > 0
                ? `${((latestDay.totalTarget / latestDay.totalAll) * 100).toFixed(0)}% : ${((latestDay.otherInsects / latestDay.totalAll) * 100).toFixed(0)}%`
                : '0% : 0%'}
            </div>
            <div className="mt-1 text-[11px] text-[#718096]">
              Total {latestDay.totalAll} serangga tertangkap
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Trend Chart */}
      {!isLoadingTrends && trendData.length > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E2E8F0] pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#192A20]">
                Dinamika Fluktuasi Populasi Hama per Hari
              </h2>
              <p className="text-xs text-[#718096]">
                Garis horizontal merah menunjukkan Ambang Kendali Ekonomi (Economic Injury Threshold = 50)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedSpeciesFilter}
                onChange={(e) => setSelectedSpeciesFilter(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] px-2.5 py-1 text-xs text-[#192A20] focus:border-[#2D6A4F] focus:outline-hidden"
              >
                <option value="all">Semua Spesies Sasaran</option>
                <option value="scirpophaga_incertulas">Penggerek Batang Saja</option>
                <option value="nilaparvata_lugens">Wereng Batang Coklat Saja</option>
                <option value="spodoptera_frugiperda">Ulat Grayak Saja</option>
              </select>
            </div>
          </div>

          {/* SVG Area Chart / Multi-Bar */}
          <div className="h-72 w-full overflow-x-auto">
            <svg className="w-full min-w-[720px] h-full" viewBox="0 0 850 250">
              {/* Horizontal Axis lines */}
              {[0, 50, 100, 150, 200, 250, 300].map((val) => {
                const y = 210 - (val / 300) * 190;
                return (
                  <g key={val}>
                    <line
                      x1="45"
                      y1={y}
                      x2="830"
                      y2={y}
                      stroke="#EDF2F0"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x="35"
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fill="#A0AEC0"
                      className="font-mono tabular-nums"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Threshold Line: 50 ekor */}
              {(() => {
                const thY = 210 - (50 / 300) * 190;
                return (
                  <g>
                    <line
                      x1="45"
                      y1={thY}
                      x2="830"
                      y2={thY}
                      stroke="#DC2626"
                      strokeWidth="1.5"
                      strokeDasharray="6 3"
                    />
                    <text
                      x="825"
                      y={thY - 5}
                      textAnchor="end"
                      fontSize="10"
                      fill="#DC2626"
                      fontWeight="bold"
                    >
                      Ambang Kendali PHT (50)
                    </text>
                  </g>
                );
              })()}

              {/* Bars for trends */}
              {trendData.map((d, i) => {
                const colWidth = 780 / Math.max(trendData.length, 1);
                const x = 55 + i * colWidth;
                const barW = Math.min(colWidth * 0.65, 34);

                let hStem = (d.stemBorer / 300) * 190;
                let hPlanthopper = (d.planthopper / 300) * 190;
                let hOther = (d.otherInsects / 300) * 190;

                if (selectedSpeciesFilter === 'scirpophaga_incertulas') {
                  hPlanthopper = 0;
                  hOther = 0;
                } else if (selectedSpeciesFilter === 'nilaparvata_lugens') {
                  hStem = 0;
                  hOther = 0;
                } else if (selectedSpeciesFilter === 'spodoptera_frugiperda') {
                  hStem = 0;
                  hPlanthopper = 0;
                  hOther = (d.armyworm / 300) * 190;
                }

                const yStem = 210 - hStem;
                const yPlanthopper = yStem - hPlanthopper;
                const yOther = yPlanthopper - hOther;

                const isAbove = d.stemBorer >= 50;

                return (
                  <g key={d.date} className="cursor-pointer group">
                    <rect
                      x={x}
                      y={yStem}
                      width={barW}
                      height={hStem}
                      fill={isAbove ? '#D97706' : '#E2E8F0'}
                      rx="2"
                    />
                    <rect
                      x={x}
                      y={yPlanthopper}
                      width={barW}
                      height={hPlanthopper}
                      fill="#2D6A4F"
                    />
                    <rect
                      x={x}
                      y={yOther}
                      width={barW}
                      height={hOther}
                      fill="#CBD5E1"
                      rx="2"
                    />

                    {/* Day label */}
                    <text
                      x={x + barW / 2}
                      y="230"
                      textAnchor="middle"
                      fontSize="9.5"
                      fill="#718096"
                      fontWeight={i === trendData.length - 1 ? 'bold' : 'normal'}
                    >
                      {d.dayLabel.split(' ')[0]}
                    </text>

                    {/* Total on top */}
                    <text
                      x={x + barW / 2}
                      y={Math.min(yOther, yPlanthopper, yStem) - 6}
                      textAnchor="middle"
                      fontSize="9.5"
                      fill="#192A20"
                      fontWeight="bold"
                      className="font-mono tabular-nums"
                    >
                      {selectedSpeciesFilter === 'all' ? d.totalAll : selectedSpeciesFilter === 'scirpophaga_incertulas' ? d.stemBorer : selectedSpeciesFilter === 'nilaparvata_lugens' ? d.planthopper : d.armyworm}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between pt-4 border-t border-[#E2E8F0] text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-[#D97706]" />
                <span>Penggerek Batang Padi Kuning</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-[#2D6A4F]" />
                <span>Wereng Batang Coklat (WBC)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-xs bg-[#CBD5E1]" />
                <span>Serangga Netral</span>
              </div>
            </div>
            <span className="text-[11px] text-[#718096]">
              Total Periode: {trendData.reduce((acc, c) => acc + c.totalAll, 0)} Tangkapan
            </span>
          </div>
        </div>
      )}

      {/* PHT Agronomic Decision Matrix */}
      <div className="rounded-xl border border-[#D1DCD6] bg-[#F8FAF9] p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-[#EAF4EE] text-[#1B4332] shrink-0 mt-0.5">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h2 className="text-sm font-bold text-[#192A20]">
                Rekomendasi Tindakan Agronomis Berdasarkan Ambang Kendali PHT
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                  latestDay && latestDay.stemBorer >= 50
                    ? 'bg-[#FEE2E2] text-[#DC2626]'
                    : 'bg-[#EAF4EE] text-[#2D6A4F]'
                }`}
              >
                STATUS: {latestDay && latestDay.stemBorer >= 50 ? 'INTERVENSI DIANJURKAN' : 'STATUS NORMAL / AMAN'}
              </span>
            </div>
            <p className="text-xs text-[#4A5568] leading-relaxed">
              {latestDay && latestDay.stemBorer >= 50
                ? `Tangkapan Penggerek Batang Padi Kuning mencapai ${latestDay.stemBorer} ekor/malam (di atas batas kritis 50 ekor). Tanaman sedang berada di fase vegetatif (rawan serangan sundep/beluk).`
                : 'Tangkapan serangga hama nocturnal saat ini berada di bawah ambang kendali ekonomi. Pertahankan monitoring rutin dan sanitasi baki air perangkap.'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                <div className="font-semibold text-[#192A20] mb-1">1. Pengendalian Hayati</div>
                <p className="text-[11px] text-[#718096]">
                  Pelepasan parasitoid telur <em>Trichogramma japonicum</em> sebanyak 20 pias/ha pada area terdampak.
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                <div className="font-semibold text-[#192A20] mb-1">2. Optimalisasi Perangkap</div>
                <p className="text-[11px] text-[#718096]">
                  Perpanjang durasi lampu UV hingga pukul 05:00 WIB dan jadwalkan pergantian air baki setiap subuh agar baki tetap bersih.
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                <div className="font-semibold text-[#192A20] mb-1">3. Pemantauan Lapangan</div>
                <p className="text-[11px] text-[#718096]">
                  Bagikan ringkasan lonjakan hama ke kelompok tani setempat untuk survei pengamatan malai bersama PPL pertanian.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Capture Session History with source links */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#192A20]">
              Riwayat Sesi Tangkapan Kamera & Computer Vision
            </h2>
            <p className="text-xs text-[#718096]">
              Setiap sesi terhubung ke snapshot resolusi tinggi dan bounding box serangga di Supabase
            </p>
          </div>
          <button
            onClick={() => setActiveTab('gallery')}
            className="text-xs font-semibold text-[#2D6A4F] hover:text-[#1B4332] flex items-center gap-1 cursor-pointer"
          >
            <span>Buka Galeri Penuh</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {filteredCaptures.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#718096] bg-[#F8FAF9] rounded-lg border border-dashed border-[#E2E8F0]">
            <Camera className="h-6 w-6 mx-auto mb-2 text-[#A0AEC0]" />
            <p>Belum ada sesi tangkapan citra kamera baki yang tercatat untuk perangkat yang dipilih.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {filteredCaptures.map((cap) => (
              <div
                key={cap.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF4EE] text-[#1B4332] shrink-0">
                    <Camera className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-[#192A20] flex items-center gap-2">
                      <span className="font-mono">{cap.id}</span>
                      <span
                        className={`px-2 py-0.2 rounded text-[10px] font-medium ${
                          cap.isManuallyVerified
                            ? 'bg-[#EAF4EE] text-[#2D6A4F]'
                            : 'bg-[#FEF3C7] text-[#D97706]'
                        }`}
                      >
                        {cap.isManuallyVerified ? 'Tervalidasi Manusia' : 'Deteksi Otomatis AI'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#718096]">
                      Waktu: {cap.timestamp} · Model: {cap.modelVersion}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pl-12 sm:pl-0">
                  <div className="text-right">
                    <div className="font-mono font-bold text-[#192A20]">{cap.totalPests} Serangga</div>
                    <div className="text-[10px] text-[#2D6A4F]">
                      {cap.targetPestsCount} Sasaran · {cap.otherInsectsCount} Netral
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('gallery')}
                    className="rounded-lg border border-[#D1DCD6] px-2.5 py-1 text-xs font-semibold text-[#1B4332] hover:bg-[#EAF4EE] cursor-pointer"
                  >
                    Lihat Foto
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
