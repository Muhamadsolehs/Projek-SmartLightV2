import React, { useState } from 'react';
import { X, Lock, Mail, ShieldCheck, Zap, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useDevice, DEMO_USERS } from '../../context/DeviceContext';
import { SystemLogo } from '../common/SystemLogo';

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, setIsLoginModalOpen, login } = useDevice();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isLoginModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Silakan masukkan alamat email akun Anda.');
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);

    try {
      await login(email.trim(), password);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
      setErrorMsg('Gagal melakukan login. Periksa kembali data akun Anda.');
    }
  };

  const handleSelectDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo12345');
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Modal Card */}
      <div
        className="relative w-full max-w-md rounded-2xl bg-white border-2 border-[#4F772D]/30 shadow-2xl overflow-hidden text-[#132A13]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Dark Green Tone #132A13 / #31572C */}
        <div className="bg-gradient-to-r from-[#132A13] via-[#31572C] to-[#4F772D] p-6 text-white relative">
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
              <span className="text-[11px] font-semibold text-[#ECF39E] uppercase tracking-wider block">
                Autentikasi Terverifikasi
              </span>
              <h3 className="text-lg font-bold text-white leading-tight">
                Smart Light Trap Portal
              </h3>
            </div>
          </div>
          <p className="text-xs text-[#ECF39E]/90 mt-1">
            Masuk untuk mengakses monitoring real-time, kontrol hardware ESP32-S3, dan analitik PHT Subang.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Select Demo Accounts */}
          <div>
            <span className="block text-[11px] font-bold text-[#4F772D] uppercase tracking-wider mb-2">
              Pilih Akun Demo Cepat:
            </span>
            <div className="space-y-1.5">
              {DEMO_USERS.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectDemo(user.email)}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    email === user.email
                      ? 'border-2 border-[#4F772D] bg-[#ECF39E]/20 shadow-xs'
                      : 'border-[#90A955]/30 bg-[#F6F9F5] hover:bg-white hover:border-[#4F772D]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-[#31572C] text-[#ECF39E] font-bold text-xs flex items-center justify-center shrink-0">
                      {user.avatarInitials}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-[#132A13] leading-tight truncate">
                        {user.name}
                      </div>
                      <div className="text-[10px] text-[#4F772D] truncate">
                        {user.role} · {user.assignedRegion}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[#90A955] shrink-0 font-medium ml-2">
                    Gunakan
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#90A955]/20 w-full" />
            <span className="bg-white px-3 text-[10px] font-semibold text-[#90A955] uppercase tracking-wider">
              atau ketik manual
            </span>
            <div className="border-t border-[#90A955]/20 w-full" />
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#132A13] mb-1">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-[#90A955]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@smarttrap.id"
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
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[#90A955]/40 bg-[#F6F9F5] py-2 pl-9 pr-10 text-xs text-[#132A13] placeholder-[#90A955]/60 focus:border-[#4F772D] focus:bg-white focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#90A955] hover:text-[#31572C]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-[#31572C] via-[#4F772D] to-[#31572C] text-white text-xs font-bold shadow-md hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isLoading ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
              <ArrowRight className="h-4 w-4 text-[#ECF39E]" />
            </button>
          </form>
        </div>

        {/* Quiet Footer */}
        <div className="p-3 bg-[#F6F9F5] border-t border-[#90A955]/20 text-center text-[10px] text-[#90A955]">
          Smart Light Trap IoT v2.3.1 · Subang Agritech Node
        </div>
      </div>
    </div>
  );
};
