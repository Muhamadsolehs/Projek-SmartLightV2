import React, { useState } from 'react';
import { SmartTrap3DScene } from './SmartTrap3DScene';
import { useDevice } from '../../context/DeviceContext';
import {
  Sun,
  ShieldCheck,
  TrendingDown,
  Cpu,
  Layers,
  ArrowRight,
  Droplets,
  Camera,
  Activity,
  FileCheck,
  Zap,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Coins,
  Bug,
  Radio,
  Sliders,
  Play,
  RotateCcw,
  Check,
  BatteryCharging,
  RefreshCw,
  Wifi,
  Bell,
  SlidersHorizontal,
  LogIn,
  LogOut,
  Menu,
  X,
  Share2,
  Compass,
  ArrowUpRight,
} from 'lucide-react';
import { SystemLogo } from '../common/SystemLogo';
import { ShareModal } from '../common/ShareModal';
import { FeaturePillarsSection } from './FeaturePillarsSection';

interface PestSpecieData {
  id: string;
  name: string;
  latinName: string;
  category: 'Hama Utama' | 'Hama Kritis' | 'Hama Pengisap' | 'Musuh Alami';
  thresholdText: string;
  thresholdValue: number;
  description: string;
  damageSymptom: string;
  wavelength: string;
  tagColor: string;
  badgeBg: string;
  accentBorder: string;
}

const PEST_SPECIES: PestSpecieData[] = [
  {
    id: 'wbc',
    name: 'Wereng Batang Coklat (WBC)',
    latinName: 'Nilaparvata lugens',
    category: 'Hama Kritis',
    thresholdText: 'Ambang PHT: > 10 ekor per rumpun / > 50 ekor per malam',
    thresholdValue: 50,
    description: 'Vektor virus kerdil hampa dan kerdil rumput. Menyebabkan hopperburn (rumpun mengering coklat seperti terbakar).',
    damageSymptom: 'Daun menguning cepat dari bawah, batang menghitam rapuh, tanaman mati melingkar.',
    wavelength: '365nm - 380nm (Fototaxis puncak)',
    tagColor: 'text-amber-900 bg-amber-100 border-amber-300',
    badgeBg: 'bg-amber-600',
    accentBorder: 'border-amber-500',
  },
  {
    id: 'penggerek',
    name: 'Penggerek Batang Kuning',
    latinName: 'Scirpophaga incertulas',
    category: 'Hama Utama',
    thresholdText: 'Ambang PHT: > 2 kelompok telur / 100 rumpun atau > 30 ngengat per malam',
    thresholdValue: 30,
    description: 'Larva menggerek jaringan pembuluh batang padi menyebabkan gejala sundep (fase anakan) dan beluk (fase malai hampa).',
    damageSymptom: 'Malai padi tegak keputihan tanpa isi bulir gabah (beluk), anakan mati mengering.',
    wavelength: '365nm (UV-A nokturnal 20.00-23.00 WIB)',
    tagColor: 'text-amber-800 bg-[#FAF0CA] border-[#F4D35E]',
    badgeBg: 'bg-[#EE964B]',
    accentBorder: 'border-[#EE964B]',
  },
  {
    id: 'walang',
    name: 'Walang Sangit',
    latinName: 'Leptocorisa oratorius',
    category: 'Hama Pengisap',
    thresholdText: 'Ambang PHT: > 5 ekor per m² saat fase masak susu',
    thresholdValue: 25,
    description: 'Mengisap cairan bulir padi muda yang sedang mengisi, menimbulkan aroma sangit menyengat dan gabah berbintik hitam.',
    damageSymptom: 'Bulir padi hampa atau bernoda coklat kotor, kualitas beras pecah tinggi.',
    wavelength: '385nm - 400nm (Spektrum biru-violet)',
    tagColor: 'text-[#8B5E34] bg-[#E6CCB2] border-[#DDB892]',
    badgeBg: 'bg-[#9C6644]',
    accentBorder: 'border-[#9C6644]',
  },
  {
    id: 'predator',
    name: 'Kepik Mirid (Musuh Alami)',
    latinName: 'Cyrtorhinus lividipennis',
    category: 'Musuh Alami',
    thresholdText: 'Status: Pemangsa telur dan nimfa wereng coklat',
    thresholdValue: 999,
    description: 'Sahabat petani yang memangsa telur dan nimfa wereng coklat. Kehadirannya dijaga untuk menekan populasi secara biologis.',
    damageSymptom: 'Bukan hama perusak, agen hayati penyeimbang ekosistem sawah.',
    wavelength: 'Spektrum netral, algoritma CV menandainya sebagai spesies dilindungi.',
    tagColor: 'text-[#2D6A4F] bg-[#D8F3DC] border-[#95D5B2]',
    badgeBg: 'bg-[#40916C]',
    accentBorder: 'border-[#40916C]',
  },
];

export const LandingPageView: React.FC = () => {
  const {
    setAppMode,
    setActiveTab,
    devices,
    currentUser,
    isAuthenticated,
    logout,
    setIsLoginModalOpen,
  } = useDevice();

  // Mobile Navigation Menu Drawer State
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // Social Share & Poster Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Active Interactive Feature Pillar Tab ('all' | 'siklus' | 'ai' | 'surya' | 'iot')
  const [activeFeatureTab, setActiveFeatureTab] = useState<'all' | 'siklus' | 'ai' | 'surya' | 'iot'>('all');

  // Interactive Hydraulic Simulation State
  const [isCycleRunning, setIsCycleRunning] = useState<boolean>(false);
  const [cycleStep, setCycleStep] = useState<string>('Standby (Baki Terisi Air Bersih 85%)');
  const [cycleProgress, setCycleProgress] = useState<number>(0);

  // Interactive Solar Energy Mode
  const [solarIrradianceMode, setSolarIrradianceMode] = useState<'cerah' | 'mendung' | 'malam'>('cerah');

  // Interactive AI Pest Classifier states
  const [selectedPest, setSelectedPest] = useState<PestSpecieData>(PEST_SPECIES[0]);
  const [simulatedCount, setSimulatedCount] = useState<number>(42);

  // Interactive 24-Hour Cycle Timeline state
  const [activeHour, setActiveHour] = useState<number>(20);

  // Interactive Farm Economic Calculator states
  const [farmHectares, setFarmHectares] = useState<number>(4);
  const [infestationSeverity, setInfestationSeverity] = useState<'sedang' | 'berat'>('sedang');

  const handleEnterDashboard = (targetTab: string = 'overview') => {
    setActiveTab(targetTab as any);
    setAppMode('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Run simulated flush cycle
  const runSimulatedFlushCycle = () => {
    if (isCycleRunning) return;
    setIsCycleRunning(true);
    setCycleProgress(10);
    setCycleStep('1. Katup Solenoid 12V Drain Membuka (Membuang air keruh & endapan serangga)...');

    setTimeout(() => {
      setCycleProgress(45);
      setCycleStep('2. Pengurasan baki 25 detik selesai. Sensor mendeteksi baki kosong.');
    }, 1500);

    setTimeout(() => {
      setCycleProgress(75);
      setCycleStep('3. Katup drain menutup. Pompa bilas aktif mengisi 5 liter air segar dari tandon...');
    }, 3000);

    setTimeout(() => {
      setCycleProgress(100);
      setCycleStep('4. Selesai: Level baki air 85%, NTU < 30 (Jernih). Perangkat siap operasi nokturnal.');
      setTimeout(() => {
        setIsCycleRunning(false);
      }, 1800);
    }, 4500);
  };

  // Timeline definitions
  const timelineSteps = [
    { hour: 6, title: '06:00 WIB', label: 'Bilas & Kuras Air Baki', color: 'bg-emerald-600', desc: 'Katup solenoid drain membuka selama 25 detik membuang kotoran serangga. Pompa tandon mengisi air bersih segar.' },
    { hour: 11, title: '11:00 WIB', label: 'Pengisian Surya Maksimal', color: 'bg-[#BC6C25]', desc: 'Panel surya 50Wp monokristalin memanen radiasi matahari puncak. Arus pengisian LiFePO4 mencapai 3.8A melalui MPPT.' },
    { hour: 18, title: '18:00 WIB', label: 'Lampu UV Otomatis Aktif', color: 'bg-[#582F0E]', desc: 'Pewaktu RTC DS3231 menyalakan LED UV 365nm saat senja tiba. Cahaya fototaxis mulai memancar memikat serangga nokturnal sawah.' },
    { hour: 21, title: '21:00 WIB', label: 'Puncak Fototaxis Nokturnal', color: 'bg-[#333D29]', desc: 'Aktivitas terbang wereng dan penggerek batang memuncak. Serangga menabrak corong pandu dan terjebak di baki penampung.' },
    { hour: 5, title: '05:00 WIB', label: 'Lampu UV Padam & Siaga', color: 'bg-[#283618]', desc: 'Lampu UV mati otomatis untuk menghemat daya baterai. Perangkat bersiap melakukan sesi pemotretan permukaan baki.' },
    { hour: 5.5, title: '05:30 WIB', label: 'Snapshot Kamera Makro & AI', color: 'bg-[#2D6A4F]', desc: 'Kamera OV5640 mengambil foto makro resolusi tinggi. Model YOLOv8 mengidentifikasi spesies serangga dan menghitung populasi.' },
  ];

  const currentTimeline = timelineSteps.find((s) => s.hour === activeHour) || timelineSteps[3];

  // Economic calculation
  const chemicalSavingsPerSeason = farmHectares * (infestationSeverity === 'sedang' ? 1450000 : 2800000);
  const yieldIncreaseTons = (farmHectares * (infestationSeverity === 'sedang' ? 0.75 : 1.4)).toFixed(1);
  const revenueGainRp = (parseFloat(yieldIncreaseTons) * 6500000).toLocaleString('id-ID');

  return (
    <div className="min-h-screen bg-[#F6F9F5] text-[#132A13] selection:bg-[#4F772D] selection:text-white font-sans pt-16">
      {/* 1. FIXED HEADER (GLASSMORPHISM HIJAU #132A13 MENYATU DENGAN TEMA) */}
      <header className="fixed top-0 inset-x-0 z-50 flex h-16 items-center justify-between gap-4 sm:gap-8 border-b border-[#90A955]/30 bg-[#132A13]/85 px-4 sm:px-6 backdrop-blur-md shadow-md text-white">
        {/* Zone 1: Brand Wordmark with Official System Logo */}
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <SystemLogo size="md" showText={true} theme="dark" />
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-[#ECF39E]/85">
          <a href="#hero-3d" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Perangkat 3D
          </a>
          <a href="#fitur-unggulan" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Fitur Utama
          </a>
          <a href="#ai-classifier" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            AI Hama PHT
          </a>
          <a href="#siklus-24h" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Siklus 24 Jam
          </a>
          <a href="#kalkulator-petani" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Kalkulator Petani
          </a>
          <a href="#anatomi-hardware" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Anatomi Sensor
          </a>
        </nav>

        {/* Zone 3: Primary Action, Auth Trigger & Mobile Hamburger Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isAuthenticated && currentUser ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#31572C]/80 border border-[#90A955]/50 text-xs">
                <div className="h-6 w-6 rounded-lg bg-[#4F772D] text-[#ECF39E] font-bold text-[10px] flex items-center justify-center border border-[#ECF39E]/40">
                  {currentUser.avatarInitials}
                </div>
                <div className="hidden sm:block text-left">
                  <span className="font-bold text-white block leading-tight">{currentUser.name}</span>
                  <span className="text-[10px] text-[#ECF39E] block leading-none">{currentUser.role.split(' ')[0]}</span>
                </div>
              </div>

              {/* Buka Dashboard Button - Menggunakan warna lebih terang (#4F772D / #90A955) agar menonjol */}
              <button
                onClick={() => handleEnterDashboard('overview')}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4F772D] via-[#90A955] to-[#4F772D] px-3.5 sm:px-4 py-2 text-xs font-extrabold text-white shadow-md hover:brightness-110 transition-all hover:scale-[1.02] whitespace-nowrap shrink-0 cursor-pointer border border-[#ECF39E]/60"
              >
                <span>Buka Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5 text-[#ECF39E]" />
              </button>

              <button
                onClick={logout}
                className="p-2 rounded-xl text-[#ECF39E] hover:text-red-400 hover:bg-white/10 border border-[#90A955]/40 transition-colors cursor-pointer"
                title="Keluar (Logout)"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Jika belum login: Tombol Masuk ke Akun dengan palet hijau lebih terang #4F772D / #90A955 */
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-[#4F772D] via-[#90A955] to-[#4F772D] text-xs font-extrabold text-white hover:brightness-110 transition-all cursor-pointer shadow-md border border-[#ECF39E]/60"
            >
              <LogIn className="h-3.5 w-3.5 text-[#ECF39E]" />
              <span>Masuk ke Akun</span>
            </button>
          )}

          {/* Hamburger Menu Toggle Button for Mobile (< lg) */}
          <button
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            className="lg:hidden p-2 rounded-xl text-[#ECF39E] hover:text-white hover:bg-white/10 border border-[#90A955]/40 transition-colors cursor-pointer"
            aria-label={isMobileNavOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            title="Menu Navigasi"
          >
            {isMobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Dropdown Menu (Glassmorphism #132A13) */}
      {isMobileNavOpen && (
        <div className="lg:hidden fixed top-16 inset-x-0 z-40 bg-[#132A13]/95 border-b border-[#90A955]/40 backdrop-blur-xl px-5 py-4 shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-[#90A955]/20 text-[11px] font-semibold text-[#ECF39E]/80 uppercase tracking-wider">
            <span>Navigasi Cepat</span>
            <span className="text-[10px] text-[#90A955]">Smart Trap Subang</span>
          </div>
          <nav className="flex flex-col gap-1">
            <a
              href="#hero-3d"
              onClick={() => setIsMobileNavOpen(false)}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-semibold text-[#ECF39E] hover:bg-[#31572C]/70 hover:text-white transition-colors"
            >
              <span>Perangkat 3D Interaktif</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-60" />
            </a>
            <a
              href="#fitur-unggulan"
              onClick={() => setIsMobileNavOpen(false)}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-semibold text-[#ECF39E] hover:bg-[#31572C]/70 hover:text-white transition-colors"
            >
              <span>Fitur Utama Terintegrasi</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-60" />
            </a>
            <a
              href="#ai-classifier"
              onClick={() => setIsMobileNavOpen(false)}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-semibold text-[#ECF39E] hover:bg-[#31572C]/70 hover:text-white transition-colors"
            >
              <span>AI Klasifikasi Hama PHT</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-60" />
            </a>
            <a
              href="#siklus-24h"
              onClick={() => setIsMobileNavOpen(false)}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-semibold text-[#ECF39E] hover:bg-[#31572C]/70 hover:text-white transition-colors"
            >
              <span>Siklus Operasi 24 Jam</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-60" />
            </a>
            <a
              href="#kalkulator-petani"
              onClick={() => setIsMobileNavOpen(false)}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-semibold text-[#ECF39E] hover:bg-[#31572C]/70 hover:text-white transition-colors"
            >
              <span>Kalkulator Ekonomi Petani</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-60" />
            </a>
            <a
              href="#anatomi-hardware"
              onClick={() => setIsMobileNavOpen(false)}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-semibold text-[#ECF39E] hover:bg-[#31572C]/70 hover:text-white transition-colors"
            >
              <span>Anatomi Sensor & Hardware</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-60" />
            </a>
            <a
              href="#armada-subang"
              onClick={() => setIsMobileNavOpen(false)}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl text-xs font-semibold text-[#ECF39E] hover:bg-[#31572C]/70 hover:text-white transition-colors"
            >
              <span>Status Armada Lapangan Subang</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-60" />
            </a>
          </nav>
        </div>
      )}

      {/* 2. FULL-SECTION HERO DENGAN LATAR #132A13 MENYATU SEAMLESS DENGAN THREE.JS 3D CANVAS */}
      <section
        id="hero-3d"
        className="relative w-full min-h-[92vh] flex flex-col lg:flex-row items-center lg:items-center overflow-hidden bg-[#132A13]"
      >
        {/* Left Side Content Overlay - Di Mobile: Memiliki container backdrop gelap transparan agar keterbacaan teks maksimal */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 pt-8 pb-4 lg:py-20 pointer-events-none">
          <div className="max-w-xl lg:max-w-xl pointer-events-auto bg-[#132A13]/90 sm:bg-[#132A13]/85 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none p-6 sm:p-8 lg:p-0 rounded-3xl border border-[#90A955]/30 lg:border-none shadow-2xl lg:shadow-none">
            {/* Left Headline */}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.18] drop-shadow-xl text-balance">
              Perangkap Serangga Otomatis Berbasis IoT & Computer Vision
            </h1>

            {/* Left Description */}
            <p className="mt-4 sm:mt-5 text-xs sm:text-base text-[#ECF39E]/90 font-normal leading-relaxed drop-shadow-md">
              Perangkat lapangan mandiri surya dengan lampu penarik fototaxis nokturnal, kamera makro AI, dan siklus pembersihan baki otomatis untuk perlindungan tanaman padi presisi.
            </p>

            {/* Call to Actions - Tombol CTA Menonjol dengan Palet Hijau Lebih Terang (#4F772D & #90A955) */}
            <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3">
              {isAuthenticated ? (
                <button
                  onClick={() => handleEnterDashboard('overview')}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#4F772D] via-[#90A955] to-[#4F772D] px-5 sm:px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-white shadow-xl shadow-[#4F772D]/25 hover:brightness-110 transition-all hover:scale-[1.02] cursor-pointer border-2 border-[#ECF39E]/70"
                >
                  <span>Lanjut ke Dashboard Operasional</span>
                  <ArrowRight className="h-4 w-4 text-[#ECF39E]" />
                </button>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#4F772D] via-[#90A955] to-[#4F772D] px-5 sm:px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-extrabold text-white shadow-xl shadow-[#4F772D]/25 hover:brightness-110 transition-all hover:scale-[1.02] cursor-pointer border-2 border-[#ECF39E]/70"
                >
                  <LogIn className="h-4 w-4 text-[#ECF39E]" />
                  <span>Masuk untuk Memantau Lahan</span>
                </button>
              )}

              <a
                href="#fitur-unggulan"
                className="inline-flex items-center gap-2 rounded-xl bg-[#31572C]/75 border border-[#90A955]/60 px-4 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-[#ECF39E] backdrop-blur-md hover:bg-[#4F772D]/60 hover:border-[#ECF39E] transition-all cursor-pointer shadow-md"
              >
                <Sparkles className="h-4 w-4 text-[#ECF39E]" />
                <span>Eksplorasi Fitur Unggulan</span>
              </a>
            </div>
          </div>
        </div>

        {/* 3D Canvas Container - Di Mobile didorong ke bawah teks, Di Desktop tetap rata kanan (align-right) */}
        <div className="relative lg:absolute lg:inset-y-0 lg:right-0 w-full lg:w-7/12 xl:w-3/5 h-[360px] sm:h-[440px] lg:h-full z-0 pointer-events-auto">
          <SmartTrap3DScene className="w-full h-full" />
          {/* Blend halus dengan warna latar dasar #132A13 yang sama persis dengan Three.js */}
          <div className="hidden lg:block absolute inset-y-0 left-0 w-36 bg-gradient-to-r from-[#132A13] via-[#132A13]/80 to-transparent pointer-events-none" />

          {/* Subtle Bottom Interaction Hint */}
          <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-6 z-10 flex items-center gap-2 rounded-full bg-[#132A13]/85 border border-[#90A955]/40 px-3 py-1.5 text-[10px] sm:text-[11px] text-[#ECF39E] backdrop-blur-xs pointer-events-none shadow-md">
            <RotateCw className="h-3.5 w-3.5 text-[#ECF39E] animate-spin" style={{ animationDuration: '8s' }} />
            <span>Model 3D Smart Trap (Interaktif 360°)</span>
          </div>
        </div>

        {/* Ambient background glow bernuansa hijau #31572C */}
        <div className="absolute top-1/4 left-10 w-96 h-96 bg-[#31572C]/25 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* 3. NEW INTERACTIVE FEATURE PILLARS SECTION (MATCHING SCREENSHOT WITH DIAMOND NAVIGATOR & 2-CARD GRID) */}
      <FeaturePillarsSection
        activeFeatureTab={activeFeatureTab}
        setActiveFeatureTab={setActiveFeatureTab}
        isCycleRunning={isCycleRunning}
        cycleProgress={cycleProgress}
        cycleStep={cycleStep}
        runSimulatedFlushCycle={runSimulatedFlushCycle}
        handleEnterDashboard={handleEnterDashboard}
      />


      {/* 4. SECTION INTERAKTIF: AI INSECT CLASSIFIER & AMBANG KENDALI PHT */}
      <section id="ai-classifier" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F6F9F5] border-b border-[#90A955]/25">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#ECF39E]/60 text-[#132A13] border border-[#90A955]/40">
                <Sparkles className="h-3.5 w-3.5 text-[#31572C]" />
                Simulasi Deteksi & Ambang PHT
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[#132A13] mt-2 tracking-tight">
                Simulasi Klasifikasi Serangga & Ambang Batas PHT
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#31572C] max-w-md">
              Uji coba bagaimana kamera makro OV5640 dan model YOLOv8 mendeteksi hama padi secara akurat di baki penampung serta menghitung rekomendasi aksi pengendalian.
            </p>
          </div>

          {/* Interactive Classifier Playground Grid (Equal Height & Flush Alignment) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            {/* Left Controls & Species Selector (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between h-full space-y-4">
              {/* Card 1: Species Selector */}
              <div className="rounded-2xl border border-[#90A955]/30 bg-white p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#31572C] flex items-center gap-1.5">
                    <Bug className="h-3.5 w-3.5 text-[#4F772D]" />
                    1. Pilih Spesies Sasaran
                  </span>
                  <span className="text-[11px] text-[#90A955] font-medium">4 Spesies PHT</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PEST_SPECIES.map((species) => {
                    const isSelected = selectedPest.id === species.id;
                    return (
                      <button
                        key={species.id}
                        type="button"
                        onClick={() => setSelectedPest(species)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-2 border-[#31572C] bg-[#ECF39E]/25 shadow-xs ring-2 ring-[#4F772D]/20'
                            : 'border-[#90A955]/25 bg-white hover:border-[#4F772D]/50 hover:bg-[#F6F9F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ECF39E] text-[#132A13] border border-[#90A955]/30">
                            {species.category}
                          </span>
                          {isSelected ? (
                            <CheckCircle2 className="h-4 w-4 text-[#31572C] shrink-0" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-[#90A955]/40" />
                          )}
                        </div>
                        <div className="text-xs font-bold text-[#132A13] leading-snug truncate">
                          {species.name}
                        </div>
                        <div className="text-[11px] italic text-[#4F772D] truncate">
                          {species.latinName}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card 2: Interactive Slider */}
              <div className="rounded-2xl border border-[#90A955]/30 bg-white p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#132A13] flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-[#31572C]" />
                    <span>2. Simulasikan Tangkapan Malam</span>
                  </span>
                  <span className="font-mono text-sm font-bold bg-[#31572C] text-[#ECF39E] px-3 py-1 rounded-full tabular-nums shadow-xs">
                    {simulatedCount} ekor
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <input
                    type="range"
                    min="0"
                    max="120"
                    value={simulatedCount}
                    onChange={(e) => setSimulatedCount(parseInt(e.target.value))}
                    className="w-full accent-[#31572C] h-2 bg-[#ECF39E]/60 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-[#31572C] pt-0.5">
                    <span>0 (Bersih)</span>
                    <span className="font-bold text-[#132A13] bg-[#ECF39E]/50 px-1.5 py-0.5 rounded">
                      Ambang: {selectedPest.thresholdValue} ekor
                    </span>
                    <span>120 (Kritis)</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Damage Symptoms & Optical Spectrum Info (Expands to align with right side) */}
              <div className="rounded-2xl border border-[#90A955]/30 bg-white p-4 sm:p-5 shadow-xs space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-[#4F772D]" />
                    <h4 className="text-xs font-bold text-[#132A13]">
                      Gejala Serangan di Sawah Subang:
                    </h4>
                  </div>
                  <p className="text-xs text-[#31572C] leading-relaxed">
                    {selectedPest.damageSymptom}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#90A955]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] mt-auto">
                  <span className="text-[#31572C] font-medium">Panjang Gelombang Lampu:</span>
                  <span className="font-semibold text-[#132A13] bg-[#ECF39E]/40 px-2 py-0.5 rounded-md border border-[#90A955]/30 self-start sm:self-auto">
                    {selectedPest.wavelength}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Interactive Viewfinder & Decision Box (7 Cols, Equal Height) */}
            <div className="lg:col-span-7 flex flex-col justify-between h-full space-y-4">
              {/* Simulated Camera Viewfinder */}
              <div className="relative rounded-2xl overflow-hidden border-2 border-[#31572C] bg-[#0c1e17] p-4 sm:p-5 shadow-xl text-white">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-[#ECF39E]" />
                    <span className="font-mono text-xs text-[#ECF39E]">
                      OV5640_MACRO_FEED · 1920x1080
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#4F772D] text-[#ECF39E] text-[10px] font-mono font-bold tracking-wider">
                    AI INFERENCE LIVE
                  </span>
                </div>

                <div className="relative h-64 sm:h-72 rounded-xl bg-gradient-to-b from-[#132c22] to-[#0d1e17] overflow-hidden border border-[#90A955]/30 flex items-center justify-center">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f3d30_1px,transparent_1px),linear-gradient(to_bottom,#1f3d30_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-30" />

                  {/* Water Basin Oval */}
                  <div className="w-56 h-56 rounded-full bg-cyan-950/40 border border-cyan-400/25 flex items-center justify-center shadow-inner">
                    <span className="text-[10px] font-mono text-cyan-300/50 uppercase tracking-wider">
                      Permukaan Air Baki
                    </span>
                  </div>

                  {/* Detection Bounding Box 1 */}
                  <div className="absolute top-10 left-10 sm:left-16 border-2 border-[#ECF39E] bg-[#ECF39E]/10 p-1 rounded-sm shadow-sm">
                    <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded-xs bg-[#ECF39E] text-[10px] font-mono font-bold text-[#132A13] whitespace-nowrap">
                      {selectedPest.name.split(' ')[0]} 98.4%
                    </span>
                    <div className="w-10 h-10 border border-dashed border-[#ECF39E]/70" />
                  </div>

                  {/* Detection Bounding Box 2 */}
                  <div className="absolute bottom-12 right-12 sm:right-20 border-2 border-[#ECF39E] bg-[#ECF39E]/10 p-1 rounded-sm shadow-sm">
                    <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded-xs bg-[#ECF39E] text-[10px] font-mono font-bold text-[#132A13] whitespace-nowrap">
                      {selectedPest.name.split(' ')[0]} 95.7%
                    </span>
                    <div className="w-12 h-12 border border-dashed border-[#ECF39E]/70" />
                  </div>

                  {/* Detection Bounding Box 3 (Secondary Pest / Predator) */}
                  <div className="absolute top-20 right-1/3 border-2 border-[#90A955] bg-[#90A955]/15 p-1 rounded-sm shadow-sm">
                    <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded-xs bg-[#90A955] text-[10px] font-mono font-bold text-[#132A13] whitespace-nowrap">
                      {selectedPest.id === 'predator' ? 'Mirid_Bug 94%' : 'Ngengat_Lain 89%'}
                    </span>
                    <div className="w-9 h-9 border border-dashed border-[#90A955]/70" />
                  </div>

                  {/* Crosshair Target Center */}
                  <div className="absolute w-8 h-8 border border-[#ECF39E]/40 rounded-full flex items-center justify-center pointer-events-none">
                    <div className="w-1.5 h-1.5 bg-[#ECF39E] rounded-full" />
                  </div>
                </div>

                {/* Viewfinder Telemetry Bar */}
                <div className="mt-3 flex flex-wrap items-center justify-between text-xs font-mono text-slate-300 border-t border-white/10 pt-2.5 gap-2">
                  <div>
                    Total Serangga Terdeteksi:{' '}
                    <span className="font-bold text-[#ECF39E] tabular-nums">{simulatedCount} ekor</span>
                  </div>
                  <div>
                    Status Ambang Batas:{' '}
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        simulatedCount >= selectedPest.thresholdValue
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : simulatedCount >= selectedPest.thresholdValue * 0.6
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-[#4F772D]/30 text-[#ECF39E] border border-[#4F772D]/50'
                      }`}
                    >
                      {simulatedCount >= selectedPest.thresholdValue
                        ? 'CRITICAL (BAHAYA LEDAKAN)'
                        : simulatedCount >= selectedPest.thresholdValue * 0.6
                        ? 'WARNING (WASPADA)'
                        : 'NORMAL (AMAN)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic Action Decision Box (Equal Height with Card 3) */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all shadow-xs flex-1 flex flex-col justify-center ${
                  simulatedCount >= selectedPest.thresholdValue
                    ? 'border-red-400 bg-red-50/95 text-red-950'
                    : simulatedCount >= selectedPest.thresholdValue * 0.6
                    ? 'border-amber-400 bg-amber-50/95 text-amber-950'
                    : 'border-[#4F772D]/40 bg-[#ECF39E]/30 text-[#132A13]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white shadow-2xs shrink-0 mt-0.5">
                    {simulatedCount >= selectedPest.thresholdValue ? (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    ) : simulatedCount >= selectedPest.thresholdValue * 0.6 ? (
                      <Activity className="h-5 w-5 text-amber-600" />
                    ) : (
                      <ShieldCheck className="h-5 w-5 text-[#31572C]" />
                    )}
                  </div>

                  <div>
                    <h5 className="text-sm font-bold leading-tight">
                      {simulatedCount >= selectedPest.thresholdValue
                        ? 'Rekomendasi PHT: Ambang Bahaya Terlampaui!'
                        : simulatedCount >= selectedPest.thresholdValue * 0.6
                        ? 'Rekomendasi PHT: Peringatan Dini (Waspada)'
                        : 'Rekomendasi PHT: Ekosistem Sawah Seimbang'}
                    </h5>
                    <p className="text-xs mt-1.5 leading-relaxed opacity-90">
                      {simulatedCount >= selectedPest.thresholdValue
                        ? `Tangkapan ${selectedPest.name} mencapai ${simulatedCount} ekor (di atas batas kendali ${selectedPest.thresholdValue} ekor). Sistem IoT secara otomatis mengirimkan notifikasi Telegram ke Koordinator PPL Subang untuk penyemprotan agens hayati terlokalisir.`
                        : simulatedCount >= selectedPest.thresholdValue * 0.6
                        ? `Populasi serangga menunjukkan tren kenaikan. Pertahankan pengamatan baki harian dan periksa rumpun padi di petak SLT-SBG-01.`
                        : `Populasi ${selectedPest.name} berada pada tingkat aman. Tidak diperlukan penyemprotan pestisida kimia. Hemat biaya operasional & jaga kelestarian musuh alami.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SECTION INTERAKTIF: SIKLUS OTOMASI 24 JAM */}
      <section id="siklus-24h" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#F2F7F4] via-[#E8F0E9] to-[#FAFDF9] border-b border-[#D8E2DC]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#D4A373]/20 text-[#7F4F24] border border-[#D4A373]/40">
              <Clock className="h-3.5 w-3.5 text-[#9C6644]" />
              Otonom Penuh Tenaga Surya
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#192A20] mt-2">
              Siklus Operasional Lapangan 24 Jam
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#52796F]">
              Klik setiap tahapan waktu di bawah untuk melihat bagaimana Smart Light Trap mengatur daya surya, lampu penarik, pembersihan baki, dan pengiriman telemetri secara otomatis.
            </p>
          </div>

          {/* Interactive Timeline Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {timelineSteps.map((step) => {
              const isActive = activeHour === step.hour;
              return (
                <button
                  key={step.hour}
                  onClick={() => setActiveHour(step.hour)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'border-2 border-[#1B4332] bg-white shadow-lg scale-102'
                      : 'border-[#D1DCD6] bg-white/70 hover:bg-white'
                  }`}
                >
                  <span className="block font-mono text-xs font-bold text-[#2D6A4F]">{step.title}</span>
                  <span className="block text-xs font-extrabold text-[#192A20] mt-1 leading-tight">{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Timeline Feature Spotlight Box */}
          <div className="rounded-2xl border border-[#D1DCD6] bg-white p-6 sm:p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="md:col-span-2 space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold font-mono bg-[#EAF4EE] text-[#1B4332]">
                  <span>Fase Aktif: {currentTimeline.title}</span>
                  <span aria-hidden="true">·</span>
                  <span>{currentTimeline.label}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#192A20]">
                  {currentTimeline.label}
                </h3>
                <p className="text-xs sm:text-sm text-[#52796F] leading-relaxed">
                  {currentTimeline.desc}
                </p>
              </div>

              {/* Dynamic Status Gauges according to activeHour */}
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAF9] p-4 space-y-3">
                <span className="text-[11px] font-bold text-[#718096] uppercase tracking-wider block">
                  Telemetri Perangkat Saat Ini
                </span>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#E2E8F0]">
                    <span className="text-[#52796F]">Tegangan Baterai LiFePO4:</span>
                    <span className="font-mono font-bold text-[#192A20]">
                      {activeHour === 11 ? '14.2 V (Pengisian MPPT)' : activeHour === 21 ? '12.8 V (Lampu UV Aktif)' : '13.2 V (Stabil)'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-1.5 border-b border-[#E2E8F0]">
                    <span className="text-[#52796F]">Status Lampu UV 365nm:</span>
                    <span className={`font-semibold ${activeHour === 18 || activeHour === 21 ? 'text-purple-600' : 'text-slate-400'}`}>
                      {activeHour === 18 || activeHour === 21 ? 'Menyala (850 mA)' : 'Mati (0 mA)'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-[#52796F]">Katup Kuras Solenoid:</span>
                    <span className={`font-semibold ${activeHour === 6 ? 'text-cyan-600' : 'text-slate-400'}`}>
                      {activeHour === 6 ? 'DURASI 25s AKTIF' : 'Tertutup (Normal)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SECTION INTERAKTIF: KALKULATOR DAMPAK EKONOMI & PENGHEMATAN PETANI */}
      <section id="kalkulator-petani" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Narrative */}
            <div className="lg:col-span-5 space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Coins className="h-3.5 w-3.5 text-emerald-600" />
                Efisiensi Gabah Subang
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-[#192A20] leading-tight">
                Kalkulator Penghematan Biaya & Hasil Panen Padi
              </h2>
              <p className="text-xs sm:text-sm text-[#52796F] leading-relaxed">
                Di sentra lumbung beras Subang, pengendalian hama berbasis data memangkas semprotan kimia yang sia-sia, menjaga ekosistem musuh alami, dan mencegah bulir padi hampa.
              </p>

              {/* Input Slider Luas Lahan */}
              <div className="p-4 rounded-xl border border-[#D1DCD6] bg-[#F8FAF9] space-y-3 mt-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#192A20]">Luas Lahan Sawah:</span>
                  <span className="font-mono text-base font-extrabold text-[#2D6A4F]">{farmHectares} Hektar</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={farmHectares}
                  onChange={(e) => setFarmHectares(parseInt(e.target.value))}
                  className="w-full accent-[#2D6A4F] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#718096]">
                  <span>1 Ha</span>
                  <span>10 Ha</span>
                  <span>20 Ha</span>
                </div>
              </div>

              {/* Tingkat Serangan */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#718096]">Riwayat Serangan:</span>
                <button
                  onClick={() => setInfestationSeverity('sedang')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    infestationSeverity === 'sedang'
                      ? 'bg-[#2D6A4F] text-white font-semibold'
                      : 'bg-[#F1F5F2] text-[#4A5568]'
                  }`}
                >
                  Sedang / Musiman
                </button>
                <button
                  onClick={() => setInfestationSeverity('berat')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                    infestationSeverity === 'berat'
                      ? 'bg-amber-800 text-white font-semibold'
                      : 'bg-[#F1F5F2] text-[#4A5568]'
                  }`}
                >
                  Endemik / Rawan Ledakan
                </button>
              </div>
            </div>

            {/* Right Calculated Results (Cards with Vibrant Earth & Sage Accents) */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-600 to-[#1B4332] text-white shadow-xl">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-200 block">
                  Penghematan Pestisida Kimia
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono mt-2 tabular-nums">
                  Rp {chemicalSavingsPerSeason.toLocaleString('id-ID')}
                </div>
                <p className="text-xs text-emerald-100 mt-2">
                  Pengurangan rata-rata 3 hingga 5 kali siklus penyemprotan insektisida per musim panen.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-gradient-to-br from-[#BC6C25] to-[#7F4F24] text-white shadow-xl">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-200 block">
                  Penyelamatan Panen Gabah (GKP)
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono mt-2 tabular-nums">
                  +{yieldIncreaseTons} Ton
                </div>
                <p className="text-xs text-amber-100 mt-2">
                  Setara nilai tambah pendapatan gabah sekitar <span className="font-bold">Rp {revenueGainRp}</span>.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#F0F5F1] border-2 border-[#84A98C]/40 text-[#192A20] shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-[#2D6A4F] block">
                  Deteksi Dini Ledakan Hama
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#192A20] mt-2">
                  3–5 Hari Lebih Cepat
                </div>
                <p className="text-xs text-[#52796F] mt-2">
                  Pemberitahuan otomatis ke bot Telegram sebelum wereng coklat memasuki fase ledakan hopperburn.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#FAF4ED] border-2 border-[#D4A373]/40 text-[#192A20] shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-[#7F4F24] block">
                  Biaya Listrik PLN Lapangan
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#BC6C25] mt-2">
                  Rp 0 / Bulan
                </div>
                <p className="text-xs text-[#52796F] mt-2">
                  100% mandiri energi bertenaga surya 50Wp dengan ketahanan baterai hingga 3 hari cuaca mendung.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. SECTION INTERAKTIF: ANATOMI PERANGKAT & SENSOR */}
      <section id="anatomi-hardware" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#FAFDF9] to-[#F2F7F4] border-b border-[#D8E2DC]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-10 sm:mb-12">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#84A98C]/20 text-[#2D6A4F] border border-[#84A98C]/30">
              <Layers className="h-3.5 w-3.5 text-[#2D6A4F]" />
              Rekayasa Perangkat Keras
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#192A20] mt-2 tracking-tight">
              Anatomi 6 Sub-Sistem Lapangan Teruji
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#52796F]">
              Setiap komponen dirancang dengan sertifikasi IP65 untuk ketahanan luar ruangan terhadap kelembapan tinggi, terik matahari sawah, dan hujan tropis.
            </p>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#52796F] sm:hidden font-medium">
              <span>Geser ke samping untuk melihat komponen</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>

          <div className="flex overflow-x-auto sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 pb-4 pt-1 snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
            {/* Card 1: Panel Surya */}
            <div className="w-[260px] sm:w-auto flex-shrink-0 snap-start rounded-2xl border border-[#D1DCD6] bg-white p-5 shadow-xs hover:shadow-md hover:border-[#2D6A4F]/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
                    <Sun className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#192A20] leading-snug">Panel Surya & INA226</h4>
                    <span className="text-[10px] text-amber-700 font-semibold block">50Wp Monokristalin</span>
                  </div>
                </div>
                <p className="text-xs text-[#52796F] leading-relaxed mb-3">
                  Panel surya 50Wp miring 15° dipadukan dengan sensor arus I2C INA226 untuk memantau tegangan bus dan mA pengisian secara presisi.
                </p>
              </div>
              <div className="bg-[#F8FAF9] p-2.5 rounded-xl text-[11px] font-mono text-[#192A20] space-y-1 border border-[#E2E8F0]">
                <div>· Baterai: LiFePO4 12.8V 20Ah</div>
                <div>· Fitur: MPPT + Eco Cut-off</div>
              </div>
            </div>

            {/* Card 2: Lampu UV */}
            <div className="w-[260px] sm:w-auto flex-shrink-0 snap-start rounded-2xl border border-[#D1DCD6] bg-white p-5 shadow-xs hover:shadow-md hover:border-[#2D6A4F]/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
                    <Zap className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#192A20] leading-snug">Lampu UV LED 365nm</h4>
                    <span className="text-[10px] text-purple-700 font-semibold block">Fototaxis Terkalibrasi</span>
                  </div>
                </div>
                <p className="text-xs text-[#52796F] leading-relaxed mb-3">
                  Panjang gelombang emisi 365nm yang terbukti memikat serangga hama malam (wereng coklat, penggerek batang) hemat daya.
                </p>
              </div>
              <div className="bg-[#F8FAF9] p-2.5 rounded-xl text-[11px] font-mono text-[#192A20] space-y-1 border border-[#E2E8F0]">
                <div>· Driver: PWM Arus 850mA</div>
                <div>· Waktu: Otomatis 18:00–05:00 WIB</div>
              </div>
            </div>

            {/* Card 3: Kamera CV */}
            <div className="w-[260px] sm:w-auto flex-shrink-0 snap-start rounded-2xl border border-[#D1DCD6] bg-white p-5 shadow-xs hover:shadow-md hover:border-[#2D6A4F]/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold shrink-0">
                    <Camera className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#192A20] leading-snug">Kamera Makro OV5640</h4>
                    <span className="text-[10px] text-cyan-700 font-semibold block">5MP Autofokus Lensa</span>
                  </div>
                </div>
                <p className="text-xs text-[#52796F] leading-relaxed mb-3">
                  Modul kamera sudut terarah baki penampung untuk pemotretan fajar beresolusi tajam sebelum inferensi deteksi YOLOv8.
                </p>
              </div>
              <div className="bg-[#F8FAF9] p-2.5 rounded-xl text-[11px] font-mono text-[#192A20] space-y-1 border border-[#E2E8F0]">
                <div>· Penerangan: Ring LED Diffused</div>
                <div>· Format: Kompresi JPEG via 4G</div>
              </div>
            </div>

            {/* Card 4: Baki & Katup Solenoid */}
            <div className="w-[260px] sm:w-auto flex-shrink-0 snap-start rounded-2xl border border-[#D1DCD6] bg-white p-5 shadow-xs hover:shadow-md hover:border-[#2D6A4F]/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                    <Droplets className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#192A20] leading-snug">Baki & Solenoid Drain</h4>
                    <span className="text-[10px] text-blue-700 font-semibold block">Kuras Otomatis 25 Detik</span>
                  </div>
                </div>
                <p className="text-xs text-[#52796F] leading-relaxed mb-3">
                  Baki penampung air bertegangan permukaan khusus. Katup solenoid 12V membuang air keruh dan pompa menyuplai air bersih.
                </p>
              </div>
              <div className="bg-[#F8FAF9] p-2.5 rounded-xl text-[11px] font-mono text-[#192A20] space-y-1 border border-[#E2E8F0]">
                <div>· Sensor: Turbidity NTU + Level</div>
                <div>· Fitur: Anti Dry-Run Lockout</div>
              </div>
            </div>

            {/* Card 5: ESP32-S3 */}
            <div className="w-[260px] sm:w-auto flex-shrink-0 snap-start rounded-2xl border border-[#D1DCD6] bg-white p-5 shadow-xs hover:shadow-md hover:border-[#2D6A4F]/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                    <Cpu className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#192A20] leading-snug">ESP32-S3 Dual-Core</h4>
                    <span className="text-[10px] text-emerald-700 font-semibold block">Mikrokontroler 240MHz</span>
                  </div>
                </div>
                <p className="text-xs text-[#52796F] leading-relaxed mb-3">
                  Memproses sensor I2C, penjadwalan timer RTC DS3231, relay hidraulik baki, dan pembaruan firmware OTA nirkabel.
                </p>
              </div>
              <div className="bg-[#F8FAF9] p-2.5 rounded-xl text-[11px] font-mono text-[#192A20] space-y-1 border border-[#E2E8F0]">
                <div>· Fitur: Hardware Watchdog</div>
                <div>· Memori: Flash 16MB + PSRAM</div>
              </div>
            </div>

            {/* Card 6: Modem 4G */}
            <div className="w-[260px] sm:w-auto flex-shrink-0 snap-start rounded-2xl border border-[#D1DCD6] bg-white p-5 shadow-xs hover:shadow-md hover:border-[#2D6A4F]/40 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                    <Radio className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#192A20] leading-snug">Modem 4G & MQTT</h4>
                    <span className="text-[10px] text-indigo-700 font-semibold block">Konektivitas Seluler</span>
                  </div>
                </div>
                <p className="text-xs text-[#52796F] leading-relaxed mb-3">
                  Mengirimkan telemetri, foto hasil tangkapan, dan menerima perintah eksekusi dari dashboard web secara real-time.
                </p>
              </div>
              <div className="bg-[#F8FAF9] p-2.5 rounded-xl text-[11px] font-mono text-[#192A20] space-y-1 border border-[#E2E8F0]">
                <div>· Protokol: MQTT TLS Encrypted</div>
                <div>· Notifikasi: Telegram Bot API</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. LIVE FLEET STATUS SUBANG */}
      <section id="armada-subang" className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#40916C]">
                Penyebaran Lapangan
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#192A20] mt-1.5">
                Status 4 Unit Smart Light Trap di Subang
              </h2>
            </div>
            <div className="flex items-center gap-3 mt-3 md:mt-0">
              <span className="text-[11px] text-[#52796F] lg:hidden flex items-center gap-1 font-medium">
                <span>Geser ke samping</span>
                <ArrowRight className="h-3 w-3" />
              </span>
              <button
                onClick={() => handleEnterDashboard('devices')}
                className="text-xs font-bold text-[#2D6A4F] hover:text-[#1B4332] flex items-center gap-1 cursor-pointer"
              >
                <span>Buka Seluruh Armada di Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Horizontal scroll / carousel layout on mobile/tablet, responsive grid on desktop */}
          <div className="flex overflow-x-auto lg:grid lg:grid-cols-4 gap-4 pb-4 pt-1 snap-x snap-mandatory scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
            {devices.map((device) => (
              <div
                key={device.id}
                onClick={() => handleEnterDashboard('devices')}
                className="min-w-[270px] sm:min-w-[290px] lg:min-w-0 flex-shrink-0 snap-start p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAF9] hover:bg-white hover:border-[#2D6A4F] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-mono font-bold text-[#192A20]">{device.code}</span>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      {device.status.toUpperCase()}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-[#192A20] truncate">{device.name}</h4>
                  <div className="text-[11px] text-[#718096] truncate">{device.locationName}</div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E2E8F0] grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[#718096] block text-[10px]">Tegangan Baterai</span>
                    <span className="font-mono font-bold text-[#192A20]">{device.currentTelemetry.battery.busVoltageV} V</span>
                  </div>
                  <div>
                    <span className="text-[#718096] block text-[10px]">Level Baki Air</span>
                    <span className="font-mono font-bold text-[#2D6A4F]">{device.currentTelemetry.water.trayLevelPercent}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. VIBRANT CTA BANNER */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#132A13] via-[#31572C] to-[#132A13] text-white border-t border-[#90A955]/30">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-[#ECF39E]">
            Akses Penuh Sistem Monitoring
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold mt-2 leading-tight tracking-tight">
            Pantau Lahan & Kendalikan Perangkat Smart Trap Lapangan
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-[#ECF39E]/85 max-w-xl mx-auto leading-relaxed">
            Akses analitik tangkapan hama, pantau tegangan baterai solar INA226, periksa foto makro kamera CV, dan jalankan perintah kuras baki dari jarak jauh.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {isAuthenticated ? (
              <button
                onClick={() => handleEnterDashboard('overview')}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4F772D] via-[#90A955] to-[#4F772D] px-6 py-3.5 text-xs sm:text-sm font-extrabold text-white shadow-xl hover:brightness-110 transition-all hover:scale-105 cursor-pointer border border-[#ECF39E]/50"
              >
                <span>Masuk ke Dashboard Sekarang</span>
                <ArrowRight className="h-4 w-4 text-[#ECF39E]" />
              </button>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4F772D] via-[#90A955] to-[#4F772D] px-6 py-3.5 text-xs sm:text-sm font-extrabold text-white shadow-xl hover:brightness-110 transition-all hover:scale-105 cursor-pointer border border-[#ECF39E]/50"
              >
                <LogIn className="h-4 w-4 text-[#ECF39E]" />
                <span>Masuk ke Akun untuk Akses Dashboard</span>
              </button>
            )}
            <button
              onClick={() => handleEnterDashboard('pests')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#132A13]/80 border border-[#90A955]/50 px-6 py-3.5 text-xs sm:text-sm font-semibold text-[#ECF39E] hover:bg-[#31572C] transition-all cursor-pointer shadow-md"
            >
              <Activity className="h-4 w-4 text-[#ECF39E]" />
              <span>Analisis Populasi Hama PHT</span>
            </button>
          </div>
        </div>
      </section>

      {/* 10. MINIMALIST FOOTER */}
      <footer className="border-t border-[#D8E2DC] bg-[#FAFDF9] py-8 px-4 sm:px-6 lg:px-8 text-xs text-[#718096]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SystemLogo size="sm" showText={true} theme="light" />
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Wilayah Operasional: Subang, Jawa Barat</span>
            <span aria-hidden="true">·</span>
            <span>ESP32-S3 Firmware v2.3.1</span>
            <span aria-hidden="true">·</span>
            <span>Standar PHT Kementan RI</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
