import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  ShieldCheck,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Info,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { DEMO_USERS } from '../../data/mockData';
import { UserProfile } from '../../types';
import { SystemLogo } from '../common/SystemLogo';
import { getRoleMetadata } from '../../lib/permissions';

type AuthTab = 'login' | 'register' | 'demo';

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, setIsLoginModalOpen, login, signUp, loginAsDemo } = useDevice();
  const [activeTab, setActiveTab] = useState<AuthTab>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Status state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isLoginModalOpen) return null;

  const handleTabChange = (tab: AuthTab) => {
    setActiveTab(tab);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMsg('Alamat email dan kata sandi wajib diisi.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const res = await login(loginEmail.trim(), loginPassword);
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Gagal masuk. Periksa kembali email dan kata sandi Anda.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regEmail.trim() || !regPassword) {
      setErrorMsg('Semua kolom pendaftaran wajib diisi.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMsg('Kata sandi minimal harus terdiri dari 6 karakter.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    const res = await signUp(regEmail.trim(), regPassword, regFullName.trim());
    setIsLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Pendaftaran gagal dibuat.');
    } else {
      if (res.needsConfirmation) {
        setSuccessMsg(
          'Akun berhasil dibuat! Tautan verifikasi telah dikirim ke email Anda. Silakan periksa inbox email Anda atau konfirmasi pengguna melalui Supabase Dashboard (Authentication > Users) untuk mengaktifkan akun.'
        );
      } else {
        setSuccessMsg('Akun berhasil dibuat dan Anda telah berhasil masuk!');
      }
    }
  };

  const handleSelectDemo = (user: UserProfile) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    loginAsDemo(user);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fadeIn">
      {/* Modal Card */}
      <div
        className="relative w-full max-w-md rounded-2xl bg-white border-2 border-[#4F772D]/30 shadow-2xl overflow-hidden text-[#132A13] flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Dark Green Tone #132A13 / #31572C */}
        <div className="bg-gradient-to-r from-[#132A13] via-[#31572C] to-[#4F772D] p-5 sm:p-6 text-white relative shrink-0">
          <button
            onClick={() => setIsLoginModalOpen(false)}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <SystemLogo size="md" showText={false} theme="dark" />
            <div>
              <span className="text-[10px] font-semibold text-[#ECF39E] uppercase tracking-wider block">
                Autentikasi Terverifikasi Supabase
              </span>
              <h3 className="text-lg font-bold text-white leading-tight">
                Smart Light Trap Portal
              </h3>
            </div>
          </div>
          <p className="text-xs text-[#ECF39E]/90 mt-1">
            Wilayah Operasional: <span className="font-semibold text-white">Subang, Jawa Barat</span>.
          </p>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-2 gap-1 mt-4 p-1 rounded-xl bg-black/20 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-white text-[#132A13] shadow-xs'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('register')}
              className={`py-1.5 rounded-lg transition-all text-center cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-white text-[#132A13] shadow-xs'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Daftar Baru
            </button>

          </div>
        </div>

        {/* Content Body with scroll if necessary */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Error Message Box */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Success Message Box */}
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN (Supabase Auth) */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div className="text-xs text-[#52796F] mb-1">
                Masuk menggunakan kredensial akun Supabase Auth Anda untuk mengakses data sensor real-time:
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#132A13] mb-1">
                  Alamat Email Akun
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#90A955]" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="operator@smarttrap.id"
                    className="w-full rounded-xl border border-[#90A955]/40 bg-[#F6F9F5] py-2 pl-9 pr-3 text-xs text-[#132A13] placeholder-[#90A955]/60 focus:border-[#4F772D] focus:bg-white focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#132A13] mb-1">
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[#90A955]" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-[#90A955]/40 bg-[#F6F9F5] py-2 pl-9 pr-10 text-xs text-[#132A13] placeholder-[#90A955]/60 focus:border-[#4F772D] focus:bg-white focus:outline-hidden"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-2.5 text-[#90A955] hover:text-[#31572C] cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#31572C] via-[#4F772D] to-[#31572C] text-white text-xs font-bold shadow-md hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{isLoading ? 'Menghubungi Supabase Auth...' : 'Masuk ke Sistem Live'}</span>
                <ArrowRight className="h-4 w-4 text-[#ECF39E]" />
              </button>

              <div className="p-3 rounded-xl bg-[#F6F9F5] border border-[#90A955]/20 text-[11px] text-[#4F772D] flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 text-[#31572C] mt-0.5" />
                <span>
                  Belum punya akun terverifikasi? Klik tab <strong>Daftar Baru</strong> di atas atau gunakan <strong>Mode Simulasi</strong> untuk uji coba desain antarmuka.
                </span>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER (Supabase Auth SignUp) */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="p-3 rounded-xl bg-[#EAF4EE] border border-[#4F772D]/30 text-xs text-[#132A13]">
                <div className="font-bold flex items-center gap-1.5 text-[#31572C] mb-1">
                  <ShieldCheck className="h-4 w-4 text-[#4F772D]" />
                  <span>Kebijakan Keamanan Peran (Role-Based Access)</span>
                </div>
                <p className="text-[11px] text-[#52796F] leading-relaxed">
                  Pengguna baru otomatis terdaftar dengan peran dasar <strong>Viewer (Pengamat)</strong> sesuai prinsip Least Privilege. Role tidak dapat dinaikkan saat pendaftaran atau melalui request browser.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#132A13] mb-1">
                  Nama Lengkap Operator
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-[#90A955]" />
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Contoh: Rahmat Hidayat"
                    className="w-full rounded-xl border border-[#90A955]/40 bg-[#F6F9F5] py-2 pl-9 pr-3 text-xs text-[#132A13] placeholder-[#90A955]/60 focus:border-[#4F772D] focus:bg-white focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#132A13] mb-1">
                  Alamat Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#90A955]" />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="rahmat@smarttrap.id"
                    className="w-full rounded-xl border border-[#90A955]/40 bg-[#F6F9F5] py-2 pl-9 pr-3 text-xs text-[#132A13] placeholder-[#90A955]/60 focus:border-[#4F772D] focus:bg-white focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#132A13] mb-1">
                  Kata Sandi (Minimal 6 Karakter)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-[#90A955]" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-[#90A955]/40 bg-[#F6F9F5] py-2 pl-9 pr-10 text-xs text-[#132A13] placeholder-[#90A955]/60 focus:border-[#4F772D] focus:bg-white focus:outline-hidden"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-2.5 text-[#90A955] hover:text-[#31572C] cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#31572C] via-[#4F772D] to-[#31572C] text-white text-xs font-bold shadow-md hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{isLoading ? 'Mendaftarkan Akun ke Supabase...' : 'Daftarkan Akun Baru'}</span>
                <ArrowRight className="h-4 w-4 text-[#ECF39E]" />
              </button>
            </form>
          )}

          {/* TAB 3: SIMULATION DEMO (Preview UI Mock Only) */}
          {activeTab === 'demo' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1.5 text-amber-800 mb-1">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  <span>Mode Simulasi (Hanya Preview Desain)</span>
                </div>
                <p className="text-[11px] text-amber-800/90 leading-relaxed">
                  Data yang ditampilkan dalam mode ini adalah data tiruan (mock data) lokal untuk keperluan pengujian UI/UX dan alur navigasi. Mode ini <strong>TIDAK</strong> membaca data fisik dari database Supabase.
                </p>
              </div>

              <span className="block text-[11px] font-bold text-[#4F772D] uppercase tracking-wider">
                Pilih Persona Simulasi:
              </span>

              <div className="space-y-2">
                {DEMO_USERS.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectDemo(user)}
                    className="w-full p-3 rounded-xl border border-[#90A955]/30 bg-[#F6F9F5] hover:bg-white hover:border-[#4F772D] text-left flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-[#31572C] text-[#ECF39E] font-bold text-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        {user.avatarInitials}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-[#132A13] leading-tight truncate">
                          {user.name}
                        </div>
                        <div className="text-[10px] text-[#4F772D] truncate mt-0.5">
                          {getRoleMetadata(user.role).label} · {user.assignedRegion}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#31572C] bg-[#ECF39E]/40 px-2.5 py-1 rounded-md border border-[#90A955]/30 group-hover:bg-[#4F772D] group-hover:text-white transition-colors">
                      Mulai Simulasi
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quiet Footer */}
        <div className="p-3 bg-[#F6F9F5] border-t border-[#90A955]/20 text-center text-[10px] text-[#90A955] shrink-0">
          Smart Light Trap IoT v2.3.1 · Subang Agritech Node (PostgreSQL + RLS)
        </div>
      </div>
    </div>
  );
};
