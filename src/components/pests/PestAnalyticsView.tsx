import React, { useState } from 'react';
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
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import {
  MOCK_DAILY_TRENDS,
  INSECT_SPECIES_LIST,
  MOCK_CAPTURES,
} from '../../data/mockData';
import { InsectSpeciesId } from '../../types';

export const PestAnalyticsView: React.FC = () => {
  const { devices, setActiveTab } = useDevice();
  const [selectedRange, setSelectedRange] = useState<'7d' | '14d'>('14d');
  const [selectedSpeciesFilter, setSelectedSpeciesFilter] = useState<string>('all');
  const [selectedDeviceFilter, setSelectedDeviceFilter] = useState<string>('all');

  const trendData = selectedRange === '7d' ? MOCK_DAILY_TRENDS.slice(-7) : MOCK_DAILY_TRENDS;
  const maxTotal = Math.max(...trendData.map((d) => d.totalAll));

  const latestDay = trendData[trendData.length - 1];
  const previousDay = trendData[trendData.length - 2];

  const targetDiff = latestDay.totalTarget - previousDay.totalTarget;
  const targetDiffPercent = Math.round((targetDiff / previousDay.totalTarget) * 100);

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
        </div>
      </div>

      {/* KPI Metric Strip */}
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
            <span>+{targetDiffPercent}% vs hari sebelumnya</span>
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
          <div className="mt-1 text-[11px] text-[#DC2626] font-medium">
            Melebihi ambang kendali (50 ekor)
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
          <div className="mt-1 text-[11px] text-[#DC2626] font-medium">
            Waspada hopperburn & kerdil hampa
          </div>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
            <span>Rasio Hama vs Netral</span>
            <Layers className="h-4 w-4 text-[#52796F]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#192A20]">
            {((latestDay.totalTarget / latestDay.totalAll) * 100).toFixed(0)}% : {((latestDay.otherInsects / latestDay.totalAll) * 100).toFixed(0)}%
          </div>
          <div className="mt-1 text-[11px] text-[#718096]">
            Total {latestDay.totalAll} serangga tertangkap
          </div>
        </div>
      </div>

      {/* Main Interactive Trend Chart */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E2E8F0] pb-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#192A20]">
              Dinamika Fluktuasi Populasi Hama per Hari
            </h2>
            <p className="text-xs text-[#718096]">
              Garis horizontal merah menunjukkan Ambang Kendali Ekonomi (Economic Injury Threshold)
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
              const colWidth = 780 / trendData.length;
              const x = 55 + i * colWidth;
              const barW = Math.min(colWidth * 0.65, 34);

              const hStem = (d.stemBorer / 300) * 190;
              const hPlanthopper = (d.planthopper / 300) * 190;
              const hOther = (d.otherInsects / 300) * 190;

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
                    y={yOther - 6}
                    textAnchor="middle"
                    fontSize="9.5"
                    fill="#192A20"
                    fontWeight="bold"
                    className="font-mono tabular-nums"
                  >
                    {d.totalAll}
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
              <span className="px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-[#FEE2E2] text-[#DC2626]">
                STATUS: INTERVENSI DIANJURKAN
              </span>
            </div>
            <p className="text-xs text-[#4A5568] leading-relaxed">
              Tangkapan Penggerek Batang Padi Kuning pada Unit SLT-KRW-02 mencapai <strong>74 ekor/malam</strong> (di atas batas kritis 50 ekor). Tanaman sedang berada di fase vegetatif HST 35-42 (rawan serangan sundep).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                <div className="font-semibold text-[#192A20] mb-1">1. Pengendalian Hayati</div>
                <p className="text-[11px] text-[#718096]">
                  Pelepasan parasitoid telur <em>Trichogramma japonicum</em> sebanyak 20 pias/ha pada area Karawang Blok B3.
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                <div className="font-semibold text-[#192A20] mb-1">2. Optimalisasi Perangkap</div>
                <p className="text-[11px] text-[#718096]">
                  Perpanjang durasi lampu UV hingga pukul 05:00 WIB dan jadwalkan pergantian air baki setiap subuh agar baki tetap bersih.
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                <div className="font-semibold text-[#192A20] mb-1">3. Pemantauan Kelompok Tani</div>
                <p className="text-[11px] text-[#718096]">
                  Kirimkan ringkasan lonjakan hama ke grup Telegram Poktan Harapan Jaya untuk survei lapangan bersama PPL.
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
              Setiap sesi terhubung ke snapshot resolusi tinggi dan bounding box serangga
            </p>
          </div>
          <button
            onClick={() => setActiveTab('gallery')}
            className="text-xs font-semibold text-[#2D6A4F] hover:text-[#1B4332] flex items-center gap-1"
          >
            <span>Buka Galeri Penuh</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="divide-y divide-[#E2E8F0]">
          {MOCK_CAPTURES.map((cap) => (
            <div key={cap.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF4EE] text-[#1B4332] shrink-0">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-bold text-[#192A20] flex items-center gap-2">
                    <span className="font-mono">{cap.id}</span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-medium ${
                      cap.isManuallyVerified
                        ? 'bg-[#EAF4EE] text-[#2D6A4F]'
                        : 'bg-[#FEF3C7] text-[#D97706]'
                    }`}>
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
                  <div className="font-mono font-bold text-[#192A20]">
                    {cap.totalPests} Serangga
                  </div>
                  <div className="text-[10px] text-[#2D6A4F]">
                    {cap.targetPestsCount} Sasaran · {cap.otherInsectsCount} Netral
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('gallery')}
                  className="rounded-lg border border-[#D1DCD6] px-2.5 py-1 text-xs font-semibold text-[#1B4332] hover:bg-[#EAF4EE]"
                >
                  Lihat Foto
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
